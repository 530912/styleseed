require("dotenv").config();

const express = require("express");
const cors = require("cors");

const sharp = require("sharp");

const { fal } = require("@fal-ai/client");

const {
  createSupabaseTokenVerifier,
  createAuthenticate,
  createAllowAnalyze,
  requireUser,
} = require("./auth");

const { createFixedWindowCounter } = require("./guestLimiter");

const { createConcurrencyLimiter } = require("./concurrencyLimiter");

const { createAnalyzeQuota, createSupabaseQuotaStore } = require("./quota");

const { createResolveImagePath } = require("./storagePaths");

const { createUserSupabaseFactory } = require("./userSupabase");

const {
  inspectImageBase64,
  createDailyCap,
  logEvent,
  createErrorLogger,
} = require("./opsGuards");

const {
  QUALITY,
  toPixelBox,
  buildPromptPoints,
  buildCenterPoint,
  maskStats,
  selectBestMask,
  assessQuality,
  fillSmallHoles,
} = require("./cutout");

const app = express();

const PORT = Number(process.env.PORT) || 3001;

const readPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value ?? "", 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

// "false" / "0" / "off"만 끔으로 본다. 값이 없으면 fallback
const readFlag = (value, fallback) => {
  if (value === undefined || value === "") {
    return fallback;
  }

  return !["false", "0", "off", "no"].includes(String(value).toLowerCase());
};

// 프록시 헤더(X-Forwarded-For)는 기본으로 신뢰하지 않는다.
// 배포 시 리버스 프록시 뒤에 둘 때만 TRUST_PROXY에 프록시 단계 수(예: 1)를 지정한다.
const TRUST_PROXY = readPositiveInt(process.env.TRUST_PROXY, 0);

if (TRUST_PROXY > 0) {
  app.set("trust proxy", TRUST_PROXY);
}

// 웹 빌드의 Origin만 허용 목록으로 제한한다. 네이티브 앱은 Origin 헤더를 보내지 않는다.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "http://localhost:8081")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// 모바일 웹(2026-11): 웹 화면과 API를 한 도메인에 둘 때 API는 /api 아래로 받는다(카페24 Caddy).
// /api/x 와 /x 를 같은 경로로 처리해, Railway처럼 접두어 없이 배포해도 앱의 API 주소(…/api)를 그대로 쓸 수 있다
app.use((req, res, next) => {
  if (req.url === "/api" || req.url.startsWith("/api/") || req.url.startsWith("/api?")) {
    const rest = req.url.slice(4);

    req.url = rest.startsWith("/") ? rest : `/${rest}`;
  }

  next();
});

// 400 이상 응답을 한 줄 JSON으로 기록(R-9). 토큰·본문은 남기지 않는다
app.use(createErrorLogger());

app.use(
  cors({
    origin: (origin, callback) =>
      callback(null, !origin || ALLOWED_ORIGINS.includes(origin)),
  }),
);

fal.config({
  credentials: process.env.FAL_KEY,
});

console.log("FAL key loaded:", Boolean(process.env.FAL_KEY));

// 앱이 쓰지 않는 fal 경로(/segment-garment)는 FAL_KEY가 있을 때만 연다(R-4). 운영에는 FAL_KEY를 넣지 않는다
app.locals.falEnabled = Boolean(process.env.FAL_KEY);

const requireFalEnabled = (req, res, next) => {
  if (!app.locals.falEnabled) {
    return res.status(404).json({
      code: "FEATURE_DISABLED",
      message: "사용하지 않는 기능입니다.",
    });
  }

  return next();
};

// 요청 본문 크기 제한
// - 분석: 앱이 원본 사진을 base64로 보낸다(upload.tsx quality 0.7)
// - 이미지 처리: Storage 경로와 좌표만 보낸다
const ANALYZE_BODY_LIMIT = process.env.ANALYZE_BODY_LIMIT || "10mb";

const IMAGE_TASK_BODY_LIMIT = process.env.IMAGE_TASK_BODY_LIMIT || "1mb";

const parseAnalyzeBody = express.json({ limit: ANALYZE_BODY_LIMIT });

const parseImageTaskBody = express.json({ limit: IMAGE_TASK_BODY_LIMIT });

// 외부 호출 타임아웃
const GEMINI_TIMEOUT_MS = readPositiveInt(process.env.GEMINI_TIMEOUT_MS, 25000);

const BRIA_TIMEOUT_MS = readPositiveInt(process.env.BRIA_TIMEOUT_MS, 45000);

const IMAGE_DOWNLOAD_TIMEOUT_MS = readPositiveInt(
  process.env.IMAGE_DOWNLOAD_TIMEOUT_MS,
  15000,
);

// Supabase 연결 (server.js와 같은 .env의 공개 Supabase URL·Publishable key 사용, Secret 불필요)
const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;

const SUPABASE_PUBLISHABLE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// 로그인·익명 토큰 검증
app.locals.verifyToken = createSupabaseTokenVerifier({
  url: SUPABASE_URL,
  publishableKey: SUPABASE_PUBLISHABLE_KEY,
});

// 요청한 사용자 본인 권한의 Supabase 클라이언트(사용량 기록, Storage 서명)
app.locals.getUserClient = createUserSupabaseFactory({
  url: SUPABASE_URL,
  publishableKey: SUPABASE_PUBLISHABLE_KEY,
});

const authenticate = createAuthenticate({
  getVerifier: () => app.locals.verifyToken,
});

// 토큰 없는 guest 분석: 임시 호환 모드(PRD SEC-01과 다름). 익명 세션이 안정화되면 false로 끈다
app.locals.allowTokenlessGuest = readFlag(
  process.env.ALLOW_TOKENLESS_GUEST,
  true,
);

const allowAnalyze = createAllowAnalyze({
  isTokenlessGuestAllowed: () => app.locals.allowTokenlessGuest,
});

// AI 분석 한도 (개발·QA 초기 가설, 운영은 환경변수로 따로 지정)
app.locals.analyzeLimits = {
  anonymousLimit: readPositiveInt(process.env.ANON_ANALYZE_LIMIT_PER_HOUR, 30),
  userLimit: readPositiveInt(process.env.USER_ANALYZE_LIMIT_PER_HOUR, 30),
  ipLimit: readPositiveInt(process.env.IP_ANALYZE_LIMIT_PER_HOUR, 30),
  guestLimit: readPositiveInt(process.env.GUEST_ANALYZE_LIMIT_PER_HOUR, 10),
};

app.locals.quotaStore = createSupabaseQuotaStore({
  getUserClient: (token) => app.locals.getUserClient(token),
});

const quotaCounters = {
  ipCounter: createFixedWindowCounter(),
  guestCounter: createFixedWindowCounter(),
  fallbackCounter: createFixedWindowCounter(),
};

app.locals.resetQuotaCounters = () => {
  for (const counter of Object.values(quotaCounters)) {
    counter.reset();
  }
};

const analyzeQuota = createAnalyzeQuota({
  getConfig: () => app.locals.analyzeLimits,
  getStore: () => app.locals.quotaStore,
  ...quotaCounters,
});

// 이미지 처리 입력: Storage 경로 → 서버가 서명 URL 생성(요청 본문의 URL은 쓰지 않음)
const resolveImagePath = createResolveImagePath({
  getUserClient: (token) => app.locals.getUserClient(token),
  getSupabaseUrl: () => SUPABASE_URL,
});

// 이미지 처리 한도 (Claude B 점검 S-2): 사용자별 시간당 횟수. 이미지 처리 4경로를 합쳐 센다.
// 옷 1벌 저장은 보통 1~2회(SlimSAM, 실패 시 BRIA)라 일반 사용에는 닿지 않는다.
app.locals.imageTaskLimit = readPositiveInt(
  process.env.IMAGE_TASK_LIMIT_PER_HOUR,
  60,
);

const imageTaskCounter = createFixedWindowCounter();

app.locals.resetImageTaskCounter = () => imageTaskCounter.reset();

const limitImageTasks = (req, res, next) => {
  const result = imageTaskCounter.hit(
    req.auth.userId,
    app.locals.imageTaskLimit,
  );

  if (!result.allowed) {
    res.set("Retry-After", String(result.retryAfterSeconds));

    return res.status(429).json({
      code: "IMAGE_TASK_RATE_LIMITED",
      message: "이미지 처리 요청이 너무 많아요. 잠시 후 다시 시도해주세요.",
      retryAfterSeconds: result.retryAfterSeconds,
    });
  }

  return next();
};

// 이미지 처리 경로: 정식 로그인 사용자만 → 사용자별 한도 → 본문 파싱 → 경로 검사·서명
const imageTaskGuards = [
  authenticate,
  requireUser,
  limitImageTasks,
  parseImageTaskBody,
  resolveImagePath,
];

// SlimSAM 동시 처리 1건 + 대기열 (R1-02-01 H-1). 앱 제한 시간(90초) 안에 끝나도록 대기는 45초까지
app.locals.slimSamLimiter = createConcurrencyLimiter({
  concurrency: readPositiveInt(process.env.SLIMSAM_CONCURRENCY, 1),
  maxQueue: readPositiveInt(process.env.SLIMSAM_MAX_QUEUE, 4),
  maxWaitMs: readPositiveInt(process.env.SLIMSAM_QUEUE_WAIT_MS, 45_000),
});

const holdSlimSamSlot = async (req, res, next) => {
  let release;

  try {
    release = await app.locals.slimSamLimiter.acquire();
  } catch (error) {
    // 앱은 이 실패를 받으면 BRIA 대체 경로로 넘어간다
    console.warn("SlimSAM 대기열 거절:", error.reason ?? error.message);

    res.set("Retry-After", "10");

    return res.status(503).json({
      code: "CUTOUT_BUSY",
      message: "지금 이미지 처리 요청이 많아요. 잠시 후 다시 시도해주세요.",
    });
  }

  // 기다리는 동안 앱이 연결을 끊었으면 처리하지 않는다
  if (res.writableEnded || req.socket.destroyed) {
    release();

    return;
  }

  res.on("finish", release);
  res.on("close", release);

  return next();
};

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

// /healthz에 요청 모델과 실제 응답 모델(modelVersion)을 함께 보여준다(R-3).
// 요청한 이름과 응답 모델이 다를 수 있다(2026-10-26: gemini-3.5-flash 요청 → 3.6-flash 응답)
app.locals.gemini = { model: GEMINI_MODEL, lastServedModel: null };

// 서버 전체 Gemini 일일 상한(한국 시간 자정 초기화). 0 또는 비우면 끔
app.locals.geminiDailyLimit = Number.parseInt(process.env.GEMINI_DAILY_LIMIT ?? "", 10) || 0;

app.locals.geminiDailyCap = createDailyCap();

// Gemini 다각형 mask 요청 여부 (Sprint 1A-3)
// 앱은 이 값을 쓰지 않는다(배경 제거는 SlimSAM/BRIA). 출력 토큰의 큰 부분을 차지하므로 기본으로 요청하지 않는다.
// 필요하면 GEMINI_REQUEST_MASK=true로 되돌린다. 응답에는 형식 유지를 위해 항상 mask 필드(빈 배열 가능)를 둔다.
const GEMINI_REQUEST_MASK = ["true", "1", "on", "yes"].includes(
  String(process.env.GEMINI_REQUEST_MASK ?? "").toLowerCase(),
);

const GEMINI_MASK_INSTRUCTIONS = GEMINI_REQUEST_MASK
  ? `  Also segment the exact selected garment.

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

`
  : "";

const GEMINI_MASK_SCHEMA = GEMINI_REQUEST_MASK
  ? {
      mask: {
        type: "array",
        items: { type: "array", items: { type: "integer" } },
      },
    }
  : {};

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

class UpstreamTimeoutError extends Error {
  constructor(service) {
    super(`${service} 응답 시간이 초과되었습니다.`);

    this.name = "UpstreamTimeoutError";
  }
}

const isAbortTimeout = (error) =>
  error?.name === "TimeoutError" || error?.name === "AbortError";

// 외부 이미지·API 호출에 타임아웃을 건다
const fetchWithTimeout = async (url, options, timeoutMs, service) => {
  try {
    return await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (isAbortTimeout(error)) {
      throw new UpstreamTimeoutError(service);
    }

    throw error;
  }
};

// 이미지 처리 경로의 외부 호출 타임아웃은 504로 알린다
const sendUpstreamTimeout = (res) =>
  res.status(504).json({
    code: "UPSTREAM_TIMEOUT",
    message: "이미지 처리 응답이 늦어지고 있습니다. 잠시 후 다시 시도해주세요.",
  });

// 재시도를 포함한 전체 대기 시간이 GEMINI_TIMEOUT_MS를 넘지 않게 한다
const fetchGeminiWithRetry = async (url, options) => {
  const deadline = Date.now() + GEMINI_TIMEOUT_MS;

  for (let attempt = 0; ; attempt += 1) {
    const remainingMs = deadline - Date.now();

    if (remainingMs <= 0) {
      throw new UpstreamTimeoutError("Gemini");
    }

    const response = await fetchWithTimeout(url, options, remainingMs, "Gemini");

    const data = await readJsonSafely(response);

    const canRetry =
      RETRYABLE_GEMINI_STATUSES.includes(response.status) &&
      attempt < GEMINI_RETRY_DELAYS_MS.length;

    if (!canRetry) {
      return { response, data };
    }

    const delay = GEMINI_RETRY_DELAYS_MS[attempt];

    // 기다린 뒤 재시도할 시간이 남지 않으면 지금 받은 응답을 돌려준다
    if (Date.now() + delay >= deadline) {
      return { response, data };
    }

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

// 분석: 정식·익명 사용자 허용(사용량 한도), 토큰 없는 guest는 임시 호환 모드에서만, 무효 토큰은 401
app.post(
  "/analyze-clothing",
  authenticate,
  allowAnalyze,
  analyzeQuota,
  parseAnalyzeBody,
  async (req, res) => {
    try {
      const { imageBase64 } = req.body;

      if (!imageBase64) {
        return res.status(400).json({
          message: "이미지 데이터가 없습니다.",
        });
      }

      // 이미지가 아니면 Gemini를 부르지 않는다(R-8)
      const image = inspectImageBase64(imageBase64);

      if (!image.ok) {
        return res.status(400).json({
          code: "INVALID_IMAGE",
          message: "이미지 형식을 확인하지 못했어요. 다른 사진으로 다시 시도해주세요.",
          reason: image.reason,
        });
      }

      const dailyCap = app.locals.geminiDailyCap.take(app.locals.geminiDailyLimit);

      if (!dailyCap.allowed) {
        logEvent("gemini_daily_cap", { limit: app.locals.geminiDailyLimit });

        // 앱은 AI_RATE_LIMITED를 이미 안내하므로 같은 코드를 쓴다
        return res.status(429).json({
          code: "AI_RATE_LIMITED",
          message: "오늘 AI 분석 한도에 도달했습니다. 내일 다시 시도해주세요.",
          retryAfterSeconds: dailyCap.retryAfterSeconds,
        });
      }

      const geminiStartedAt = Date.now();

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

${GEMINI_MASK_INSTRUCTIONS}  Return the result using only the allowed values defined in the response schema.
  `,
                  },

                  {
                    inlineData: {
                      mimeType: image.mimeType,

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

                  ...GEMINI_MASK_SCHEMA,

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
                  ...(GEMINI_REQUEST_MASK ? ["mask"] : []),
                ],
              },
            },
          }),
        },
      );

      // 호출 1건 = 한 줄(R-3·R-9): 요청·응답 모델, 상태, 토큰. 매일 비용·오류 집계용
      const usage = data?.usageMetadata ?? {};

      const servedModel = data?.modelVersion ?? null;

      if (servedModel) {
        app.locals.gemini.lastServedModel = servedModel;
      }

      logEvent("gemini_call", {
        model: GEMINI_MODEL,
        servedModel,
        modelMismatch: Boolean(servedModel) && servedModel !== GEMINI_MODEL,
        status: response.status,
        ms: Date.now() - geminiStartedAt,
        mask: GEMINI_REQUEST_MASK,
        prompt: usage.promptTokenCount ?? null,
        output: usage.candidatesTokenCount ?? null,
        thoughts: usage.thoughtsTokenCount ?? 0,
        total: usage.totalTokenCount ?? null,
        dailyCount: dailyCap.count,
      });

      if (!response.ok) {
        console.error("Gemini API Error:", JSON.stringify(data));

        if (response.status === 429) {
          return res.status(429).json({
            code: "AI_RATE_LIMITED",
            message: "AI 요청 한도에 도달했습니다. 잠시 후 다시 시도해주세요.",
            retryAfterSeconds: getGeminiRetryAfterSeconds(data),
          });
        }

        // 402: Gemini 선불 크레딧 소진(모든 키가 멈춤). 운영자가 로그에서 바로 구분하도록 별도 코드.
        // 앱은 503을 "AI 혼잡"으로 안내한다(앱 변경 없음)
        if (response.status === 402) {
          logEvent("gemini_credit_exhausted", { model: GEMINI_MODEL });

          return res.status(503).json({
            code: "AI_CREDIT_EXHAUSTED",
            message: "AI 분석을 잠시 사용할 수 없어요. 잠시 후 다시 시도해주세요.",
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

      // 토큰 사용량은 위 gemini_call 로그에 함께 남긴다(Sprint 1A-3의 "Gemini 사용량:" 줄을 대체)
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
      if (error instanceof UpstreamTimeoutError) {
        console.error("Gemini 응답 시간 초과");

        // 시간 초과도 호출 1건으로 집계한다(응답이 없어 토큰·응답 모델은 모름)
        logEvent("gemini_call", {
          model: GEMINI_MODEL,
          servedModel: null,
          modelMismatch: false,
          status: "timeout",
          timeoutMs: GEMINI_TIMEOUT_MS,
        });

        return res.status(504).json({
          code: "AI_TIMEOUT",
          message: "AI 응답이 늦어지고 있습니다. 잠시 후 다시 시도해주세요.",
        });
      }

      console.error("Server Error:", error);

      res.status(500).json({
        message: "옷 분석 중 서버 오류가 발생했습니다.",
      });
    }
  },
);

app.post("/segment-garment", ...imageTaskGuards, requireFalEnabled, async (req, res) => {
  try {
    // 이미지는 서버가 만든 서명 URL만 쓴다(resolveImagePath)
    const imageUrl = req.imageUrl;

    const { box2d, imageWidth, imageHeight } = req.body;

    const falImageInput = buildFalImageInput({ imageUrl });

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

    // 내부 오류 문구는 로그에만 남긴다 (Claude B 점검 S-7)
    return res.status(500).json({
      success: false,
      message: "의류 분리에 실패했습니다.",
    });
  }
});

const slimSamGuards = [...imageTaskGuards, holdSlimSamSlot];

app.post("/segment-garment-local", ...slimSamGuards, async (req, res) => {
  try {
    // 이미지는 서버가 만든 서명 URL만 쓴다(resolveImagePath)
    const imageUrl = req.imageUrl;

    const { box2d } = req.body;

    if (!Array.isArray(box2d) || box2d.length !== 4) {
      return res.status(400).json({
        message: "box2d가 올바르지 않습니다.",
      });
    }

    const { model, processor, RawImage } = await getLocalSam();

    // 이미지를 한 번만 내려받고(타임아웃 적용), EXIF 방향을 반영한 픽셀로 분리한다.
    // Gemini 상자는 화면에 보이는 방향 기준이므로 회전 전 픽셀을 쓰면 위치가 어긋난다.
    const imageResponse = await fetchWithTimeout(
      imageUrl,
      {},
      IMAGE_DOWNLOAD_TIMEOUT_MS,
      "이미지 다운로드",
    );

    if (!imageResponse.ok) {
      throw new Error("원본 이미지를 가져오지 못했습니다.");
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

    const { data: rgb, info: rgbInfo } = await sharp(imageBuffer)
      .rotate()
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const imageWidth = rgbInfo.width;

    const imageHeight = rgbInfo.height;

    const image = new RawImage(
      new Uint8ClampedArray(rgb.buffer, rgb.byteOffset, rgb.length),
      imageWidth,
      imageHeight,
      3,
    );

    const box = toPixelBox(box2d, imageWidth, imageHeight);

    // 후보 마스크 3개를 만들고 상자 기준 통계를 붙인다
    const segment = async ({ points, labels }) => {
      const inputs = await processor(image, {
        input_points: [[points]],
        input_labels: [[labels]],
      });

      const outputs = await model(inputs);

      const masks = await processor.post_process_masks(
        outputs.pred_masks,
        inputs.original_sizes,
        inputs.reshaped_input_sizes,
      );

      const maskTensor = masks[0];

      const maskHeight = maskTensor.dims[maskTensor.dims.length - 2];

      const maskWidth = maskTensor.dims[maskTensor.dims.length - 1];

      const perMask = maskWidth * maskHeight;

      return Array.from(outputs.iou_scores.data).map((iou, index) => {
        const data = maskTensor.data.subarray(index * perMask, (index + 1) * perMask);

        return { iou, data, maskWidth, maskHeight, ...maskStats(data, maskWidth, maskHeight, box) };
      });
    };

    // 1차: 상자 안 양성 점 5개, 2차(기준 미달 시): 예전 중심점 1개
    let strategy = "multi_point";

    let best = selectBestMask(await segment(buildPromptPoints(box)));

    if (!assessQuality(best).ok) {
      const retry = selectBestMask(await segment(buildCenterPoint(box)));

      if (assessQuality(retry).ok) {
        best = retry;
        strategy = "center_point";
      }
    }

    const quality = assessQuality(best);

    const metrics = {
      strategy,
      boxFill: Number(best.boxFill.toFixed(3)),
      outside: Number(best.outside.toFixed(3)),
    };

    if (!quality.ok) {
      // 분리 결과가 옷 일부·배경이면 저장하지 않고 앱이 BRIA 대체 경로로 넘어가게 한다
      console.warn("SlimSAM 결과 품질 미달:", quality.reason, JSON.stringify(metrics));

      return res.status(422).json({
        code: "LOW_QUALITY_CUTOUT",
        message: "의류 분리 결과가 기준에 미달했습니다.",
        reason: quality.reason,
        metrics,
      });
    }

    // 단추·자수 사이 같은 작은 구멍을 메운다(큰 틈은 유지)
    const { mask, filledHoles } = fillSmallHoles(
      best.data,
      best.maskWidth,
      best.maskHeight,
      Math.round(best.maskWidth * best.maskHeight * QUALITY.maxHoleFraction),
    );

    const pixels = best.maskWidth * best.maskHeight;

    const rgba = Buffer.alloc(pixels * 4);

    for (let i = 0; i < pixels; i += 1) {
      rgba[i * 4] = rgb[i * 3];
      rgba[i * 4 + 1] = rgb[i * 3 + 1];
      rgba[i * 4 + 2] = rgb[i * 3 + 2];
      rgba[i * 4 + 3] = mask[i] ? 255 : 0;
    }

    const cutoutBuffer = await sharp(rgba, {
      raw: {
        width: best.maskWidth,
        height: best.maskHeight,
        channels: 4,
      },
    })
      .trim()
      .png()
      .toBuffer();

    console.log("SlimSAM 분리:", JSON.stringify({ ...metrics, filledHoles }));

    res.set("Content-Type", "image/png");
    res.set("X-Cutout-Strategy", strategy);
    res.set("X-Cutout-Box-Fill", String(metrics.boxFill));
    res.set("X-Cutout-Outside", String(metrics.outside));
    res.set("X-Cutout-Holes-Filled", String(filledHoles));

    return res.send(cutoutBuffer);
  } catch (error) {
    if (error instanceof UpstreamTimeoutError) {
      return sendUpstreamTimeout(res);
    }

    console.error("Local SAM Error:", error);

    // 내부 오류 문구는 로그에만 남긴다 (Claude B 점검 S-7)
    return res.status(500).json({
      message: "로컬 의류 분리에 실패했습니다.",
    });
  }
});

app.post("/apply-garment-mask", ...imageTaskGuards, async (req, res) => {
  try {
    // 이미지는 서버가 만든 서명 URL만 쓴다(resolveImagePath)
    const imageUrl = req.imageUrl;

    const { box2d, mask } = req.body;

    if (
      !Array.isArray(box2d) ||
      box2d.length !== 4 ||
      !Array.isArray(mask) ||
      mask.length < 3
    ) {
      return res.status(400).json({
        message: "이미지 또는 의류 마스크 데이터가 올바르지 않습니다.",
      });
    }

    const imageResponse = await fetchWithTimeout(
      imageUrl,
      {},
      IMAGE_DOWNLOAD_TIMEOUT_MS,
      "이미지 다운로드",
    );

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
    if (error instanceof UpstreamTimeoutError) {
      return sendUpstreamTimeout(res);
    }

    console.error("Garment Mask Error:", error);

    return res.status(500).json({
      message: "의류 이미지 생성 중 오류가 발생했습니다.",
    });
  }
});

app.post("/remove-background", ...imageTaskGuards, async (req, res) => {
  try {
    // 이미지는 서버가 만든 서명 URL만 쓴다(resolveImagePath)
    const imageUrl = req.imageUrl;

    const response = await fetchWithTimeout(
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
      BRIA_TIMEOUT_MS,
      "BRIA",
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("BRIA API Error:", response.status, data);

      // BRIA의 401·429 등을 그대로 넘기면 앱이 STYLESEED 인증·한도 오류로 오해하므로 502로 감싼다
      return res.status(502).json({
        code: "UPSTREAM_FAILED",
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
    if (error instanceof UpstreamTimeoutError) {
      return sendUpstreamTimeout(res);
    }

    console.error("Remove Background Error:", error);

    return res.status(500).json({
      message: "배경 제거 중 오류가 발생했습니다.",
    });
  }
});

// 출시 준비 라우트: 헬스 체크, 계정 삭제(앱·웹). 내용은 backend/accountRoutes.js
require("./accountRoutes").registerAccountRoutes(app, {
  authenticate,
  requireUser,
  supabaseUrl: SUPABASE_URL,
  publishableKey: SUPABASE_PUBLISHABLE_KEY,
});

// 본문 파싱 오류를 JSON으로 응답한다(라우트 뒤에 등록해야 한다)
app.use((error, req, res, next) => {
  if (error?.type === "entity.too.large") {
    return res.status(413).json({
      code: "PAYLOAD_TOO_LARGE",
      message: "요청한 이미지 용량이 너무 큽니다.",
    });
  }

  if (error?.type === "entity.parse.failed") {
    return res.status(400).json({
      code: "INVALID_JSON",
      message: "요청 형식이 올바르지 않습니다.",
    });
  }

  // 그 밖의 처리되지 않은 오류도 HTML 대신 JSON으로 응답한다(내부 문구는 로그에만)
  if (res.headersSent) {
    return next(error);
  }

  logEvent("unhandled_error", {
    method: req.method,
    path: req.path,
    name: error?.name ?? null,
    message: error?.message ?? String(error),
  });

  return res.status(500).json({
    code: "SERVER_ERROR",
    message: "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
  });
});

// 등록되지 않은 경로는 JSON 404
app.use((req, res) => {
  res.status(404).json({
    code: "NOT_FOUND",
    message: "요청한 주소를 찾을 수 없습니다.",
  });
});

module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`STYLESEED API running on http://localhost:${PORT}`);
  });
}
