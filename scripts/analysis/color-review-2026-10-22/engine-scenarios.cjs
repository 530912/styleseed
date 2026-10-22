// 비파괴 주색상 시나리오: 컴파일된 엔진 사본 + 모의 옷장. 저장소·DB·계약·Lab 변경 없음
// 신규 6색(ivory·burgundy·olive·teal·gold·silver)은 현재 앱 목록 밖 값이므로 "그대로 들어왔을 때"를 본다
const path = require("path");
const E = { ...require(path.join(process.env.ENGINE_DIR, "utils/outfitScore.js")), ...require(path.join(process.env.ENGINE_DIR, "utils/recommendation.js")), ...require(path.join(process.env.ENGINE_DIR, "utils/weatherRecommendation.js")), ...require(path.join(process.env.ENGINE_DIR, "utils/prototypeCore.js")) };
const { POETCORE_DEMO_RULE } = require(path.join(process.env.ENGINE_DIR, "data/coreDemo.js"));
const fx = require(path.join(__dirname, "../../../src/utils/__tests__/fixtures/engine-closet.json"));
const W = fx.weathers;
let nextId = 100;
const item = (category, subCategory, over = {}) => ({ id: nextId++, category, subCategory, color: "black", colorTone: "dark", fit: "regular", material: "cotton", season: ["spring", "summer", "fall"], tpo: ["casual", "office"], style: ["minimal", "classic"], ...over });
const label = (items) => items.map((i) => `${i.color} ${i.subCategory}`).join(" + ");
const safe = (name, fn) => { try { return fn(); } catch (e) { console.log(`  ✖ ${name} 예외: ${e.message}`); return null; } };
const out = (t) => console.log(`\n## ${t}`);
const NEW = ["ivory", "burgundy", "olive", "teal", "gold", "silver"];
const colorDetail = (items) => E.evaluateOutfit(items, items).details.find((d) => d.key === "color").score;
const pairStyling = (a, b) => E.getCompatibilityScore(item("top", "knit", { color: a }), item("bottom", "slacks", { color: b })).colorScore;

out("C1 신규 6색이 저장값으로 들어왔을 때 오류 여부 (Styling·Looks·Today·Missing·Core)");
for (const c of NEW) {
  nextId = 100;
  const closet = [item("top", "knit", { color: c }), item("bottom", "slacks", { color: "navy" }), item("shoes", "loafer", { color: "brown" }), item("outer", "coat", { color: "beige" }), item("accessory", "necklace", { color: c, material: "other" })];
  const r = {
    styling: safe("Styling", () => label(E.getRecommendedOutfit(closet[0], closet).items)),
    looks: safe("Looks", () => E.getRankedLooks(closet).length),
    today: safe("Today", () => E.getTodaysLooks(closet, W.cold).length),
    missing: safe("Missing", () => E.getMissingItemSuggestion("shoes", closet).color),
    core: safe("Core", () => E.getPrototypeCoreScore(closet[0], POETCORE_DEMO_RULE).prototypeCoreScore),
  };
  console.log(`  ${c}: ${JSON.stringify(r)}`);
}

out("C2 색 조합 점수: 신규 색 vs 현재 앱에서 쓸 근사값 (Styling 점수 /20, Looks 색 점수 /100)");
const PAIRS = [["ivory", "white", "black"], ["ivory", "beige", "black"], ["silver", "gray", "black"], ["burgundy", "red", "navy"], ["olive", "green", "beige"], ["teal", "blue", "white"], ["gold", "yellow", "black"], ["ivory", "white", "red"], ["silver", "gray", "pink"]];
for (const [raw, approx, partner] of PAIRS) {
  nextId = 300;
  const look = (c) => colorDetail([item("top", "knit", { color: c }), item("bottom", "slacks", { color: partner })]);
  console.log(`  ${raw}+${partner}: Styling ${pairStyling(raw, partner)} / Looks ${look(raw)}   ↔ ${approx}+${partner}: Styling ${pairStyling(approx, partner)} / Looks ${look(approx)}`);
}

out("C3 multi 처리: 두 엔진의 순서 차이와 단색 대비");
for (const [a, b] of [["multi", "multi"], ["multi", "black"], ["multi", "red"], ["red", "black"], ["red", "blue"], ["black", "black"], ["black", "white"]]) {
  nextId = 400;
  console.log(`  ${a}+${b}: Styling ${pairStyling(a, b)} / Looks ${colorDetail([item("top", "knit", { color: a }), item("bottom", "slacks", { color: b })])}`);
}

out("C4 colorTone이 추천에 쓰이는지: 같은 옷장에서 colorTone만 바꿔 결과 비교");
{
  const base = fx.closet;
  const sig = (closet) => JSON.stringify({
    styling: closet.map((c) => E.getRecommendedOutfit(c, closet).items.map((i) => i.id)),
    looks: E.getRankedLooks(closet).map((l) => [l.total, l.items.map((i) => i.id)]),
    today: Object.values(W).map((w) => E.getTodaysLooks(closet, w).map((l) => [l.score, l.recommendation.items.map((i) => i.id)])),
    core: E.rankClosetByPrototypeCore(closet, POETCORE_DEMO_RULE).map((m) => [m.clothing.id, m.prototypeCoreScore]),
  });
  const variants = ["bright", "light", "muted", "dark", "vivid"].map((t) => sig(base.map((c) => ({ ...c, colorTone: t }))));
  console.log(`  옷장 ${base.length}벌 · colorTone 5가지로 일괄 변경 → 결과 서로 같음: ${variants.every((v) => v === variants[0])}, 원래 값과 같음: ${variants[0] === sig(base)}`);
}

out("C5 취향 점수(Preference)가 색을 문자열로만 세는지: red 옷장에 burgundy·red 새 옷");
{
  nextId = 500;
  const closet = [item("top", "knit", { color: "red" }), item("top", "shirt", { color: "red" }), item("bottom", "skirt", { color: "red" }), item("bottom", "slacks", { color: "black" })];
  const pref = (c) => E.evaluateOutfit([item("outer", "coat", { color: c }), closet[3]], closet).details.find((d) => d.key === "preference").score;
  console.log(`  red 코트 ${pref("red")} / burgundy 코트 ${pref("burgundy")} / blue 코트 ${pref("blue")}`);
}

out("C6 Core(POETCORE 데모): 라벨은 Burgundy·Olive인데 점수는 red·green 기준");
console.log(`  primary ${JSON.stringify(POETCORE_DEMO_RULE.colors.primary)} labels ${JSON.stringify(POETCORE_DEMO_RULE.colors.labels)}`);
for (const c of ["red", "burgundy", "green", "olive", "brown", "ivory", "white"]) {
  nextId = 600;
  const m = E.getPrototypeCoreScore(item("top", "knit", { color: c, material: "wool", season: ["fall"] }), POETCORE_DEMO_RULE);
  console.log(`  ${c} wool knit: ${m.prototypeCoreScore} ${JSON.stringify(m.matchedSignals)}`);
}

out("C7 신규 색 옷이 Today에서 선택되는 정도(색 점수 차이가 순위에 미치는지)");
{
  nextId = 700;
  for (const [raw, approx] of [["ivory", "white"], ["silver", "gray"], ["burgundy", "red"]]) {
    const pick = (c) => {
      const closet = [item("top", "knit", { color: c }), item("top", "knit", { color: "pink", id: 9001 }), item("bottom", "slacks", { color: "black" }), item("shoes", "loafer", { color: "black" })];
      const top = E.getTodaysLooks(closet, W.mild)[0];
      return top ? `${top.score} ${label(top.recommendation.items)}` : "없음";
    };
    console.log(`  ${raw}: ${pick(raw)}   ↔ ${approx}: ${pick(approx)}`);
  }
}
