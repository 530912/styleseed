// FKD Data Contract V0.1 검증·빌드·비교 테스트 — "승인되지 않은 데이터는 추천에 쓰이지 않는다"를 보장한다
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { buildRuleset, loadApprovedRules } from "../build.mjs";
import { runValidation } from "../bundle.mjs";
import { compareEvaluations, spearman, weightedKappa } from "../compare.mjs";
import { ROOT, headerFor, loadContract, parseCsv, readTable } from "../lib.mjs";
import { createValidator, validateManifest } from "../validate.mjs";

const contract = loadContract();
const TEMPLATES = path.join(ROOT, "data/fkd/templates");

const table = (file, rows) => ({
  file,
  keys: [...new Set(rows.flatMap((r) => Object.keys(r)))],
  rows: rows.map((values, i) => ({ line: i + 2, values })),
});

const value = (attribute_key, value_key, over = {}) => ({
  attribute_key, attribute_ko: attribute_key, value_key, value_ko: value_key, app_field: "none", app_supported: "no",
  status: "confirmed", decided_by: "E1|E2", decided_at: "2026-10-20", data_origin: "human", version: "1", ...over,
});

const rule = (over = {}) => ({
  rule_id: "FIT-001", rule_version: "1", rule_type: "base", dimension: "silhouette_fit",
  a_category: "top", a_attribute: "fit", a_values: "oversized",
  b_category: "bottom", b_attribute: "silhouette", b_values: "wide",
  judgement: "caution", strength: "3", reason: "상·하의 볼륨이 동시에 커져 허리선이 흐려짐", confidence: "high",
  author: "E1", reviewer: "E2", approval_status: "approved", approved_at: "2026-10-20", data_origin: "human",
  ...over,
});

const evaluation = (outfit_id, evaluator_id, scores, label = "suitable", over = {}) => ({
  outfit_id, evaluator_id, round: "1",
  score_color: String(scores[0]), score_silhouette_fit: String(scores[1]), score_material_season: String(scores[2]),
  score_tpo: String(scores[3]), score_mood: String(scores[4]), score_overall: String(scores[5]),
  label, recommendable: "yes", reason: "명도 대비와 볼륨 균형이 안정적", confidence: "high", rated_at: "2026-10-21",
  submission_status: "submitted", data_origin: "human", ...over,
});

const bundle = ({ rules = [], evaluations = [], extraValues = [], evaluators } = {}) => ({
  evaluators: table("evaluators.csv", evaluators ?? [
    { evaluator_id: "E1", role: "cofounder", can_approve: "yes", active: "yes" },
    { evaluator_id: "E2", role: "cofounder", can_approve: "yes", active: "yes" },
    { evaluator_id: "E3", role: "external", can_approve: "no", active: "yes" },
  ]),
  attribute_values: table("garment_schema.csv", [
    value("category", "top"), value("category", "bottom"),
    value("subcategory", "shirt", { parent_value: "top" }), value("subcategory", "jeans", { parent_value: "bottom" }),
    value("main_color", "white"), value("main_color", "navy"), value("main_color", "blue", { status: "proposed", decided_by: "", decided_at: "" }),
    value("fit", "oversized"), value("fit", "regular"), value("silhouette", "wide", { app_supported: "no" }),
    value("material", "cotton"), value("material", "denim"), value("season", "spring"), value("tpo", "office"), value("tpo", "casual"),
    value("mood", "minimal"), value("mood", "street"),
    ...extraValues,
  ]),
  garments: table("garments.csv", [
    { garment_id: "G001", name_ko: "화이트 셔츠", source: "fixture", category: "top", subcategory: "shirt", main_color: "white", color_tone: "bright", fit: "oversized", material: "cotton", season: "spring", tpo: "office", mood: "minimal", attribute_status: "proposed", data_origin: "claude_draft" },
    { garment_id: "G002", name_ko: "블루 청바지", source: "fixture", category: "bottom", subcategory: "jeans", main_color: "navy", color_tone: "muted", fit: "regular", material: "denim", season: "spring", tpo: "casual", mood: "street", attribute_status: "proposed", data_origin: "claude_draft" },
  ]),
  outfits: table("outfits.csv", [
    { outfit_id: "P01", set: "pilot", split: "unassigned", context_label: "봄 · 출근", context_tpo: "office", context_season: "spring", garment_ids: "G001|G002", status: "active", data_origin: "claude_draft" },
    { outfit_id: "P02", set: "pilot", split: "unassigned", context_label: "봄 · 주말", context_tpo: "casual", context_season: "spring", garment_ids: "G001|G002", status: "active", data_origin: "claude_draft" },
    { outfit_id: "P03", set: "pilot", split: "unassigned", context_label: "봄 · 주말", context_tpo: "casual", context_season: "spring", garment_ids: "G001|G002", status: "active", data_origin: "claude_draft" },
  ]),
  styling_rules: table("styling_rules.csv", rules.length ? rules : [rule({ approval_status: "draft", approved_at: "", reviewer: "" })]),
  outfit_evaluations: evaluations,
});

const validate = (opts) => createValidator(contract).validateBundle(bundle(opts));
const codes = (result) => result.issues.filter((i) => i.level === "error").map((i) => i.code);
const build = (result) => buildRuleset({ contract, data: result.data, taxonomy: result.taxonomy, sourceText: "t" });

test("템플릿 묶음: 오류 0(경고는 manifest 없음뿐), 빌드 시 승인 규칙 0개", () => {
  const result = runValidation(TEMPLATES, contract);
  assert.equal(result.errors, 0, JSON.stringify(result.issues.filter((i) => i.level === "error").slice(0, 3)));
  assert.deepEqual(result.issues.map((i) => i.code), ["W_MANIFEST_MISSING"]);
  assert.equal(result.data.outfit_evaluations[0].records.filter((r) => !r.example).length, 20);
  const ruleset = build(result);
  assert.equal(ruleset.rules.length, 0);
  assert.equal(ruleset.counts.ruleRows, 8);
});

test("템플릿 헤더가 계약 필드와 정확히 같다(계약 = 단일 원본)", () => {
  const files = { evaluators: "evaluators.csv", attribute_values: "garment_schema.csv", garments: "garments.csv", outfits: "outfits.csv", styling_rules: "styling_rules.csv", disagreement_reviews: "disagreement_review.csv", outfit_evaluations: "evaluations/outfit_evaluation.csv" };
  for (const [entity, file] of Object.entries(files)) {
    const [header] = parseCsv(fs.readFileSync(path.join(TEMPLATES, file), "utf8"));
    assert.deepEqual(header, contract.entities[entity].fields.map(headerFor), entity);
  }
});

test("승인 + human + 작성자≠승인자 + 확정 값 → 빌드 포함. 한국어 라벨도 같은 값으로 인식", () => {
  const korean = rule({ dimension: "핏·실루엣", judgement: "주의", confidence: "High", approval_status: "승인", data_origin: "사람", rule_type: "기본" });
  const result = validate({ rules: [korean] });
  assert.deepEqual(codes(result), []);
  const ruleset = build(result);
  assert.equal(ruleset.rules.length, 1);
  assert.equal(ruleset.rules[0].dimension, "silhouette_fit");
  assert.equal(ruleset.rules[0].judgement, "caution");
  // 앱이 저장하지 않는 속성(silhouette)을 쓰면 경고
  assert.ok(result.issues.some((i) => i.code === "W_UNSUPPORTED_ATTRIBUTE"));
});

test("초안·검토중·보류·폐기 규칙은 빌드에서 빠진다", () => {
  const rules = ["draft", "in_review", "on_hold", "retired"].map((s, i) => rule({ rule_id: `FIT-00${i + 2}`, approval_status: s, approved_at: "" }));
  const result = validate({ rules });
  assert.deepEqual(codes(result), []);
  assert.equal(build(result).rules.length, 0);
});

test("승인 조건 위반은 오류 코드로 막힌다", () => {
  assert.ok(codes(validate({ rules: [rule({ reviewer: "E1" })] })).includes("E_APPROVAL_SAME_PERSON"));
  assert.ok(codes(validate({ rules: [rule({ data_origin: "claude_draft" })] })).includes("E_APPROVAL_ORIGIN"));
  assert.ok(codes(validate({ rules: [rule({ reviewer: "E3" })] })).includes("E_APPROVER_AUTHORITY"));
  assert.ok(codes(validate({ rules: [rule({ approved_at: "" })] })).includes("E_REQUIRED"));
  assert.ok(codes(validate({ rules: [rule({ rule_id: "EX-FIT-001", data_origin: "example" })] })).includes("E_EXAMPLE_APPROVED"));
  const unconfirmed = validate({ rules: [rule({ rule_id: "COL-001", dimension: "color", a_category: "any", a_attribute: "main_color", a_values: "navy", b_category: "any", b_attribute: "main_color", b_values: "blue" })] });
  assert.ok(unconfirmed.issues.some((i) => i.code === "E_UNCONFIRMED_VALUE" && i.message.includes("main_color:blue")));
});

test("Claude 초안·예시는 승인 표시가 있어도 빌드에서 빠진다", () => {
  const result = validate({ rules: [rule({ data_origin: "claude_draft" }), rule({ rule_id: "EX-FIT-001", data_origin: "example" })] });
  assert.equal(build(result).rules.length, 0);
});

test("규칙 형식: ID 약자·없는 값·강도 범위·조건 불완전·미승인 기본 규칙의 예외", () => {
  assert.ok(codes(validate({ rules: [rule({ rule_id: "COL-001" })] })).includes("E_RULE_PREFIX"));
  assert.ok(codes(validate({ rules: [rule({ a_values: "baggy" })] })).includes("E_TAXONOMY_VALUE"));
  assert.ok(codes(validate({ rules: [rule({ strength: "7" })] })).includes("E_INT"));
  assert.ok(codes(validate({ rules: [rule({ b_values: "" })] })).includes("E_CONDITION_INCOMPLETE"));
  assert.ok(codes(validate({ rules: [rule({ judgement: "maybe" })] })).includes("E_ENUM"));
  const exception = validate({
    rules: [
      rule({ approval_status: "draft", approved_at: "", reviewer: "" }),
      rule({ rule_id: "FIT-002", rule_type: "exception", exception_of: "FIT-001", context_mood: "street", judgement: "conditional" }),
    ],
  });
  assert.ok(codes(exception).includes("E_EXCEPTION_BASE_NOT_APPROVED"));
});

test("같은 규칙의 승인 버전이 여러 개면 가장 높은 버전만", () => {
  const result = validate({ rules: [rule(), rule({ rule_version: "2", judgement: "not_recommended" })] });
  const ruleset = build(result);
  assert.equal(ruleset.rules.length, 1);
  assert.equal(ruleset.rules[0].version, 2);
});

test("엔진 로더는 빌드 파일을 손으로 고쳐도 미승인 규칙을 거른다", () => {
  const tampered = { rules: [{ id: "FIT-001", approvalStatus: "approved" }, { id: "FIT-002", approvalStatus: "draft" }, { id: "EX-COL-001", approvalStatus: "approved" }] };
  assert.deepEqual(loadApprovedRules(tampered).map((r) => r.id), ["FIT-001"]);
});

test("평가: 한 파일에 평가자 여러 명 → 오류, 제출 행만 필수 검사, 점수 범위", () => {
  const mixed = validate({ evaluations: [table("evaluations/a.csv", [evaluation("P01", "E1", [4, 4, 4, 4, 4, 4]), evaluation("P02", "E2", [3, 3, 3, 3, 3, 3])])] });
  assert.ok(codes(mixed).includes("E_EVAL_MIXED_EVALUATOR"));

  const draft = validate({ evaluations: [table("evaluations/a.csv", [{ outfit_id: "P01", round: "1", submission_status: "in_progress", data_origin: "human" }])] });
  assert.deepEqual(codes(draft), []);

  const bad = validate({ evaluations: [table("evaluations/a.csv", [evaluation("P01", "E1", [4, 6, 4, 4, 4, 4]), evaluation("P09", "E1", [4, 4, 4, 4, 4, 4])])] });
  assert.ok(codes(bad).includes("E_INT"));
  assert.ok(codes(bad).includes("E_REF"));
});

test("의류·코디 참조: 세부분류-대분류 불일치, 없는 의류 ID", () => {
  const b = bundle();
  b.garments.rows[0].values.subcategory = "jeans";
  b.outfits.rows[0].values.garment_ids = "G001|G999";
  const result = createValidator(contract).validateBundle(b);
  assert.ok(codes(result).includes("E_PARENT_MISMATCH"));
  assert.ok(result.issues.some((i) => i.code === "E_REF" && i.message.includes("G999")));
});

test("모르는 열은 경고, x_ 열은 조용히 무시", () => {
  const b = bundle();
  b.garments.keys.push("colour", "x_lab_internal");
  const result = createValidator(contract).validateBundle(b);
  const unknown = result.issues.filter((i) => i.code === "W_UNKNOWN_FIELD").map((i) => i.field);
  assert.deepEqual(unknown, ["colour"]);
});

test("manifest: 주 버전 불일치·해시 불일치 오류, 새 부 버전 경고", () => {
  const bytes = Buffer.from("a,b\n1,2\n");
  const hash = crypto.createHash("sha256").update(bytes).digest("hex");
  const read = (file) => (file === "garments.csv" ? bytes : null);
  assert.equal(validateManifest(contract, { contract_version: "1.0.0", source: "knowledge-lab", files: {} }, read)[0].code, "E_CONTRACT_MAJOR");
  assert.equal(validateManifest(contract, { contract_version: "0.3.0", source: "knowledge-lab", files: { "garments.csv": hash } }, read)[0].code, "W_CONTRACT_NEWER");
  assert.equal(validateManifest(contract, { contract_version: "0.1.0", source: "knowledge-lab", files: { "garments.csv": "00" } }, read)[0].code, "E_HASH_MISMATCH");
  assert.equal(validateManifest(contract, { contract_version: "0.1.0", source: "knowledge-lab", files: { "outfits.csv": hash } }, read)[0].code, "E_FILE_MISSING");
  assert.deepEqual(validateManifest(contract, { contract_version: "0.1.0", source: "knowledge-lab", files: { "garments.csv": hash } }, read), []);
});

test("두 평가 비교: 일치도와 불일치 목록(차이 2 이상 또는 판정 다름)", () => {
  const a = table("evaluations/E1.csv", [
    evaluation("P01", "E1", [4, 4, 4, 4, 4, 5]),
    evaluation("P02", "E1", [2, 3, 3, 3, 3, 2], "unsuitable"),
    evaluation("P03", "E1", [3, 3, 3, 3, 3, 3], "conditional"),
  ]);
  const b = table("evaluations/E2.csv", [
    evaluation("P01", "E2", [4, 4, 4, 4, 4, 4]),
    evaluation("P02", "E2", [4, 3, 3, 3, 3, 3], "conditional"),
    evaluation("P03", "E2", [3, 3, 3, 3, 3, 3], "conditional"),
  ]);
  const result = validate({ evaluations: [a, b] });
  assert.deepEqual(codes(result), []);
  const [ra, rb] = result.data.outfit_evaluations;
  const compared = compareEvaluations(contract, ra.records, rb.records);
  assert.equal(compared.compared, 3);
  assert.deepEqual(compared.evaluators, ["E1", "E2"]);
  assert.equal(compared.metrics.color.exact, 0.667);
  assert.equal(compared.labelAgreement, 0.667);
  assert.deepEqual(compared.review.map((r) => `${r[0]}:${r[1]}`), ["P02:색", "P02:종합"]);
});

test("통계: 가중 kappa(완전 일치 1), 스피어만(역순 -1)", () => {
  assert.equal(weightedKappa([[1, 1], [3, 3], [5, 5]]), 1);
  assert.equal(spearman([1, 2, 3, 4], [4, 3, 2, 1]), -1);
});

test("CSV: 따옴표 안 쉼표·줄바꿈·BOM 처리, 대괄호 헤더", () => {
  const rows = parseCsv('﻿이름 [a],이유 [b]\nx,"쉼표, 있음\n줄바꿈 ""따옴표"""\n');
  assert.deepEqual(rows[1], ["x", '쉼표, 있음\n줄바꿈 "따옴표"']);
  const t = readTable(path.join(TEMPLATES, "evaluators.csv"));
  assert.deepEqual(t.keys.slice(0, 2), ["evaluator_id", "role"]);
});

test("CLI는 지정한 묶음 폴더를 검증한다(--out 없이도)", async () => {
  const { execFileSync } = await import("node:child_process");
  let output = "";
  try {
    execFileSync(process.execPath, [path.join(ROOT, "scripts/fkd/cli.mjs"), "validate", "/nonexistent-fkd-bundle", "--json"], { encoding: "utf8" });
  } catch (error) {
    output = error.stdout;
  }
  const report = JSON.parse(output);
  assert.ok(report.errors >= 5);
  assert.ok(report.issues.every((i) => i.code === "E_FILE_MISSING" || i.level === "warning"));
});

test("비교 결과(disagreement_review)는 계약 검증을 그대로 통과한다", async () => {
  const { reviewHeaders } = await import("../compare.mjs");
  const { tableFromText, toCsv } = await import("../lib.mjs");
  const a = table("evaluations/E1.csv", [evaluation("P01", "E1", [5, 4, 4, 4, 4, 5])]);
  const b = table("evaluations/E2.csv", [evaluation("P01", "E2", [2, 4, 4, 4, 4, 2], "unsuitable")]);
  const first = validate({ evaluations: [a, b] });
  const [ra, rb] = first.data.outfit_evaluations;
  const csv = toCsv(reviewHeaders(contract), compareEvaluations(contract, ra.records, rb.records).review);
  const tables = bundle();
  tables.disagreement_reviews = tableFromText(csv, "disagreement_review.csv");
  const result = createValidator(contract).validateBundle(tables);
  assert.deepEqual(codes(result), []);
  assert.equal(result.data.disagreement_reviews.length, 2);
});

test("전달 명세(README)의 표가 계약 JSON과 같다", async () => {
  const { DOC_PATH, syncDoc } = await import("../gen-contract-doc.mjs");
  const current = fs.readFileSync(DOC_PATH, "utf8");
  assert.equal(syncDoc(current, contract), current, "node scripts/fkd/gen-contract-doc.mjs 실행 필요");
});

const PACKAGE = path.join(ROOT, "docs/handoff/fkd-data-contract-v0.1");

test("전달 패키지가 계약·예시와 동기화되어 있다(gen-handoff --check와 같음)", async () => {
  const { generateHandoff } = await import("../gen-handoff.mjs");
  for (const [rel, content] of generateHandoff(contract)) {
    assert.equal(fs.readFileSync(path.join(PACKAGE, rel), "utf8"), content, rel);
  }
});

test("예시 묶음: CSV·JSON 모두 오류 0, 빌드하면 승인 규칙 5개(최고 버전만)", () => {
  for (const target of ["examples/csv", "examples/json/bundle.json"]) {
    const result = runValidation(path.join(PACKAGE, target), contract);
    assert.equal(result.errors, 0, `${target}: ${JSON.stringify(result.issues.filter((i) => i.level === "error").slice(0, 2))}`);
    assert.deepEqual(result.issues.map((i) => i.code), Array(3).fill("W_UNSUPPORTED_ATTRIBUTE"), target);
    const ruleset = build(result);
    assert.deepEqual(ruleset.rules.map((r) => `${r.id}v${r.version}`), ["COL-001v1", "COL-002v2", "FIT-001v1", "FIT-002v1", "MAT-001v1"], target);
  }
});

test("잘못된 예시 17개: 각각 기대한 오류 코드 집합이 정확히 나온다", () => {
  const expected = JSON.parse(fs.readFileSync(path.join(PACKAGE, "examples/invalid/expected-errors.json"), "utf8"));
  assert.equal(Object.keys(expected).length, 17);
  for (const [name, codesExpected] of Object.entries(expected)) {
    const result = runValidation(path.join(PACKAGE, `examples/invalid/${name}.json`), contract);
    const got = [...new Set(result.issues.filter((i) => i.level === "error").map((i) => i.code))].sort();
    assert.deepEqual(got, [...codesExpected].sort(), name);
  }
});

test("purpose=example 묶음은 엔진용 빌드를 거부한다", async () => {
  const { spawnSync } = await import("node:child_process");
  const run = spawnSync(process.execPath, [path.join(ROOT, "scripts/fkd/cli.mjs"), "build", path.join(PACKAGE, "examples/csv")], { encoding: "utf8" });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /E_EXAMPLE_BUNDLE_BUILD/);
  assert.doesNotMatch(run.stdout, /생성: data\/fkd\/build/);
});

// 작은 JSON Schema 검사기(type·enum·pattern·범위·required·items)로 예시 JSON이 스키마를 따르는지 확인
const checkSchema = (schema, value, where, errors) => {
  if (schema.type === "object") {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return errors.push(`${where}: object`);
    for (const key of schema.required ?? []) if (!(key in value)) errors.push(`${where}.${key}: required`);
    for (const [key, sub] of Object.entries(schema.properties ?? {})) if (key in value) checkSchema(sub, value[key], `${where}.${key}`, errors);
  } else if (schema.type === "array") {
    if (!Array.isArray(value)) return errors.push(`${where}: array`);
    if (schema.minItems && value.length < schema.minItems) errors.push(`${where}: minItems`);
    if (schema.maxItems && value.length > schema.maxItems) errors.push(`${where}: maxItems`);
    value.forEach((item, i) => schema.items && checkSchema(schema.items, item, `${where}[${i}]`, errors));
  } else if (schema.type === "integer") {
    if (!Number.isInteger(value)) return errors.push(`${where}: integer`);
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${where}: minimum`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${where}: maximum`);
  } else if (schema.type === "string") {
    if (typeof value !== "string") return errors.push(`${where}: string`);
    if (schema.enum && !schema.enum.includes(value)) errors.push(`${where}: enum ${value}`);
    if (schema.const && value !== schema.const) errors.push(`${where}: const`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${where}: pattern ${value}`);
    if (schema.minLength && value.length < schema.minLength) errors.push(`${where}: minLength`);
  }
  return errors;
};

test("JSON Schema: 예시 bundle.json은 통과, 형식이 틀린 예시는 걸린다", () => {
  const schema = JSON.parse(fs.readFileSync(path.join(PACKAGE, "contract/fkd-bundle.schema.json"), "utf8"));
  const bundle = JSON.parse(fs.readFileSync(path.join(PACKAGE, "examples/json/bundle.json"), "utf8"));
  assert.deepEqual(checkSchema(schema, bundle, "$", []), []);
  for (const name of ["korean-label-in-json", "int-as-string-in-json"]) {
    const bad = JSON.parse(fs.readFileSync(path.join(PACKAGE, `examples/invalid/${name}.json`), "utf8"));
    assert.ok(checkSchema(schema, bad, "$", []).length > 0, name);
  }
});
