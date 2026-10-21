// 계약 0.2.0 앱 호환 규칙 테스트 — 연구용 분류(Lab 8개 대분류·세부분류 63개) → 앱 7개 대분류 변환이 조용히 정보를 잃지 않는다
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { convertGarmentsForApp } from "../app-compat.mjs";
import { runValidation } from "../bundle.mjs";
import { ROOT, loadContract } from "../lib.mjs";
import { createValidator } from "../validate.mjs";

const contract = loadContract();
const compat = contract.app_compat;
const lab = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/fkd/__tests__/fixtures/lab-taxonomy-2026-10-21.json"), "utf8"));

// 헤더는 계약 필드 전체(빈 표도 헤더는 있음)
const table = (entity, file, rows) => ({ file, keys: contract.entities[entity].fields.map((f) => f.key), rows: rows.map((values, i) => ({ line: i + 2, values })) });

const row = (attribute_key, value_key, app_field, app_supported, over = {}) => ({
  attribute_key, attribute_ko: attribute_key, value_key, value_ko: value_key, app_field, app_value: "", app_supported,
  status: "proposed", data_origin: "human", version: "1", ...over,
});
const yes = (attribute_key, value_key, app_field, over) => row(attribute_key, value_key, app_field, "yes", { app_value: value_key, ...over });
const no = (attribute_key, value_key, over) => row(attribute_key, value_key, "none", "no", over);

// 의류에 필요한 최소 속성(앱과 같은 값)
const baseValues = () => [
  ...["beige", "black"].map((k) => yes("main_color", k, "color")),
  ...["regular", "relaxed"].map((k) => yes("fit", k, "fit")),
  ...["cotton", "linen"].map((k) => yes("material", k, "material")),
  ...["spring", "summer"].map((k) => yes("season", k, "season")),
  yes("tpo", "casual", "tpo"), no("tpo", "school"),
  ...["casual", "minimal"].map((k) => yes("mood", k, "style")), no("mood", "romantic"),
  row("season", "all-season", "season", "converted"),
  row("value", "light", "colorTone", "converted"),
];

const garment = (garment_id, category, subcategory, over = {}) => ({
  garment_id, name_ko: garment_id, source: "fixture", category, subcategory, main_color: "beige", color_tone: "muted", fit: "regular",
  material: "cotton", season: "spring|summer", tpo: "casual", mood: "casual", attribute_status: "proposed", data_origin: "human", ...over,
});

const run = (values, garments = []) => {
  const result = createValidator(contract, { strictEnumKeys: true }).validateBundle({
    evaluators: table("evaluators", "evaluators.csv", [{ evaluator_id: "E1", role: "cofounder", can_approve: "yes", active: "yes" }]),
    attribute_values: table("attribute_values", "garment_schema.csv", values),
    garments: table("garments", "garments.csv", garments),
    outfits: table("outfits", "outfits.csv", []),
    styling_rules: table("styling_rules", "styling_rules.csv", []),
    outfit_evaluations: [],
  });
  return { ...result, errors: result.issues.filter((i) => i.level === "error"), warnings: result.issues.filter((i) => i.level === "warning") };
};
const errorCodes = (r) => r.errors.map((i) => i.code).sort();

// Lab 대분류 8개·세부분류 63개를 매핑 지침(CLAUDE_C 매핑 지침 2장)대로 적은 속성 사전
const guidedTaxonomy = ({ jumpsuitCategory } = {}) => [
  ...lab.categories.map((k) =>
    k === "jumpsuit" ? (jumpsuitCategory ?? row("category", "jumpsuit", "category", "converted", { app_value: "dress" })) : yes("category", k, "category"),
  ),
  ...lab.existing_41.map(([k, parent]) => yes("subcategory", k, "subCategory", { parent_value: parent })),
  ...[...lab.new_19, ...lab.extra_candidates].map(([k, parent]) => no("subcategory", k, { parent_value: parent, data_origin: "claude_draft" })),
  ...baseValues(),
];

// ---------- 앱 허용값 = 앱 상수 = Gemini 분석 스키마 ----------

test("계약 app_values가 앱 상수(src/constants/clothingOptions.ts)와 같다", () => {
  const source = fs.readFileSync(path.join(ROOT, "src/constants/clothingOptions.ts"), "utf8");
  const arrayOf = (name) => [...source.match(new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const`))[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(compat.app_values.category, arrayOf("CLOTHING_CATEGORIES"));
  assert.deepEqual(compat.app_values.color, arrayOf("CLOTHING_COLORS"));
  assert.deepEqual(compat.app_values.colorTone, arrayOf("COLOR_TONES"));
  assert.deepEqual(compat.app_values.fit, arrayOf("CLOTHING_FITS"));
  assert.deepEqual(compat.app_values.material, arrayOf("CLOTHING_MATERIALS"));
  assert.deepEqual(compat.app_values.season, arrayOf("CLOTHING_SEASONS"));
  assert.deepEqual(compat.app_values.tpo, arrayOf("CLOTHING_TPOS"));
  assert.deepEqual(compat.app_values.style, arrayOf("CLOTHING_STYLES"));
  const subBody = source.match(/export const CLOTHING_SUBCATEGORIES = \{([\s\S]*?)\} as const/)[1];
  for (const category of compat.app_values.category) {
    const block = subBody.match(new RegExp(`${category}: \\[([\\s\\S]*?)\\]`))[1];
    assert.deepEqual(compat.app_values.subCategory[category], [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]), category);
  }
  assert.equal(compat.app_values.category.length, 7, "1라운드 앱 대분류 7개 고정");
});

test("계약 app_values가 Gemini 분석 스키마(backend/server.js)의 허용값과 같다", () => {
  const server = fs.readFileSync(path.join(ROOT, "backend/server.js"), "utf8");
  const enumOf = (field) => {
    const block = server.match(new RegExp(`\\n\\s+${field}: \\{[\\s\\S]*?enum: \\[([\\s\\S]*?)\\]`))[1];
    return [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  };
  assert.deepEqual(enumOf("category"), compat.app_values.category);
  assert.deepEqual(enumOf("subCategory"), Object.values(compat.app_values.subCategory).flat());
  for (const field of ["color", "colorTone", "fit", "material", "season", "tpo", "style"]) assert.deepEqual(enumOf(field), compat.app_values[field], field);
});

test("계약 고정 목록 color_tone이 앱 colorTone과 같다(의류 color_tone은 변환 없이 앱으로)", () => {
  assert.deepEqual(contract.lists.color_tone.map(([k]) => k), compat.app_values.colorTone);
});

// ---------- 속성 사전 앱 매핑 규칙 ----------

test("앱 매핑 규칙: 8번째 앱 대분류 금지, 변환은 앱 값 필요, 미지원 값을 지원으로 표시하면 오류", () => {
  const cases = [
    ["대분류 jumpsuit = yes(앱 대분류 추가로 표시)", [row("category", "jumpsuit", "category", "yes")], ["E_APP_VALUE"]],
    ["대분류 jumpsuit = converted → dress", [row("category", "jumpsuit", "category", "converted", { app_value: "dress" })], []],
    ["대분류 jumpsuit = converted → jumpsuit(앱 값 아님)", [row("category", "jumpsuit", "category", "converted", { app_value: "jumpsuit" })], ["E_APP_VALUE"]],
    ["대분류 jumpsuit = converted, 앱 값 없음", [row("category", "jumpsuit", "category", "converted")], ["E_APP_VALUE"]],
    ["대분류 jumpsuit = converted → dress|top(단일 필드에 여러 값)", [row("category", "jumpsuit", "category", "converted", { app_value: "dress|top" })], ["E_APP_VALUE"]],
    ["romper = yes", [yes("category", "dress", "category"), yes("subcategory", "romper", "subCategory", { parent_value: "dress" })], ["E_APP_VALUE"]],
    ["romper = converted → romper(앱 값 아님)", [yes("category", "dress", "category"), row("subcategory", "romper", "subCategory", "converted", { app_value: "romper", parent_value: "dress" })], ["E_APP_VALUE"]],
    ["앱 필드 none인데 yes", [row("subcategory", "romper", "none", "yes", { parent_value: "dress" }), yes("category", "dress", "category")], ["E_APP_FIELD"]],
    ["세부분류를 앱 category 필드로", [yes("category", "dress", "category"), row("subcategory", "midi-dress", "category", "yes", { parent_value: "dress" })], ["E_APP_FIELD"]],
    ["yes인데 앱 값이 다름", [row("category", "dress", "category", "yes", { app_value: "top" })], ["E_APP_VALUE"]],
    ["사계절 = converted(규칙형, 앱 값 없음)", [row("season", "all-season", "season", "converted")], []],
    ["명도 = converted(D-F02 규칙형)", [row("value", "light", "colorTone", "converted")], []],
    ["무드 romantic → 앱 style 여러 값(목록 필드)", [row("mood", "romantic", "style", "converted", { app_value: "feminine|vintage" })], []],
    ["핏 → 여러 값(단일 필드)", [row("fit", "fitted", "fit", "converted", { app_value: "slim|regular" })], ["E_APP_VALUE"]],
    ["폐기 값은 매핑 검사 안 함", [row("category", "jumpsuit", "category", "yes", { status: "retired" })], []],
  ];
  for (const [name, values, expected] of cases) assert.deepEqual(errorCodes(run(values)), expected, name);
});

test("미지원(no) 값에 앱 값을 적으면 경고만(변환에 쓰지 않음)", () => {
  const r = run([yes("category", "dress", "category"), no("subcategory", "romper", { parent_value: "dress", app_value: "jumpsuit" })]);
  assert.deepEqual(errorCodes(r), []);
  assert.deepEqual(r.warnings.map((w) => w.code), ["W_APP_VALUE_IGNORED"]);
});

test("세부분류의 앱 상위 대분류 = 연구용 상위 대분류의 앱 변환값", () => {
  const converted = row("category", "jumpsuit", "category", "converted", { app_value: "dress" });
  assert.deepEqual(errorCodes(run([converted, yes("subcategory", "jumpsuit", "subCategory", { parent_value: "jumpsuit" })])), []);
  // 앱에서 shirt는 top 아래 → jumpsuit(→dress) 아래에 두면 앱에서 어긋남
  assert.deepEqual(errorCodes(run([converted, yes("subcategory", "shirt", "subCategory", { parent_value: "jumpsuit" })])), ["E_APP_PARENT_MISMATCH"]);
  // 상위 대분류가 앱 미지원이면 세부분류를 앱으로 보낼 수 없음
  assert.deepEqual(errorCodes(run([no("category", "jumpsuit"), yes("subcategory", "jumpsuit", "subCategory", { parent_value: "jumpsuit" })])), ["E_APP_PARENT_MISMATCH"]);
});

// ---------- Lab 63개 세부분류 호환성 기준 ----------

test("Lab 대분류 8개·세부분류 63개: 매핑 지침대로 적으면 오류 0", () => {
  const r = run(guidedTaxonomy());
  assert.deepEqual(errorCodes(r), []);
  assert.equal(lab.existing_41.length + lab.new_19.length + lab.extra_candidates.length, 63);
});

test("Lab의 현재 상태(대분류 jumpsuit 앱 매핑 없음)는 세부분류 jumpsuit에서 E_APP_PARENT_MISMATCH 1건", () => {
  const observed = lab.observed_category_jumpsuit;
  const r = run(guidedTaxonomy({ jumpsuitCategory: row("category", "jumpsuit", observed.app_field, observed.app_supported, { app_value: observed.app_value }) }));
  assert.deepEqual(r.errors.map((i) => `${i.code}:${i.record}`), ["E_APP_PARENT_MISMATCH:subcategory/jumpsuit"]);
});

test("기존 41개 키는 모두 앱 세부분류에 있고(키 유지), 신규 19개·추가 후보 3개는 앱에 없다(지원 표시 금지)", () => {
  const appSubs = new Set(Object.values(compat.app_values.subCategory).flat());
  assert.deepEqual(lab.existing_41.filter(([k]) => !appSubs.has(k)), []);
  assert.deepEqual([...lab.new_19, ...lab.extra_candidates].filter(([k]) => appSubs.has(k)), []);
  for (const [k, parent] of [...lab.new_19, ...lab.extra_candidates]) {
    const r = run([...guidedTaxonomy().filter((v) => v.value_key !== k), yes("subcategory", k, "subCategory", { parent_value: parent })]);
    assert.ok(errorCodes(r).includes("E_APP_VALUE"), k);
  }
});

// ---------- 의류 변환: 원본 보존, 조용한 유실 없음 ----------

test("의류 변환: 점프수트는 dress로 변환(원본 보존), 롬퍼는 제외(가까운 값으로 바꾸지 않음), 목록 미지원 값은 빠진 값으로 기록", () => {
  const garments = [
    garment("G101", "dress", "midi-dress"),
    garment("G102", "jumpsuit", "jumpsuit"),
    garment("G103", "jumpsuit", "romper", { mood: "minimal|romantic" }),
    garment("G104", "top", "shirt", { tpo: "casual|school", season: "all-season", value: "light" }),
  ];
  const r = run(guidedTaxonomy(), garments);
  assert.deepEqual(errorCodes(r), []);
  const report = convertGarmentsForApp(contract, r.data, r.taxonomy);
  const byId = Object.fromEntries(report.records.map((x) => [x.garment_id, x]));

  assert.equal(byId.G101.status, "exact");
  assert.deepEqual([byId.G101.app.category, byId.G101.app.subCategory], ["dress", "midi-dress"]);

  assert.equal(byId.G102.status, "converted");
  assert.deepEqual([byId.G102.app.category, byId.G102.app.subCategory], ["dress", "jumpsuit"]);
  assert.deepEqual([byId.G102.research.category, byId.G102.research.subcategory], ["jumpsuit", "jumpsuit"]);
  assert.deepEqual(byId.G102.conversions, [{ field: "category", app_field: "category", from: "jumpsuit", to: "dress", kind: "converted" }]);

  assert.equal(byId.G103.status, "unsupported");
  assert.equal(byId.G103.app, null);
  assert.deepEqual(byId.G103.unresolved.map((u) => `${u.field}=${u.value}`), ["subcategory=romper"]);
  assert.deepEqual(byId.G103.dropped.map((d) => `${d.field}=${d.value}`), ["mood=romantic"]);
  assert.equal(byId.G103.research.subcategory, "romper");

  assert.equal(byId.G104.status, "lossy");
  assert.deepEqual(byId.G104.app.tpo, ["casual"]);
  assert.deepEqual(byId.G104.app.season, ["spring", "summer", "fall", "winter"]);
  assert.deepEqual(byId.G104.dropped, [{ field: "tpo", value: "school", reason: "unsupported" }]);
  assert.deepEqual(byId.G104.research.tpo, ["casual", "school"]);
  assert.deepEqual(byId.G104.research_only, { value: "light" });

  assert.deepEqual(report.summary, { exact: 1, converted: 1, lossy: 1, unsupported: 1 });
  assert.deepEqual(report.issues.map((i) => `${i.code}:${i.record}`), ["W_APP_UNSUPPORTED:G103", "W_APP_LOSSY:G104"]);
});

test("변환 결과의 앱 값은 모두 앱 허용값이고, 앱 세부분류는 앱 대분류 안에 있다", () => {
  const r = run(guidedTaxonomy(), lab.existing_41.map(([k, parent], i) => garment(`G${200 + i}`, parent, k)));
  const report = convertGarmentsForApp(contract, r.data, r.taxonomy);
  assert.equal(report.summary.unsupported, 0);
  for (const g of report.records) {
    assert.ok(compat.app_values.category.includes(g.app.category), g.garment_id);
    assert.ok(compat.app_values.subCategory[g.app.category].includes(g.app.subCategory), `${g.garment_id} ${g.app.category}/${g.app.subCategory}`);
  }
});

test("전달 패키지 예시: G009 점프수트 converted, G010 롬퍼 unsupported, 나머지 exact", () => {
  const result = runValidation(path.join(ROOT, "docs/handoff/fkd-data-contract-v0.1/examples/csv"), contract);
  assert.equal(result.errors, 0);
  const report = convertGarmentsForApp(contract, result.data, result.taxonomy);
  assert.deepEqual(report.summary, { exact: 8, converted: 1, lossy: 0, unsupported: 1 });
  assert.equal(report.records.find((g) => g.garment_id === "G009").app.category, "dress");
  assert.equal(report.records.find((g) => g.garment_id === "G010").app, null);
});
