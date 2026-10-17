require("dotenv").config();

const express = require("express");
const cors = require("cors");

const sharp = require("sharp");

const { fal } = require("@fal-ai/client");

const app = express();

const PORT = 3001;

app.use(cors());

fal.config({
  credentials: process.env.FAL_KEY,
});

console.log("FAL key loaded:", Boolean(process.env.FAL_KEY));

app.use(
  express.json({
    limit: "50mb",
  }),
);

const buildFalImageInput = ({
  imageUrl,
  imageBase64,
  mimeType = "image/jpeg",
}) => {
  if (imageBase64) {
    if (imageBase64.startsWith("data:")) {
      return imageBase64;
    }

    return `data:${mimeType};base64,${imageBase64}`;
  }

  if (imageUrl) {
    return imageUrl;
  }

  throw new Error("imageUrl 또는 imageBase64가 필요합니다.");
};

const normalizeBoxPrompt = (box2d, imageWidth, imageHeight) => {
  if (!Array.isArray(box2d) || box2d.length !== 4) {
    throw new Error("box2d 형식이 올바르지 않습니다.");
  }

  if (!imageWidth || !imageHeight) {
    throw new Error("이미지 크기 정보가 필요합니다.");
  }

  // Gemini:
  // [ymin, xmin, ymax, xmax]
  // 모든 값은 0 ~ 1000
  const [yMinNormalized, xMinNormalized, yMaxNormalized, xMaxNormalized] =
    box2d.map(Number);

  const xMin = Math.round((xMinNormalized / 1000) * imageWidth);

  const yMin = Math.round((yMinNormalized / 1000) * imageHeight);

  const xMax = Math.round((xMaxNormalized / 1000) * imageWidth);

  const yMax = Math.round((yMaxNormalized / 1000) * imageHeight);

  return {
    x_min: Math.max(0, Math.min(imageWidth, xMin)),

    y_min: Math.max(0, Math.min(imageHeight, yMin)),

    x_max: Math.max(0, Math.min(imageWidth, xMax)),

    y_max: Math.max(0, Math.min(imageHeight, yMax)),
  };
};

let localSamPromise = null;

const getLocalSam = async () => {
  if (!localSamPromise) {
    localSamPromise = (async () => {
      const { SamModel, AutoProcessor, RawImage } =
        await import("@huggingface/transformers");

      console.log("Local SlimSAM 모델 로딩 시작...");

      const model = await SamModel.from_pretrained("Xenova/slimsam-77-uniform");

      const processor = await AutoProcessor.from_pretrained(
        "Xenova/slimsam-77-uniform",
      );

      console.log("Local SlimSAM 모델 로딩 완료");

      return {
        model,
        processor,
        RawImage,
      };
    })();
  }

  return localSamPromise;
};

// 무료 등급은 모델별로 하루 요청 한도(현재 20회)가 따로 잡힌다.
// 한 모델의 한도를 다 쓰면 .env에서 GEMINI_MODEL만 바꿔 다른 모델로 전환할 수 있다.
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

// 일부 모델(gemini-3.8-flash 등)은 "minimal"을 지원하지 않아 "low"가 필요하다.
const GEMINI_THINKING_LEVEL = process.env.GEMINI_THINKING_LEVEL || "minimal";

const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

console.log(
  `Gemini model: ${GEMINI_MODEL} (thinkingLevel: ${GEMINI_THINKING_LEVEL})`,
);

// Gemini 일시 오류 대응
// - 500/503/504 (혼잡·일시 장애): 잠시 기다렸다가 최대 2번 더 시도
// - 429 (요청 한도 초과): 재시도하면 한도만 더 소모하므로 바로 중단하고 대기 시간을 앱에 전달
const GEMINI_RETRY_DELAYS_MS = [2000, 4000];

const RETRYABLE_GEMINI_STATUSES = [500, 503, 504];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const readJsonSafely = async (response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

// Gemini 429 응답의 RetryInfo.retryDelay ("49s") → 49
const getGeminiRetryAfterSeconds = (data) => {
  const retryInfo = data?.error?.details?.find(
    (detail) => typeof detail?.retryDelay === "string",
  );

  const seconds = Number.parseFloat(retryInfo?.retryDelay ?? "");

  return Number.isFinite(seconds) ? Math.ceil(seconds) : null;
};

const fetchGeminiWithRetry = async (url, options) => {
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(url, options);

    const data = await readJsonSafely(response);

    const canRetry =
      RETRYABLE_GEMINI_STATUSES.includes(response.status) &&
      attempt < GEMINI_RETRY_DELAYS_MS.length;

    if (!canRetry) {
      return { response, data };
    }

    const delay = GEMINI_RETRY_DELAYS_MS[attempt];

    console.warn(
      `Gemini ${response.status} - ${delay}ms 후 재시도 (${attempt + 2}/${GEMINI_RETRY_DELAYS_MS.length + 1})`,
    );

    await wait(delay);
  }
};

app.get("/", (req, res) => {
  res.json({
    message: "STYLESEED API is running",
  });
});

app.post("/analyze-clothing", async (req, res) => {
  try {
    const { imageBase64 } = req.body;

    if (!imageBase64) {
      return res.status(400).json({
        message: "이미지 데이터가 없습니다.",
      });
    }

    const { response, data } = await fetchGeminiWithRetry(
      GEMINI_ENDPOINT,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",

          "x-goog-api-key": process.env.GEMINI_API_KEY,
        },

        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `
Analyze exactly ONE clothing item from this image.

The image may contain:
- a single clothing product
- a person wearing multiple garments
- a full outfit

Your task is to identify and analyze only ONE main clothing item.

Rules:
1. If multiple garments are visible, choose the most visually prominent garment.
2. Do not treat the entire outfit as one clothing item.
3. Ignore the person's face, body, hair, skin, background, and pose.
4. Focus only on the selected garment itself.
5. Prefer garments that occupy a large visible area and have clearly identifiable design details.
6. If an outerwear item such as a jacket or coat is clearly visible, prefer it over clothing mostly hidden underneath.
7. Do not mix attributes from different garments.

Examples:
- jacket + tshirt + pants → analyze the jacket if it is the most visually prominent garment
- tshirt + jeans → analyze whichever garment is more clearly visible and dominant
- coat over knit → analyze the coat
- product-only shirt image → analyze the shirt

Also locate the selected garment in the image.

Return "box_2d" as exactly four integers in this order:

[ymin, xmin, ymax, xmax]

All coordinates must be normalized from 0 to 1000.

The bounding box must:
- contain the entire visible selected garment
- be as tight as reasonably possible around that garment
- exclude the face, hair, hands, legs, bags, shoes, and other garments as much as possible
- describe only the same garment used for the clothing attributes

Also segment the exact selected garment.

Return "mask" as a polygon made of [x, y] coordinate points.

Mask rules:
- Each x and y value must be normalized from 0 to 1000.
- The mask coordinates are relative to the selected garment's box_2d.
- Trace only the visible fabric and shape of the selected garment.
- Exclude the person's face, hair, neck, skin, hands, legs and feet.
- Exclude bags, jewelry, hats and other accessories.
- Exclude inner garments that are visible underneath the selected garment.
- Do not include other clothing such as pants or shoes.
- The polygon should follow the garment silhouette as closely as possible.

Return the result using only the allowed values defined in the response schema.
`,
                },

                {
                  inlineData: {
                    mimeType: "image/jpeg",

                    data: imageBase64,
                  },
                },
              ],
            },
          ],

          generationConfig: {
            responseMimeType: "application/json",

            thinkingConfig: {
              thinkingLevel: GEMINI_THINKING_LEVEL,
            },

            responseSchema: {
              type: "object",

              properties: {
                category: {
                  type: "string",
                  enum: [
                    "top",
                    "bottom",
                    "outer",
                    "dress",
                    "shoes",
                    "bag",
                    "accessory",
                  ],
                },

                box_2d: {
                  type: "array",
                  items: {
                    type: "integer",
                  },
                },

                mask: {
                  type: "array",
                  items: {
                    type: "array",
                    items: {
                      type: "integer",
                    },
                  },
                },

                subCategory: {
                  type: "string",
                  enum: [
                    "tshirt",
                    "shirt",
                    "blouse",
                    "knit",
                    "sweatshirt",
                    "hoodie",
                    "sleeveless",

                    "jeans",
                    "slacks",
                    "trousers",
                    "shorts",
                    "skirt",
                    "leggings",

                    "jacket",
                    "coat",
                    "cardigan",
                    "blazer",
                    "padding",
                    "vest",

                    "mini-dress",
                    "midi-dress",
                    "maxi-dress",
                    "jumpsuit",

                    "sneakers",
                    "loafer",
                    "boots",
                    "heels",
                    "sandals",
                    "flats",

                    "shoulder-bag",
                    "crossbody-bag",
                    "tote-bag",
                    "backpack",
                    "clutch",

                    "hat",
                    "belt",
                    "scarf",
                    "necklace",
                    "bracelet",
                    "earrings",
                    "glasses",
                  ],
                },

                color: {
                  type: "string",
                  enum: [
                    "black",
                    "white",
                    "gray",
                    "beige",
                    "brown",
                    "navy",
                    "blue",
                    "red",
                    "pink",
                    "orange",
                    "yellow",
                    "green",
                    "purple",
                    "multi",
                  ],
                },

                colorTone: {
                  type: "string",
                  enum: ["bright", "light", "muted", "dark", "vivid"],
                },

                fit: {
                  type: "string",
                  enum: [
                    "slim",
                    "regular",
                    "relaxed",
                    "oversized",
                    "straight",
                    "wide",
                  ],
                },

                material: {
                  type: "string",
                  enum: [
                    "cotton",
                    "denim",
                    "leather",
                    "wool",
                    "linen",
                    "polyester",
                    "nylon",
                    "silk",
                    "knit",
                    "other",
                  ],
                },

                season: {
                  type: "array",
                  items: {
                    type: "string",
                    enum: ["spring", "summer", "fall", "winter"],
                  },
                },

                tpo: {
                  type: "array",
                  items: {
                    type: "string",
                    enum: [
                      "casual",
                      "office",
                      "date",
                      "formal",
                      "travel",
                      "party",
                    ],
                  },
                },

                style: {
                  type: "array",
                  items: {
                    type: "string",
                    enum: [
                      "minimal",
                      "classic",
                      "casual",
                      "street",
                      "sporty",
                      "feminine",
                      "vintage",
                    ],
                  },
                },
              },

              required: [
                "category",
                "subCategory",
                "color",
                "colorTone",
                "fit",
                "material",
                "season",
                "tpo",
                "style",
                "box_2d",
                "mask",
              ],
            },
          },
        }),
      },
    );

    if (!response.ok) {
      console.error("Gemini API Error:", JSON.stringify(data));

      if (response.status === 429) {
        return res.status(429).json({
          code: "AI_RATE_LIMITED",
          message: "AI 요청 한도에 도달했습니다. 잠시 후 다시 시도해주세요.",
          retryAfterSeconds: getGeminiRetryAfterSeconds(data),
        });
      }

      if (RETRYABLE_GEMINI_STATUSES.includes(response.status)) {
        return res.status(503).json({
          code: "AI_BUSY",
          message: "AI 서버가 혼잡합니다. 잠시 후 다시 시도해주세요.",
        });
      }

      return res.status(500).json({
        message: "Gemini 분석 요청에 실패했습니다.",
      });
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return res.status(500).json({
        message: "Gemini 분석 결과가 없습니다.",
      });
    }

    const result = JSON.parse(text);

    const clamp1000 = (value) => Math.max(0, Math.min(1000, Number(value)));

    const rawBox = result.box_2d;

    const box2d =
      Array.isArray(rawBox) && rawBox.length === 4
        ? rawBox.map(clamp1000)
        : [0, 0, 1000, 1000];

    const rawMask = result.mask;

    const mask = Array.isArray(rawMask)
      ? rawMask
          .filter((point) => Array.isArray(point) && point.length === 2)
          .map(([x, y]) => [clamp1000(x), clamp1000(y)])
      : [];

    const { box_2d, mask: ignoredMask, ...analysisResult } = result;

    const finalResult = {
      ...analysisResult,
      box2d,
      mask,
    };

    console.log("Gemini 분석 결과:", finalResult);

    res.json(finalResult);
  } catch (error) {
    console.error("Server Error:", error);

    res.status(500).json({
      message: "옷 분석 중 서버 오류가 발생했습니다.",
    });
  }
});

app.post("/segment-garment", async (req, res) => {
  try {
    const { imageUrl, imageBase64, mimeType, box2d, imageWidth, imageHeight } =
      req.body;

    const falImageInput = buildFalImageInput({
      imageUrl,
      imageBase64,
      mimeType,
    });

    const boxPrompt = normalizeBoxPrompt(box2d, imageWidth, imageHeight);

    const result = await fal.subscribe("fal-ai/sam2/image", {
      input: {
        image_url: falImageInput,
        box_prompts: [boxPrompt],
        apply_mask: true,
        output_format: "png",
      },
      logs: true,
    });

    const cutoutImageUrl = result?.data?.image?.url;

    if (!cutoutImageUrl) {
      throw new Error("분리된 이미지 URL을 받지 못했습니다.");
    }

    return res.json({
      success: true,
      cutoutImageUrl,
      boxPrompt,
    });
  } catch (error) {
    console.error("segment-garment error:", error);

    return res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "의류 분리에 실패했습니다.",
    });
  }
});

app.post("/segment-garment-local", async (req, res) => {
  try {
    const { imageUrl, box2d } = req.body;

    if (!imageUrl) {
      return res.status(400).json({
        message: "이미지 URL이 필요합니다.",
      });
    }

    if (!Array.isArray(box2d) || box2d.length !== 4) {
      return res.status(400).json({
        message: "box2d가 올바르지 않습니다.",
      });
    }

    const { model, processor, RawImage } = await getLocalSam();

    const image = await RawImage.read(imageUrl);

    const imageWidth = image.width;

    const imageHeight = image.height;

    // Gemini:
    // [ymin, xmin, ymax, xmax]
    // 0 ~ 1000
    const [yMinNormalized, xMinNormalized, yMaxNormalized, xMaxNormalized] =
      box2d.map(Number);

    const x1 = Math.round((xMinNormalized / 1000) * imageWidth);

    const y1 = Math.round((yMinNormalized / 1000) * imageHeight);

    const x2 = Math.round((xMaxNormalized / 1000) * imageWidth);

    const y2 = Math.round((yMaxNormalized / 1000) * imageHeight);

    // 옷 중심부 한 점도 같이 제공
    const centerX = Math.round((x1 + x2) / 2);

    const centerY = Math.round(y1 + (y2 - y1) * 0.55);

    const inputs = await processor(image, {
      input_boxes: [[[x1, y1, x2, y2]]],

      input_points: [[[centerX, centerY]]],

      input_labels: [[[1]]],
    });

    const outputs = await model(inputs);

    const masks = await processor.post_process_masks(
      outputs.pred_masks,
      inputs.original_sizes,
      inputs.reshaped_input_sizes,
    );

    const scores = outputs.iou_scores;

    const scoreValues = Array.from(scores.data);

    let bestIndex = 0;

    for (let i = 1; i < scoreValues.length; i += 1) {
      if (scoreValues[i] > scoreValues[bestIndex]) {
        bestIndex = i;
      }
    }

    const maskTensor = masks[0];

    const dims = maskTensor.dims;

    const maskHeight = dims[dims.length - 2];

    const maskWidth = dims[dims.length - 1];

    const pixelsPerMask = maskWidth * maskHeight;

    const offset = bestIndex * pixelsPerMask;

    const imageResponse = await fetch(imageUrl);

    if (!imageResponse.ok) {
      throw new Error("원본 이미지를 가져오지 못했습니다.");
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

    const { data: rgbaBuffer, info } = await sharp(imageBuffer)
      .resize(maskWidth, maskHeight)
      .ensureAlpha()
      .raw()
      .toBuffer({
        resolveWithObject: true,
      });

    for (let i = 0; i < pixelsPerMask; i += 1) {
      const isGarment = maskTensor.data[offset + i];

      rgbaBuffer[i * 4 + 3] = isGarment ? 255 : 0;
    }

    const cutoutBuffer = await sharp(rgbaBuffer, {
      raw: {
        width: info.width,
        height: info.height,
        channels: 4,
      },
    })
      .trim()
      .png()
      .toBuffer();

    res.set("Content-Type", "image/png");

    return res.send(cutoutBuffer);
  } catch (error) {
    console.error("Local SAM Error:", error);

    return res.status(500).json({
      message:
        error instanceof Error
          ? error.message
          : "로컬 의류 분리에 실패했습니다.",
    });
  }
});

app.post("/apply-garment-mask", async (req, res) => {
  try {
    const { imageUrl, box2d, mask } = req.body;

    if (
      !imageUrl ||
      !Array.isArray(box2d) ||
      box2d.length !== 4 ||
      !Array.isArray(mask) ||
      mask.length < 3
    ) {
      return res.status(400).json({
        message: "이미지 또는 의류 마스크 데이터가 올바르지 않습니다.",
      });
    }

    const imageResponse = await fetch(imageUrl);

    if (!imageResponse.ok) {
      throw new Error("원본 이미지를 불러오지 못했습니다.");
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

    const metadata = await sharp(imageBuffer).metadata();

    const imageWidth = metadata.width;

    const imageHeight = metadata.height;

    if (!imageWidth || !imageHeight) {
      throw new Error("이미지 크기를 확인하지 못했습니다.");
    }

    // Gemini box:
    // [ymin, xmin, ymax, xmax]
    const [yMinNormalized, xMinNormalized, yMaxNormalized, xMaxNormalized] =
      box2d.map(Number);

    const xMin = (xMinNormalized / 1000) * imageWidth;

    const yMin = (yMinNormalized / 1000) * imageHeight;

    const xMax = (xMaxNormalized / 1000) * imageWidth;

    const yMax = (yMaxNormalized / 1000) * imageHeight;

    const boxWidth = xMax - xMin;

    const boxHeight = yMax - yMin;

    // mask의 [x,y]는
    // box 내부의 0~1000 좌표
    const polygonPoints = mask.map(([x, y]) => {
      const pixelX = xMin + (Number(x) / 1000) * boxWidth;

      const pixelY = yMin + (Number(y) / 1000) * boxHeight;

      return `${pixelX},${pixelY}`;
    });

    const svgMask = `
        <svg
          width="${imageWidth}"
          height="${imageHeight}"
          xmlns="http://www.w3.org/2000/svg"
        >
          <polygon
            points="${polygonPoints.join(" ")}"
            fill="white"
          />
        </svg>
      `;

    const cutoutBuffer = await sharp(imageBuffer)
      .ensureAlpha()
      .composite([
        {
          input: Buffer.from(svgMask),
          blend: "dest-in",
        },
      ])
      .trim()
      .png()
      .toBuffer();

    res.set("Content-Type", "image/png");

    return res.send(cutoutBuffer);
  } catch (error) {
    console.error("Garment Mask Error:", error);

    return res.status(500).json({
      message: "의류 이미지 생성 중 오류가 발생했습니다.",
    });
  }
});

app.post("/remove-background", async (req, res) => {
  try {
    const { imageUrl } = req.body;

    if (!imageUrl) {
      return res.status(400).json({
        message: "이미지 URL이 필요합니다.",
      });
    }

    const response = await fetch(
      "https://engine.prod.bria-api.com/v2/image/edit/remove_background",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",

          api_token: process.env.BRIA_API_TOKEN,
        },

        body: JSON.stringify({
          image: imageUrl,

          sync: true,

          preserve_alpha: true,
        }),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("BRIA API Error:", data);

      return res.status(response.status).json({
        message: "배경 제거에 실패했습니다.",
      });
    }

    const cutoutUrl = data.result?.image_url;

    if (!cutoutUrl) {
      return res.status(500).json({
        message: "배경 제거 결과 이미지가 없습니다.",
      });
    }

    return res.json({
      cutoutUrl,
    });
  } catch (error) {
    console.error("Remove Background Error:", error);

    return res.status(500).json({
      message: "배경 제거 중 오류가 발생했습니다.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`STYLESEED API running on http://localhost:${PORT}`);
});
