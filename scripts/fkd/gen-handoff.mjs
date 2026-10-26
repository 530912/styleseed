// Claude C 전달용 독립 패키지 생성 — docs/handoff/fkd-data-contract-v0.1/
//   원본: 계약 JSON(data/fkd/contract) + 손으로 작성한 예시 CSV 묶음(패키지 examples/csv/*.csv)
//   생성: 계약 사본, JSON Schema, 예시 manifest(해시), 예시 JSON 묶음, 잘못된 예시 + 기대 오류 코드, README 표
//   node scripts/fkd/gen-handoff.mjs          생성
//   node scripts/fkd/gen-handoff.mjs --check  생성 결과가 디스크와 같은지 확인

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { CSV_FILES, loadCsvBundle, toJsonBundle } from "./bundle.mjs";
import { syncDoc } from "./gen-contract-doc.mjs";
import { CONTRACT_PATH, ROOT, loadContract } from "./lib.mjs";
import { createValidator } from "./validate.mjs";

export const PACKAGE_DIR = path.join(ROOT, "docs/handoff/fkd-data-contract-v0.1");
const EXPORTED_AT = "2026-10-24T10:00:00+09:00";

const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const json = (value) => `${JSON.stringify(value, null, 1)}\n`;

// ---------- JSON Schema (draft 2020-12) ----------
const fieldSchema = (contract, f) => {
  const keys = f.list ? contract.lists[f.list].map(([k]) => k) : null;
  const base = { description: [f.label, f.desc].filter(Boolean).join(" — ") };
  if (f.required && f.required !== true) base["x-required-when"] = f.required;
  if (f.taxonomy) base["x-taxonomy"] = f.taxonomy;
  if (f.ref) base["x-ref"] = f.ref;
  if (f.display_only) base["x-display-only"] = true;
  if (f.type === "int") return { ...base, type: "integer", ...(f.min !== undefined && { minimum: f.min }), ...(f.max !== undefined && { maximum: f.max }) };
  if (f.type === "enum_list" || f.type === "ref_list" || f.type === "taxonomy_values") {
    return { ...base, type: "array", items: { type: "string", ...(keys && { enum: keys }) }, ...(f.min_items && { minItems: f.min_items }), ...(f.max_items && { maxItems: f.max_items }) };
  }
  const schema = { ...base, type: "string" };
  if (keys) schema.enum = keys;
  if (f.allow) schema["x-also-allowed"] = f.allow;
  if (f.pattern) schema.pattern = f.pattern;
  if (f.type === "date") schema.pattern = "^\\d{4}-\\d{2}-\\d{2}$";
  if (f.type === "url") schema.pattern = "^https://\\S+$";
  if (f.min_length) schema.minLength = f.min_length;
  if (f.max_length) schema.maxLength = f.max_length;
  return schema;
};

export const buildJsonSchema = (contract) => ({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: `https://styleseed.local/fkd/bundle-${contract.contract_version}.schema.json`,
  title: `STYLESEED Fashion Knowledge bundle (contract ${contract.contract_version})`,
  description: "필드 단위 형식만 표현한다. 교차 검증(참조·승인 조건·독립 평가)은 계약 문서 8장과 validate.mjs가 기준. x-taxonomy 값은 같은 묶음의 attribute_values에서 허용값을 찾는다.",
  type: "object",
  required: ["manifest", ...Object.keys(CSV_FILES)],
  properties: {
    manifest: {
      type: "object",
      required: ["contract_version", "source", "purpose", "format"],
      properties: {
        contract_version: { type: "string", pattern: "^\\d+\\.\\d+\\.\\d+$" },
        source: { type: "string", enum: ["knowledge-lab", "sheets"] },
        purpose: { type: "string", enum: ["production", "example"] },
        format: { type: "string", const: "json" },
        exported_at: { type: "string" },
        exported_by: { type: "string" },
        counts: { type: "object", additionalProperties: { type: "integer" } },
      },
    },
    ...Object.fromEntries(
      Object.entries(contract.entities).map(([name, entity]) => [
        name,
        {
          type: "array",
          description: `${entity.title_ko} · 기본 키 ${entity.key.join(" + ")}`,
          items: {
            type: "object",
            required: entity.fields.filter((f) => f.required === true).map((f) => f.key),
            properties: Object.fromEntries(entity.fields.map((f) => [f.key, fieldSchema(contract, f)])),
          },
        },
      ]),
    ),
  },
});

// ---------- 잘못된 예시(기대 오류 코드) ----------
const find = (list, predicate) => {
  const item = list.find(predicate);
  if (!item) throw new Error("잘못된 예시 대상 없음");
  return item;
};

export const INVALID_CASES = [
  ["same-person-approval", ["E_APPROVAL_SAME_PERSON"], (b) => { find(b.styling_rules, (r) => r.rule_id === "FIT-001").reviewer = "E1"; }],
  ["approver-without-authority", ["E_APPROVER_AUTHORITY"], (b) => { find(b.styling_rules, (r) => r.rule_id === "COL-001").reviewer = "E3"; }],
  ["unconfirmed-value-in-approved-rule", ["E_UNCONFIRMED_VALUE"], (b) => { find(b.styling_rules, (r) => r.rule_id === "FIT-002").context_mood = ["romantic"]; }],
  ["claude-draft-approved", ["E_APPROVAL_ORIGIN"], (b) => Object.assign(find(b.styling_rules, (r) => r.rule_id === "COL-003"), { approval_status: "approved", author: "E1", reviewer: "E2", approved_at: "2026-10-24" })],
  ["exception-base-not-approved", ["E_EXCEPTION_BASE_NOT_APPROVED"], (b) => Object.assign(find(b.styling_rules, (r) => r.rule_id === "FIT-001"), { approval_status: "in_review", reviewer: undefined, approved_at: undefined })],
  ["korean-label-in-json", ["E_ENUM"], (b) => { find(b.styling_rules, (r) => r.rule_id === "COL-001").judgement = "권장"; }],
  ["int-as-string-in-json", ["E_JSON_INVALID"], (b) => { find(b.styling_rules, (r) => r.rule_id === "COL-001").strength = "4"; }],
  ["retired-value-used", ["E_TAXONOMY_VALUE"], (b) => { find(b.garments, (g) => g.garment_id === "G002").fit = "fitted"; }],
  ["subcategory-parent-mismatch", ["E_PARENT_MISMATCH"], (b) => { find(b.garments, (g) => g.garment_id === "G003").subcategory = "shirt"; }],
  ["unknown-garment-in-outfit", ["E_REF"], (b) => { find(b.outfits, (o) => o.outfit_id === "P01").garment_ids = ["G001", "G999"]; }],
  ["submitted-evaluation-missing-score", ["E_REQUIRED"], (b) => { delete find(b.outfit_evaluations, (e) => e.outfit_id === "P01" && e.evaluator_id === "E1").score_overall; }],
  ["duplicate-rule-version", ["E_DUPLICATE_KEY"], (b) => { b.styling_rules.push({ ...find(b.styling_rules, (r) => r.rule_id === "COL-001") }); }],
  ["rule-id-prefix-mismatch", ["E_RULE_PREFIX"], (b) => { find(b.styling_rules, (r) => r.rule_id === "MAT-001").dimension = "color"; }],
  ["contract-major-mismatch", ["E_CONTRACT_MAJOR"], (b) => { b.manifest.contract_version = "1.0.0"; }],
  ["jumpsuit-category-marked-app-supported", ["E_APP_VALUE", "E_APP_PARENT_MISMATCH"], (b) => Object.assign(find(b.attribute_values, (v) => v.attribute_key === "category" && v.value_key === "jumpsuit"), { app_supported: "yes", app_value: undefined })],
  ["romper-marked-app-supported", ["E_APP_VALUE"], (b) => Object.assign(find(b.attribute_values, (v) => v.value_key === "romper"), { app_field: "subCategory", app_supported: "yes", app_value: "romper" })],
  ["jumpsuit-category-without-app-mapping", ["E_APP_PARENT_MISMATCH"], (b) => Object.assign(find(b.attribute_values, (v) => v.attribute_key === "category" && v.value_key === "jumpsuit"), { app_field: "none", app_supported: "no", app_value: undefined })],
];

// ---------- 생성 ----------
export const generateHandoff = (contract = loadContract()) => {
  const files = new Map();
  const csvDir = path.join(PACKAGE_DIR, "examples/csv");

  files.set("contract/fkd-contract-v0.1.json", fs.readFileSync(CONTRACT_PATH, "utf8"));
  files.set("contract/fkd-bundle.schema.json", json(buildJsonSchema(contract)));

  // 예시 CSV 묶음 검증(오류가 있으면 생성 중단) + manifest
  const bundle = loadCsvBundle(csvDir, contract);
  const result = createValidator(contract).validateBundle(bundle.tables);
  const errors = result.issues.filter((i) => i.level === "error");
  if (errors.length > 0) throw new Error(`예시 CSV 묶음 오류: ${errors.map((e) => `${e.code} ${e.file}:${e.line}`).join(", ")}`);

  const csvFiles = [
    ...Object.values(CSV_FILES),
    "disagreement_review.csv",
    ...fs.readdirSync(path.join(csvDir, "evaluations")).filter((f) => f.endsWith(".csv")).sort().map((f) => `evaluations/${f}`),
  ];
  const counts = {
    ...Object.fromEntries(Object.keys(CSV_FILES).map((e) => [e, result.data[e].length])),
    outfit_evaluations: result.data.outfit_evaluations.reduce((n, g) => n + g.records.length, 0),
    disagreement_reviews: result.data.disagreement_reviews.length,
  };
  const manifestBase = { contract_version: contract.contract_version, source: "knowledge-lab", purpose: "example", exported_at: EXPORTED_AT, exported_by: "E1" };
  files.set("examples/csv/manifest.json", json({
    ...manifestBase,
    format: "csv",
    files: Object.fromEntries(csvFiles.map((f) => [f, sha256(fs.readFileSync(path.join(csvDir, f)))])),
    counts,
  }));

  const jsonBundle = toJsonBundle(contract, result.data, { ...manifestBase, format: "json", counts });
  files.set("examples/json/bundle.json", json(jsonBundle));

  const expected = {};
  for (const [name, codes, mutate] of INVALID_CASES) {
    const copy = structuredClone(jsonBundle);
    mutate(copy);
    files.set(`examples/invalid/${name}.json`, json(copy));
    expected[name] = codes;
  }
  files.set("examples/invalid/expected-errors.json", json(expected));

  const readmePath = path.join(PACKAGE_DIR, "README.md");
  files.set("README.md", syncDoc(fs.readFileSync(readmePath, "utf8"), contract));

  return files;
};

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const files = generateHandoff();
  const check = process.argv.includes("--check");
  const stale = [];
  for (const [rel, content] of files) {
    const full = path.join(PACKAGE_DIR, rel);
    const current = fs.existsSync(full) ? fs.readFileSync(full, "utf8") : null;
    if (current === content) continue;
    if (check) stale.push(rel);
    else {
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content);
      console.log(`생성: ${path.relative(ROOT, full)}`);
    }
  }
  if (check && stale.length > 0) {
    console.error(`전달 패키지가 최신이 아닙니다: ${stale.join(", ")} → node scripts/fkd/gen-handoff.mjs`);
    process.exit(1);
  }
  if (check) console.log("전달 패키지 최신");
}
