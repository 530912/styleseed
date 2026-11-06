// 이미지 처리 보호: SlimSAM 동시 1건 대기열(H-1), 사용자별 한도(S-2), 내부 오류 문구 비노출(S-7)
process.env.SUPABASE_URL = "https://test-project.supabase.co";
process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  fakeUserClientFactory,
  realFetch,
  startServer,
  stopServer,
  fakeVerifyToken,
  post,
} = require("./helpers");

const {
  createConcurrencyLimiter,
  LimiterBusyError,
} = require("../concurrencyLimiter");

const { fal } = require("@fal-ai/client");

const app = require("../server");

// helpers.js의 valid-user-token 사용자
const USER_ID = "00000000-0000-4000-8000-00000000000a";

let server;
let baseUrl;

const defaultLimiter = app.locals.slimSamLimiter;
const defaultImageTaskLimit = app.locals.imageTaskLimit;

test.before(async () => {
  app.locals.verifyToken = fakeVerifyToken;
  app.locals.getUserClient = fakeUserClientFactory;

  // 테스트 서버 외 요청은 보내지 않는다(BRIA·fal·Storage 호출은 실패로 끝난다)
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith("http://127.0.0.1")) {
      return realFetch(url, options);
    }

    throw new Error("outbound blocked in test");
  };

  ({ server, baseUrl } = await startServer(app));
});

test.after(async () => {
  globalThis.fetch = realFetch;

  await stopServer(server);
});

test.beforeEach(() => {
  app.locals.resetImageTaskCounter();
  app.locals.imageTaskLimit = defaultImageTaskLimit;
  app.locals.slimSamLimiter = defaultLimiter;
});

test("H-1 대기열: 한 번에 1건만 처리하고 끝나면 다음 차례로 넘긴다", async () => {
  const limiter = createConcurrencyLimiter({ concurrency: 1, maxQueue: 2, maxWaitMs: 1000 });

  const order = [];

  const job = async (name, ms) => {
    const release = await limiter.acquire();

    order.push(`start:${name}`);

    assert.equal(limiter.stats().active, 1, "동시에 2건 이상 처리하면 안 된다");

    await new Promise((resolve) => setTimeout(resolve, ms));

    order.push(`end:${name}`);

    release();
  };

  await Promise.all([job("a", 30), job("b", 10), job("c", 10)]);

  assert.deepEqual(order, ["start:a", "end:a", "start:b", "end:b", "start:c", "end:c"]);
  assert.deepEqual(limiter.stats(), { active: 0, waiting: 0 });
});

test("H-1 대기열: 가득 차면 바로 거절, 오래 기다리면 시간 초과로 거절", async () => {
  const limiter = createConcurrencyLimiter({ concurrency: 1, maxQueue: 1, maxWaitMs: 30 });

  const release = await limiter.acquire();

  const waiter = limiter.acquire();

  await assert.rejects(limiter.acquire(), (error) => {
    assert.ok(error instanceof LimiterBusyError);
    assert.equal(error.reason, "queue_full");
    return true;
  });

  await assert.rejects(waiter, (error) => error.reason === "wait_timeout");

  release();

  // release를 두 번 불러도 자리 수가 어긋나지 않는다
  release();

  assert.deepEqual(limiter.stats(), { active: 0, waiting: 0 });
});

test("H-1 SlimSAM 경로: 처리 중인 요청이 있고 대기열이 꽉 차면 503 CUTOUT_BUSY (모델을 부르지 않음)", async () => {
  const limiter = createConcurrencyLimiter({ concurrency: 1, maxQueue: 0, maxWaitMs: 1000 });

  app.locals.slimSamLimiter = limiter;

  const release = await limiter.acquire();

  try {
    const response = await post(baseUrl, "/segment-garment-local", {
      token: "valid-user-token",
      body: { imagePath: `${USER_ID}/originals/1712.jpg`, box2d: [0, 0, 1000, 1000] },
    });

    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, "CUTOUT_BUSY");
    assert.equal(response.headers.get("retry-after"), "10");
  } finally {
    release();
  }
});

test("H-1 SlimSAM 경로: 잘못된 요청은 자리를 차지하지 않고, 끝나면 자리를 돌려준다", async () => {
  const limiter = createConcurrencyLimiter({ concurrency: 1, maxQueue: 0, maxWaitMs: 1000 });

  app.locals.slimSamLimiter = limiter;

  // box2d가 없으면 모델을 불러오기 전에 400으로 끝난다
  const response = await post(baseUrl, "/segment-garment-local", {
    token: "valid-user-token",
    body: { imagePath: `${USER_ID}/originals/1712.jpg` },
  });

  assert.equal(response.status, 400);
  await response.text();

  assert.deepEqual(limiter.stats(), { active: 0, waiting: 0 });
});

test("S-2 이미지 처리 한도: 사용자별 시간당 한도를 넘으면 429 IMAGE_TASK_RATE_LIMITED", async () => {
  app.locals.imageTaskLimit = 2;

  const send = () =>
    post(baseUrl, "/remove-background", {
      token: "valid-user-token",
      body: { imagePath: `${USER_ID}/processing/1712.jpg` },
    });

  for (let i = 0; i < 2; i += 1) {
    const response = await send();

    assert.notEqual(response.status, 429);
    await response.text();
  }

  const limited = await send();

  assert.equal(limited.status, 429);

  const body = await limited.json();

  assert.equal(body.code, "IMAGE_TASK_RATE_LIMITED");
  assert.ok(body.retryAfterSeconds > 0);
  assert.ok(Number(limited.headers.get("retry-after")) > 0);
});

test("S-2 이미지 처리 한도: 로그인하지 않은 요청은 한도를 쓰지 않는다", async () => {
  app.locals.imageTaskLimit = 1;

  const anonymous = await post(baseUrl, "/remove-background", {
    token: "anonymous-token",
    body: { imagePath: `${USER_ID}/processing/1712.jpg` },
  });

  assert.equal(anonymous.status, 403);
  await anonymous.text();

  const user = await post(baseUrl, "/remove-background", {
    token: "valid-user-token",
    body: { imagePath: `${USER_ID}/processing/1712.jpg` },
  });

  assert.notEqual(user.status, 429);
  await user.text();
});

test("S-7 fal 경로 500 응답에 내부 오류 문구를 담지 않는다", async (t) => {
  // fal 클라이언트는 globalThis.fetch를 거치지 않으므로 호출 자체를 바꿔 외부 요청을 막는다
  const originalSubscribe = fal.subscribe;

  // 운영 기본값은 꺼짐(FAL_KEY 없음, R-4). 이 테스트는 경로를 켜고 오류 문구만 확인한다
  app.locals.falEnabled = true;

  fal.subscribe = async () => {
    throw new Error("internal detail: upstream secret path");
  };

  t.after(() => {
    fal.subscribe = originalSubscribe;
    app.locals.falEnabled = false;
  });

  const response = await post(baseUrl, "/segment-garment", {
    token: "valid-user-token",
    body: {
      imagePath: `${USER_ID}/originals/1712.jpg`,
      box2d: [0, 0, 1000, 1000],
      imageWidth: 100,
      imageHeight: 100,
    },
  });

  assert.equal(response.status, 500);

  const body = await response.json();

  assert.equal(body.message, "의류 분리에 실패했습니다.");
  assert.ok(!JSON.stringify(body).includes("internal detail"));
});
