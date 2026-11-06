// D-F02 설계 초안(비파괴): color + value + saturation 신규 표준 ↔ 앱 colorTone 호환 규칙
// 앱 코드가 아니다. 공동창업자 확정 전 후보 규칙을 시나리오로 검증하기 위한 참고 구현이다.
// 원칙(D-F02 결정 2·3·4): colorTone은 유지하되 기준으로 쓰지 않음, 직접 확인 가능한 칸만 채움, 원본은 덮어쓰지 않음, multi는 명도·채도 없음

export const VALUES = ["light", "medium", "dark"];
export const SATURATIONS = ["low", "medium", "high"];
export const COLOR_TONES = ["bright", "light", "muted", "dark", "vivid"];

// 채도 개념이 없는 색(무채색·금속 무채색). ivory는 미세한 노란빛이 정의라 유채색 쪽(저채도)으로 둔다 — 공동창업자 확인
export const ACHROMATIC = ["black", "white", "gray", "silver"];

export const RULES_VERSION = "D-F02-draft-r1";

// 칸 하나의 상태: assessed(값 있음) · not_applicable(무채색 채도, multi) · unknown(판단 불가) · unrecorded(아직 안 봄)
const cell = (value, status, source = null) => ({ value, status, source });

/**
 * 기존 colorTone → 명도·채도 중 "직접 확인 가능한 칸"만 (Lab 요구 3.3)
 * 채운 칸의 source는 derived_from_color_tone. 평가·정확도 비교의 정답으로 쓰지 않는다
 */
export const deriveFromColorTone = (color, colorTone) => {
  if (color === "multi") {
    return { value: cell(null, "not_applicable"), saturation: cell(null, "not_applicable"), rulesVersion: RULES_VERSION };
  }

  const achromatic = ACHROMATIC.includes(color);
  const derived = (v) => cell(v, "assessed", "derived_from_color_tone");
  const value = colorTone === "light" || colorTone === "dark" ? derived(colorTone) : cell(null, "unrecorded");
  let saturation = colorTone === "muted" ? derived("low") : colorTone === "vivid" ? derived("high") : cell(null, "unrecorded");

  if (achromatic) saturation = cell(null, "not_applicable");

  return { value, saturation, rulesVersion: RULES_VERSION };
};

/**
 * 명도·채도 → 앱 colorTone 축약 후보. 앱이 원래 colorTone을 갖고 있으면 그 값을 우선한다(Lab 요구 3.4)
 *  strict: 의미가 분명한 5칸만 대응, 나머지는 unresolved
 *  practical: 명도 dark 우선 → 채도 high는 명도로 bright/vivid 구분 → 저채도 → muted/light. (medium, medium)만 unresolved
 * 무채색(채도 not_applicable)은 명도로만: light → bright(기존 앱 흰 옷 관례), medium → muted, dark → dark
 */
const STRICT = {
  "light|low": "light",
  "light|high": "bright",
  "medium|low": "muted",
  "medium|high": "vivid",
  "dark|medium": "dark",
};

const PRACTICAL = {
  ...STRICT,
  "light|medium": "light",
  "dark|low": "dark",
  "dark|high": "dark",
};

const ACHROMATIC_BY_VALUE = { light: "bright", medium: "muted", dark: "dark" };

export const toAppColorTone = ({ originalColorTone, value, saturation, mode = "practical" }) => {
  if (originalColorTone && COLOR_TONES.includes(originalColorTone)) {
    return { colorTone: originalColorTone, status: "original" };
  }

  if (value?.status !== "assessed") {
    return { colorTone: null, status: "unresolved", reason: "value_missing" };
  }

  if (saturation?.status === "not_applicable") {
    return { colorTone: ACHROMATIC_BY_VALUE[value.value], status: "converted", reason: "achromatic_by_value" };
  }

  if (saturation?.status !== "assessed") {
    return { colorTone: null, status: "unresolved", reason: "saturation_missing" };
  }

  const table = mode === "strict" ? STRICT : PRACTICAL;
  const tone = table[`${value.value}|${saturation.value}`];

  return tone
    ? { colorTone: tone, status: "converted" }
    : { colorTone: null, status: "unresolved", reason: `no_counterpart(${value.value},${saturation.value})` };
};

/** 내보내기 검증(Lab 요구 4장 a~c) */
export const validateTone = (color, tone) => {
  const issues = [];

  if (color === "multi" && (tone.value.value || tone.saturation.value)) issues.push("E_MULTI_HAS_TONE");
  if (tone.value.status === "assessed" && !tone.value.value) issues.push("E_ASSESSED_WITHOUT_VALUE");
  if (tone.saturation.status === "assessed" && !tone.saturation.value) issues.push("E_ASSESSED_WITHOUT_SATURATION");
  if (ACHROMATIC.includes(color) && tone.saturation.value) issues.push("W_ACHROMATIC_HAS_SATURATION");

  return issues;
};

/**
 * 엔진이 쓸 "해석된 톤": 출처 우선순위 human > measured(측정·Gemini 일치) > gemini > derived_from_color_tone
 * 값이 없으면 null → 엔진은 중립(가점·감점 없음) 처리하고 의류를 제외하지 않는다(V5)
 */
const SOURCE_RANK = { human: 4, measured: 3, gemini: 2, derived_from_color_tone: 1 };

export const resolveTone = (assessments, field) => {
  const usable = assessments
    .map((a) => a[field])
    .filter((c) => c && c.status === "assessed" && c.value)
    .sort((a, b) => (SOURCE_RANK[b.source] ?? 0) - (SOURCE_RANK[a.source] ?? 0));

  return usable[0] ?? null;
};
