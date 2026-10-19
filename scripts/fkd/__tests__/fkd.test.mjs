// FKD 데이터 검증·빌드·비교 테스트 — "승인되지 않은 규칙은 추천에 쓰이지 않는다"를 보장한다
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildRuleset, loadApprovedRules } from "../build.mjs";
import { compareEvaluations, spearman, weightedKappa } from "../compare.mjs";
import { parseCsv, readTable } from "../lib.mjs";
import { validateEvaluation, validateRules, validateSchema } from "../validate.mjs";

const TEMPLATES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../data/fkd/templates");

const table = (rows) => ({ keys: Object.keys(rows[0] ?? {}), rows: rows.map((values, i) => ({ line: i + 2, values })) });

const schemaRow = (attribute_key, value_key, status = "확정") => ({
  attribute_key, value_key, status,
  decided_by: status === "확정" ? "E1" : "", decided_at: status === "확정" ? "2026-10-20" : "",
  data_origin: "사람",
});

const SCHEMA = table([
  schemaRow("category", "top"),
  schemaRow("category", "bottom"),
  schemaRow("fit", "oversized"),
  schemaRow("silhouette", "wide"),
  schemaRow("main_color", "navy"),
  schemaRow("main_color", "white", "제안"),
  schemaRow("tpo", "office"),
]);

const rule = (over = {}) => ({
  rule_id: "FIT-001", rule_version: "1", rule_type: "기본", exception_of: "", dimension: "핏·실루엣",
  a_category: "top", a_attribute: "fit", a_values: "oversized",
  b_category: "bottom", b_attribute: "silhouette", b_values: "wide",
  context_tpo: "", context_mood: "", context_season: "", context_weather: "",
  judgement: "주의", strength: "3", reason: "상·하의 볼륨이 동시에 커져 허리선이 흐려짐", display_text: "",
  exception_note: "", confidence: "High", author: "E1", reviewer: "E2",
  approval_status: "승인", approved_at: "2026-10-20", data_origin: "사람", note: "",
  ...over,
});

const schemaValues = () => validateSchema(SCHEMA).values;
const errorsOf = (rows) => validateRules(table(rows), schemaValues()).issues.filter((i) => i.level === "error");
const build = (rows) =>
  buildRuleset({ schemaTable: SCHEMA, rulesTable: table(rows), schemaValues: schemaValues(), sourceText: JSON.stringify(rows) });

test("템플릿 4종은 오류 없이 검증되고, 빌드하면 승인 규칙이 0개다(예시·초안 제외)", () => {
  const schemaTable = readTable(path.join(TEMPLATES, "garment_schema.csv"));
  const rulesTable = readTable(path.join(TEMPLATES, "styling_rules.csv"));
  const schema = validateSchema(schemaTable);
  assert.deepEqual(schema.issues.filter((i) => i.level === "error"), []);
  assert.deepEqual(validateRules(rulesTable, schema.values).issues.filter((i) => i.level === "error"), []);

  const evaluation = validateEvaluation(readTable(path.join(TEMPLATES, "outfit_evaluation.csv")));
  assert.deepEqual(evaluation.issues, []);
  assert.equal(evaluation.unrated, 20);

  const ruleset = buildRuleset({ schemaTable, rulesTable, schemaValues: schema.values, sourceText: "t" });
  assert.equal(ruleset.rules.length, 0);
  assert.equal(ruleset.counts.ruleRows, 8);

  const review = readTable(path.join(TEMPLATES, "disagreement_review.csv"));
  assert.ok(review.keys.includes("agreed_score") && review.keys.includes("status"));
});

test("승인 + 사람 + 서로 다른 작성자·검토자 + 확정 값 → 빌드에 포함", () => {
  assert.deepEqual(errorsOf([rule()]), []);
  const ruleset = build([rule()]);
  assert.equal(ruleset.rules.length, 1);
  assert.equal(ruleset.rules[0].id, "FIT-001");
  assert.deepEqual(ruleset.confirmedValues.main_color, ["navy"]);
});

test("초안·검토중·보류·폐기 규칙은 빌드에 들어가지 않는다", () => {
  const rows = ["초안", "검토중", "보류", "폐기"].map((s, i) =>
    rule({ rule_id: `FIT-00${i + 2}`, approval_status: s, approved_at: "" }),
  );
  assert.deepEqual(errorsOf(rows), []);
  const ruleset = build(rows);
  assert.equal(ruleset.rules.length, 0);
  assert.equal(Object.values(ruleset.counts.excluded).reduce((a, b) => a + b, 0), 4);
});

test("승인 조건 위반은 오류: 작성자=검토자, 출처 Claude 초안, 승인일 없음, 확정 안 된 값", () => {
  assert.match(errorsOf([rule({ reviewer: "E1" })])[0].message, /서로 다른 사람/);
  assert.match(errorsOf([rule({ data_origin: "Claude 초안" })])[0].message, /출처가 '사람'/);
  assert.match(errorsOf([rule({ approved_at: "" })])[0].message, /승인일/);

  const unconfirmed = errorsOf([
    rule({ rule_id: "COL-001", dimension: "색", a_category: "any", a_attribute: "main_color", a_values: "navy", b_category: "any", b_attribute: "main_color", b_values: "white" }),
  ]);
  assert.match(unconfirmed[0].message, /확정.*main_color:white/);
});

test("Claude 초안·예시 규칙은 승인 표시가 있어도 빌드에서 빠진다", () => {
  const ruleset = build([
    rule({ data_origin: "Claude 초안" }),
    rule({ rule_id: "EX-FIT-001", data_origin: "예시" }),
  ]);
  assert.equal(ruleset.rules.length, 0);
  assert.match(errorsOf([rule({ rule_id: "EX-FIT-001", data_origin: "예시" })])[0].message, /예시 행은 승인할 수 없어요/);
});

test("규칙 형식 오류: ID 접두어·없는 속성값·강도 범위·승인 안 된 기본 규칙의 예외", () => {
  assert.match(errorsOf([rule({ rule_id: "COL-001" })])[0].message, /FIT-로 시작/);
  assert.match(errorsOf([rule({ a_values: "baggy" })])[0].message, /허용값에 없어요/);
  assert.match(errorsOf([rule({ strength: "7" })])[0].message, /1~5/);

  const errors = errorsOf([
    rule({ approval_status: "초안", approved_at: "" }),
    rule({ rule_id: "FIT-002", rule_type: "예외", exception_of: "FIT-001", context_tpo: "office" }),
  ]);
  assert.match(errors[0].message, /FIT-001이 아직 승인되지 않았어요/);
});

test("같은 규칙의 승인 버전이 여러 개면 가장 높은 버전만 쓴다", () => {
  const ruleset = build([rule(), rule({ rule_version: "2", judgement: "비권장" })]);
  assert.equal(ruleset.rules.length, 1);
  assert.equal(ruleset.rules[0].version, 2);
  assert.equal(ruleset.rules[0].judgement, "비권장");
});

test("엔진 로더는 빌드 파일을 손으로 고쳐도 미승인 규칙을 거른다", () => {
  const tampered = { rules: [{ id: "FIT-001", approvalStatus: "승인" }, { id: "FIT-002", approvalStatus: "초안" }, { id: "EX-COL-001", approvalStatus: "승인" }] };
  assert.deepEqual(loadApprovedRules(tampered).map((r) => r.id), ["FIT-001"]);
});

const evalRow = (outfit_id, evaluator_id, scores, label = "적합", over = {}) => ({
  evaluator_id, outfit_id, set: "pilot",
  score_color: String(scores[0]), score_silhouette_fit: String(scores[1]), score_material_season: String(scores[2]),
  score_tpo: String(scores[3]), score_mood: String(scores[4]), score_overall: String(scores[5]),
  label, recommendable: "예", reason: "명도 대비와 볼륨 균형이 안정적", confidence: "High",
  rated_at: "2026-10-21", data_origin: "사람", ...over,
});

test("평가 파일: 한 파일에 두 평가자가 섞이면 오류(독립 평가), 점수 범위 검사", () => {
  const mixed = validateEvaluation(table([evalRow("P01", "E1", [4, 4, 4, 4, 4, 4]), evalRow("P02", "E2", [3, 3, 3, 3, 3, 3])]));
  assert.ok(mixed.issues.some((i) => /평가자가 2명/.test(i.message)));

  const bad = validateEvaluation(table([evalRow("P01", "E1", [4, 6, 4, 4, 4, 4])]));
  assert.ok(bad.issues.some((i) => /score_silhouette_fit/.test(i.message)));
});

test("두 평가 비교: 일치도 지표와 불일치 검토 목록(차이 2 이상 또는 판정 다름)", () => {
  const a = table([
    evalRow("P01", "E1", [4, 4, 4, 4, 4, 5]),
    evalRow("P02", "E1", [2, 3, 3, 3, 3, 2], "부적합"),
    evalRow("P03", "E1", [3, 3, 3, 3, 3, 3], "조건부"),
  ]);
  const b = table([
    evalRow("P01", "E2", [4, 4, 4, 4, 4, 4]),
    evalRow("P02", "E2", [4, 3, 3, 3, 3, 3], "조건부"),
    evalRow("P03", "E2", [3, 3, 3, 3, 3, 3], "조건부"),
  ]);
  const result = compareEvaluations(a, b);

  assert.equal(result.compared, 3);
  assert.deepEqual(result.evaluators, ["E1", "E2"]);
  assert.equal(result.metrics["색"].exact, 0.667);
  assert.equal(result.labelAgreement, 0.667);
  // P02 색 차이 2 + P02 종합 판정 다름 → 2행
  assert.deepEqual(result.review.map((r) => `${r[0]}:${r[1]}`), ["P02:색", "P02:종합"]);
});

test("통계: 가중 kappa(완전 일치 1), 스피어만(역순 -1)", () => {
  assert.equal(weightedKappa([[1, 1], [3, 3], [5, 5]]), 1);
  assert.equal(spearman([1, 2, 3, 4], [4, 3, 2, 1]), -1);
});

test("CSV: 따옴표 안 쉼표·줄바꿈·BOM 처리", () => {
  const rows = parseCsv('﻿이름 [a],이유 [b]\nx,"쉼표, 있음\n줄바꿈 ""따옴표"""\n');
  assert.deepEqual(rows[1], ["x", '쉼표, 있음\n줄바꿈 "따옴표"']);
});
