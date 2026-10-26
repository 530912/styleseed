// 핏·실루엣 분리 호환 규칙 초안(비파괴). 앱 코드가 아니다.
// - 기존 clothes.fit(straight·wide 포함)은 바꾸지 않는다. 읽을 때 새 칸(fit, silhouette)으로 나눠 본다
// - 값 목록은 인계 JSON(buildDictionary)에서, 매핑·범위·우선순위는 compat-draft.json에서 받는다(하드코딩하지 않음)
// - 칸 하나 = { value, status, source, reason }
//   status: assessed(평가됨) · unrecorded(미평가) · undeterminable(판단 불가, 사유 필수)
//           not_applicable(대분류상 이 속성이 없음: 신발·가방·액세서리) · unresolved(폐기값이라 자동 변환 불가) · invalid

const cell = (value, status, source = null, reason = null) => ({ value, status, source, reason });

export const groupOf = (item, cfg) => {
  for (const [name, g] of Object.entries(cfg.garment_groups)) {
    if ((g.also ?? []).some(([c, s]) => c === item.category && s === item.subCategory)) return name;
  }
  for (const [name, g] of Object.entries(cfg.garment_groups)) {
    if (!g.category.includes(item.category)) continue;
    if (!g.subCategory || g.subCategory.includes(item.subCategory)) return name;
  }
  return null;
};

const notApplicable = (attr, item, cfg) => cfg.not_applicable_categories[attr]?.includes(item.category);

/**
 * 기존 앱 의류(fit 한 칸) → { fit, silhouette, legacyFit }
 * keys: { fit: Lab 핏 활성 키, silhouette: Lab 실루엣 활성 키, legacyFit: 앱 CLOTHING_FITS }
 */
export const splitLegacyFit = (item, cfg, keys) => {
  const legacyFit = item.fit ?? null;
  if (notApplicable("fit", item, cfg)) {
    // 신발·가방도 지금은 Gemini가 fit을 강제로 낸다(예: regular). 원본은 legacyFit에 남기고 새 칸에는 쓰지 않는다
    return {
      fit: cell(null, "not_applicable", null, "category"),
      silhouette: cell(null, "not_applicable", null, "category"),
      legacyFit,
    };
  }
  const moved = cfg.legacy_fit[legacyFit];
  if (moved) {
    return {
      fit: cell(null, moved.fit_status, null, moved.fit_reason), // regular 등으로 추측해 채우지 않는다
      silhouette: keys.silhouette.includes(moved.silhouette)
        ? cell(moved.silhouette, "assessed", "derived_from_legacy_fit")
        : cell(null, "unresolved", null, "silhouette_key_missing"),
      legacyFit,
    };
  }
  if (keys.fit.includes(legacyFit)) {
    return { fit: cell(legacyFit, "assessed", "legacy_app_fit"), silhouette: cell(null, "unrecorded"), legacyFit };
  }
  return { fit: cell(null, "invalid", null, "unknown_legacy_fit"), silhouette: cell(null, "unrecorded"), legacyFit };
};

/**
 * 새 칸(fit, silhouette)만으로 지금 엔진이 아는 fit 키를 다시 만든다(엔진 결과 유지 확인용).
 * 기존 값은 모두 원래 값으로 돌아와야 한다. 새 핏 값(fitted 등)은 엔진 키가 없으므로 null + 사유
 */
export const toEngineFit = (split, cfg, engineFitKeys) => {
  if (split.fit.status === "not_applicable") return { fit: split.legacyFit, via: "legacy_passthrough" };
  if (split.fit.status === "assessed" && engineFitKeys.includes(split.fit.value)) return { fit: split.fit.value, via: "fit" };
  const back = Object.entries(cfg.legacy_fit).find(([, m]) => m.silhouette === split.silhouette.value);
  if (split.fit.status !== "assessed" && back && engineFitKeys.includes(back[0])) return { fit: back[0], via: "silhouette" };
  return { fit: null, via: "none", reason: split.fit.status === "assessed" ? "fit_value_unknown_to_engine" : `fit_${split.fit.status}` };
};

/** 원시 실루엣 입력(Gemini·Lab·사용자) → 정규화. 대소문자는 바꾸지 않는다(A ≠ a) */
export const normalizeSilhouette = (raw, cfg, silhouetteKeys) => {
  if (raw === null || raw === undefined || raw === "") return { ...cell(null, "unrecorded"), original: raw ?? null, codes: [] };
  if (silhouetteKeys.includes(raw)) return { ...cell(raw, "assessed"), original: raw, codes: [] };
  const alias = cfg.silhouette_aliases[raw];
  if (alias && silhouetteKeys.includes(alias)) return { ...cell(alias, "assessed", null, "alias"), original: raw, codes: ["W_SILHOUETTE_ALIAS"] };
  const retired = cfg.retired_silhouette[raw];
  if (retired && silhouetteKeys.includes(retired)) return { ...cell(retired, "assessed", null, "retired_mapped"), original: raw, codes: ["W_SILHOUETTE_RETIRED_MAPPED"] };
  if (cfg.unresolved_silhouette.includes(raw)) return { ...cell(null, "unresolved", null, "retired_ambiguous"), original: raw, codes: ["W_SILHOUETTE_RETIRED_UNRESOLVED"] };
  const caseOnly = silhouetteKeys.find((k) => k.toLowerCase() === String(raw).toLowerCase());
  if (caseOnly) return { ...cell(null, "invalid", null, "case_mismatch"), original: raw, suggestion: caseOnly, codes: ["E_SILHOUETTE_CASE_MISMATCH"] };
  return { ...cell(null, "invalid", null, "unknown_value"), original: raw, codes: ["E_SILHOUETTE_UNKNOWN"] };
};

/** 대분류·세부분류별 적용 범위. 범위 밖은 지우지 않고 경고만(Lab DB도 강제하지 않음) */
export const checkScope = (item, silhouette, cfg) => {
  if (notApplicable("silhouette", item, cfg)) return silhouette ? { status: "error", code: "E_SILHOUETTE_NOT_APPLICABLE" } : { status: "not_applicable" };
  if (!silhouette) return { status: "ok" };
  const group = groupOf(item, cfg);
  const scope = cfg.silhouette_scope[silhouette];
  if (!scope) return { status: "unknown_scope" };
  return scope.includes(group) ? { status: "ok", group } : { status: "warn", code: "W_SILHOUETTE_SCOPE", group };
};

/** 이 의류에서 고를 수 있는 실루엣 키(프롬프트 선택 제공·평가용). 순서는 사전 순서를 따른다 */
export const allowedSilhouettes = (item, cfg, silhouetteKeys) => {
  if (notApplicable("silhouette", item, cfg)) return [];
  const group = groupOf(item, cfg);
  return silhouetteKeys.filter((k) => (cfg.silhouette_scope[k] ?? []).includes(group));
};

/**
 * 후보가 둘 이상일 때(사람 두 명의 라벨, Gemini 1·2순위 등) 단일 값으로 정한다.
 * 우선순위 규칙이 없는 쌍은 정하지 않고 conflict로 돌려 사람 검토로 보낸다
 */
export const resolveCandidates = (item, candidates, cfg, { upperEmphasis = false } = {}) => {
  const uniq = [...new Set(candidates.filter(Boolean))];
  if (uniq.length <= 1) return { value: uniq[0] ?? null, status: uniq.length ? "resolved" : "empty", rule: null };
  const group = groupOf(item, cfg);
  const wins = (a, b) =>
    cfg.precedence.find((p) => {
      const over = Array.isArray(p.over) ? p.over : [p.over];
      if (p.win !== a || !over.includes(b)) return false;
      if (p.when === "always") return true;
      if (p.when === "one_piece_with_upper_emphasis") return group === "one_piece" && upperEmphasis;
      return false;
    });
  const winners = uniq.filter((a) => uniq.every((b) => a === b || wins(a, b)));
  if (winners.length === 1) {
    const rules = uniq.filter((b) => b !== winners[0]).map((b) => wins(winners[0], b));
    return { value: winners[0], status: "resolved", rule: rules.map((r) => `${r.win}>${[].concat(r.over).join("|")}`) };
  }
  return { value: null, status: "conflict", candidates: uniq, rule: null };
};

/** 새 구조(fit·silhouette 칸)를 검사한다. 계약 0.3 후보 코드와 같은 뜻 */
export const validateFitSilhouette = (item, t, cfg, keys) => {
  const issues = [];
  const cells = { fit: t.fit, silhouette: t.silhouette };
  for (const [attr, c] of Object.entries(cells)) {
    if (c.status === "assessed" && c.value === null) issues.push(`E_${attr.toUpperCase()}_ASSESSED_WITHOUT_VALUE`);
    if (c.status !== "assessed" && c.value !== null) issues.push(`E_${attr.toUpperCase()}_VALUE_WITHOUT_ASSESSED`);
    if (c.status === "undeterminable" && !c.reason) issues.push(`E_${attr.toUpperCase()}_UNDETERMINABLE_WITHOUT_REASON`);
    if (notApplicable(attr, item, cfg) && c.value !== null) issues.push(`E_${attr.toUpperCase()}_NOT_APPLICABLE`);
  }
  // 핏 칸에 실루엣 값(옛 straight·wide), 실루엣 칸에 핏 값이 들어간 경우
  if (t.fit.value && keys.silhouette.includes(t.fit.value) && !keys.fit.includes(t.fit.value)) issues.push("E_FIT_HAS_SILHOUETTE_VALUE");
  if (t.silhouette.value && keys.fit.includes(t.silhouette.value)) issues.push("E_SILHOUETTE_HAS_FIT_VALUE");
  if (t.fit.value && !keys.fit.includes(t.fit.value)) issues.push("E_FIT_UNKNOWN");
  if (t.silhouette.value && !keys.silhouette.includes(t.silhouette.value)) issues.push("E_SILHOUETTE_UNKNOWN");
  const scope = checkScope(item, t.silhouette.value, cfg);
  if (scope.code === "W_SILHOUETTE_SCOPE") issues.push(scope.code);
  return [...new Set(issues)];
};
