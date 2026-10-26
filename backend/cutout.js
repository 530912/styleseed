// SlimSAM 의류 분리: 프롬프트·마스크 선택·후처리·품질 판정 (Sprint 1A-3, KI-1)
//
// 배경: 이 SlimSAM ONNX 모델은 입력으로 점(input_points)만 받는다. 상자(input_boxes)를 함께 넘기면
// "Too many inputs ... input_boxes will be ignored" 경고와 함께 상자가 무시된다.
// 그래서 예전 방식(상자 + 옷 중심점 1개)은 사실상 "중심점 1개"였고, 그 점이 단추 위에 놓이면
// 단추만 잘라냈다(KI-1). 이 모듈은 Gemini 상자 안에 양성 점 5개를 고르게 찍고,
// 후보 마스크 중 상자를 가장 잘 채우는 것을 고른 뒤, 작은 구멍(단추·자수 사이 틈)을 메우고,
// 결과 품질이 기준에 못 미치면 실패로 돌려 BRIA 대체 경로로 넘기게 한다.
//
// 모델과 무관한 순수 함수만 둔다(backend/test/cutout.test.js에서 직접 검증).

// 품질 기준 (7장 평가 세트 기준으로 정한 초기값)
const QUALITY = {
  // 마스크가 Gemini 상자 면적의 25% 미만이면 옷 일부(단추 등)만 잡은 것으로 본다
  minBoxFill: 0.25,
  // 마스크 픽셀의 20% 넘게 상자 밖에 있으면 배경을 잡은 것으로 본다
  maxOutside: 0.2,
  // 후보 선택 시 상자 밖 비율 허용치
  selectMaxOutside: 0.15,
  // 메울 구멍의 최대 크기: 이미지 면적의 0.3%(단추·작은 틈). 팔과 몸통 사이 같은 큰 틈은 남긴다
  maxHoleFraction: 0.003,
};

// Gemini box_2d [ymin, xmin, ymax, xmax] (0~1000) → 픽셀 상자 [x1, y1, x2, y2]
const toPixelBox = (box2d, width, height) => {
  const [yMin, xMin, yMax, xMax] = box2d.map(Number);

  const clamp = (value, max) => Math.max(0, Math.min(max, value));

  return [
    clamp(Math.round((xMin / 1000) * width), width),
    clamp(Math.round((yMin / 1000) * height), height),
    clamp(Math.round((xMax / 1000) * width), width),
    clamp(Math.round((yMax / 1000) * height), height),
  ];
};

// 상자 안 양성 점 5개: 예전 중심점(세로 55%) + 상자 안쪽 네 지점
const buildPromptPoints = ([x1, y1, x2, y2]) => {
  const w = x2 - x1;
  const h = y2 - y1;

  const at = (fx, fy) => [Math.round(x1 + w * fx), Math.round(y1 + h * fy)];

  return {
    points: [at(0.5, 0.55), at(0.3, 0.3), at(0.7, 0.3), at(0.3, 0.75), at(0.7, 0.75)],
    labels: [1, 1, 1, 1, 1],
  };
};

// 중심점 1개(예전 방식) — 5점 결과가 기준 미달일 때 한 번 더 시도한다
const buildCenterPoint = ([x1, y1, x2, y2]) => ({
  points: [[Math.round((x1 + x2) / 2), Math.round(y1 + (y2 - y1) * 0.55)]],
  labels: [1],
});

// mask: 길이 width*height, 0이 아니면 옷
const maskStats = (mask, width, height, [x1, y1, x2, y2]) => {
  let total = 0;
  let inBox = 0;

  for (let y = 0; y < height; y += 1) {
    const row = y * width;

    for (let x = 0; x < width; x += 1) {
      if (!mask[row + x]) continue;

      total += 1;

      if (x >= x1 && x < x2 && y >= y1 && y < y2) inBox += 1;
    }
  }

  const boxArea = Math.max(1, (x2 - x1) * (y2 - y1));

  return {
    total,
    boxFill: inBox / boxArea,
    outside: total ? (total - inBox) / total : 0,
  };
};

// 후보(모델 점수 iou + maskStats) 중 상자를 가장 잘 채우는 것.
// 상자 밖 비율이 허용치 이하인 후보를 우선하고, 채움 차이가 2%p 이내면 모델 점수가 높은 쪽
const selectBestMask = (candidates) => {
  const within = candidates.filter((c) => c.outside <= QUALITY.selectMaxOutside);

  const pool = within.length > 0 ? within : candidates;

  return pool.reduce((best, c) => {
    if (c.boxFill > best.boxFill + 0.02) return c;

    if (Math.abs(c.boxFill - best.boxFill) <= 0.02 && c.iou > best.iou) return c;

    return best;
  });
};

const assessQuality = ({ boxFill, outside }) => {
  if (boxFill < QUALITY.minBoxFill) {
    return { ok: false, reason: "too_small" };
  }

  if (outside > QUALITY.maxOutside) {
    return { ok: false, reason: "background" };
  }

  return { ok: true, reason: null };
};

// 옷 마스크 안에 갇힌 작은 배경 구멍을 메운다(이미지 가장자리에 닿는 배경은 그대로).
// 새 배열을 돌려준다.
const fillSmallHoles = (mask, width, height, maxHolePixels) => {
  const out = Uint8Array.from(mask, (v) => (v ? 1 : 0));
  const seen = new Uint8Array(width * height);
  const stack = new Int32Array(width * height);

  let filledHoles = 0;
  let filledPixels = 0;

  for (let start = 0; start < width * height; start += 1) {
    if (out[start] || seen[start]) continue;

    // 이 배경 영역을 모은다
    let top = 0;
    let size = 0;
    let touchesBorder = false;

    const region = [];

    stack[top++] = start;
    seen[start] = 1;

    while (top > 0) {
      const p = stack[--top];
      const x = p % width;
      const y = (p - x) / width;

      size += 1;

      if (size <= maxHolePixels) region.push(p);

      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) touchesBorder = true;

      if (x > 0 && !out[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; stack[top++] = p - 1; }
      if (x < width - 1 && !out[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; stack[top++] = p + 1; }
      if (y > 0 && !out[p - width] && !seen[p - width]) { seen[p - width] = 1; stack[top++] = p - width; }
      if (y < height - 1 && !out[p + width] && !seen[p + width]) { seen[p + width] = 1; stack[top++] = p + width; }
    }

    if (!touchesBorder && size <= maxHolePixels) {
      for (const p of region) out[p] = 1;

      filledHoles += 1;
      filledPixels += size;
    }
  }

  return { mask: out, filledHoles, filledPixels };
};

module.exports = {
  QUALITY,
  toPixelBox,
  buildPromptPoints,
  buildCenterPoint,
  maskStats,
  selectBestMask,
  assessQuality,
  fillSmallHoles,
};
