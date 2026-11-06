// 연구용 분류(Knowledge Lab) → STYLESEED 앱 값 변환 규칙 (계약 app_compat)
// 원칙: 원본(research)과 앱 값(app)을 함께 남기고, 앱이 모르는 값은 가까운 값으로 바꾸지 않는다.
//   - 필수 속성(대분류·세부분류·색·색 톤·핏·소재)에 앱 값이 없으면 그 의류는 app = null(앱·엔진 입력 제외)
//   - 목록 속성(계절·TPO·무드)의 미지원 값은 빠지고 dropped에 남는다
// 이 파일은 계약의 참고 구현이다. 엔진 기준선(S1)이 이 결과를 그대로 쓴다.

export const isAppValue = (compat, field, value) => {
  const allowed = compat.app_values[field];
  if (!allowed) return false;
  return Array.isArray(allowed) ? allowed.includes(value) : Object.values(allowed).some((list) => list.includes(value));
};

// 앱 세부분류의 앱 상위 대분류
export const appParentOf = (compat, subCategory) =>
  Object.entries(compat.app_values.subCategory).find(([, list]) => list.includes(subCategory))?.[0] ?? null;

// 속성 사전 값 하나 → { status: yes|converted|derived|unsupported|unknown, values: [앱 값] | null, rule? }
export const resolveTaxonomyForApp = (compat, taxonomy, attribute, key) => {
  const entry = taxonomy?.get(attribute)?.get(key);
  if (!entry) return { status: "unknown", values: null };
  if (entry.status === "retired") return { status: "unsupported", values: null, reason: "retired" };
  const field = entry.appField;
  if (field === "none" || entry.appSupported === "no") return { status: "unsupported", values: null };
  if (entry.appSupported === "yes") {
    return isAppValue(compat, field, key) ? { status: "yes", values: [key] } : { status: "unsupported", values: null, reason: "not_app_value" };
  }
  if (entry.appSupported === "converted") {
    const parts = String(entry.appValue ?? "").split("|").map((x) => x.trim()).filter(Boolean);
    if (parts.length > 0) {
      return parts.every((p) => isAppValue(compat, field, p)) ? { status: "converted", values: parts } : { status: "unsupported", values: null, reason: "not_app_value" };
    }
    const derived = compat.derived_conversions.find((d) => d.attribute_key === attribute && d.value_key === key)
      ?? compat.derived_conversions.find((d) => d.attribute_key === attribute && d.value_key === "*");
    if (derived?.app_values) return { status: "derived", values: derived.app_values, rule: derived.rule };
    return { status: "unsupported", values: null, reason: derived ? "derived_rule_pending" : "no_app_value" };
  }
  return { status: "unsupported", values: null };
};

const listOf = (value) => (Array.isArray(value) ? value : value ? [value] : []);

// 의류 하나(검증된 v) → 변환 기록
export const convertGarmentForApp = (contract, taxonomy, v) => {
  const compat = contract.app_compat;
  const research = {};
  const app = {};
  const conversions = [];
  const dropped = [];
  const unresolved = [];

  for (const m of compat.garment_field_map) {
    const raw = v[m.contract];
    research[m.contract] = m.multi ? listOf(raw) : raw ?? "";

    if (m.list) {
      // 계약 고정 목록이 앱 목록과 같은 필드(color_tone)
      if (raw && isAppValue(compat, m.app, raw)) app[m.app] = raw;
      else unresolved.push({ field: m.contract, value: raw ?? "", reason: "not_app_value" });
      continue;
    }

    const values = m.multi ? listOf(raw) : raw ? [raw] : [];
    const out = [];
    for (const key of values) {
      const r = resolveTaxonomyForApp(compat, taxonomy, m.taxonomy, key);
      if (!r.values) {
        (m.multi ? dropped : unresolved).push({ field: m.contract, value: key, reason: r.reason ?? r.status });
        continue;
      }
      if (r.status !== "yes") conversions.push({ field: m.contract, app_field: m.app, from: key, to: m.multi ? r.values : r.values[0], kind: r.status, ...(r.rule && { rule: r.rule }) });
      out.push(...r.values);
    }
    if (m.multi) app[m.app] = [...new Set(out)];
    else if (out.length > 0) app[m.app] = out[0];
    else if (values.length === 0 && m.required) unresolved.push({ field: m.contract, value: "", reason: "empty" });
  }

  // 앱 상·하위 분류 일치(앱은 세부분류가 대분류 안에 있어야 함)
  if (app.subCategory && app.category) {
    const parent = appParentOf(compat, app.subCategory);
    if (parent !== app.category) unresolved.push({ field: "subcategory", value: `${research.category}/${research.subcategory}`, reason: `app_parent_mismatch(${app.subCategory}는 앱 ${parent})` });
  }

  const researchOnly = Object.fromEntries(
    compat.research_only_fields.filter((f) => listOf(v[f]).length > 0).map((f) => [f, v[f]]),
  );
  const status = unresolved.length > 0 ? "unsupported" : dropped.length > 0 ? "lossy" : conversions.length > 0 ? "converted" : "exact";

  return {
    garment_id: v.garment_id,
    status,
    research,
    app: status === "unsupported" ? null : app,
    conversions,
    dropped,
    unresolved,
    research_only: researchOnly,
  };
};

// 묶음 전체: 검증 결과(data, taxonomy) → 의류별 변환 기록 + 요약 + 경고
export const convertGarmentsForApp = (contract, data, taxonomy) => {
  const records = data.garments.filter((r) => !r.example).map((r) => ({ ...convertGarmentForApp(contract, taxonomy, r.v), ctx: r.ctx }));
  const summary = { exact: 0, converted: 0, lossy: 0, unsupported: 0 };
  const issues = [];
  for (const { ctx, ...record } of records) {
    summary[record.status] += 1;
    if (record.status === "unsupported") {
      issues.push({ level: "warning", code: "W_APP_UNSUPPORTED", entity: "garments", file: ctx.file, line: ctx.line, record: record.garment_id, field: record.unresolved.map((u) => u.field).join(","), message: `${contract.error_codes.W_APP_UNSUPPORTED}: ${record.unresolved.map((u) => `${u.field}=${u.value}(${u.reason})`).join(", ")}` });
    } else if (record.status === "lossy") {
      issues.push({ level: "warning", code: "W_APP_LOSSY", entity: "garments", file: ctx.file, line: ctx.line, record: record.garment_id, field: record.dropped.map((d) => d.field).join(","), message: `${contract.error_codes.W_APP_LOSSY}: ${record.dropped.map((d) => `${d.field}=${d.value}`).join(", ")}` });
    }
  }
  return { records: records.map(({ ctx, ...record }) => record), summary, issues };
};
