// 비파괴: Lab 인계 JSON(읽기 전용) → 계약 0.2.0 검증기·변환 보고서. 저장소 파일 변경 없음
import fs from "node:fs";
import { createValidator, validateManifest } from "../../fkd/validate.mjs";
import { convertGarmentsForApp } from "../../fkd/app-compat.mjs";
import { loadContract, parseCsv, toCsv } from "../../fkd/lib.mjs";

const contract = loadContract();
const lab = JSON.parse(fs.readFileSync(process.env.LAB_TAXONOMY_JSON, "utf8"));
const fields = contract.entities.attribute_values.fields.map((f) => f.key);
const table = (entity, file, rows) => ({ file, keys: contract.entities[entity].fields.map((f) => f.key), rows: rows.map((values, i) => ({ line: i + 2, values })) });
const KO = { category: "대분류", subcategory: "세부분류" };
const str = (r) => Object.fromEntries(fields.map((k) => [k, k === "attribute_ko" && !r[k] ? KO[r.attribute_key] : r[k] === undefined || r[k] === null ? "" : String(r[k])]));
// 의류 속성에 필요한 최소 값(앱과 같은 값)만 추가 — Lab 사전에는 대분류·세부분류만 있음
const extra = [["main_color", "black", "color"], ["main_color", "beige", "color"], ["fit", "regular", "fit"], ["fit", "wide", "fit"], ["material", "cotton", "material"], ["material", "linen", "material"], ["season", "summer", "season"], ["tpo", "casual", "tpo"], ["mood", "minimal", "style"]]
  .map(([a, k, f]) => ({ attribute_key: a, attribute_ko: a, value_key: k, value_ko: k, app_field: f, app_value: k, app_supported: "yes", status: "proposed", data_origin: "human", version: "1" }));
const garment = (id, category, subcategory) => ({ garment_id: id, name_ko: id, source: "other", category, subcategory, main_color: "black", color_tone: "dark", fit: "regular", material: "cotton", season: "summer", tpo: "casual", mood: "minimal", attribute_status: "proposed", data_origin: "human" });
const run = (values, garments = []) => {
  const r = createValidator(contract, { strictEnumKeys: true }).validateBundle({
    evaluators: table("evaluators", "evaluators.csv", [{ evaluator_id: "E1", role: "cofounder", can_approve: "yes", active: "yes" }]),
    attribute_values: table("attribute_values", "garment_schema.csv", [...values.map(str), ...extra]),
    garments: table("garments", "garments.csv", garments), outfits: table("outfits", "outfits.csv", []), styling_rules: table("styling_rules", "styling_rules.csv", []), outfit_evaluations: [],
  });
  return r;
};
const errs = (r) => r.issues.filter((i) => i.level === "error").map((i) => `${i.code}:${i.record}`);
const base = [...lab.categories, ...lab.subcategories];
const withJumpsuit = (patch) => base.map((v) => (v.attribute_key === "category" && v.value_key === "jumpsuit" ? { ...v, ...patch } : v));

console.log(`인계 JSON: 대분류 ${lab.categories.length}, 세부분류 ${lab.subcategories.length}, 스냅샷 ${lab.snapshot} (${lab.snapshot_sha256})`);
console.log("S1 현재 Lab 사전:", JSON.stringify(errs(run(base))), `경고 ${run(base).issues.filter((i) => i.level === "warning").length}`);
const fixed = withJumpsuit({ app_field: "category", app_value: "dress", app_supported: "converted" });
console.log("S2 대분류 jumpsuit → category/dress/converted:", JSON.stringify(errs(run(fixed))));
const r3 = run(fixed, [garment("G1", "jumpsuit", "jumpsuit"), garment("G2", "jumpsuit", "romper"), garment("G3", "top", "knit-vest"), garment("G4", "dress", "shirt-dress"), garment("G5", "dress", "mini-dress"), garment("G6", "shoes", "mary-jane")]);
const rep = convertGarmentsForApp(contract, r3.data, r3.taxonomy);
console.log("S3/S7 변환 보고서:", JSON.stringify(rep.summary));
for (const g of rep.records) console.log(`   ${g.garment_id} ${g.research.category}/${g.research.subcategory} → ${g.status} ${g.app ? `${g.app.category}/${g.app.subCategory}` : "제외"} ${g.unresolved.map((u) => `${u.field}=${u.value}`).join(",")}`);
const vest = fixed.map((v) => (["knit-vest", "tailored-vest", "padded-vest"].includes(v.value_key) ? { ...v, app_field: "subCategory", app_value: "vest", app_supported: "converted" } : v));
console.log("S4 베스트 3종 → 앱 vest 변환:", JSON.stringify(errs(run(vest))));
const vest2 = fixed.map((v) => (["knit-vest", "tailored-vest"].includes(v.value_key) ? { ...v, app_field: "subCategory", app_value: "knit", app_supported: "converted" } : v.value_key === "padded-vest" ? { ...v, app_field: "subCategory", app_value: "padding", app_supported: "converted" } : v));
console.log("S4' 니트·테일러드 → knit(top), 패딩 베스트 → padding:", JSON.stringify(errs(run(vest2))));
const romper = fixed.map((v) => (v.value_key === "romper" ? { ...v, app_field: "subCategory", app_value: "jumpsuit", app_supported: "converted" } : v));
console.log("롬퍼 → 앱 jumpsuit 변환(공동창업자 결정 시):", JSON.stringify(errs(run(romper))));

// S11 줄바꿈·백틱·쉼표·따옴표가 든 문장 CSV 왕복
const tricky = base.filter((v) => /[\n`",]/.test(`${v.guide}${v.definition}${v.note}${v.example}`));
const csv = toCsv(fields, tricky.map((v) => fields.map((k) => v[k] ?? "")));
const back = parseCsv(csv).slice(1);
const same = back.every((row, i) => fields.every((k, j) => (row[j] ?? "") === String(tricky[i][k] ?? "")));
console.log(`S11 CSV 왕복: 특수문자 포함 ${tricky.length}행, 원문 그대로 ${same}`);
console.log(`   최대 글자 수: 정의 ${Math.max(...base.map((v) => (v.definition ?? "").length))}, 판단 기준 ${Math.max(...base.map((v) => (v.guide ?? "").length))}, 메모 ${Math.max(...base.map((v) => (v.note ?? "").length))}`);
const limits = Object.fromEntries(contract.entities.attribute_values.fields.filter((f) => f.max_length).map((f) => [f.key, f.max_length]));
const over = base.flatMap((v) => Object.entries(limits).filter(([k, n]) => (v[k] ?? "").length > n).map(([k, n]) => `${v.value_key}.${k} ${(v[k] ?? "").length}>${n}`));
console.log(`   계약 글자 수 제한 ${JSON.stringify(limits)} 초과: ${JSON.stringify(over)}`);

// S12 Lab 사본(0.1.0) manifest → 0.2.0 검증기
console.log("S12 manifest 0.1.0(JSON):", JSON.stringify(validateManifest(contract, { contract_version: "0.1.0", source: "knowledge-lab", purpose: "production", format: "json" }, () => null).map((i) => i.code)));
