// /segment-garment-local 라우트 메모리·시간 부하 측정 (Beta Launch, Railway 메모리 한도 결정용)
//
// 실제 server.js 라우트(인증 미들웨어 → 경로 검사 → 서명 URL → SlimSAM → PNG)를 그대로 실행한다.
// Supabase 대신: 토큰 검증은 가짜, 서명 URL은 이 스크립트가 띄운 로컬 이미지 서버 주소를 돌려준다.
// 외부 네트워크·Supabase·Gemini를 쓰지 않는다(모델 캐시가 없으면 Hugging Face에서 내려받음 → --offline).
//
// 실행
//   node backend/scripts/measure-route-memory.mjs --concurrency 1 img1.jpg img2.jpg ...
//   node backend/scripts/measure-route-memory.mjs --concurrency 2 --rounds 3 --json out.json <이미지들>
//   node backend/scripts/measure-route-memory.mjs --offline ...    # 캐시만 사용(배포 이미지 확인)
//
// 컨테이너 메모리 한도 안에서 실행하려면(예: 4GB):
//   docker run --rm --memory=4g --memory-swap=4g -v "$PWD/samples:/samples:ro" styleseed-backend \
//     node scripts/measure-route-memory.mjs --offline --concurrency 2 --rounds 3 /samples/*.jpg
//   → 한도를 넘으면 컨테이너가 종료(exit 137, OOM)된다. 종료 여부 자체가 판정 결과다.
//
// 출력: 동시 처리 수별 최대 RSS, 요청별 시간·상태(200 성공 / 422 품질 미달), 실패 수

import fs from "node:fs";
import http from "node:http";
import { createRequire } from "node:module";
import path from "node:path";

const args = process.argv.slice(2);

const take = (name, fallback) => {
  const index = args.indexOf(name);

  if (index === -1) {
    return fallback;
  }

  const [, value] = args.splice(index, 2);

  return value;
};

const flag = (name) => {
  const index = args.indexOf(name);

  if (index === -1) {
    return false;
  }

  args.splice(index, 1);

  return true;
};

const concurrency = Math.max(1, Number.parseInt(take("--concurrency", "1"), 10) || 1);

const rounds = Math.max(1, Number.parseInt(take("--rounds", "1"), 10) || 1);

const jsonOut = take("--json", null);

const offline = flag("--offline");

const images = args;

if (images.length === 0) {
  console.error("측정할 이미지 경로를 하나 이상 넘겨주세요.");
  process.exit(2);
}

const USER_ID = "00000000-0000-4000-8000-0000000000aa";

const TOKEN = "measure-token";

const mb = (bytes) => Math.round((bytes / 1024 / 1024) * 10) / 10;

// 1) 로컬 이미지 서버: /{index}.jpg → images[index]
const imageServer = http.createServer((req, res) => {
  const index = Number.parseInt(path.basename(req.url ?? "", ".jpg"), 10);

  const file = images[index];

  if (!file) {
    res.writeHead(404).end();
    return;
  }

  res.writeHead(200, { "Content-Type": "image/jpeg" });
  fs.createReadStream(file).pipe(res);
});

await new Promise((resolve) => imageServer.listen(0, "127.0.0.1", resolve));

const imageBase = `http://127.0.0.1:${imageServer.address().port}`;

// 2) server.js를 불러오기 전에 Supabase 주소를 로컬 이미지 서버로 둔다(서명 URL 출처 확인 통과용)
process.env.SUPABASE_URL = imageBase;
process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_measure";

if (offline) {
  const { env } = await import("@huggingface/transformers");

  env.allowRemoteModels = false;
}

const require = createRequire(import.meta.url);

const app = require("../server.js");

app.locals.verifyToken = async (token) =>
  token === TOKEN
    ? { ok: true, claims: { sub: USER_ID, role: "authenticated" } }
    : { ok: false, reason: "invalid" };

app.locals.getUserClient = () => ({
  storage: {
    from: () => ({
      createSignedUrl: async (imagePath) => ({
        data: { signedUrl: `${imageBase}/${path.basename(imagePath)}` },
        error: null,
      }),
    }),
  },
});

const api = await new Promise((resolve) => {
  const server = app.listen(0, "127.0.0.1", () => resolve(server));
});

const apiBase = `http://127.0.0.1:${api.address().port}`;

// 3) RSS 표본(50ms)
let peak = process.memoryUsage().rss;

const sampler = setInterval(() => {
  peak = Math.max(peak, process.memoryUsage().rss);
}, 50);

const segment = async (index) => {
  const startedAt = performance.now();

  const response = await fetch(`${apiBase}/segment-garment-local`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    // Gemini box 대신 가운데 80% 영역
    body: JSON.stringify({ imagePath: `${USER_ID}/originals/${index}.jpg`, box2d: [100, 100, 900, 900] }),
  });

  await response.arrayBuffer();

  return {
    image: path.basename(images[index]),
    status: response.status,
    strategy: response.headers.get("x-cutout-strategy"),
    ms: Math.round(performance.now() - startedAt),
    // 요청이 끝난 시점의 RSS. 순차 실행에서 계속 늘면 누수·할당자 캐시를 의심한다
    rssAfterMB: mb(process.memoryUsage().rss),
  };
};

const baselineRss = process.memoryUsage().rss;

// 첫 요청: 모델 로딩 포함(콜드)
const cold = await segment(0);

const afterColdRss = process.memoryUsage().rss;

peak = afterColdRss;

const runs = [];

const queue = Array.from({ length: rounds }, () => images.map((_, index) => index)).flat();

for (let start = 0; start < queue.length; start += concurrency) {
  const batch = queue.slice(start, start + concurrency);

  runs.push(...(await Promise.all(batch.map(segment))));
}

clearInterval(sampler);

const ms = runs.map((run) => run.ms).sort((a, b) => a - b);

const result = {
  measuredAt: new Date().toISOString(),
  node: process.version,
  platform: `${process.platform}-${process.arch}`,
  cgroupMemoryLimitMB: (() => {
    try {
      const raw = fs.readFileSync("/sys/fs/cgroup/memory.max", "utf8").trim();

      return raw === "max" ? null : mb(Number(raw));
    } catch {
      return null;
    }
  })(),
  offline,
  concurrency,
  requests: runs.length,
  cold: { ...cold, rssAfterMB: mb(afterColdRss) },
  rssMB: { baseline: mb(baselineRss), peakUnderLoad: mb(peak) },
  latencyMs: { p50: ms[Math.floor(ms.length * 0.5)], p90: ms[Math.min(ms.length - 1, Math.floor(ms.length * 0.9))], max: ms.at(-1) },
  statuses: runs.reduce((acc, run) => ({ ...acc, [run.status]: (acc[run.status] ?? 0) + 1 }), {}),
  runs,
};

console.log(JSON.stringify(result, null, 2));

if (jsonOut) {
  fs.writeFileSync(jsonOut, `${JSON.stringify(result, null, 2)}\n`);
}

api.close();
imageServer.close();
process.exit(0);
