// SlimSAM 후처리·판정 단위 테스트 (Sprint 1A-3, KI-1). 모델 없이 합성 마스크로 검증한다.
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  QUALITY,
  toPixelBox,
  buildPromptPoints,
  buildCenterPoint,
  maskStats,
  selectBestMask,
  assessQuality,
  fillSmallHoles,
} = require("../cutout");

const makeMask = (width, height, fill) => {
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) if (fill(x, y)) mask[y * width + x] = 1;
  return mask;
};

test("Gemini box_2d(y,x 순서, 0~1000)를 픽셀 상자로 변환하고 범위를 넘지 않는다", () => {
  assert.deepEqual(toPixelBox([100, 200, 900, 800], 500, 1000), [100, 100, 400, 900]);
  assert.deepEqual(toPixelBox([-50, -10, 1200, 1100], 100, 100), [0, 0, 100, 100]);
});

test("프롬프트 점 5개는 모두 상자 안, 첫 점은 예전 중심점(세로 55%)", () => {
  const box = [100, 200, 300, 600];
  const { points, labels } = buildPromptPoints(box);

  assert.equal(points.length, 5);
  assert.deepEqual(labels, [1, 1, 1, 1, 1]);
  assert.deepEqual(points[0], buildCenterPoint(box).points[0]);

  for (const [x, y] of points) {
    assert.ok(x > box[0] && x < box[2] && y > box[1] && y < box[3], `${x},${y}`);
  }
});

test("maskStats: 상자 채움 비율과 상자 밖 비율", () => {
  // 10x10 이미지, 상자 [0,0,5,10] (왼쪽 절반)
  const mask = makeMask(10, 10, (x) => x < 6); // 왼쪽 6열
  const stats = maskStats(mask, 10, 10, [0, 0, 5, 10]);

  assert.equal(stats.total, 60);
  assert.equal(stats.boxFill, 1);
  assert.ok(Math.abs(stats.outside - 10 / 60) < 1e-9);
});

test("KI-1 재현: 모델 점수가 높은 '단추' 마스크 대신 상자를 채운 옷 마스크를 고른다", () => {
  // 흰 셔츠 실측과 같은 형태: 점수 0.95인 아주 작은 후보 vs 점수 0.667인 큰 후보
  const button = { iou: 0.95, boxFill: 0.0003, outside: 0 };
  const shirt = { iou: 0.667, boxFill: 0.7, outside: 0.01 };
  const tiny = { iou: 0.936, boxFill: 0.001, outside: 0 };

  assert.equal(selectBestMask([shirt, button, tiny]), shirt);
});

test("배경을 잡은 후보(상자 밖 76%)는 채움이 커도 고르지 않는다(white-sneakers2 실측)", () => {
  const background = { iou: 1.0, boxFill: 0.95, outside: 0.76 };
  const shoes = { iou: 0.99, boxFill: 0.73, outside: 0.01 };

  assert.equal(selectBestMask([background, shoes]), shoes);
});

test("채움 차이가 2%p 이내면 모델 점수가 높은 후보", () => {
  const a = { iou: 0.9, boxFill: 0.7, outside: 0 };
  const b = { iou: 0.97, boxFill: 0.69, outside: 0 };

  assert.equal(selectBestMask([a, b]), b);
});

test("품질 판정: 상자 25% 미만은 too_small, 상자 밖 20% 초과는 background", () => {
  assert.deepEqual(assessQuality({ boxFill: QUALITY.minBoxFill - 0.01, outside: 0 }), { ok: false, reason: "too_small" });
  assert.deepEqual(assessQuality({ boxFill: 0.7, outside: QUALITY.maxOutside + 0.01 }), { ok: false, reason: "background" });
  assert.deepEqual(assessQuality({ boxFill: 0.7, outside: 0.05 }), { ok: true, reason: null });
});

test("작은 구멍(단추 자리)은 메우고, 큰 틈과 가장자리에 닿은 배경은 유지", () => {
  const W = 40;
  const H = 40;
  // 옷: [5,35) 정사각형. 안에 2x2 작은 구멍과 8x8 큰 구멍
  const mask = makeMask(W, H, (x, y) => {
    const inGarment = x >= 5 && x < 35 && y >= 5 && y < 35;
    const smallHole = x >= 10 && x < 12 && y >= 10 && y < 12;
    const bigHole = x >= 20 && x < 28 && y >= 20 && y < 28;
    return inGarment && !smallHole && !bigHole;
  });

  const { mask: filled, filledHoles, filledPixels } = fillSmallHoles(mask, W, H, 10);

  assert.equal(filledHoles, 1);
  assert.equal(filledPixels, 4);
  assert.equal(filled[10 * W + 10], 1, "작은 구멍은 메워짐");
  assert.equal(filled[24 * W + 24], 0, "큰 구멍은 그대로");
  assert.equal(filled[0], 0, "가장자리 배경은 그대로");
  assert.equal(mask[10 * W + 10], 0, "원본 마스크는 바꾸지 않음");
});
