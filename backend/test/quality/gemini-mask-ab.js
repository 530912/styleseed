// Gemini mask 출력 제거 A/B 비교 (Sprint 1A-3 C) — 수동 실행 스크립트(자동 테스트 아님)
//
// 같은 사진을 mask 요청 켠 서버(A)와 끈 서버(B)에 보내 토큰 사용량, 속성 일치, 상자 IoU를 비교한다.
// 현재 .env의 Gemini 키·모델을 그대로 쓴다(모델·유료 설정은 바꾸지 않는다).
// 무료 한도를 사진 수 x 2회 쓰므로 한도가 남아 있을 때만 실행한다.
//
// 실행: node backend/test/quality/gemini-mask-ab.js [사진 수, 기본 5]

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "../../..");
const PRODUCTS = path.join(ROOT, "assets/images/products");
const { cases } = require("../fixtures/cutout-cases.json");

const COUNT = Number(process.argv[2]) || 5;
const FIELDS = ["category", "subCategory", "color", "colorTone", "fit", "material"];
const LIST_FIELDS = ["season", "tpo", "style"];

const startServer = (port, mask) =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["backend/server.js"], {
      cwd: ROOT,
      env: {
        ...process.env,
        PORT: String(port),
        GEMINI_REQUEST_MASK: mask ? "true" : "false",
        GUEST_ANALYZE_LIMIT_PER_HOUR: "100",
        IP_ANALYZE_LIMIT_PER_HOUR: "100",
      },
    });
    const usages = [];
    child.stdout.on("data", (chunk) => {
      const text = String(chunk);
      for (const match of text.matchAll(/Gemini 사용량: (\{.*\})/g)) usages.push(JSON.parse(match[1]));
      if (text.includes("STYLESEED API running")) resolve({ child, usages, base: `http://127.0.0.1:${port}` });
    });
    child.on("exit", (code) => reject(new Error(`server exited ${code}`)));
  });

const analyze = async (base, file) => {
  const imageBase64 = fs.readFileSync(path.join(PRODUCTS, file)).toString("base64");
  const startedAt = Date.now();
  const response = await fetch(`${base}/analyze-clothing`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64 }),
  });
  return { status: response.status, ms: Date.now() - startedAt, body: await response.json() };
};

// box2d: [ymin, xmin, ymax, xmax] (0~1000)
const iou = (a, b) => {
  const ix = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  const iy = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]));
  const inter = ix * iy;
  const area = (r) => (r[2] - r[0]) * (r[3] - r[1]);
  return inter / (area(a) + area(b) - inter);
};

const sameList = (a = [], b = []) => [...a].sort().join() === [...b].sort().join();

(async () => {
  const withMask = await startServer(3101, true);
  const withoutMask = await startServer(3102, false);
  const rows = [];

  try {
    for (const c of cases.slice(0, COUNT)) {
      const a = await analyze(withMask.base, c.file);
      const b = await analyze(withoutMask.base, c.file);

      if (a.status !== 200 || b.status !== 200) {
        rows.push({ file: c.file, error: `A=${a.status} B=${b.status} ${a.body.code ?? ""} ${b.body.code ?? ""}` });
        if (a.status === 429 || b.status === 429) break;
        continue;
      }

      rows.push({
        file: c.file,
        ms: [a.ms, b.ms],
        fieldsMatch: FIELDS.filter((f) => a.body[f] === b.body[f]).length + "/" + FIELDS.length,
        listsMatch: LIST_FIELDS.filter((f) => sameList(a.body[f], b.body[f])).length + "/" + LIST_FIELDS.length,
        boxIoU: Number(iou(a.body.box2d, b.body.box2d).toFixed(3)),
        maskPoints: [a.body.mask.length, b.body.mask.length],
      });
    }
  } finally {
    withMask.child.kill();
    withoutMask.child.kill();
  }

  const sum = (list, key) => list.reduce((acc, u) => acc + (u[key] ?? 0), 0);
  const avg = (list, key) => (list.length ? Math.round(sum(list, key) / list.length) : null);

  console.log(JSON.stringify({ rows }, null, 1));
  console.log(
    JSON.stringify({
      tokens: {
        withMask: { calls: withMask.usages.length, prompt: avg(withMask.usages, "prompt"), output: avg(withMask.usages, "output"), thoughts: avg(withMask.usages, "thoughts") },
        withoutMask: { calls: withoutMask.usages.length, prompt: avg(withoutMask.usages, "prompt"), output: avg(withoutMask.usages, "output"), thoughts: avg(withoutMask.usages, "thoughts") },
      },
      model: withMask.usages[0]?.model ?? null,
    }),
  );
})();
