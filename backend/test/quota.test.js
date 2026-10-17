// AI 분석 호출 한도 (Sprint 1A-2 T2-10·12·13)
process.env.SUPABASE_URL = "https://test-project.supabase.co";
process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
process.env.ANON_ANALYZE_LIMIT_PER_HOUR = "3";
process.env.USER_ANALYZE_LIMIT_PER_HOUR = "4";
process.env.IP_ANALYZE_LIMIT_PER_HOUR = "5";
process.env.GUEST_ANALYZE_LIMIT_PER_HOUR = "2";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createFakeQuotaStore,
  fakeUserClientFactory,
  startServer,
  stopServer,
  post,
  captureConsole,
} = require("./helpers");

const app = require("../server");

const quotaStore = createFakeQuotaStore();

// 토큰마다 다른 사용자: "anon-1", "anon-2" ... 는 익명, "user-1" ... 은 정식
const verifyByPrefix = async (token) => {
  if (token.startsWith("anon-")) {
    return { ok: true, claims: { sub: token, is_anonymous: true } };
  }

  if (token.startsWith("user-")) {
    return { ok: true, claims: { sub: token } };
  }

  return { ok: false, reason: "invalid" };
};

let server;
let baseUrl;

test.before(async () => {
  app.locals.verifyToken = verifyByPrefix;
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

const analyze = (token) => post(baseUrl, "/analyze-clothing", { token, body: {} });

test("T2-10 익명 사용자는 한도(3)까지 허용, 초과 시 429 GUEST_RATE_LIMITED", async () => {
  const statuses = [];

  for (let i = 0; i < 4; i += 1) {
    statuses.push((await analyze("anon-1")).status);
  }

  assert.deepEqual(statuses, [400, 400, 400, 429]);

  const body = await (await analyze("anon-1")).json();

  assert.equal(body.code, "GUEST_RATE_LIMITED");
  assert.equal(body.limit, 3);
});

test("T2-10b 정식 사용자는 사용자 한도(4)까지 허용, 초과 시 429 USER_RATE_LIMITED", async () => {
  const statuses = [];

  for (let i = 0; i < 5; i += 1) {
    statuses.push((await analyze("user-1")).status);
  }

  assert.deepEqual(statuses, [400, 400, 400, 400, 429]);

  const body = await (await analyze("user-1")).json();

  assert.equal(body.code, "USER_RATE_LIMITED");
});

test("T2-10c 사용자 A가 한도를 다 써도 B는 영향 없음", async () => {
  for (let i = 0; i < 4; i += 1) {
    await analyze("user-a");
  }

  assert.equal((await analyze("user-a")).status, 429);
  assert.equal((await analyze("user-b")).status, 400);
});

test("T2-12 익명 세션을 계속 새로 만들어도 IP 상한(5)에서 막힌다", async () => {
  const statuses = [];

  for (let i = 0; i < 6; i += 1) {
    statuses.push((await analyze(`anon-new-${i}`)).status);
  }

  assert.deepEqual(statuses, [400, 400, 400, 400, 400, 429]);
});

test("T2-12b 정식 사용자는 IP 상한에 포함되지 않는다", async () => {
  for (let i = 0; i < 5; i += 1) {
    await analyze(`anon-x-${i}`);
  }

  assert.equal((await analyze("anon-x-last")).status, 429);
  assert.equal((await analyze("user-1")).status, 400);
});

test("T2-13 사용량 저장소 장애 시 분석은 계속되고 메모리 한도로 대체된다", async () => {
  quotaStore.failing = true;

  const capture = captureConsole();

  const statuses = [];

  try {
    for (let i = 0; i < 4; i += 1) {
      statuses.push((await analyze("anon-down")).status);
    }
  } finally {
    capture.restore();
  }

  assert.deepEqual(statuses, [400, 400, 400, 429]);
  assert.ok(capture.lines.some((line) => line.includes("메모리 한도로 대체")));
});

test("T2-02c 토큰 없는 guest는 guest 한도(2)를 쓰고 영구 저장소를 쓰지 않는다", async () => {
  const statuses = [];

  for (let i = 0; i < 3; i += 1) {
    statuses.push((await analyze(undefined)).status);
  }

  assert.deepEqual(statuses, [400, 400, 429]);
  assert.equal(quotaStore.calls, 0);
});
