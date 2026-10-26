// D-F02 설계 초안 r2(비파괴). r1(tone-rules.mjs)과 달라진 점:
//  - 무채색도 채도를 평가한다(Lab 채도 원칙: black·white·gray = low). 무채색 여부는 별도 칸 achromatic
//  - 상태 4가지: assessed(평가됨) · unrecorded(미평가) · undeterminable(판단 불가) · multiple(단일 대표값 없음 = multi)
//    r1의 not_applicable(해당 없음)은 쓰지 않는다 — multi도 색 특성은 있고, 하나로 대표할 수 없을 뿐이다
//  - silver·gold(금속색)는 일반 규칙을 적용하지 않고 별도 검증 대상(metallic_pending)
//  - 3×3 → colorTone 축약은 승인 전이다. 대안 비교용 후보만 둔다(compressCandidate)
// 앱 코드가 아니다.

export const RULES_VERSION = "D-F02-draft-r2";

export const ACHROMATIC_COLORS = ["black", "white", "gray"];
export const METALLIC_COLORS = ["silver", "gold"];

const cell = (value, status, source = null, reason = null) => ({ value, status, source, reason });

/**
 * 주색상 + 기존 colorTone → 판정 초안
 * - 주색상으로 직접 아는 것: 무채색이면 채도 low(source derived_from_main_color), achromatic = true
 * - colorTone으로 직접 아는 칸만(r1과 같음): light·dark → 명도, muted → 채도 low, vivid → 채도 high
 * - 무채색인데 colorTone vivid처럼 어긋나면 채도는 주색상 기준 low로 두고 conflicts에 남긴다(원본 colorTone은 그대로)
 */
export const deriveTone = (color, colorTone) => {
  const conflicts = [];

  if (color === "multi") {
    return {
      value: cell(null, "multiple", null, "no_single_main_color"),
      saturation: cell(null, "multiple", null, "no_single_main_color"),
      achromatic: { value: null, source: null },
      metallic: { value: false, source: "main_color" },
      conflicts,
      rulesVersion: RULES_VERSION,
    };
  }

  if (METALLIC_COLORS.includes(color)) {
    // 반사광 때문에 Gemini colorTone도 측정도 흔들린다 → 일반 역산을 하지 않고 검증 대기
    return {
      value: cell(null, "unrecorded", null, "metallic_pending"),
      saturation: cell(null, "unrecorded", null, "metallic_pending"),
      achromatic: { value: null, source: null },
      metallic: { value: true, source: "main_color" },
      conflicts,
      rulesVersion: RULES_VERSION,
    };
  }

  const achromatic = ACHROMATIC_COLORS.includes(color);
  const fromTone = (v) => cell(v, "assessed", "derived_from_color_tone");

  const value = colorTone === "light" || colorTone === "dark" ? fromTone(colorTone) : cell(null, "unrecorded");
  let saturation = colorTone === "muted" ? fromTone("low") : colorTone === "vivid" ? fromTone("high") : cell(null, "unrecorded");

  if (achromatic) {
    if (colorTone === "vivid") conflicts.push("W_ACHROMATIC_COLOR_TONE_VIVID");
    saturation = cell("low", "assessed", "derived_from_main_color");
  }

  return {
    value,
    saturation,
    achromatic: { value: achromatic ? true : null, source: achromatic ? "main_color" : null },
    metallic: { value: false, source: "main_color" },
    conflicts,
    rulesVersion: RULES_VERSION,
  };
};

/** 판단을 시도했지만 정보가 부족할 때(사진 없음, 흐림, 누끼 실패 등) */
export const undeterminable = (reason) => ({
  value: cell(null, "undeterminable", null, reason),
  saturation: cell(null, "undeterminable", null, reason),
});

/** 측정 결과(measure-core summarizeLab) → 판정. 금속성 의심이면 확정하지 않는다 */
export const fromMeasurement = (color, m) => {
  if (color === "multi") return deriveTone("multi", null);

  if (METALLIC_COLORS.includes(color) || m.metallicSuspect) {
    return {
      value: cell(null, "undeterminable", "measured", "metallic_reflection"),
      saturation: cell(null, "undeterminable", "measured", "metallic_reflection"),
      achromatic: { value: null, source: null },
      metallic: { value: METALLIC_COLORS.includes(color) ? true : null, source: METALLIC_COLORS.includes(color) ? "main_color" : "measured" },
      conflicts: m.metallicSuspect && !METALLIC_COLORS.includes(color) ? ["W_METALLIC_SUSPECT_NON_METAL_COLOR"] : [],
      rulesVersion: RULES_VERSION,
    };
  }

  const conflicts = [];
  const achromaticByColor = ACHROMATIC_COLORS.includes(color);

  // 주색상이 무채색인데 측정 채도가 높으면 조명 색 틀어짐을 의심(주색상을 바꾸지 않음)
  if (achromaticByColor && !m.achromatic) conflicts.push("W_LIGHTING_CAST_SUSPECT");
  // 유채색 주색상인데 측정상 거의 무채색(진한 네이비·블랙 경계 등) → 사람 검토 대상
  if (!achromaticByColor && m.achromatic) conflicts.push("W_NEAR_ACHROMATIC_CHROMATIC_COLOR");

  return {
    value: cell(m.value, "assessed", "measured"),
    saturation: achromaticByColor ? cell("low", "assessed", "derived_from_main_color") : cell(m.saturation, "assessed", "measured"),
    achromatic: { value: achromaticByColor ? true : m.achromatic, source: achromaticByColor ? "main_color" : "measured" },
    metallic: { value: false, source: "main_color" },
    conflicts,
    rulesVersion: RULES_VERSION,
  };
};

export const validateTone = (color, t) => {
  const issues = [];
  const cells = [t.value, t.saturation];

  if (color === "multi" && cells.some((c) => c.value !== null)) issues.push("E_MULTI_HAS_SINGLE_TONE");
  if (color !== "multi" && cells.some((c) => c.status === "multiple")) issues.push("E_MULTIPLE_WITHOUT_MULTI");
  if (cells.some((c) => c.status === "assessed" && c.value === null)) issues.push("E_ASSESSED_WITHOUT_VALUE");
  if (cells.some((c) => c.status !== "assessed" && c.value !== null)) issues.push("E_VALUE_WITHOUT_ASSESSED");
  if (cells.some((c) => c.status === "undeterminable" && !c.reason)) issues.push("E_UNDETERMINABLE_WITHOUT_REASON");
  if (t.achromatic?.value === true && t.saturation.value && t.saturation.value !== "low") issues.push("W_ACHROMATIC_NOT_LOW");
  if (METALLIC_COLORS.includes(color) && cells.some((c) => c.source === "derived_from_color_tone")) issues.push("E_METALLIC_DERIVED");

  return issues;
};

/* ---------- 3×3 → colorTone 축약 대안 (승인 전, 비교용) ---------- */

// 대안 A: 고정표(r1 practical). (medium, medium)은 대응 없음
const FIXED = {
  "light|low": "light", "light|medium": "light", "light|high": "bright",
  "medium|low": "muted", "medium|high": "vivid",
  "dark|low": "dark", "dark|medium": "dark", "dark|high": "dark",
};

// 대안 B: 색상별 기준 명도. 순색(가장 선명한 상태)이 어느 명도에 있는지가 색마다 다르다
// (노랑 순색은 밝음, 파랑·보라 순색은 어두움). 채도 high일 때 순색보다 밝으면 bright, 같으면 vivid, 어두우면 dark
const PURE_HUE_VALUE = {
  yellow: "light", gold: "light",
  orange: "medium", green: "medium", pink: "medium", red: "medium", teal: "medium", olive: "medium", beige: "light", ivory: "light",
  blue: "dark", purple: "dark",
};
// 이름 자체가 어두움을 뜻하는 색(진한 색이 정의). 채도가 높아도 vivid가 아니라 dark
const DARK_BY_NAME = ["navy", "burgundy", "brown"];
const RANK = { dark: 0, medium: 1, light: 2 };

export const compressCandidate = ({ value, saturation, color, alternative }) => {
  if (alternative === "none") return { colorTone: null, status: "not_compressed" };

  if (alternative === "fixed") {
    const tone = FIXED[`${value}|${saturation}`];
    return tone ? { colorTone: tone, status: "lossy" } : { colorTone: null, status: "unresolved" };
  }

  // hueAware
  if (saturation === "high") {
    if (DARK_BY_NAME.includes(color)) return { colorTone: "dark", status: "lossy" };
    const pure = PURE_HUE_VALUE[color];
    if (!pure) return { colorTone: null, status: "unresolved" };
    const diff = RANK[value] - RANK[pure];
    return { colorTone: diff > 0 ? "bright" : diff === 0 ? "vivid" : "dark", status: "lossy" };
  }
  if (value === "dark") return { colorTone: "dark", status: "lossy" };
  if (saturation === "low") return { colorTone: value === "light" ? "light" : "muted", status: "lossy" };
  // 채도 medium: 밝으면 light, 중간이면 대응 없음(PCCS soft·dull 계열 — muted로 볼지 공동창업자 결정)
  return value === "light" ? { colorTone: "light", status: "lossy" } : { colorTone: null, status: "unresolved" };
};
