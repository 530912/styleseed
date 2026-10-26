// D-F02 초안 r2 검증 — 무채색 low, 상태 4가지, multi, 실버·금속성, 조명, 축약 대안 비교
// 실행: node --test "scripts/analysis/color-tone-2026-10-22/*.test.mjs"   (r1 11개 테스트도 함께 유지)
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import { compressCandidate, deriveTone, fromMeasurement, undeterminable, validateTone } from "./tone-rules-r2.mjs";

const require = createRequire(import.meta.url);
const { summarizeLab } = require("./measure-core.cjs");

const s = (t) => [t.value.value, t.value.status, t.saturation.value, t.saturation.status];
const COLOR_TONES = ["bright", "light", "muted", "dark", "vivid"];
// 합성 픽셀: [L*, a*, b*]를 n개
const px = (n, L, a = 0, b = 0) => Array.from({ length: n }, (_, i) => [L + ((i % 5) - 2) * 0.6, a, b]);

/* ---- 1. 무채색: 채도 low + achromatic 별도 ---- */

test("무채색(black·white·gray)은 채도 low(주색상 근거), achromatic = true — colorTone과 무관", () => {
  for (const color of ["black", "white", "gray"]) {
    for (const tone of COLOR_TONES) {
      const t = deriveTone(color, tone);
      assert.equal(t.saturation.value, "low", `${color}/${tone}`);
      assert.equal(t.saturation.source, "derived_from_main_color");
      assert.equal(t.achromatic.value, true);
      assert.deepEqual(validateTone(color, t), [], `${color}/${tone}`);
    }
  }
});

test("Lab C2(차콜 gray·muted): 채도 low — r1의 '해당 없음'과 달리 Lab 기대값과 일치, 명도는 미평가", () => {
  assert.deepEqual(s(deriveTone("gray", "muted")), [null, "unrecorded", "low", "assessed"]);
});

test("저채도 유채색(navy muted)은 채도 low지만 achromatic이 아님(무채색과 구분됨)", () => {
  const navy = deriveTone("navy", "muted");
  const gray = deriveTone("gray", "muted");
  assert.equal(navy.saturation.value, gray.saturation.value);
  assert.notEqual(navy.achromatic.value, gray.achromatic.value);
});

test("무채색인데 colorTone vivid(모순) → 채도는 low 유지, 경고만 남김(원본 colorTone은 손대지 않음)", () => {
  const t = deriveTone("white", "vivid");
  assert.equal(t.saturation.value, "low");
  assert.deepEqual(t.conflicts, ["W_ACHROMATIC_COLOR_TONE_VIVID"]);
});

test("무채색에 채도 medium·high가 들어오면 경고", () => {
  const t = deriveTone("black", "dark");
  assert.ok(validateTone("black", { ...t, saturation: { value: "high", status: "assessed", source: "human" } }).includes("W_ACHROMATIC_NOT_LOW"));
});

/* ---- 2. 상태 4가지: 미평가·판단 불가·단일 대표값 없음 ---- */

test("multi는 '해당 없음'이 아니라 multiple(단일 대표값 없음)이고 값은 비어 있음", () => {
  const t = deriveTone("multi", "vivid");
  assert.deepEqual(s(t), [null, "multiple", null, "multiple"]);
  assert.equal(t.value.reason, "no_single_main_color");
  assert.deepEqual(validateTone("multi", t), []);
});

test("multi에 단일 명도·채도가 들어가면 오류, multi가 아닌데 multiple이면 오류", () => {
  const filled = { ...deriveTone("multi", null), value: { value: "light", status: "assessed", source: "human" } };
  assert.ok(validateTone("multi", filled).includes("E_MULTI_HAS_SINGLE_TONE"));
  assert.ok(validateTone("red", deriveTone("multi", null)).includes("E_MULTIPLE_WITHOUT_MULTI"));
});

test("판단 불가(undeterminable)는 사유가 필수 — 사진 없음과 미평가가 구분됨", () => {
  const noImage = { ...deriveTone("red", "bright"), ...undeterminable("no_image") };
  assert.deepEqual(s(noImage), [null, "undeterminable", null, "undeterminable"]);
  assert.deepEqual(validateTone("red", noImage), []);
  const noReason = { ...noImage, value: { value: null, status: "undeterminable", reason: null } };
  assert.ok(validateTone("red", noReason).includes("E_UNDETERMINABLE_WITHOUT_REASON"));
  assert.equal(deriveTone("red", "bright").value.status, "unrecorded");
});

test("값이 있는데 상태가 assessed가 아니면 오류(상태와 값 불일치)", () => {
  const bad = { ...deriveTone("red", "dark"), saturation: { value: "high", status: "unrecorded" } };
  assert.ok(validateTone("red", bad).includes("E_VALUE_WITHOUT_ASSESSED"));
});

/* ---- 3. 실버·금속성: 별도 검증 ---- */

test("silver·gold는 colorTone 역산을 하지 않음(metallic_pending), gray와 다르게 처리", () => {
  for (const color of ["silver", "gold"]) {
    for (const tone of COLOR_TONES) {
      const t = deriveTone(color, tone);
      assert.deepEqual(s(t), [null, "unrecorded", null, "unrecorded"], `${color}/${tone}`);
      assert.equal(t.value.reason, "metallic_pending");
      assert.equal(t.metallic.value, true);
      assert.deepEqual(validateTone(color, t), []);
    }
  }
  assert.equal(deriveTone("gray", "dark").value.value, "dark");
  assert.equal(deriveTone("silver", "dark").value.value, null);
});

test("금속색에 colorTone 역산값이 들어오면 오류", () => {
  const t = { ...deriveTone("silver", "dark"), value: { value: "dark", status: "assessed", source: "derived_from_color_tone" } };
  assert.ok(validateTone("silver", t).includes("E_METALLIC_DERIVED"));
});

test("측정: 무광 그레이는 확정, 금속성 실버(반사광 25%·어두운 반사 15%)는 금속성 의심 → 판단 불가", () => {
  const matte = summarizeLab([...px(300, 50, 1, 1)]);
  assert.equal(matte.metallicSuspect, false);
  assert.deepEqual(s(fromMeasurement("gray", matte)), ["medium", "assessed", "low", "assessed"]);

  const silver = summarizeLab([...px(180, 62, 0.5, -1), ...px(75, 97, 0, 0.5), ...px(45, 22, 0, -1)]);
  assert.equal(silver.metallicSuspect, true);
  assert.equal(silver.confidence, "low");
  const t = fromMeasurement("silver", silver);
  assert.deepEqual(s(t), [null, "undeterminable", null, "undeterminable"]);
  assert.equal(t.value.reason, "metallic_reflection");
});

test("측정: 광택 새틴(반사광 5%, 밝기 퍼짐 작음)은 금속성으로 오판하지 않음", () => {
  const satin = summarizeLab([...px(285, 45, 2, 2), ...px(15, 96, 0, 0)]);
  assert.equal(satin.metallicSuspect, false);
  assert.equal(fromMeasurement("gray", satin).value.value, "medium");
});

test("측정: 주색상이 gray인데 실버처럼 반사가 강하면 경고(주색상은 바꾸지 않음)", () => {
  const shiny = summarizeLab([...px(180, 62), ...px(75, 97), ...px(45, 22)]);
  const t = fromMeasurement("gray", shiny);
  assert.ok(t.conflicts.includes("W_METALLIC_SUSPECT_NON_METAL_COLOR"));
});

/* ---- 4. 조명 ---- */

test("측정: 흰 옷이 따뜻한 조명에서 C* 22로 측정되면 채도는 주색상 기준 low, 조명 경고", () => {
  const warmWhite = summarizeLab(px(300, 90, 2, 22));
  assert.equal(warmWhite.achromatic, false);
  const t = fromMeasurement("white", warmWhite);
  assert.equal(t.saturation.value, "low");
  assert.ok(t.conflicts.includes("W_LIGHTING_CAST_SUSPECT"));
});

test("측정: 진한 navy가 C* 7(무채색 범위)로 측정되면 채도 low, 무채색 판단은 measured로 남기고 검토 경고", () => {
  const navy = summarizeLab(px(300, 23, 2, -7));
  const t = fromMeasurement("navy", navy);
  assert.equal(t.saturation.value, "low");
  assert.equal(t.achromatic.source, "measured");
  assert.ok(t.conflicts.includes("W_NEAR_ACHROMATIC_CHROMATIC_COLOR"));
  assert.deepEqual(fromMeasurement("navy", summarizeLab(px(300, 23, 4, -20))).conflicts, []);
});

/* ---- 5. 3×3 → colorTone 축약 대안 비교(승인 전) ---- */

const ALL = ["light", "medium", "dark"].flatMap((value) => ["low", "medium", "high"].map((saturation) => ({ value, saturation })));

test("대안 none(축약하지 않음): 9칸 모두 not_compressed — 원래 colorTone만 사용", () => {
  assert.ok(ALL.every((c) => compressCandidate({ ...c, color: "red", alternative: "none" }).status === "not_compressed"));
});

test("(medium, medium)은 고정표·색상별 기준 모두 대응 없음", () => {
  for (const alternative of ["fixed", "hueAware"]) {
    assert.equal(compressCandidate({ value: "medium", saturation: "medium", color: "green", alternative }).status, "unresolved");
  }
});

test("밝음·높은 채도: 고정표는 항상 bright, 색상별 기준은 노랑이면 vivid(순색이 원래 밝음)", () => {
  assert.equal(compressCandidate({ value: "light", saturation: "high", color: "yellow", alternative: "fixed" }).colorTone, "bright");
  assert.equal(compressCandidate({ value: "light", saturation: "high", color: "yellow", alternative: "hueAware" }).colorTone, "vivid");
  assert.equal(compressCandidate({ value: "light", saturation: "high", color: "pink", alternative: "hueAware" }).colorTone, "bright");
});

test("어두움·높은 채도: 고정표는 코발트 블루도 dark(선명함 손실), 색상별 기준은 vivid. 진한 초록(에메랄드)은 두 안 모두 dark", () => {
  assert.equal(compressCandidate({ value: "dark", saturation: "high", color: "blue", alternative: "fixed" }).colorTone, "dark");
  assert.equal(compressCandidate({ value: "dark", saturation: "high", color: "blue", alternative: "hueAware" }).colorTone, "vivid");
  assert.equal(compressCandidate({ value: "dark", saturation: "high", color: "green", alternative: "hueAware" }).colorTone, "dark");
  // 이름이 진한 색(burgundy·navy)은 채도가 높아도 vivid가 아님 — 주색상 이름이 깊이 정보를 이미 보존
  assert.equal(compressCandidate({ value: "dark", saturation: "high", color: "burgundy", alternative: "hueAware" }).colorTone, "dark");
  assert.equal(compressCandidate({ value: "dark", saturation: "high", color: "navy", alternative: "hueAware" }).colorTone, "dark");
});

test("기존 관례 충돌: 흰 옷(명도 light·채도 low)을 축약하면 light — 앱이 흰 옷에 저장해 온 bright와 다름", () => {
  const white = { value: "light", saturation: deriveTone("white", "bright").saturation.value };
  for (const alternative of ["fixed", "hueAware"]) {
    assert.equal(compressCandidate({ ...white, color: "white", alternative }).colorTone, "light");
  }
});

test("색상별 기준은 순색 명도를 모르는 색(multi·black 등)에서 채도 high면 대응 없음", () => {
  assert.equal(compressCandidate({ value: "medium", saturation: "high", color: "multi", alternative: "hueAware" }).status, "unresolved");
});
