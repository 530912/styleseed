// SlimSAM 실제 모델 품질 회귀 테스트 (Sprint 1A-3, KI-1)
//
// 실제 /segment-garment-local 경로를 실제 SlimSAM 모델로 실행한다. Supabase 대신 로컬 정적 서버가
// 이미지를 제공한다(외부 네트워크 불필요, 모델은 로컬 캐시 사용).
// "처리 성공(HTTP 200)"과 "분리 품질(상자 채움·배경 비율)"을 따로 판정한다.
//
// 실행: npm run test:quality   (선택: CUTOUT_OUT_DIR=<폴더> 로 결과 PNG 저장)

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const sharp = require("sharp");

const { cases } = require("../fixtures/cutout-cases.json");

const PRODUCTS = path.join(__dirname, "../../../assets/images/products");
const USER_ID = "00000000-0000-4000-8000-00000000000a";
const OUT_DIR = process.env.CUTOUT_OUT_DIR;

let staticServer;
let apiServer;
let apiBase;

test.before(async () => {
  // Storage 대역: 서명 URL 경로의 마지막 파일명을 상품 이미지 폴더에서 돌려준다
  staticServer = http.createServer((req, res) => {
    const file = path.join(PRODUCTS, path.basename(new URL(req.url, "http://x").pathname));
    if (!fs.existsSync(file)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { "Content-Type": "image/jpeg" });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((resolve) => staticServer.listen(0, "127.0.0.1", resolve));
  const storageOrigin = `http://127.0.0.1:${staticServer.address().port}`;

  process.env.SUPABASE_URL = storageOrigin;
  process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";

  const app = require("../../server");
  app.locals.verifyToken = async () => ({ ok: true, claims: { sub: USER_ID } });
  app.locals.getUserClient = () => ({
    storage: {
      from: () => ({
        createSignedUrl: async (p) => ({
          data: { signedUrl: `${storageOrigin}/storage/v1/object/sign/clothing-images/${p}?token=t` },
          error: null,
        }),
      }),
    },
  });

  await new Promise((resolve) => {
    apiServer = app.listen(0, "127.0.0.1", () => {
      apiBase = `http://127.0.0.1:${apiServer.address().port}`;
      resolve();
    });
  });

  if (OUT_DIR) fs.mkdirSync(OUT_DIR, { recursive: true });
});

test.after(async () => {
  await new Promise((resolve) => apiServer.close(resolve));
  await new Promise((resolve) => staticServer.close(resolve));
});

for (const c of cases) {
  test(`분리 품질: ${c.file} (이전 상자 채움 ${c.before.boxFill} → 하한 ${c.minBoxFill})`, async () => {
    const response = await fetch(`${apiBase}/segment-garment-local`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer test" },
      body: JSON.stringify({ imagePath: `${USER_ID}/originals/${c.file}`, box2d: c.box2d }),
    });

    // 1) 처리 성공
    assert.equal(response.status, 200, `처리 실패: ${response.status}`);

    // 2) 분리 품질(처리 성공과 별도 판정)
    const boxFill = Number(response.headers.get("x-cutout-box-fill"));
    const outside = Number(response.headers.get("x-cutout-outside"));

    assert.ok(boxFill >= c.minBoxFill, `상자 채움 ${boxFill} < 하한 ${c.minBoxFill}`);
    assert.ok(outside <= 0.2, `상자 밖 비율 ${outside}`);

    const png = Buffer.from(await response.arrayBuffer());
    const meta = await sharp(png).metadata();
    assert.equal(meta.format, "png");
    assert.ok(meta.hasAlpha);

    if (OUT_DIR) fs.writeFileSync(path.join(OUT_DIR, c.file.replace(".jpg", ".png")), png);

    console.log(
      JSON.stringify({
        file: c.file,
        strategy: response.headers.get("x-cutout-strategy"),
        boxFill,
        outside,
        holesFilled: Number(response.headers.get("x-cutout-holes-filled")),
        size: [meta.width, meta.height],
      }),
    );
  });
}

// 품질 미달 판정: 옷이 없는 배경 구석을 상자로 주면 저장하지 않고 422로 알린다(앱은 BRIA 대체 경로로 넘어감)
test("품질 미달: 배경만 있는 상자는 422 LOW_QUALITY_CUTOUT", async () => {
  const response = await fetch(`${apiBase}/segment-garment-local`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer test" },
    body: JSON.stringify({ imagePath: `${USER_ID}/originals/brown-loafer.jpg`, box2d: [0, 0, 120, 120] }),
  });

  assert.equal(response.status, 422);

  const body = await response.json();
  assert.equal(body.code, "LOW_QUALITY_CUTOUT");
  assert.ok(["too_small", "background"].includes(body.reason), body.reason);

  console.log(JSON.stringify({ lowQuality: body.reason, metrics: body.metrics }));
});
