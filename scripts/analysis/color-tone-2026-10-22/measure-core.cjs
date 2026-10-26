// 색상 공간 측정 계산(순수 함수). measure.cjs(사진)와 테스트(합성 픽셀)가 함께 쓴다
// 경계는 가설값이다. 기준 세트로 조정한다(설계 문서 5.4)

const BANDS = { valueLight: 70, valueDark: 40, achromaticC: 8, satLow: 18, satHigh: 40 };

// 금속성(실버·골드) 의심 기준(가설): 반사광 비율과 밝기 퍼짐이 함께 큼
const METALLIC = { specularL: 90, specularC: 6, specularShare: 0.08, iqrL: 25 };

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29);

const rgbToLab = (r, g, b) => {
  const [R, G, B] = [r, g, b].map((x) => toLinear(x / 255));
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  const Y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
};

const quantile = (arr, q) => {
  const s = [...arr].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};

/**
 * 옷 영역 픽셀(Lab) → 명도·채도 요약
 * - 반사광(매우 밝고 색 없음)은 값 계산에서 빼고 비율만 기록한다
 * - 채도는 측정 그대로(무채색도 low). 무채색 여부는 achromatic으로 따로 낸다(설계 r2 2장)
 * - 금속성 의심이면 명도·채도를 확정하지 않도록 confidence를 낮춘다(실버 별도 검증, r2 4장)
 */
const summarizeLab = (pixels, bands = BANDS) => {
  const chroma = (p) => Math.hypot(p[1], p[2]);
  const specular = pixels.filter((p) => p[0] > METALLIC.specularL && chroma(p) < METALLIC.specularC);
  const diffuse = pixels.filter((p) => !(p[0] > METALLIC.specularL && chroma(p) < METALLIC.specularC));
  const base = diffuse.length > 0 ? diffuse : pixels;

  const L = base.map((p) => p[0]);
  const C = base.map(chroma);
  const Lm = quantile(L, 0.5);
  const Cm = quantile(C, 0.5);
  const allL = pixels.map((p) => p[0]);
  const iqrL = quantile(allL, 0.75) - quantile(allL, 0.25);
  const specularShare = specular.length / Math.max(1, pixels.length);
  const metallicSuspect = specularShare >= METALLIC.specularShare && iqrL >= METALLIC.iqrL;

  return {
    L: Lm,
    C: Cm,
    iqrL,
    specularShare,
    metallicSuspect,
    value: Lm >= bands.valueLight ? "light" : Lm < bands.valueDark ? "dark" : "medium",
    saturation: Cm < bands.satLow ? "low" : Cm >= bands.satHigh ? "high" : "medium",
    achromatic: Cm < bands.achromaticC,
    confidence: metallicSuspect ? "low" : "normal",
  };
};

module.exports = { BANDS, METALLIC, rgbToLab, quantile, summarizeLab };
