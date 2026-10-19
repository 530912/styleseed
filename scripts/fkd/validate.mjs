// FKD 가져오기 검증 — Data Contract(fkd-contract-v0.1.json)에 맞는지 확인한다.
// 1단계 필드 검사(필수·형식·허용값)는 계약에서 자동으로, 2단계 교차 검사(참조·승인·독립 평가)는 아래 규칙으로.
// 모든 문제는 { level, code, entity, file, line, record, field, message }로 돌려준다(Knowledge Lab도 같은 코드 사용).

import crypto from "node:crypto";

import { isDate, listLookup, splitValues } from "./lib.mjs";

const isExampleRow = (v, keyField) =>
  v.data_origin === "example" || String(v[keyField] ?? "").startsWith("EX-");

// "status=confirmed", "approval_status!=draft" 같은 조건부 필수
const requiredNow = (required, v) => {
  if (required === true) return true;
  if (!required) return false;
  const match = String(required).match(/^(\w+)(!?=)(.+)$/);
  if (!match) return false;
  const [, field, op, expected] = match;
  return op === "=" ? v[field] === expected : v[field] !== expected;
};

export const createValidator = (contract) => {
  const lists = listLookup(contract);
  const codeText = contract.error_codes;
  const issues = [];

  const add = (level, code, ctx, detail = "") =>
    issues.push({
      level,
      code,
      entity: ctx.entity,
      file: ctx.file,
      line: ctx.line ?? 0,
      record: ctx.record ?? "",
      field: ctx.field ?? "",
      message: `${codeText[code] ?? code}${detail ? `: ${detail}` : ""}`,
    });

  // taxonomy: attribute → Map(value → { status, parent, appSupported, origin })
  const taxonomy = new Map();
  const taxonomyHas = (attribute, value) => {
    const entry = taxonomy.get(attribute)?.get(value);
    return Boolean(entry) && entry.status !== "retired";
  };

  // ---------- 1단계: 엔티티 하나의 필드 검사 + 정규화 ----------
  const checkEntity = (entityName, table) => {
    const spec = contract.entities[entityName];
    const fields = new Map(spec.fields.map((f) => [f.key, f]));
    const keyField = spec.key[0];
    const base = { entity: entityName, file: table.file };

    for (const key of table.keys) {
      if (!fields.has(key) && !key.startsWith("x_")) add("warning", "W_UNKNOWN_FIELD", { ...base, field: key }, key);
    }
    for (const f of spec.fields) {
      if (!table.missing && f.required === true && !table.keys.includes(f.key)) add("error", "E_MISSING_FIELD", { ...base, field: f.key }, f.key);
    }

    const records = [];
    const seenKeys = new Set();

    for (const { line, values } of table.rows) {
      const v = {};
      const record = spec.key.map((k) => values[k]).join("/");
      const ctx = { ...base, line, record };

      // 고정 목록을 먼저 정규화(조건부 필수 판단에 쓰므로)
      for (const f of spec.fields) {
        const raw = values[f.key] ?? "";
        if (f.display_only) continue;
        if (f.type === "enum" && f.list) v[f.key] = raw ? lists[f.list].get(raw) ?? lists[f.list].get(raw.toLowerCase()) ?? `!${raw}` : "";
        else if (f.type === "enum_list" && f.list) v[f.key] = splitValues(raw).map((x) => lists[f.list].get(x) ?? `!${x}`);
        else if (f.type === "enum_list" || f.type === "ref_list" || f.type === "taxonomy_values") v[f.key] = splitValues(raw);
        else v[f.key] = raw;
      }

      const example = isExampleRow(v, keyField);

      // 예시 행은 형식 설명용이라 검사하지 않는다(승인 여부만 규칙 검사에서 확인)
      if (example) {
        records.push({ line, v, example, ctx });
        continue;
      }

      for (const f of spec.fields) {
        if (f.display_only) continue;
        const value = v[f.key];
        const empty = Array.isArray(value) ? value.length === 0 : value === "";
        const fctx = { ...ctx, field: f.key };

        if (empty) {
          if (requiredNow(f.required, v) && !example) add("error", "E_REQUIRED", fctx, f.label);
          continue;
        }

        switch (f.type) {
          case "id":
            if (f.pattern && !new RegExp(f.pattern).test(value)) add("error", "E_PATTERN", fctx, `${f.label} "${value}" (형식 ${f.example})`);
            break;
          case "int": {
            const n = Number(value);
            if (!/^-?\d+$/.test(value) || (f.min !== undefined && n < f.min) || (f.max !== undefined && n > f.max)) {
              add("error", "E_INT", fctx, `${f.label} "${value}" (${f.min ?? ""}~${f.max ?? ""})`);
            }
            break;
          }
          case "date":
            if (!isDate(value)) add("error", "E_DATE", fctx, `${f.label} "${value}"`);
            break;
          case "url":
            if (!/^https:\/\/\S+$/.test(value)) add("error", "E_URL", fctx, value);
            break;
          case "text":
            if ((f.min_length && value.length < f.min_length) || (f.max_length && value.length > f.max_length)) {
              add("error", "E_TEXT_LENGTH", fctx, `${f.label} ${value.length}자 (${f.min_length ?? 0}~${f.max_length ?? "∞"})`);
            }
            break;
          case "enum":
            if (f.list && value.startsWith("!")) add("error", "E_ENUM", fctx, `${f.label} "${value.slice(1)}"`);
            if (f.taxonomy && !(f.allow ?? []).includes(value) && !taxonomyHas(f.taxonomy, value)) {
              add("error", "E_TAXONOMY_VALUE", fctx, `${f.taxonomy}:${value}`);
            }
            break;
          case "enum_list":
            for (const item of value) {
              if (f.list && item.startsWith("!")) add("error", "E_ENUM", fctx, `${f.label} "${item.slice(1)}"`);
              if (f.taxonomy && !taxonomyHas(f.taxonomy, item)) add("error", "E_TAXONOMY_VALUE", fctx, `${f.taxonomy}:${item}`);
            }
            break;
          case "ref_list":
            if ((f.min_items && value.length < f.min_items) || (f.max_items && value.length > f.max_items)) {
              add("error", "E_LIST_SIZE", fctx, `${f.label} ${value.length}개 (${f.min_items ?? 0}~${f.max_items ?? "∞"})`);
            }
            break;
          default:
            break;
        }
      }

      const uniqueKey = spec.key.map((k) => v[k]).join("\u0000");
      if (seenKeys.has(uniqueKey)) add("error", "E_DUPLICATE_KEY", ctx, record);
      seenKeys.add(uniqueKey);

      records.push({ line, v, example, ctx });
    }

    return records;
  };

  const refCheck = (records, field, targetIds, label) => {
    for (const { v, example, ctx } of records) {
      if (example) continue;
      const values = Array.isArray(v[field]) ? v[field] : v[field] ? [v[field]] : [];
      for (const id of values) {
        if (!targetIds.has(id)) add("error", "E_REF", { ...ctx, field }, `${label} "${id}"`);
      }
    }
  };

  // ---------- 2단계: 묶음 전체 검사 ----------
  const validateBundle = (tables) => {
    const data = {};

    data.evaluators = checkEntity("evaluators", tables.evaluators);
    const evaluatorIds = new Set(data.evaluators.filter((r) => !r.example).map((r) => r.v.evaluator_id));
    const approvers = new Set(
      data.evaluators.filter((r) => !r.example && r.v.can_approve === "yes" && r.v.active === "yes").map((r) => r.v.evaluator_id),
    );

    // 속성 사전을 먼저 읽어 taxonomy를 만든다(다른 엔티티의 허용값)
    for (const { values } of tables.attribute_values.rows) {
      if (values.data_origin === "예시" || values.data_origin === "example") continue;
      const attribute = values.attribute_key;
      if (!taxonomy.has(attribute)) taxonomy.set(attribute, new Map());
      taxonomy.get(attribute).set(values.value_key, {
        status: lists.taxonomy_status.get(values.status) ?? values.status,
        parent: values.parent_value,
        appSupported: lists.app_supported.get(values.app_supported) ?? values.app_supported,
      });
    }

    data.attribute_values = checkEntity("attribute_values", tables.attribute_values);
    refCheck(data.attribute_values, "decided_by", evaluatorIds, "평가자");
    for (const { v, example, ctx } of data.attribute_values) {
      if (example) continue;
      if (v.attribute_key === "subcategory" && v.parent_value && !taxonomyHas("category", v.parent_value)) {
        add("error", "E_PARENT_MISMATCH", { ...ctx, field: "parent_value" }, v.parent_value);
      }
      if (v.status === "confirmed") {
        if (v.data_origin !== "human") add("error", "E_CONFIRM_ORIGIN", { ...ctx, field: "data_origin" });
        for (const id of v.decided_by) if (!approvers.has(id)) add("error", "E_APPROVER_AUTHORITY", { ...ctx, field: "decided_by" }, id);
      }
    }

    data.garments = checkEntity("garments", tables.garments);
    const garmentIds = new Set(data.garments.filter((r) => !r.example).map((r) => r.v.garment_id));
    refCheck(data.garments, "labeled_by", evaluatorIds, "평가자");
    for (const { v, example, ctx } of data.garments) {
      if (example || !v.subcategory) continue;
      const parent = taxonomy.get("subcategory")?.get(v.subcategory)?.parent;
      if (parent && parent !== v.category) add("error", "E_PARENT_MISMATCH", { ...ctx, field: "subcategory" }, `${v.subcategory}는 ${parent}`);
    }

    data.outfits = checkEntity("outfits", tables.outfits);
    const outfitIds = new Set(data.outfits.filter((r) => !r.example).map((r) => r.v.outfit_id));
    refCheck(data.outfits, "garment_ids", garmentIds, "의류");

    data.styling_rules = checkRules(checkEntity("styling_rules", tables.styling_rules), evaluatorIds, approvers);

    data.outfit_evaluations = [];
    const evalKeys = new Set();
    for (const table of tables.outfit_evaluations ?? []) {
      const records = checkEntity("outfit_evaluations", table);
      refCheck(records, "outfit_id", outfitIds, "코디");
      refCheck(records, "evaluator_id", evaluatorIds, "평가자");
      const evaluators = new Set();
      for (const r of records) {
        if (r.example || r.v.submission_status !== "submitted") continue;
        evaluators.add(r.v.evaluator_id);
        if (r.v.data_origin !== "human") add("error", "E_EVAL_ORIGIN", { ...r.ctx, field: "data_origin" });
        const key = `${r.v.outfit_id}/${r.v.evaluator_id}/${r.v.round}`;
        if (evalKeys.has(key)) add("error", "E_DUPLICATE_KEY", r.ctx, `${key}(다른 파일과 중복)`);
        evalKeys.add(key);
      }
      // 독립 평가: 한 파일 = 한 평가자
      if (evaluators.size > 1) {
        add("error", "E_EVAL_MIXED_EVALUATOR", { entity: "outfit_evaluations", file: table.file }, [...evaluators].join(", "));
      }
      data.outfit_evaluations.push({ file: table.file, records, evaluator: [...evaluators][0] ?? null });
    }

    if (tables.disagreement_reviews) {
      data.disagreement_reviews = checkEntity("disagreement_reviews", tables.disagreement_reviews);
      refCheck(data.disagreement_reviews, "outfit_id", outfitIds, "코디");
    }

    return { issues, data, taxonomy };
  };

  // ---------- 규칙 교차 검사 ----------
  const checkRules = (records, evaluatorIds, approvers) => {
    const byId = new Map();
    for (const r of records) if (!r.example) (byId.get(r.v.rule_id) ?? byId.set(r.v.rule_id, []).get(r.v.rule_id)).push(r);

    refCheck(records, "author", evaluatorIds, "작성자");
    refCheck(records, "reviewer", evaluatorIds, "검토·승인자");

    for (const { v, example, ctx } of records) {
      const approved = v.approval_status === "approved";

      if (example) {
        if (approved) add("error", "E_EXAMPLE_APPROVED", ctx);
        continue;
      }

      const prefix = contract.rule_id_prefix[v.dimension];
      if (prefix && /^(COL|FIT|MAT|TPO|MOOD)-/.test(v.rule_id) && !v.rule_id.startsWith(`${prefix}-`)) {
        add("error", "E_RULE_PREFIX", { ...ctx, field: "rule_id" }, `${v.dimension} → ${prefix}-`);
      }

      for (const side of ["a", "b"]) {
        const attribute = v[`${side}_attribute`];
        const values = v[`${side}_values`];
        if (Boolean(attribute && !attribute.startsWith("!")) !== values.length > 0) {
          add("error", "E_CONDITION_INCOMPLETE", { ...ctx, field: `${side}_values` }, side.toUpperCase());
          continue;
        }
        if (!attribute || attribute.startsWith("!")) continue;
        for (const value of values) {
          if (!taxonomyHas(attribute, value)) add("error", "E_TAXONOMY_VALUE", { ...ctx, field: `${side}_values` }, `${attribute}:${value}`);
        }
        const supported = [...(taxonomy.get(attribute)?.values() ?? [])].some((e) => e.appSupported !== "no");
        if (!supported) add("warning", "W_UNSUPPORTED_ATTRIBUTE", { ...ctx, field: `${side}_attribute` }, attribute);
      }

      if (v.judgement === "conditional" && !(v.context_tpo.length || v.context_mood.length || v.context_season.length || v.context_weather.length)) {
        add("warning", "W_CONDITIONAL_NO_CONTEXT", ctx);
      }

      if (v.rule_type === "exception") {
        const bases = byId.get(v.exception_of) ?? [];
        if (bases.length === 0) add("error", "E_EXCEPTION_BASE", { ...ctx, field: "exception_of" }, v.exception_of);
        else if (approved && !bases.some((b) => b.v.approval_status === "approved")) {
          add("error", "E_EXCEPTION_BASE_NOT_APPROVED", { ...ctx, field: "exception_of" }, v.exception_of);
        }
      }

      if (approved) {
        if (v.data_origin !== "human") add("error", "E_APPROVAL_ORIGIN", { ...ctx, field: "data_origin" });
        if (v.author && v.author === v.reviewer) add("error", "E_APPROVAL_SAME_PERSON", { ...ctx, field: "reviewer" });
        if (v.reviewer && !approvers.has(v.reviewer)) add("error", "E_APPROVER_AUTHORITY", { ...ctx, field: "reviewer" }, v.reviewer);

        const used = [
          ["category", [v.a_category, v.b_category].filter((c) => c && c !== "any")],
          [v.a_attribute, v.a_values],
          [v.b_attribute, v.b_values],
          ["tpo", v.context_tpo],
          ["mood", v.context_mood],
          ["season", v.context_season],
        ];
        const unconfirmed = [];
        for (const [attribute, values] of used) {
          for (const value of values ?? []) {
            const entry = taxonomy.get(attribute)?.get(value);
            if (entry && entry.status !== "confirmed") unconfirmed.push(`${attribute}:${value}`);
          }
        }
        if (unconfirmed.length > 0) add("error", "E_UNCONFIRMED_VALUE", ctx, unconfirmed.join(", "));
      }
    }

    return records;
  };

  return { validateBundle, issues };
};

// ---------- manifest ----------
export const validateManifest = (contract, manifest, readFileBytes) => {
  const issues = [];
  const add = (level, code, detail = "") =>
    issues.push({ level, code, entity: "manifest", file: "manifest.json", line: 0, record: "", field: "", message: `${contract.error_codes[code]}${detail ? `: ${detail}` : ""}` });

  if (!manifest) {
    add("warning", "W_MANIFEST_MISSING");
    return issues;
  }

  const [major, minor] = String(manifest.contract_version ?? "").split(".").map(Number);
  const [ourMajor, ourMinor] = contract.contract_version.split(".").map(Number);

  if (!Number.isInteger(major) || !manifest.source || !manifest.files) add("error", "E_MANIFEST_INVALID", "contract_version·source·files 필요");
  else if (major !== ourMajor) add("error", "E_CONTRACT_MAJOR", `${manifest.contract_version} (지원 ${contract.contract_version})`);
  else if (minor > ourMinor) add("warning", "W_CONTRACT_NEWER", manifest.contract_version);

  for (const [file, hash] of Object.entries(manifest.files ?? {})) {
    const bytes = readFileBytes(file);
    if (!bytes) add("error", "E_FILE_MISSING", file);
    else if (crypto.createHash("sha256").update(bytes).digest("hex") !== hash) add("error", "E_HASH_MISMATCH", file);
  }

  return issues;
};

export const formatIssues = (issues) =>
  issues
    .map((i) => `${i.level === "error" ? "오류" : "경고"} [${i.code}] ${i.file}${i.line ? ` ${i.line}행` : ""}${i.field ? ` (${i.field})` : ""}: ${i.message}`)
    .join("\n");
