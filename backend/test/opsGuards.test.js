// 2026-11 사용자 조사 MVP 운영 보호 장치: 이미지 사전 검사(R-8), Gemini 일일 상한,
// 한 줄 JSON 로그(R-9), 모델 노출(R-3), fal 경로 비활성(R-4), JSON 404·500
process.env.SUPABASE_URL = "https://test-project.supabase.co";
process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
process.env.GEMINI_TIMEOUT_MS = "400";
// 가짜 Gemini(fetch 가로채기)로 시험한다. 키가 없으면 서버가 Gemini를 부르지 않고 503을 낸다
process.env.GEMINI_API_KEY = "test-gemini-key";
process.env.GUEST_ANALYZE_LIMIT_PER_HOUR = "100";
process.env.IP_ANALYZE_LIMIT_PER_HOUR = "100";
process.env.ALLOWED_ORIGINS = "https://web.example";

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

const {
  inspectImageBase64,
  createDailyCap,
  createErrorLogger,
} = require("../opsGuards");

const app = require("../server");

const USER_ID = "00000000-0000-4000-8000-00000000000a";

const b64 = (bytes) => Buffer.from(bytes).toString("base64");

const JPEG = b64([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);

const PNG = b64([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);

const WEBP = b64([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP")]);

const HEIC = b64([0, 0, 0, 0x18, ...Buffer.from("ftypheic"), 0, 0, 0, 0]);

// Gemini 호출만 가로챈다
let geminiCalls = 0;

let lastGeminiBody = null;

let modelVersion = "gemini-3.6-flash";

let geminiHangs = false;

let geminiStatus = 200;

globalThis.fetch = async (url, options) => {
  if (String(url).includes("generativelanguage.googleapis.com")) {
    geminiCalls += 1;

    lastGeminiBody = JSON.parse(options.body);

    if (geminiStatus !== 200) {
      return new Response(JSON.stringify({ error: { code: geminiStatus } }), {
        status: geminiStatus,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (geminiHangs) {
      return new Promise((_, reject) => {
        options.signal.addEventListener("abort", () => reject(options.signal.reason));
      });
    }

    return new Response(
      JSON.stringify({
        modelVersion,
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    category: "top", subCategory: "shirt", color: "white", colorTone: "light",
                    fit: "regular", material: "cotton", season: ["spring"], tpo: ["casual"],
                    style: ["minimal"], box_2d: [0, 0, 1000, 1000],
                  }),
                },
              ],
            },
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  return realFetch(url, options);
};

// console.log로 나가는 JSON 로그를 모은다
const captureLogs = (t) => {
  const lines = [];

  const original = console.log;

  console.log = (...args) => {
    if (typeof args[0] === "string" && args[0].startsWith("{")) {
      try {
        lines.push(JSON.parse(args[0]));

        return;
      } catch {
        // JSON이 아니면 그대로 출력
      }
    }

    original(...args);
  };

  t.after(() => {
    console.log = original;
  });

  return lines;
};

let server;
let baseUrl;

const defaultDailyLimit = app.locals.geminiDailyLimit;

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
  modelVersion = "gemini-3.6-flash";
  geminiHangs = false;
  geminiStatus = 200;
  app.locals.resetQuotaCounters();
  app.locals.geminiDailyCap.reset();
  app.locals.geminiDailyLimit = defaultDailyLimit;
});

// ── 단위 ──

test("OG-01 이미지 시그니처: JPEG·PNG·WEBP·HEIC를 알아보고 mimeType을 돌려준다", () => {
  assert.deepEqual(inspectImageBase64(JPEG), { ok: true, mimeType: "image/jpeg" });
  assert.deepEqual(inspectImageBase64(PNG), { ok: true, mimeType: "image/png" });
  assert.deepEqual(inspectImageBase64(WEBP), { ok: true, mimeType: "image/webp" });
  assert.deepEqual(inspectImageBase64(HEIC), { ok: true, mimeType: "image/heic" });
});

test("OG-02 base64가 아니거나 이미지가 아니면 거절", () => {
  assert.equal(inspectImageBase64("").reason, "missing");
  assert.equal(inspectImageBase64(123).reason, "missing");
  assert.equal(inspectImageBase64("notanimage").reason, "not_base64");
  assert.equal(inspectImageBase64("abc").reason, "not_base64");
  assert.equal(inspectImageBase64("data:image/jpeg;base64,/9j/").reason, "not_base64");
  assert.equal(inspectImageBase64(b64(Buffer.from("hello world!"))).reason, "unsupported_format");
});

test("OG-03 일일 상한: 한도까지 허용, 넘으면 거절, 한국 시간 자정에 초기화, 0이면 끔", () => {
  // 2026-11-09 23:59:00 KST
  let now = Date.parse("2026-11-09T14:59:00Z");

  const cap = createDailyCap({ now: () => now });

  assert.equal(cap.take(2).allowed, true);
  assert.equal(cap.take(2).allowed, true);

  const blocked = cap.take(2);

  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSeconds, 60);
  assert.equal(cap.snapshot().count, 2);

  now += 60 * 1000; // 자정

  assert.equal(cap.take(2).allowed, true);
  assert.equal(cap.snapshot().count, 1);

  for (let i = 0; i < 50; i += 1) {
    assert.equal(cap.take(0).allowed, true);
  }
});

test("OG-04 오류 로거: 400 이상만 기록하고 code·tier를 담는다", async () => {
  const lines = [];

  const express = require("express");

  const mini = express();

  mini.use(createErrorLogger({ log: (evt, fields) => lines.push({ evt, ...fields }) }));
  mini.get("/ok", (req, res) => res.json({ ok: true }));
  mini.get("/bad", (req, res) => {
    req.auth = { tier: "user" };
    res.status(429).json({ code: "X_LIMITED", message: "secret detail" });
  });

  const { server: miniServer, baseUrl: miniUrl } = await startServer(mini);

  await (await realFetch(`${miniUrl}/ok`)).text();
  await (await realFetch(`${miniUrl}/bad?token=abc`)).text();
  await new Promise((resolve) => setImmediate(resolve));
  await stopServer(miniServer);

  assert.equal(lines.length, 1);
  assert.equal(lines[0].evt, "http_error");
  assert.equal(lines[0].status, 429);
  assert.equal(lines[0].code, "X_LIMITED");
  assert.equal(lines[0].tier, "user");
  assert.equal(lines[0].path, "/bad");
  assert.ok(!JSON.stringify(lines[0]).includes("secret detail"));
  assert.ok(!JSON.stringify(lines[0]).includes("token=abc"));
});

// ── 서버 ──

test("OG-05 R-8: 이미지가 아닌 데이터는 Gemini를 부르지 않고 400 INVALID_IMAGE", async () => {
  for (const imageBase64 of ["notanimage", "abc", b64(Buffer.from("plain text data"))]) {
    const response = await post(baseUrl, "/analyze-clothing", { body: { imageBase64 } });

    const body = await response.json();

    assert.equal(response.status, 400, imageBase64);
    assert.equal(body.code, "INVALID_IMAGE");
  }

  assert.equal(geminiCalls, 0);
});

test("OG-06 PNG는 image/png로 Gemini에 보낸다", async () => {
  const response = await post(baseUrl, "/analyze-clothing", { body: { imageBase64: PNG } });

  assert.equal(response.status, 200);
  await response.json();

  const inline = lastGeminiBody.contents[0].parts.find((part) => part.inlineData).inlineData;

  assert.equal(inline.mimeType, "image/png");
});

test("OG-07 서버 전체 일일 상한을 넘으면 Gemini 호출 없이 429 AI_RATE_LIMITED", async () => {
  app.locals.geminiDailyLimit = 2;

  for (let i = 0; i < 2; i += 1) {
    const ok = await post(baseUrl, "/analyze-clothing", { body: { imageBase64: JPEG } });

    assert.equal(ok.status, 200);
    await ok.json();
  }

  const blocked = await post(baseUrl, "/analyze-clothing", { body: { imageBase64: JPEG } });

  const body = await blocked.json();

  assert.equal(blocked.status, 429);
  assert.equal(body.code, "AI_RATE_LIMITED");
  assert.ok(body.retryAfterSeconds > 0);
  assert.equal(geminiCalls, 2);
});

test("OG-08 R-3·R-9: Gemini 호출 1건마다 gemini_call 한 줄(요청·응답 모델, 불일치 표시, 토큰)", async (t) => {
  const lines = captureLogs(t);

  modelVersion = "gemini-9.9-other";

  const response = await post(baseUrl, "/analyze-clothing", { body: { imageBase64: JPEG } });

  assert.equal(response.status, 200);
  await response.json();

  const call = lines.find((line) => line.evt === "gemini_call");

  assert.ok(call, "gemini_call 로그");
  assert.equal(call.model, "gemini-3.6-flash");
  assert.equal(call.servedModel, "gemini-9.9-other");
  assert.equal(call.modelMismatch, true);
  assert.equal(call.status, 200);
  assert.equal(call.total, 15);
  assert.ok(!JSON.stringify(call).includes(JPEG), "이미지 데이터는 로그에 없음");

  const health = await (await realFetch(`${baseUrl}/healthz`)).json();

  assert.deepEqual(health.gemini, {
    model: "gemini-3.6-flash",
    lastServedModel: "gemini-9.9-other",
  });
});

test("OG-09 R-9: 오류 응답은 http_error 한 줄로 남는다", async (t) => {
  const lines = captureLogs(t);

  const response = await post(baseUrl, "/analyze-clothing", { body: { imageBase64: "abc" } });

  await response.json();
  await new Promise((resolve) => setImmediate(resolve));

  const line = lines.find((entry) => entry.evt === "http_error");

  assert.ok(line);
  assert.equal(line.status, 400);
  assert.equal(line.code, "INVALID_IMAGE");
  assert.equal(line.path, "/analyze-clothing");
});

test("OG-10 R-4: FAL_KEY가 없으면 /segment-garment는 fal을 부르지 않고 404 FEATURE_DISABLED", async () => {
  const before = app.locals.falEnabled;

  app.locals.falEnabled = false;

  try {
    const anonymous = await post(baseUrl, "/segment-garment", { body: {} });

    assert.equal(anonymous.status, 401, "인증 검사가 먼저");
    await anonymous.text();

    const response = await post(baseUrl, "/segment-garment", {
      token: "valid-user-token",
      body: {
        imagePath: `${USER_ID}/originals/1712.jpg`,
        box2d: [0, 0, 1000, 1000],
        imageWidth: 100,
        imageHeight: 100,
      },
    });

    assert.equal(response.status, 404);
    assert.equal((await response.json()).code, "FEATURE_DISABLED");
  } finally {
    app.locals.falEnabled = before;
  }
});

test("OG-11 등록되지 않은 경로는 JSON 404", async () => {
  const response = await realFetch(`${baseUrl}/no-such-route`);

  assert.equal(response.status, 404);
  assert.equal((await response.json()).code, "NOT_FOUND");
});

test("OG-12 Gemini 시간 초과도 gemini_call 한 줄(status: timeout)로 집계", async (t) => {
  const lines = captureLogs(t);

  geminiHangs = true;

  const response = await post(baseUrl, "/analyze-clothing", { body: { imageBase64: JPEG } });

  assert.equal(response.status, 504);
  assert.equal((await response.json()).code, "AI_TIMEOUT");

  const call = lines.find((line) => line.evt === "gemini_call");

  assert.ok(call);
  assert.equal(call.status, "timeout");
  assert.equal(call.model, "gemini-3.6-flash");
});

test("OG-13 Gemini 402(선불 크레딧 소진)는 503 AI_CREDIT_EXHAUSTED + 로그 한 줄, 재시도 없음", async (t) => {
  const lines = captureLogs(t);

  geminiStatus = 402;

  const response = await post(baseUrl, "/analyze-clothing", { body: { imageBase64: JPEG } });

  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.code, "AI_CREDIT_EXHAUSTED");
  assert.equal(geminiCalls, 1);
  assert.ok(lines.some((line) => line.evt === "gemini_credit_exhausted"));
  assert.ok(lines.some((line) => line.evt === "gemini_call" && line.status === 402));
});

// ── 모바일 웹(2026-11) ──

test("OG-14 /api 접두어: /api/x 와 /x 가 같은 경로(같은 도메인 배포·Railway 이전 공용)", async () => {
  const health = await realFetch(`${baseUrl}/api/healthz`);

  assert.equal(health.status, 200);
  assert.equal((await health.json()).status, "ok");

  const root = await realFetch(`${baseUrl}/api`);

  assert.equal(root.status, 200);
  await root.text();

  const invalid = await post(baseUrl, "/api/analyze-clothing", { body: { imageBase64: "abc" } });

  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).code, "INVALID_IMAGE");

  const lookalike = await realFetch(`${baseUrl}/apix/healthz`);

  assert.equal(lookalike.status, 404, "/api로 시작하는 다른 경로는 건드리지 않음");
  await lookalike.text();

  const deletionPage = await realFetch(`${baseUrl}/api/account-deletion`);

  assert.equal(deletionPage.status, 200);
  assert.match(await deletionPage.text(), /<form method="post" action=""/, "폼은 현재 주소로 전송(/api 아래에서도 동작)");
});

test("OG-15 다른 도메인 웹: 허용 Origin의 사전 요청(Authorization 헤더)은 통과, 그 외 Origin은 CORS 헤더 없음", async () => {
  const preflight = (origin) =>
    realFetch(`${baseUrl}/api/analyze-clothing`, {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization,content-type",
      },
    });

  const allowed = await preflight("https://web.example");

  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get("access-control-allow-origin"), "https://web.example");
  assert.match(allowed.headers.get("access-control-allow-headers") ?? "", /authorization/i);
  assert.match(allowed.headers.get("access-control-allow-methods") ?? "", /POST/);

  const other = await preflight("https://evil.example");

  assert.equal(other.headers.get("access-control-allow-origin"), null);
});

test("OG-16 Gemini 키 없이 배포한 단계: Google을 부르지 않고 503 AI_UNAVAILABLE", async () => {
  const saved = process.env.GEMINI_API_KEY;

  delete process.env.GEMINI_API_KEY;

  try {
    const response = await post(baseUrl, "/analyze-clothing", { body: { imageBase64: JPEG } });

    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, "AI_UNAVAILABLE");
    assert.equal(geminiCalls, 0);
  } finally {
    process.env.GEMINI_API_KEY = saved;
  }
});
