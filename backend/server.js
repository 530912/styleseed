require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

const PORT = 3001;

app.use(cors());

app.use(
  express.json({
    limit: "50mb",
  }),
);

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

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent",
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
Analyze the main clothing item in this image.

Classify it using only the allowed values.

Return:
- category
- subCategory
- color
- colorTone
- fit
- material
- season
- tpo
- style

Rules:
- Analyze only the main clothing item.
- Use only allowed enum values.
- If material is uncertain, use "other".
- category and subCategory must logically match.
- season, tpo and style may contain multiple values.
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
              ],
            },
          },
        }),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API Error:", data);

      return res.status(500).json({
        message: "Gemini 분석 요청에 실패했습니다.",
      });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return res.status(500).json({
        message: "Gemini 분석 결과가 없습니다.",
      });
    }

    const result = JSON.parse(text);

    console.log("Gemini 분석 결과:", result);

    res.json(result);
  } catch (error) {
    console.error("Server Error:", error);

    res.status(500).json({
      message: "옷 분석 중 서버 오류가 발생했습니다.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`STYLESEED API running on http://localhost:${PORT}`);
});
