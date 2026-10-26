// D-F02 초안 규칙 검증 — Lab 요구 문서 6장 C1~C8 + 축약표 성질. 실행: node --test "scripts/analysis/color-tone-2026-10-22/*.test.mjs"
import assert from "node:assert/strict";
import test from "node:test";

import { COLOR_TONES, SATURATIONS, VALUES, deriveFromColorTone, resolveTone, toAppColorTone, validateTone } from "./tone-rules.mjs";

const v = (tone) => [tone.value.value, tone.value.status, tone.saturation.value, tone.saturation.status];

test("C1 흰 셔츠 bright: 명도·채도 모두 채우지 않음(채도는 해당 없음), 앱 colorTone은 bright 그대로", () => {
  const t = deriveFromColorTone("white", "bright");
  assert.deepEqual(v(t), [null, "unrecorded", null, "not_applicable"]);
  assert.equal(toAppColorTone({ originalColorTone: "bright", ...t }).colorTone, "bright");
});

test("C2 차콜(gray) 코트 muted: 무채색이라 채도도 채우지 않음, 명도 미평가", () => {
  // Lab 기대값은 '채도 low derived'지만 같은 문서의 무채색 제한(3.3 추가 제한)과 충돌 → 무채색 제한 우선(보고서 4.3)
  assert.deepEqual(v(deriveFromColorTone("gray", "muted")), [null, "unrecorded", null, "not_applicable"]);
  // 유채색 muted(예: 더스티 네이비)는 채도 low만
  assert.deepEqual(v(deriveFromColorTone("navy", "muted")), [null, "unrecorded", "low", "assessed"]);
});

test("C3 블랙 dark / 버건디 dark: 명도 dark(derived), 채도는 블랙 해당 없음·버건디 미평가", () => {
  assert.deepEqual(v(deriveFromColorTone("black", "dark")), ["dark", "assessed", null, "not_applicable"]);
  assert.deepEqual(v(deriveFromColorTone("burgundy", "dark")), ["dark", "assessed", null, "unrecorded"]);
  assert.equal(deriveFromColorTone("black", "dark").value.source, "derived_from_color_tone");
});

test("C4 형광 옐로 vivid: 채도 high만, 명도 미평가", () => {
  assert.deepEqual(v(deriveFromColorTone("yellow", "vivid")), [null, "unrecorded", "high", "assessed"]);
});

test("C5 multi: 둘 다 해당 없음, 앱 colorTone 원래 값 유지", () => {
  const t = deriveFromColorTone("multi", "vivid");
  assert.deepEqual(v(t), [null, "not_applicable", null, "not_applicable"]);
  assert.equal(toAppColorTone({ originalColorTone: "vivid", ...t }).colorTone, "vivid");
  assert.equal(toAppColorTone({ originalColorTone: null, ...t }).status, "unresolved");
});

test("C6 사람이 dark·high: 원래 colorTone 우선, 없으면 strict는 unresolved·practical은 dark", () => {
  const human = { value: { value: "dark", status: "assessed", source: "human" }, saturation: { value: "high", status: "assessed", source: "human" } };
  assert.equal(toAppColorTone({ originalColorTone: "vivid", ...human }).colorTone, "vivid");
  assert.equal(toAppColorTone({ originalColorTone: null, ...human, mode: "strict" }).status, "unresolved");
  assert.equal(toAppColorTone({ originalColorTone: null, ...human, mode: "practical" }).colorTone, "dark");
});

test("C7 multi인데 명도·채도가 채워지면 오류", () => {
  const bad = { value: { value: "light", status: "assessed" }, saturation: { value: "low", status: "assessed" } };
  assert.ok(validateTone("multi", bad).includes("E_MULTI_HAS_TONE"));
  assert.deepEqual(validateTone("multi", deriveFromColorTone("multi", "light")), []);
});

test("C8 colorTone 5개 × 주요 색: 역산으로 두 칸이 동시에 채워지는 경우가 없음(일대일 역산 금지)", () => {
  for (const color of ["white", "black", "gray", "navy", "red", "beige", "multi", "ivory", "silver"]) {
    for (const tone of COLOR_TONES) {
      const t = deriveFromColorTone(color, tone);
      assert.ok(!(t.value.value && t.saturation.value), `${color}/${tone}`);
      assert.deepEqual(validateTone(color, t), [], `${color}/${tone}`);
    }
  }
});

test("축약표: 원래 값 → 부분 역산 → 다시 축약하면 원래 값과 모순되지 않음(왕복)", () => {
  // 원래 colorTone이 있으면 항상 그대로 나와야 하고, 원래 값을 지운 뒤 부분 역산만으로는 대부분 unresolved(정보가 부족함을 숨기지 않음)
  for (const tone of COLOR_TONES) {
    const t = deriveFromColorTone("red", tone);
    assert.equal(toAppColorTone({ originalColorTone: tone, ...t }).colorTone, tone);
    assert.equal(toAppColorTone({ originalColorTone: null, ...t }).status, "unresolved", tone);
  }
});

test("축약표 커버리지: strict 5/9, practical 8/9, (medium, medium)은 두 안 모두 unresolved", () => {
  const count = (mode) => VALUES.flatMap((val) => SATURATIONS.map((sat) => toAppColorTone({ value: { value: val, status: "assessed" }, saturation: { value: sat, status: "assessed" }, mode }))).filter((r) => r.status === "converted").length;
  assert.equal(count("strict"), 5);
  assert.equal(count("practical"), 8);
  const mm = { value: { value: "medium", status: "assessed" }, saturation: { value: "medium", status: "assessed" } };
  assert.equal(toAppColorTone({ ...mm, mode: "practical" }).status, "unresolved");
});

test("해석 우선순위: human > measured > gemini > derived, 미평가는 null(엔진 중립)", () => {
  const a = [
    { value: { value: "dark", status: "assessed", source: "derived_from_color_tone" } },
    { value: { value: "medium", status: "assessed", source: "gemini" } },
    { value: { value: "light", status: "assessed", source: "human" } },
  ];
  assert.equal(resolveTone(a, "value").value, "light");
  assert.equal(resolveTone(a.slice(0, 2), "value").value, "medium");
  assert.equal(resolveTone([{ value: { value: null, status: "unrecorded" } }], "value"), null);
});
