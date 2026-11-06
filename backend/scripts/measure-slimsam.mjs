// SlimSAM 로딩 시간·메모리·처리 시간 측정 (Beta Launch, 배포 사양 결정용)
//
// 서버 라우트를 거치지 않고 같은 모델(Xenova/slimsam-77-uniform)과 같은 입력 형식
// (box + 중심점 프롬프트)으로 직접 실행한다. 품질은 보지 않는다(품질은 개발 트랙 KI-1 범위).
//
// 측정 항목
// - 모델 로딩 시간(캐시가 있으면 콜드 스타트, 없으면 다운로드 포함)
// - 로딩 직후 RSS
// - 이미지별 처리 시간과 처리 중 최대 RSS (동시 처리 수 --concurrency)
//
// 실행
//   node backend/scripts/measure-slimsam.mjs                     # 저장소 상품 이미지, 순차
//   node backend/scripts/measure-slimsam.mjs --concurrency 3      # 동시 3건
//   node backend/scripts/measure-slimsam.mjs --offline            # 캐시만 사용(배포 이미지 확인)
//   node backend/scripts/measure-slimsam.mjs --json out.json      # 결과 저장
//   node backend/scripts/measure-slimsam.mjs img1.jpg img2.jpg    # 직접 고른 이미지
//
// 판정 기준(초안, docs/launch/BACKEND_DEPLOY.md): 최대 RSS < 컨테이너 메모리 한도의 75%

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const args = process.argv.slice(2);

const readOption = (name, fallback) => {
  const index = args.indexOf(name);

  if (index === -1) {
    return fallback;
  }

  const [, value] = args.splice(index, 2);

  return value;
};

const offline = args.includes("--offline");

if (offline) {
  args.splice(args.indexOf("--offline"), 1);
}

const concurrency = Math.max(1, Number.parseInt(readOption("--concurrency", "1"), 10) || 1);

const jsonOut = readOption("--json", null);

const here = path.dirname(fileURLToPath(import.meta.url));

const PRODUCT_DIR = path.join(here, "../../assets/images/products");

const images =
  args.length > 0
    ? args
    : fs
        .readdirSync(PRODUCT_DIR)
        .filter((name) => /\.(jpe?g|png)$/i.test(name))
        .map((name) => path.join(PRODUCT_DIR, name));

const mb = (bytes) => Math.round((bytes / 1024 / 1024) * 10) / 10;

// RSS를 50ms마다 기록해 구간별 최대값을 구한다
let peakRss = 0;

const sampler = setInterval(() => {
  peakRss = Math.max(peakRss, process.memoryUsage().rss);
}, 50);

const resetPeak = () => {
  peakRss = process.memoryUsage().rss;
};

const { AutoProcessor, RawImage, SamModel, env } = await import(
  "@huggingface/transformers"
);

if (offline) {
  env.allowRemoteModels = false;
}

const baselineRss = process.memoryUsage().rss;

resetPeak();

const loadStartedAt = performance.now();

const model = await SamModel.from_pretrained("Xenova/slimsam-77-uniform");

const processor = await AutoProcessor.from_pretrained("Xenova/slimsam-77-uniform");

const loadMs = Math.round(performance.now() - loadStartedAt);

const afterLoadRss = process.memoryUsage().rss;

const loadPeakRss = peakRss;

// 서버와 같은 순서: 이미지 → box 프롬프트 → 마스크 → 원본 크기 알파 합성
const segment = async (file) => {
  const startedAt = performance.now();

  const buffer = fs.readFileSync(file);

  const { data: rgb, info } = await sharp(buffer)
    .rotate()
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const image = new RawImage(new Uint8ClampedArray(rgb), info.width, info.height, 3);

  // Gemini box 대신 가운데 80% 영역을 쓴다(시간·메모리 측정용)
  const box = [
    Math.round(info.width * 0.1),
    Math.round(info.height * 0.1),
    Math.round(info.width * 0.9),
    Math.round(info.height * 0.9),
  ];

  // transformers.js SAM은 점 입력이 필요하다(서버와 같이 box + 중심 양성 점 1개)
  const center = [Math.round((box[0] + box[2]) / 2), Math.round((box[1] + box[3]) / 2)];

  const inputs = await processor(image, {
    input_boxes: [[box]],
    input_points: [[[center]]],
    input_labels: [[[1]]],
  });

  const outputs = await model(inputs);

  const masks = await processor.post_process_masks(
    outputs.pred_masks,
    inputs.original_sizes,
    inputs.reshaped_input_sizes,
  );

  const mask = masks[0];

  const pixels = info.width * info.height;

  const alpha = Buffer.alloc(pixels);

  for (let i = 0; i < pixels; i += 1) {
    alpha[i] = mask.data[i] ? 255 : 0;
  }

  await sharp(rgb, { raw: { width: info.width, height: info.height, channels: 3 } })
    .joinChannel(alpha, { raw: { width: info.width, height: info.height, channels: 1 } })
    .png()
    .toBuffer();

  return {
    image: path.basename(file),
    width: info.width,
    height: info.height,
    ms: Math.round(performance.now() - startedAt),
  };
};

const runs = [];

resetPeak();

for (let index = 0; index < images.length; index += concurrency) {
  const batch = images.slice(index, index + concurrency);

  runs.push(...(await Promise.all(batch.map(segment))));
}

const inferencePeakRss = peakRss;

clearInterval(sampler);

const sorted = runs.map((run) => run.ms).sort((a, b) => a - b);

const percentile = (p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];

const result = {
  measuredAt: new Date().toISOString(),
  node: process.version,
  platform: `${process.platform}-${process.arch}`,
  offline,
  concurrency,
  images: runs.length,
  modelLoadMs: loadMs,
  rssMB: {
    baseline: mb(baselineRss),
    afterModelLoad: mb(afterLoadRss),
    peakDuringLoad: mb(loadPeakRss),
    peakDuringInference: mb(inferencePeakRss),
  },
  inferenceMs: { p50: percentile(50), p90: percentile(90), max: sorted.at(-1) },
  runs,
};

console.log(JSON.stringify(result, null, 2));

if (jsonOut) {
  fs.writeFileSync(jsonOut, `${JSON.stringify(result, null, 2)}\n`);
}
