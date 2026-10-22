// 색상 공간 측정 시제품(비파괴): 저장소 상품 사진 7장 → CIELAB L*(명도)·C*(채도)·h(색상각)
// Gemini·DB·사용자 사진을 쓰지 않는다. 조명·그림자를 사진에 인위적으로 입혀 측정값이 얼마나 흔들리는지 본다.
// 실행: node scripts/analysis/color-tone-2026-10-22/measure.cjs
const path = require("path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "../../..");
const { cases } = require(path.join(ROOT, "backend/test/fixtures/cutout-cases.json"));

// 후보 경계(보정 전 가설). 실측 세트로 조정한다
const BANDS = { valueLight: 70, valueDark: 40, achromaticC: 8, satLow: 18, satHigh: 40 };

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29);
const rgbToLab = (r, g, b) => {
  const [R, G, B] = [r, g, b].map((x) => toLinear(x / 255));
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  const Y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const L = 116 * f(Y) - 16;
  const a = 500 * (f(X) - f(Y));
  const bb = 200 * (f(Y) - f(Z));
  return [L, a, bb];
};
const quantile = (arr, q) => {
  const s = [...arr].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};

// 조명 변형: 채널 배수(따뜻한 조명·그림자·차가운 조명)
const LIGHTS = {
  원본: [1, 1, 1],
  "따뜻한 조명": [1.08, 1.0, 0.82],
  "차가운 조명": [0.9, 1.0, 1.1],
  그림자: [0.62, 0.62, 0.62],
};

const measure = async (file, box, light, { whiteBalance }) => {
  const { data, info } = await sharp(path.join(ROOT, "assets/images/products", file)).removeAlpha().resize({ width: 320 }).raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const px = (x, y) => {
    const i = (y * w + x) * 3;
    return [0, 1, 2].map((k) => Math.min(255, data[i + k] * light[k]));
  };

  // 배경 = 테두리 2% 픽셀의 중앙값. 흰 배경 상품 사진을 가정(누끼 이미지가 있으면 알파로 대체)
  const border = [];
  const m = Math.max(2, Math.round(w * 0.02));
  for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) if (x < m || y < m || x >= w - m || y >= h - m) border.push(px(x, y));
  const bg = [0, 1, 2].map((k) => quantile(border.map((p) => p[k]), 0.5));
  // 흰 배경을 기준으로 한 간단한 화이트밸런스(그레이 월드 변형): 배경을 무채색으로 되돌리는 배수
  const gain = whiteBalance ? bg.map((c) => Math.max(...bg) / Math.max(1, c)) : [1, 1, 1];
  const bgLab = rgbToLab(...bg.map((c, k) => Math.min(255, c * gain[k])));

  // 옷 영역 = Gemini 상자를 15% 안쪽으로 줄인 영역 중 배경과 ΔE ≥ 10인 픽셀
  const [y0, x0, y1, x1] = box.map((v) => v / 1000);
  const inset = 0.15;
  const xs = [x0 + (x1 - x0) * inset, x1 - (x1 - x0) * inset].map((v) => Math.round(v * w));
  const ys = [y0 + (y1 - y0) * inset, y1 - (y1 - y0) * inset].map((v) => Math.round(v * h));
  const L = [];
  const C = [];
  const H = [];
  let highlights = 0;
  let total = 0;
  for (let y = ys[0]; y < ys[1]; y++) {
    for (let x = xs[0]; x < xs[1]; x++) {
      const lab = rgbToLab(...px(x, y).map((c, k) => Math.min(255, c * gain[k])));
      const dE = Math.hypot(lab[0] - bgLab[0], lab[1] - bgLab[1], lab[2] - bgLab[2]);
      if (dE < 10) continue;
      total++;
      const chroma = Math.hypot(lab[1], lab[2]);
      // 반사광(광택) 후보: 매우 밝고 색이 거의 없는 픽셀 — 측정에서 뺀다
      if (lab[0] > 92 && chroma < 6) {
        highlights++;
        continue;
      }
      L.push(lab[0]);
      C.push(chroma);
      H.push(((Math.atan2(lab[2], lab[1]) * 180) / Math.PI + 360) % 360);
    }
  }
  if (L.length < 50) return { file, note: "옷 픽셀 부족(배경과 구분 안 됨)", pixels: L.length };

  // 그림자·주름 영향을 줄이려고 평균 대신 중앙값, 퍼짐(IQR)은 워싱·패턴 신호
  const Lm = quantile(L, 0.5);
  const Cm = quantile(C, 0.5);
  const value = Lm >= BANDS.valueLight ? "light" : Lm < BANDS.valueDark ? "dark" : "medium";
  const achromatic = Cm < BANDS.achromaticC;
  const saturation = achromatic ? "n/a" : Cm < BANDS.satLow ? "low" : Cm >= BANDS.satHigh ? "high" : "medium";
  return {
    L: +Lm.toFixed(1),
    C: +Cm.toFixed(1),
    h: Math.round(quantile(H, 0.5)),
    LIqr: +(quantile(L, 0.75) - quantile(L, 0.25)).toFixed(1),
    value,
    saturation,
    highlight: +(highlights / Math.max(1, total)).toFixed(3),
    bg: bg.map(Math.round),
  };
};

(async () => {
  console.log(`경계(가설): ${JSON.stringify(BANDS)}  ·  value light ≥ L*${BANDS.valueLight} > medium ≥ ${BANDS.valueDark} > dark  ·  C* < ${BANDS.achromaticC} 무채색(채도 해당 없음)`);
  for (const c of cases) {
    console.log(`\n## ${c.file}`);
    for (const [name, light] of Object.entries(LIGHTS)) {
      const raw = await measure(c.file, c.box2d, light, { whiteBalance: false });
      const wb = await measure(c.file, c.box2d, light, { whiteBalance: true });
      const s = (r) => (r.note ? r.note : `L*${r.L} C*${r.C} h${r.h} IQR(L)${r.LIqr} → ${r.value}/${r.saturation} 반사광 ${r.highlight}`);
      console.log(`  ${name.padEnd(6)} 보정 전: ${s(raw)}`);
      if (name !== "원본" && name !== "그림자") console.log(`  ${"".padEnd(6)} 배경 기준 보정: ${s(wb)}`);
    }
  }
})();
