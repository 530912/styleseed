// 인증 등급·엔드포인트별 접근 (Sprint 1A-1 TS-01·04·05·06·12·13, Sprint 1A-2 T2-02·03·04·05)
process.env.SUPABASE_URL = "https://test-project.supabase.co";
process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
process.env.GUEST_ANALYZE_LIMIT_PER_HOUR = "3";
process.env.ALLOWED_ORIGINS = "http://localhost:8081";

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
  captureConsole,
} = require("./helpers");

const app = require("../server");

const IMAGE_TASK_PATHS = [
  "/segment-garment",
  "/segment-garment-local",
  "/apply-garment-mask",
  "/remove-background",
];

const quotaStore = createFakeQuotaStore();

let server;
let baseUrl;

test.before(async () => {
  app.locals.verifyToken = fakeVerifyToken;
  app.locals.quotaStore = quotaStore;
  app.locals.getUserClient = fakeUserClientFactory;

  ({ server, baseUrl } = await startServer(app));
});

test.after(async () => {
  await stopServer(server);
});

test.beforeEach(() => {
  app.locals.resetQuotaCounters();
  quotaStore.reset();
  app.locals.allowTokenlessGuest = true;
});

test("TS-01 상태 확인 GET / 은 인증 없이 200", async () => {
  const response = await realFetch(`${baseUrl}/`);

  assert.equal(response.status, 200);
});

test("TS-04 토큰 없이 이미지 처리 4종을 호출하면 401 AUTH_REQUIRED", async () => {
  for (const path of IMAGE_TASK_PATHS) {
    const response = await post(baseUrl, path, {
      body: { imageUrl: "https://example.com/a.jpg" },
    });

    assert.equal(response.status, 401, path);
    assert.equal((await response.json()).code, "AUTH_REQUIRED", path);
  }
});

test("T2-03 익명 세션 토큰은 이미지 처리 4종에서 403 ANONYMOUS_NOT_ALLOWED", async () => {
  for (const path of IMAGE_TASK_PATHS) {
    const response = await post(baseUrl, path, { token: "anonymous-token" });

    assert.equal(response.status, 403, path);
    assert.equal((await response.json()).code, "ANONYMOUS_NOT_ALLOWED", path);
  }
});

test("TS-04c 정식 사용자 토큰은 이미지 처리 4종의 인증을 통과(다음 단계 경로 검사에서 400)", async () => {
  for (const path of IMAGE_TASK_PATHS) {
    const response = await post(baseUrl, path, {
      token: "valid-user-token",
      body: {},
    });

    assert.equal(response.status, 400, path);
    assert.equal((await response.json()).code, "INVALID_IMAGE_PATH", path);
  }
});

test("T2-02 토큰 없는 분석은 임시 호환 모드에서 허용되고 guest 한도 초과 시 429", async () => {
  for (let i = 1; i <= 3; i += 1) {
    const response = await post(baseUrl, "/analyze-clothing", { body: {} });

    // 이미지가 없으므로 400이면 인증·한도를 통과해 핸들러에 도달한 것
    assert.equal(response.status, 400, `요청 ${i}`);
  }

  const limited = await post(baseUrl, "/analyze-clothing", { body: {} });

  const body = await limited.json();

  assert.equal(limited.status, 429);
  assert.equal(body.code, "GUEST_RATE_LIMITED");
  assert.equal(body.limit, 3);
  assert.ok(body.retryAfterSeconds > 0);
  assert.ok(Number(limited.headers.get("retry-after")) > 0);
  assert.match(body.message, /로그인/);
  assert.equal(quotaStore.calls, 0, "토큰 없는 요청은 영구 저장소를 쓰지 않는다");
});

test("T2-04 임시 호환 모드를 끄면 토큰 없는 분석도 401 AUTH_REQUIRED", async () => {
  app.locals.allowTokenlessGuest = false;

  const response = await post(baseUrl, "/analyze-clothing", { body: {} });

  assert.equal(response.status, 401);
  assert.equal((await response.json()).code, "AUTH_REQUIRED");
});

test("T2-02b 익명 세션 토큰은 분석을 허용하고 사용량을 기록한다", async () => {
  const response = await post(baseUrl, "/analyze-clothing", {
    token: "anonymous-token",
    body: {},
  });

  assert.equal(response.status, 400);
  assert.equal(quotaStore.calls, 1);
});

test("TS-05b 정식 사용자는 guest 한도와 무관하게 분석할 수 있다", async () => {
  for (let i = 0; i < 4; i += 1) {
    await post(baseUrl, "/analyze-clothing", { body: {} });
  }

  const response = await post(baseUrl, "/analyze-clothing", {
    token: "valid-user-token",
    body: {},
  });

  assert.equal(response.status, 400);
});

test("TS-05c X-Forwarded-For를 바꿔도 guest 한도를 우회할 수 없다(프록시 헤더 미신뢰)", async () => {
  for (let i = 0; i < 3; i += 1) {
    await post(baseUrl, "/analyze-clothing", {
      body: {},
      headers: { "X-Forwarded-For": `203.0.113.${i}` },
    });
  }

  const response = await post(baseUrl, "/analyze-clothing", {
    body: {},
    headers: { "X-Forwarded-For": "198.51.100.77" },
  });

  assert.equal(response.status, 429);
});

test("T2-05 위조·만료 토큰이면 분석 포함 5개 모두 401 AUTH_INVALID", async () => {
  for (const path of ["/analyze-clothing", ...IMAGE_TASK_PATHS]) {
    const response = await post(baseUrl, path, {
      token: "forged-or-expired-token",
      body: {},
    });

    assert.equal(response.status, 401, path);
    assert.equal((await response.json()).code, "AUTH_INVALID", path);
  }
});

test("TS-06b Bearer 형식이 아닌 Authorization 헤더는 401 AUTH_INVALID", async () => {
  const response = await post(baseUrl, "/analyze-clothing", {
    body: {},
    headers: { Authorization: "Token abc" },
  });

  assert.equal(response.status, 401);
  assert.equal((await response.json()).code, "AUTH_INVALID");
});

test("TS-06c Auth 서버에 닿지 못하면 503 AUTH_UNAVAILABLE", async () => {
  const response = await post(baseUrl, "/remove-background", {
    token: "auth-down-token",
    body: {},
  });

  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "AUTH_UNAVAILABLE");
});

test("TS-12 허용되지 않은 웹 Origin은 CORS 허용 헤더를 받지 못한다", async () => {
  const preflight = (origin) =>
    realFetch(`${baseUrl}/analyze-clothing`, {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization,content-type",
      },
    });

  const blocked = await preflight("https://evil.example");

  assert.equal(blocked.headers.get("access-control-allow-origin"), null);

  const allowed = await preflight("http://localhost:8081");

  assert.equal(
    allowed.headers.get("access-control-allow-origin"),
    "http://localhost:8081",
  );
});

test("TS-12b Origin이 없는 네이티브 앱 요청은 CORS와 무관하게 처리된다", async () => {
  const response = await post(baseUrl, "/analyze-clothing", {
    token: "valid-user-token",
    body: {},
  });

  assert.equal(response.status, 400);
});

test("TS-13 인증 실패 로그에 토큰 문자열이 남지 않는다", async () => {
  const secretLikeToken = "eyJhbGciOiJIUzI1NiJ9.TEST-SECRET-PAYLOAD.signature";

  const capture = captureConsole();

  try {
    await post(baseUrl, "/remove-background", { token: secretLikeToken });

    await post(baseUrl, "/analyze-clothing", { token: secretLikeToken });
  } finally {
    capture.restore();
  }

  assert.ok(capture.lines.length > 0, "실패 로그가 기록되어야 한다");

  for (const line of capture.lines) {
    assert.ok(!line.includes("TEST-SECRET-PAYLOAD"), line);
  }
});
