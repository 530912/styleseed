// Sprint 1A-1: 본문 크기·타임아웃·Gemini 응답 처리 (TS-08, TS-09, TS-10, 분석 회귀)
process.env.SUPABASE_URL = "https://test-project.supabase.co";
process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
process.env.GEMINI_TIMEOUT_MS = "400";
process.env.GUEST_ANALYZE_LIMIT_PER_HOUR = "100";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createFakeQuotaStore,
  fakeUserClientFactory,
  realFetch,
  startServer,
  stopServer,
  fakeVerifyToken,
  post,
} = require("./helpers");

const app = require("../server");

// Gemini 호출만 가로채고, 테스트 서버로 가는 요청은 실제 fetch를 쓴다
let geminiBehavior = null;

let geminiCalls = 0;

let lastGeminiBody = null;

globalThis.fetch = async (url, options) => {
  if (String(url).includes("generativelanguage.googleapis.com")) {
    geminiCalls += 1;

    lastGeminiBody = JSON.parse(options.body);

    return geminiBehavior(options);
  }

  return realFetch(url, options);
};

const jsonResponse = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// signal이 중단될 때까지 응답하지 않는 Gemini
const hangingGemini = (options) =>
  new Promise((_, reject) => {
    options.signal.addEventListener("abort", () => {
      reject(options.signal.reason);
    });
  });

const geminiSuccess = () =>
  jsonResponse(200, {
    candidates: [
      {
        content: {
          parts: [
            {
              text: JSON.stringify({
                category: "top",
                subCategory: "shirt",
                color: "white",
                colorTone: "neutral",
                fit: "regular",
                material: "cotton",
                season: ["spring"],
                tpo: ["daily"],
                style: ["minimal"],
                box_2d: [100, 200, 1200, 800],
                mask: [[10, 20], [1500, 30], [5]],
              }),
            },
          ],
        },
      },
    ],
  });

let server;
let baseUrl;

test.before(async () => {
  app.locals.verifyToken = fakeVerifyToken;
  app.locals.quotaStore = createFakeQuotaStore();
  app.locals.getUserClient = fakeUserClientFactory;

  ({ server, baseUrl } = await startServer(app));
});

test.after(async () => {
  await stopServer(server);
});

test.beforeEach(() => {
  geminiCalls = 0;
  app.locals.resetQuotaCounters();
});

test("TS-08 10MB를 넘는 분석 요청은 413 PAYLOAD_TOO_LARGE(JSON)", async () => {
  const response = await post(baseUrl, "/analyze-clothing", {
    body: { imageBase64: "a".repeat(11 * 1024 * 1024) },
  });

  assert.equal(response.status, 413);
  assert.equal((await response.json()).code, "PAYLOAD_TOO_LARGE");
  assert.equal(geminiCalls, 0);
});

test("TS-08b 10MB 이하 분석 요청은 크기 제한에 걸리지 않는다", async () => {
  geminiBehavior = geminiSuccess;

  const response = await post(baseUrl, "/analyze-clothing", {
    body: { imageBase64: "a".repeat(8 * 1024 * 1024) },
  });

  assert.equal(response.status, 200);
});

test("TS-09 이미지 처리 경로의 1MB 초과 본문은 413", async () => {
  const response = await post(baseUrl, "/apply-garment-mask", {
    token: "valid-user-token",
    body: { imageUrl: "x".repeat(1.2 * 1024 * 1024) },
  });

  assert.equal(response.status, 413);
  assert.equal((await response.json()).code, "PAYLOAD_TOO_LARGE");
});

test("TS-09b 토큰 없는 대용량 이미지 처리 요청은 본문을 읽기 전에 401", async () => {
  const response = await post(baseUrl, "/apply-garment-mask", {
    body: { imageUrl: "x".repeat(1.2 * 1024 * 1024) },
  });

  assert.equal(response.status, 401);
});

test("TS-09c 잘못된 JSON은 400 INVALID_JSON", async () => {
  const response = await post(baseUrl, "/analyze-clothing", {
    rawBody: "{not json",
  });

  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, "INVALID_JSON");
});

test("TS-10 Gemini가 응답하지 않으면 제한 시간 안에 504 AI_TIMEOUT", async () => {
  geminiBehavior = hangingGemini;

  const startedAt = Date.now();

  const response = await post(baseUrl, "/analyze-clothing", {
    body: { imageBase64: "abc" },
  });

  const elapsed = Date.now() - startedAt;

  assert.equal(response.status, 504);
  assert.equal((await response.json()).code, "AI_TIMEOUT");
  assert.ok(elapsed < 2000, `elapsed ${elapsed}ms`);
});

test("TS-10b 503이 계속되면 남은 시간 안에서만 재시도하고 AI_BUSY로 응답", async () => {
  geminiBehavior = () => jsonResponse(503, { error: { message: "busy" } });

  const response = await post(baseUrl, "/analyze-clothing", {
    body: { imageBase64: "abc" },
  });

  // GEMINI_TIMEOUT_MS(400ms)가 첫 재시도 대기(2초)보다 짧으므로 재시도 없이 응답
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "AI_BUSY");
  assert.equal(geminiCalls, 1);
});

test("회귀: Gemini 429는 기존처럼 429 AI_RATE_LIMITED + retryAfterSeconds", async () => {
  geminiBehavior = () =>
    jsonResponse(429, {
      error: {
        details: [{ "@type": "RetryInfo", retryDelay: "49s" }],
      },
    });

  const response = await post(baseUrl, "/analyze-clothing", {
    body: { imageBase64: "abc" },
  });

  const body = await response.json();

  assert.equal(response.status, 429);
  assert.equal(body.code, "AI_RATE_LIMITED");
  assert.equal(body.retryAfterSeconds, 49);
});

test("회귀: 정상 분석 응답은 기존 형식(box2d 보정, mask 필터)을 유지", async () => {
  geminiBehavior = geminiSuccess;

  const response = await post(baseUrl, "/analyze-clothing", {
    body: { imageBase64: "abc" },
  });

  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.category, "top");
  assert.deepEqual(body.box2d, [100, 200, 1000, 800]);
  assert.deepEqual(body.mask, [
    [10, 20],
    [1000, 30],
  ]);
  assert.equal(body.box_2d, undefined);
});

test("Sprint 1A-3: 기본 설정에서는 Gemini에 mask를 요청하지 않고, 응답 형식은 mask: [] 유지", async () => {
  geminiBehavior = () =>
    jsonResponse(200, {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  category: "top", subCategory: "shirt", color: "white", colorTone: "neutral",
                  fit: "regular", material: "cotton", season: ["spring"], tpo: ["daily"], style: ["minimal"],
                  box_2d: [100, 200, 900, 800],
                }),
              },
            ],
          },
        },
      ],
    });

  const response = await post(baseUrl, "/analyze-clothing", { body: { imageBase64: "abc" } });

  const body = await response.json();

  const schema = lastGeminiBody.generationConfig.responseSchema;

  const promptText = lastGeminiBody.contents[0].parts.find((part) => part.text).text;

  assert.equal(response.status, 200);
  assert.equal("mask" in schema.properties, false);
  assert.equal(schema.required.includes("mask"), false);
  assert.ok(schema.required.includes("box_2d"), "box_2d는 계속 요청");
  assert.doesNotMatch(promptText, /Return "mask"/);
  assert.deepEqual(body.mask, []);
  assert.deepEqual(body.box2d, [100, 200, 900, 800]);
});
