// 메모리·부하 측정용 샘플 이미지 만들기 (Beta Launch)
//
// 저장소 상품 사진을 앱 업로드와 같은 형식(긴 변 1600px JPEG, 품질 85)으로 만든다.
// 상품 사진을 늘린 것이라 실제 휴대폰 사진보다 단순하다 → 실제 사진(얼굴·개인정보 없는 옷 사진)이
// 있으면 같은 폴더에 넣어 함께 쓴다.
//
//   node backend/scripts/make-samples.mjs --out /tmp/styleseed-samples [--long-edge 1600]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const args = process.argv.slice(2);

const read = (name, fallback) => {
  const index = args.indexOf(name);

  return index === -1 ? fallback : args[index + 1];
};

const out = read("--out");

const longEdge = Number(read("--long-edge", "1600"));

if (!out) {
  console.error("사용법: node backend/scripts/make-samples.mjs --out <폴더> [--long-edge 1600]");
  process.exit(2);
}

const source = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../assets/images/products");

fs.mkdirSync(out, { recursive: true });

for (const name of fs.readdirSync(source).filter((file) => /\.jpe?g$/i.test(file))) {
  const image = sharp(path.join(source, name));

  const { width, height } = await image.metadata();

  const scale = longEdge / Math.max(width, height);

  const target = { width: Math.round(width * scale), height: Math.round(height * scale) };

  const file = path.join(out, `${target.width}x${target.height}-${name}`);

  await image.resize(target).jpeg({ quality: 85 }).toFile(file);

  console.log(file);
}
