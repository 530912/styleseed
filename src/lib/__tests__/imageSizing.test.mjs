// Sprint 1A-3: 업로드 전 이미지 크기 규칙 (KI-9)
import test from "node:test";
import assert from "node:assert/strict";

import {
  ANALYZE_BASE64_LIMIT,
  UPLOAD_MAX_SIDE,
  base64ToBytes,
  computeTargetSize,
  isWithinAnalyzeLimit,
} from "../imageSizing.ts";

test("휴대폰 원본(4032x3024)은 긴 변 1600px로 줄이고 비율 유지", () => {
  const t = computeTargetSize(4032, 3024);

  assert.equal(t.resized, true);
  assert.equal(Math.max(t.width, t.height), UPLOAD_MAX_SIDE);
  assert.ok(Math.abs(t.width / t.height - 4032 / 3024) < 0.01);
});

test("세로 사진(3024x4032)과 아주 긴 사진도 긴 변 기준", () => {
  assert.deepEqual(computeTargetSize(3024, 4032), { width: 1200, height: 1600, resized: true });
  assert.deepEqual(computeTargetSize(1000, 8000), { width: 200, height: 1600, resized: true });
});

test("이미 작은 사진은 확대하지 않음, 크기 정보가 없으면 0", () => {
  assert.deepEqual(computeTargetSize(736, 736), { width: 736, height: 736, resized: false });
  assert.deepEqual(computeTargetSize(0, 0), { width: 0, height: 0, resized: false });
});

test("분석 요청 한도: base64 길이 기준(요청 10MB 안쪽)", () => {
  assert.ok(ANALYZE_BASE64_LIMIT < 10 * 1024 * 1024);
  assert.equal(isWithinAnalyzeLimit(ANALYZE_BASE64_LIMIT), true);
  assert.equal(isWithinAnalyzeLimit(ANALYZE_BASE64_LIMIT + 1), false);
  assert.equal(base64ToBytes(4), 3);
});
