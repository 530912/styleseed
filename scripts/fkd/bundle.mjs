// FKD 묶음 불러오기 — CSV 묶음 폴더와 JSON(bundle.json)을 같은 검증기 입력으로 바꾼다.
// JSON은 영어 키·정확한 타입(정수=number, 목록=배열)만 받는다. 규칙은 CSV와 완전히 같다.

import fs from "node:fs";
import path from "node:path";

import { readTable } from "./lib.mjs";
import { createValidator, validateManifest } from "./validate.mjs";

export const CSV_FILES = {
  evaluators: "evaluators.csv",
  attribute_values: "garment_schema.csv",
  garments: "garments.csv",
  outfits: "outfits.csv",
  styling_rules: "styling_rules.csv",
};

const LIST_TYPES = new Set(["enum_list", "ref_list", "taxonomy_values"]);

const issue = (contract, code, file, detail, extra = {}) => ({
  level: "error", code, entity: extra.entity ?? "bundle", file, line: extra.line ?? 0, record: extra.record ?? "",
  field: extra.field ?? "", message: `${contract.error_codes[code]}${detail ? `: ${detail}` : ""}`,
});

// ---------- CSV ----------
export const loadCsvBundle = (dir, contract) => {
  const issues = [];
  const tables = {};
  for (const [entity, file] of Object.entries(CSV_FILES)) {
    const full = path.join(dir, file);
    if (fs.existsSync(full)) tables[entity] = readTable(full, file);
    else {
      issues.push(issue(contract, "E_FILE_MISSING", file, file, { entity }));
      tables[entity] = { file, keys: [], rows: [], missing: true };
    }
  }
  const reviewFile = path.join(dir, "disagreement_review.csv");
  if (fs.existsSync(reviewFile)) tables.disagreement_reviews = readTable(reviewFile, "disagreement_review.csv");
  const evalDir = path.join(dir, "evaluations");
  tables.outfit_evaluations = fs.existsSync(evalDir)
    ? fs.readdirSync(evalDir).filter((f) => f.endsWith(".csv")).sort().map((f) => readTable(path.join(evalDir, f), `evaluations/${f}`))
    : [];

  const manifestFile = path.join(dir, "manifest.json");
  let manifest = null;
  if (fs.existsSync(manifestFile)) {
    try {
      manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
    } catch {
      manifest = {};
    }
  }
  issues.push(...validateManifest(contract, manifest, (file) => {
    const full = path.join(dir, file);
    return fs.existsSync(full) ? fs.readFileSync(full) : null;
  }));

  return { format: "csv", tables, manifest, issues };
};

// ---------- JSON ----------
const toCell = (contract, entity, field, value, ctx, issues) => {
  if (value === undefined || value === null) return "";
  const list = LIST_TYPES.has(field.type);
  if (Array.isArray(value)) {
    if (!list) issues.push(issue(contract, "E_JSON_INVALID", ctx.file, `${field.key}는 배열이 아니어야 함`, { ...ctx, entity, field: field.key }));
    return value.map(String).join("|");
  }
  if (list && value !== "") {
    issues.push(issue(contract, "E_JSON_INVALID", ctx.file, `${field.key}는 문자열 배열이어야 함`, { ...ctx, entity, field: field.key }));
    return String(value);
  }
  if (field.type === "int" && typeof value !== "number" && value !== "") {
    issues.push(issue(contract, "E_JSON_INVALID", ctx.file, `${field.key}는 숫자여야 함`, { ...ctx, entity, field: field.key }));
  }
  if (typeof value === "object" || typeof value === "boolean") {
    issues.push(issue(contract, "E_JSON_INVALID", ctx.file, `${field.key} 타입`, { ...ctx, entity, field: field.key }));
    return "";
  }
  return String(value);
};

const tableFromRecords = (contract, entity, records, file, issues) => {
  const fields = new Map(contract.entities[entity].fields.map((f) => [f.key, f]));
  const keys = [...new Set(records.flatMap((r) => Object.keys(r)))];
  return {
    file,
    keys,
    rows: records.map((record, index) => {
      const ctx = { file, line: index + 1 };
      const values = {};
      for (const key of keys) {
        const field = fields.get(key) ?? { key, type: "string" };
        values[key] = toCell(contract, entity, field, record[key], ctx, issues).trim();
      }
      return { line: index + 1, values };
    }),
  };
};

export const tablesFromJson = (contract, bundle, file = "bundle.json") => {
  const issues = [];
  if (!bundle || typeof bundle !== "object" || Array.isArray(bundle)) {
    issues.push(issue(contract, "E_JSON_INVALID", file, "최상위는 객체"));
    return { tables: null, issues };
  }
  const tables = {};
  for (const entity of Object.keys(CSV_FILES)) {
    const records = bundle[entity];
    if (!Array.isArray(records)) {
      issues.push(issue(contract, "E_FILE_MISSING", file, entity, { entity }));
      tables[entity] = { file: `${file}#${entity}`, keys: [], rows: [], missing: true };
    } else {
      tables[entity] = tableFromRecords(contract, entity, records, `${file}#${entity}`, issues);
    }
  }
  if (Array.isArray(bundle.disagreement_reviews)) {
    tables.disagreement_reviews = tableFromRecords(contract, "disagreement_reviews", bundle.disagreement_reviews, `${file}#disagreement_reviews`, issues);
  }
  // 평가는 평가자별 테이블로 나눠 독립 평가 검사를 CSV와 같게 한다
  const groups = new Map();
  for (const record of bundle.outfit_evaluations ?? []) {
    const id = record.evaluator_id || "(미지정)";
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(record);
  }
  tables.outfit_evaluations = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, records]) => tableFromRecords(contract, "outfit_evaluations", records, `${file}#outfit_evaluations[${id}]`, issues));

  for (const key of Object.keys(bundle)) {
    if (key !== "manifest" && !contract.entities[key] && !key.startsWith("x_")) {
      issues.push({ ...issue(contract, "W_UNKNOWN_FIELD", file, key), level: "warning" });
    }
  }
  return { tables, issues };
};

export const loadJsonBundle = (filePath, contract) => {
  let bundle;
  try {
    bundle = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    return { format: "json", tables: null, manifest: null, issues: [issue(contract, "E_JSON_INVALID", path.basename(filePath), error.message)] };
  }
  const { tables, issues } = tablesFromJson(contract, bundle, path.basename(filePath));
  const manifest = bundle?.manifest ?? null;
  if (manifest && manifest.format !== "json") {
    issues.push(issue(contract, "E_MANIFEST_INVALID", "bundle.json", 'JSON 묶음의 manifest.format은 "json"'));
  }
  issues.push(...validateManifest(contract, manifest, () => null));
  return { format: "json", tables, manifest, issues };
};

// 폴더(CSV 묶음, 또는 bundle.json이 든 폴더)나 .json 파일 경로
export const loadBundle = (target, contract) => {
  if (target.endsWith(".json")) return loadJsonBundle(target, contract);
  const json = path.join(target, "bundle.json");
  if (!fs.existsSync(path.join(target, CSV_FILES.styling_rules)) && fs.existsSync(json)) return loadJsonBundle(json, contract);
  return loadCsvBundle(target, contract);
};

export const runValidation = (target, contract) => {
  const bundle = loadBundle(target, contract);
  if (!bundle.tables) {
    return { ...bundle, data: null, taxonomy: null, errors: bundle.issues.filter((i) => i.level === "error").length };
  }
  const result = createValidator(contract, { strictEnumKeys: bundle.format === "json" }).validateBundle(bundle.tables);
  const issues = [...bundle.issues, ...result.issues];
  return { ...bundle, ...result, issues, errors: issues.filter((i) => i.level === "error").length };
};

// ---------- 검증된 데이터 → JSON 묶음(정식 형식) ----------
export const toJsonBundle = (contract, data, manifest) => {
  const out = { manifest };
  const convert = (entity, records) =>
    records.map(({ v }) => {
      const object = {};
      for (const f of contract.entities[entity].fields) {
        const value = v[f.key];
        if (value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) continue;
        object[f.key] = f.type === "int" ? Number(value) : value;
      }
      return object;
    });
  for (const entity of Object.keys(CSV_FILES)) out[entity] = convert(entity, data[entity]);
  out.outfit_evaluations = data.outfit_evaluations.flatMap((group) => convert("outfit_evaluations", group.records));
  if (data.disagreement_reviews) out.disagreement_reviews = convert("disagreement_reviews", data.disagreement_reviews);
  return out;
};
