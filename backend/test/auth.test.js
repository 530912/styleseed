// Sprint 1A-1: 인증·Guest 정책 (TS-01, TS-04, TS-05, TS-06, TS-12, TS-13)
process.env.GUEST_ANALYZE_LIMIT_PER_HOUR = "3";
process.env.ALLOWED_ORIGINS = "http://localhost:8081";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
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

let server;
let baseUrl;

test.before(async () => {
  app.locals.verifyToken = fakeVerifyToken;

  ({ server, baseUrl } = await startServer(app));
});

test.after(async () => {
  await stopServer(server);
});

test.beforeEach(() => {
  app.locals.guestAnalyzeLimiter.reset();
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

    const body = await response.json();

    assert.equal(response.status, 401, path);
    assert.equal(body.code, "AUTH_REQUIRED", path);
  }
});

test("TS-04b 익명 세션 토큰도 이미지 처리는 401 AUTH_REQUIRED", async () => {
  for (const path of IMAGE_TASK_PATHS) {
    const response = await post(baseUrl, path, { token: "anonymous-token" });

    assert.equal(response.status, 401, path);
    assert.equal((await response.json()).code, "AUTH_REQUIRED", path);
  }
});

test("TS-04c 유효한 사용자 토큰이면 이미지 처리 4종 모두 인증 단계를 통과", async () => {
  for (const path of IMAGE_TASK_PATHS) {
    // 본문이 비어 있으므로 핸들러의 입력 검증에서 실패하면 인증은 통과한 것이다
    // (쓰이지 않는 /segment-garment는 기존 코드대로 입력 오류를 500으로 응답)
    const response = await post(baseUrl, path, {
      token: "valid-user-token",
      body: {},
    });

    const body = await response.json();

    assert.notEqual(response.status, 401, path);
    assert.ok([400, 500].includes(response.status), `${path} ${response.status}`);
    assert.ok(!String(body.code ?? "").startsWith("AUTH_"), path);
  }
});

test("TS-05 토큰 없는 분석은 Guest 한도까지 허용되고 초과하면 429 GUEST_RATE_LIMITED", async () => {
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
});

test("TS-05b 로그인 사용자는 Guest 한도와 무관하게 분석할 수 있다", async () => {
  for (let i = 0; i < 4; i += 1) {
    await post(baseUrl, "/analyze-clothing", { body: {} });
  }

  const response = await post(baseUrl, "/analyze-clothing", {
    token: "valid-user-token",
    body: {},
  });

  assert.equal(response.status, 400);
});

test("TS-05c X-Forwarded-For를 바꿔도 Guest 한도를 우회할 수 없다(프록시 헤더 미신뢰)", async () => {
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

test("TS-06 위조·만료 토큰이면 분석 포함 5개 모두 401 AUTH_INVALID", async () => {
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
