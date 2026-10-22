// 비파괴 엔진 시나리오: 컴파일된 엔진 사본 + 모의 옷장. 저장소·DB 변경 없음
const path = require("path");
const E = { ...require(path.join(process.env.ENGINE_DIR, "utils/outfitScore.js")), ...require(path.join(process.env.ENGINE_DIR, "utils/recommendation.js")), ...require(path.join(process.env.ENGINE_DIR, "utils/weatherRecommendation.js")), ...require(path.join(process.env.ENGINE_DIR, "utils/prototypeCore.js")) };
const { CLOTHING_SUBCATEGORIES } = require(path.join(process.env.ENGINE_DIR, "constants/clothingOptions.js"));
const fx = require(path.join(__dirname, "../../../src/utils/__tests__/fixtures/engine-closet.json"));
const W = fx.weathers;
let nextId = 100;
const item = (category, subCategory, over = {}) => ({ id: nextId++, category, subCategory, color: "black", colorTone: "dark", fit: "regular", material: "cotton", season: ["spring", "summer", "fall"], tpo: ["casual", "office"], style: ["minimal", "classic"], ...over });
const label = (items) => items.map((i) => `${i.category}/${i.subCategory}`).join(" + ");
const safe = (name, fn) => { try { return fn(); } catch (e) { console.log(`  ✖ ${name} 예외: ${e.message}`); return null; } };
const rain = { ...W.mild, kind: "rain", label: "비" };
const out = (t) => console.log(`\n## ${t}`);

out("E1 앱이 모르는 세부분류(예: mules, knit-vest)가 옷장에 있을 때");
{
  const closet = [item("top", "shirt", { color: "white", colorTone: "bright" }), item("bottom", "slacks", { color: "navy" }), item("shoes", "mules"), item("outer", "knit-vest", { material: "knit" })];
  for (const [n, fn] of [["Styling", () => closet.map((c) => label(E.getRecommendedOutfit(c, closet).items))], ["Looks", () => E.getRankedLooks(closet).map((l) => `${l.total} ${label(l.items)}`)], ["Today(hot)", () => E.getTodaysLooks(closet, W.hot).map((l) => `${l.score} ${label(l.recommendation.items)}`)], ["Today(rain)", () => E.getTodaysLooks(closet, rain).map((l) => `${l.score} ${label(l.recommendation.items)}`)]]) {
    const r = safe(n, fn); if (r) console.log(`  ${n}: ${JSON.stringify(r)}`);
  }
  const rule = E.getWeatherRule(W.hot);
  console.log(`  날씨 적합도(hot) mules=${E.getWeatherFitScore(closet[2], rule)} sandals=${E.getWeatherFitScore(item("shoes", "sandals"), rule)} (모르는 값 = 중립 15점)`);
}

out("E2 대분류 jumpsuit가 그대로 들어올 때 vs dress/jumpsuit(현재 앱 방식)");
for (const cat of ["jumpsuit", "dress"]) {
  nextId = 200;
  const js = item(cat, "jumpsuit", { fit: "wide", color: "beige", colorTone: "muted" });
  const closet = [js, item("top", "tshirt", { color: "white", colorTone: "bright" }), item("bottom", "jeans", { color: "blue", colorTone: "muted" }), item("shoes", "sneakers", { color: "white" }), item("outer", "jacket")];
  const styling = E.getRecommendedOutfit(js, closet);
  const forItem = E.getRankedLooksForItem(js, closet);
  const looks = E.getRankedLooks(closet).filter((l) => l.items.includes(js));
  const today = E.getTodaysLooks(closet, W.mild).filter((l) => l.recommendation.items.includes(js));
  console.log(`  [${cat}] Styling: ${label(styling.items)} (missing ${JSON.stringify(styling.missingCategories)})`);
  console.log(`  [${cat}] Looks(아이템 기준·PLUS): ${forItem.map((l) => `${l.total} ${label(l.items)}`).join(" | ")}`);
  console.log(`  [${cat}] Looks 전체에 포함된 코디 수: ${looks.length}, Today 포함: ${today.length}`);
  console.log(`  [${cat}] 단독+신발 평가: ${E.evaluateOutfit([js, closet[3]], closet).total}`);
}

out("E3 원피스와 상의·하의가 한 코디에 같이 나오는지 (Styling·Looks·Today 전수)");
{
  nextId = 300;
  const dress = item("dress", "midi-dress", { color: "navy" });
  const closet = [dress, item("top", "shirt", { color: "white", colorTone: "bright" }), item("top", "knit", { material: "knit" }), item("bottom", "skirt"), item("bottom", "jeans", { color: "blue" }), item("shoes", "loafer", { color: "brown" }), item("outer", "cardigan", { material: "knit" }), item("bag", "tote-bag")];
  const bad = (items) => items.some((i) => i.category === "dress") && items.some((i) => i.category === "top" || i.category === "bottom");
  const sets = [];
  closet.forEach((c) => sets.push(["Styling " + c.subCategory, E.getRecommendedOutfit(c, closet).items]));
  closet.forEach((c) => E.getRankedLooksForItem(c, closet, 10).forEach((l) => sets.push(["ForItem " + c.subCategory, l.items])));
  E.getRankedLooks(closet, 50).forEach((l) => sets.push(["Looks", l.items]));
  for (const w of ["cold", "mild", "hot"]) E.getTodaysLooks(closet, W[w], 10).forEach((l) => sets.push([`Today ${w}`, l.recommendation.items]));
  const conflicts = sets.filter(([, items]) => bad(items));
  console.log(`  검사한 코디 ${sets.length}개, 원피스+상의/하의 중복 ${conflicts.length}개 ${conflicts.slice(0, 3).map(([n, i]) => `${n}: ${label(i)}`).join(" | ")}`);
  const coatLooks = E.getRankedLooksForItem(closet[6], closet, 10);
  console.log(`  카디건 기준 Looks에 원피스 포함: ${coatLooks.some((l) => l.items.includes(dress))} (아우터 기준 코디는 상의+하의 조합에만 더함)`);
}

out("E4 굽 높이: 같은 신발 유형인데 굽만 다를 때(앱에 굽 정보 없음)");
{
  const ruleRain = E.getWeatherRule(rain), ruleSnow = E.getWeatherRule(W.cold);
  for (const sub of ["heels", "flats", "loafer", "mary-jane", "mules", "sandals"]) {
    const s = item("shoes", sub);
    console.log(`  ${sub.padEnd(9)} 비 ${E.getWeatherFitScore(s, ruleRain)} · 눈 ${E.getWeatherFitScore(s, ruleSnow)} · 코디 점수(셔츠+슬랙스) ${E.evaluateOutfit([item("top", "shirt"), item("bottom", "slacks"), s], []).total}`);
  }
  console.log("  → 코디 점수는 세부분류를 보지 않아 굽 차이가 반영되지 않음. 날씨는 heels(비·눈)·flats(눈)만 회피. 힐 로퍼·힐 메리제인을 앱이 loafer/flats로 받으면 비 오는 날 회피가 빠짐");
}

out("E5 카디건·베스트 레이어링");
{
  nextId = 500;
  const cardigan = item("outer", "cardigan", { material: "knit" });
  const closet = [cardigan, item("bottom", "skirt"), item("shoes", "flats")];
  const looks = E.getRankedLooks(closet);
  console.log(`  상의 없이 카디건+스커트+플랫: Looks ${looks.map((l) => `${l.total} ${label(l.items)} 완성도${l.details ? "" : ""}`).join(" | ") || "없음"}`);
  console.log(`  Styling(카디건 기준): ${label(E.getRecommendedOutfit(cardigan, closet).items)} missing ${JSON.stringify(E.getRecommendedOutfit(cardigan, closet).missingCategories)}`);
  const withTop = E.evaluateOutfit([item("top", "shirt"), item("bottom", "skirt"), item("shoes", "flats")], []).total;
  const asOuter = E.evaluateOutfit([cardigan, item("bottom", "skirt"), item("shoes", "flats")], []).total;
  console.log(`  같은 옷을 상의 자리로 볼 수 없어 점수 감점: 셔츠+스커트+플랫 ${withTop} vs 카디건+스커트+플랫 ${asOuter}`);
  const hot = E.getWeatherRule(W.hot);
  for (const [n, v] of [["니트 베스트(앱 vest/knit)", item("outer", "vest", { material: "knit" })], ["패딩 베스트(앱 vest/nylon)", item("outer", "vest", { material: "nylon", season: ["fall", "winter"] })], ["패딩(padding)", item("outer", "padding", { material: "nylon", season: ["winter"] })]]) {
    console.log(`  ${n} 더위 적합도 ${E.getWeatherFitScore(v, hot)}`);
  }
  nextId = 550;
  const c2 = [item("top", "shirt", { color: "white" }), item("outer", "vest", { material: "nylon", season: ["fall", "winter"] }), item("bottom", "slacks"), item("shoes", "loafer")];
  console.log(`  Looks(날씨 없음)에 패딩 베스트 아우터 추가 코디: ${E.getRankedLooks(c2).map((l) => label(l.items)).join(" | ")}`);
}

out("E6 Lab 범위 축소로 생기는 날씨 신호 손실 (민소매 블라우스, 힐 뮬)");
{
  const hot = E.getWeatherRule(W.hot);
  console.log(`  35°C 민소매 블라우스: sleeveless로 받으면 ${E.getWeatherFitScore(item("top", "sleeveless", { season: ["summer"] }), hot)}, blouse로 받으면 ${E.getWeatherFitScore(item("top", "blouse", { season: ["summer"] }), hot)}`);
  console.log(`  원피스 더위: mini-dress ${E.getWeatherFitScore(item("dress", "mini-dress", { season: ["summer"] }), hot)}, midi-dress ${E.getWeatherFitScore(item("dress", "midi-dress", { season: ["summer"] }), hot)}, jumpsuit(롬퍼를 변환했을 때) ${E.getWeatherFitScore(item("dress", "jumpsuit", { season: ["summer"] }), hot)}`);
}

out("E7 Missing Item → 상품: 제안 값은 앱 41개 안에서만 생성");
{
  const outfit = [item("top", "shirt", { style: ["classic"], tpo: ["office"] }), item("bottom", "slacks", { style: ["classic"] })];
  for (const cat of ["shoes", "bottom", "outer", "dress", "bag", "accessory", "jumpsuit"]) {
    const r = safe(cat, () => E.getMissingItemSuggestion(cat, outfit));
    if (r) console.log(`  ${cat} → ${r.category}/${r.subCategory}/${r.color}/${r.style}`);
  }
}

out("E8 분석 수정 화면이 모르는 대분류를 받을 때(analyze.tsx:478과 같은 식)");
console.log(`  CLOTHING_SUBCATEGORIES["dress"].length = ${CLOTHING_SUBCATEGORIES.dress.length}`);
safe('CLOTHING_SUBCATEGORIES["jumpsuit"].map', () => CLOTHING_SUBCATEGORIES["jumpsuit"].map((x) => x));
