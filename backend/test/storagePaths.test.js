// 이미지 처리 SSRF 차단 (Sprint 1A-2 T2-17·18)
process.env.SUPABASE_URL = "https://test-project.supabase.co";
process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  TEST_SUPABASE_URL,
  fakeUserClientFactory,
  realFetch,
  startServer,
  stopServer,
  fakeVerifyToken,
  post,
} = require("./helpers");

const { validateImagePath } = require("../storagePaths");

const app = require("../server");

// helpers.js의 valid-user-token 사용자
const USER_ID = "00000000-0000-4000-8000-00000000000a";
const OTHER_ID = "00000000-0000-4000-8000-00000000000c";

let server;
let baseUrl;
let outboundUrls = [];

test.before(async () => {
  app.locals.verifyToken = fakeVerifyToken;
  app.locals.getUserClient = fakeUserClientFactory;

  // 서버가 밖으로 요청하는 주소를 기록하고, 테스트 서버 외 요청은 실제로 보내지 않는다
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith("http://127.0.0.1")) {
      return realFetch(url, options);
    }

    outboundUrls.push(String(url));

    throw new Error("outbound blocked in test");
  };

  ({ server, baseUrl } = await startServer(app));
});

test.after(async () => {
  globalThis.fetch = realFetch;

  await stopServer(server);
});

test.beforeEach(() => {
  outboundUrls = [];
});

test("T2-17 경로 검사: 정상 경로만 통과", () => {
  assert.equal(validateImagePath(`${USER_ID}/originals/1712.jpg`, USER_ID).ok, true);
  assert.equal(validateImagePath(`${USER_ID}/processing/1712.png`, USER_ID).ok, true);

  const rejected = [
    "https://evil.example/a.jpg",
    "http://169.254.169.254/latest/meta-data",
    "http://localhost:3001/",
    `${USER_ID}/originals/../../etc/passwd.jpg`,
    `${USER_ID}//originals/a.jpg`,
    `${USER_ID}/cutouts/a.png`,
    `${USER_ID}/originals/a.txt`,
    `${USER_ID}/originals/.hidden.jpg`,
    `/${USER_ID}/originals/a.jpg`,
    "",
    null,
    { path: "x" },
  ];

  for (const value of rejected) {
    const result = validateImagePath(value, USER_ID);

    assert.equal(result.ok, false, String(value));
    assert.equal(result.status, 400, String(value));
  }
});

test("T2-18 경로 검사: 다른 사용자 폴더는 403", () => {
  const result = validateImagePath(`${OTHER_ID}/originals/1712.jpg`, USER_ID);

  assert.equal(result.ok, false);
  assert.equal(result.status, 403);
  assert.equal(result.code, "IMAGE_PATH_FORBIDDEN");
});

test("T2-17b 요청 본문의 imageUrl(외부·내부 주소)은 쓰지 않고 400", async () => {
  for (const imageUrl of [
    "http://169.254.169.254/latest/meta-data/",
    "http://127.0.0.1:3001/",
    "https://evil.example/a.jpg",
  ]) {
    const response = await post(baseUrl, "/remove-background", {
      token: "valid-user-token",
      body: { imageUrl },
    });

    assert.equal(response.status, 400, imageUrl);
    assert.equal((await response.json()).code, "INVALID_IMAGE_PATH");
  }

  assert.deepEqual(outboundUrls, [], "서버가 외부로 요청하면 안 된다");
});

test("T2-18b 다른 사용자 폴더 경로로 처리 요청 → 403, 외부 요청 없음", async () => {
  const response = await post(baseUrl, "/segment-garment-local", {
    token: "valid-user-token",
    body: { imagePath: `${OTHER_ID}/originals/1712.jpg`, box2d: [0, 0, 1000, 1000] },
  });

  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, "IMAGE_PATH_FORBIDDEN");
  assert.deepEqual(outboundUrls, []);
});

test("T2-17c 정상 경로는 서버가 만든 Supabase 서명 URL로만 요청한다", async () => {
  await post(baseUrl, "/remove-background", {
    token: "valid-user-token",
    body: { imagePath: `${USER_ID}/processing/1712.jpg` },
  });

  // remove-background는 BRIA를 호출한다. BRIA에 넘기는 이미지 주소가 서버가 만든 서명 URL인지 본다
  assert.equal(outboundUrls.length, 1);
  assert.ok(outboundUrls[0].startsWith("https://engine.prod.bria-api.com/"));

  await post(baseUrl, "/apply-garment-mask", {
    token: "valid-user-token",
    body: {
      imagePath: `${USER_ID}/originals/1712.jpg`,
      box2d: [0, 0, 1000, 1000],
      mask: [
        [0, 0],
        [10, 0],
        [10, 10],
      ],
    },
  });

  assert.ok(
    outboundUrls[1].startsWith(`${TEST_SUPABASE_URL}/storage/v1/object/sign/`),
    outboundUrls[1],
  );
});

test("T2-17d 서명 URL이 설정된 Supabase 주소가 아니면 502", async () => {
  app.locals.getUserClient = () => ({
    storage: {
      from: () => ({
        createSignedUrl: async () => ({
          data: { signedUrl: "https://attacker.example/x.jpg" },
          error: null,
        }),
      }),
    },
  });

  try {
    const response = await post(baseUrl, "/remove-background", {
      token: "valid-user-token",
      body: { imagePath: `${USER_ID}/processing/1712.jpg` },
    });

    assert.equal(response.status, 502);
    assert.deepEqual(outboundUrls, []);
  } finally {
    app.locals.getUserClient = fakeUserClientFactory;
  }
});
