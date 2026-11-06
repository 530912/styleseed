// 비파괴: 계약 0.2.0 의류 변환 + 1라운드 상품 CSV 검증기에 신규 6색을 넣어 본다. 저장소 파일 변경 없음
// 주색상 앱 매핑은 KNOWLEDGE_LAB_COLOR_HANDOFF r1 부록 A(14개 color/yes, 신규 6개 none/no)를 그대로 옮김
import path from "node:path";
import { convertGarmentForApp } from "../../fkd/app-compat.mjs";
import { loadContract } from "../../fkd/lib.mjs";
import { loadCatalogTables, loadProductContract, validateCatalog } from "../../round1/products.mjs";

const contract = loadContract();
const APP14 = ["black", "white", "gray", "beige", "brown", "navy", "blue", "red", "pink", "orange", "yellow", "green", "purple", "multi"];
const NEW = ["ivory", "burgundy", "olive", "teal", "gold", "silver"];
const entry = (appField, appSupported, appValue = "") => ({ status: "proposed", appField, appSupported, appValue });
const taxonomyWith = (colorOverrides = {}) => new Map([
  ["category", new Map([["top", entry("category", "yes")], ["accessory", entry("category", "yes")]])],
  ["subcategory", new Map([["knit", entry("subCategory", "yes")], ["necklace", entry("subCategory", "yes")]])],
  ["main_color", new Map([...APP14.map((k) => [k, entry("color", "yes")]), ...NEW.map((k) => [k, colorOverrides[k] ?? entry("none", "no")])])],
  ["fit", new Map([["regular", entry("fit", "yes")]])],
  ["material", new Map([["wool", entry("material", "yes")], ["other", entry("material", "yes")]])],
  ["season", new Map([["fall", entry("season", "yes")]])],
  ["tpo", new Map([["casual", entry("tpo", "yes")]])],
  ["mood", new Map([["classic", entry("style", "yes")]])],
]);
const garment = (id, main_color, sub = "knit") => ({ garment_id: id, category: sub === "knit" ? "top" : "accessory", subcategory: sub, main_color, color_tone: "muted", fit: "regular", material: sub === "knit" ? "wool" : "other", season: ["fall"], tpo: ["casual"], mood: ["classic"] });
const show = (r) => `${r.status}${r.app ? ` → color=${r.app.color}` : " (앱·엔진 입력 제외)"}${r.conversions.length ? ` 변환 ${JSON.stringify(r.conversions.map((c) => `${c.from}→${c.to}`))}` : ""}${r.unresolved.length ? ` 미해결 ${JSON.stringify(r.unresolved.map((u) => `${u.field}=${u.value}(${u.reason})`))}` : ""}`;

console.log("\n## K1 계약 0.2.0: 신규 6색 의류(현재 Lab 매핑 none/no)");
for (const c of NEW) console.log(`  ${c} 니트: ${show(convertGarmentForApp(contract, taxonomyWith(), garment(`G-${c}`, c)))}`);

console.log("\n## K2 같은 의류, 변환 규칙(converted)을 정했다고 가정 — 후보는 Lab 인계 2장 표");
const CANDIDATE = { ivory: "white", burgundy: "red", olive: "green", teal: "blue", gold: "yellow", silver: "gray" };
const converted = taxonomyWith(Object.fromEntries(NEW.map((k) => [k, entry("color", "converted", CANDIDATE[k])])));
for (const c of NEW) console.log(`  ${c}: ${show(convertGarmentForApp(contract, converted, garment(`G-${c}`, c)))}`);

console.log("\n## K3 앱 값이 아닌 색을 '직접 지원(yes)'으로 잘못 표시하면");
const wrongYes = taxonomyWith({ ivory: entry("color", "yes") });
console.log(`  ivory: ${show(convertGarmentForApp(contract, wrongYes, garment("G-ivory", "ivory")))}`);

console.log("\n## P1 1라운드 상품 CSV 검증기: 예시 주얼리 상품(JWL-001 실버 체인 목걸이) 색만 바꿔 검증");
const pc = loadProductContract();
const dir = path.resolve("data/round1/products/examples");
for (const color of ["gray", "silver", "gold", "yellow", "ivory"]) {
  const tables = loadCatalogTables(dir, pc);
  tables.products = { ...tables.products, rows: tables.products.rows.map((r) => (r.values.product_id === "JWL-001" ? { ...r, values: { ...r.values, color } } : r)) };
  const { issues } = validateCatalog(pc, tables);
  const mine = issues.filter((i) => i.record?.includes?.("JWL-001") && i.field === "color");
  console.log(`  color=${color}: ${mine.length ? mine.map((i) => `${i.level} ${i.code}`).join(", ") : "색 오류 없음"}`);
}
