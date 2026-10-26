// 분류 호환 계층(taxonomyCompat) + 엔진 역할 처리 회귀 테스트
// Knowledge Lab 분류(대분류 jumpsuit, 세부분류 romper·knit-vest·tailored-vest·padded-vest)를 앱이 안전하게 다루는지,
// 앱 7개 대분류·41개 세부분류만 쓰는 기존 옷장의 결과는 바뀌지 않는지 확인한다. (엔진은 tsc로 임시 폴더에 컴파일)
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const { closet: legacyCloset, weathers } = JSON.parse(fs.readFileSync(path.join(here, "fixtures/engine-closet.json"), "utf8"));

const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "styleseed-taxonomy-"));
execFileSync(
  path.join(root, "node_modules/.bin/tsc"),
  ["--ignoreConfig", "--outDir", outDir, "--module", "commonjs", "--target", "es2022", "--moduleResolution", "node",
    "--ignoreDeprecations", "6.0", "--skipLibCheck", "--esModuleInterop",
    "src/utils/taxonomyCompat.ts", "src/utils/outfitScore.ts", "src/utils/recommendation.ts", "src/utils/weatherRecommendation.ts", "src/utils/prototypeCore.ts"],
  { cwd: root, stdio: "pipe" },
);
const require = createRequire(path.join(outDir, "index.js"));
const E = {
  ...require(path.join(outDir, "utils/taxonomyCompat.js")),
  ...require(path.join(outDir, "utils/outfitScore.js")),
  ...require(path.join(outDir, "utils/recommendation.js")),
  ...require(path.join(outDir, "utils/weatherRecommendation.js")),
  ...require(path.join(outDir, "utils/prototypeCore.js")),
};
const { CLOTHING_CATEGORIES, CLOTHING_SUBCATEGORIES } = require(path.join(outDir, "constants/clothingOptions.js"));
const { POETCORE_DEMO_RULE } = require(path.join(outDir, "data/coreDemo.js"));

let nextId = 1000;
const item = (category, subCategory, over = {}) => ({
  id: nextId++, category, subCategory, color: "black", colorTone: "dark", fit: "regular", material: "cotton",
  season: ["spring", "summer", "fall", "winter"], tpo: ["casual", "office"], style: ["minimal", "classic"], ...over,
});
const rain = { ...weathers.mild, kind: "rain", label: "비" };

// 한 코디의 역할 규칙: 한 벌 옷과 상의·하의가 함께 있지 않음, 베스트는 아우터 자리에 없음, 아우터 최대 1벌
const checkOutfit = (items, where) => {
  // 옷 1벌만 돌려준 결과(추천할 짝이 없음, 예: 알 수 없는 옷을 기준으로 연 Styling)는 코디가 아니다
  if (items.length < 2) return;
  const roles = items.map(E.getOutfitRole);
  const onePiece = roles.filter((r) => r === "onePiece").length;
  assert.ok(onePiece <= 1, `${where}: 한 벌 옷 2개`);
  if (onePiece === 1) assert.ok(!roles.some((r) => ["top", "topLayer", "bottom"].includes(r)), `${where}: 한 벌 옷 + 상의/하의 ${items.map((i) => i.subCategory)}`);
  assert.ok(roles.filter((r) => r === "outer").length <= 1, `${where}: 아우터 2개`);
  assert.ok(roles.filter((r) => r === "topLayer").length <= 1, `${where}: 베스트 2개`);
  assert.ok(!roles.includes("unknown"), `${where}: 알 수 없는 값이 코디에 들어감`);
  for (const i of items) {
    if (["knit-vest", "tailored-vest"].includes(i.subCategory)) assert.notEqual(E.getOutfitRole(i), "outer", `${where}: 베스트가 아우터로`);
  }
};

// Styling·Looks(전체·아이템별)·Today(날씨 5종)의 모든 코디
const allOutfits = (closet) => {
  const outfits = [];
  for (const c of closet) outfits.push([`Styling ${c.subCategory}`, E.getRecommendedOutfit(c, closet).items]);
  for (const c of closet) for (const l of E.getRankedLooksForItem(c, closet, 20)) outfits.push([`ForItem ${c.subCategory}`, l.items]);
  for (const l of E.getRankedLooks(closet, 50)) outfits.push(["Looks", l.items]);
  for (const [name, w] of [["none", null], ...Object.entries(weathers), ["rain", rain]]) {
    for (const l of E.getTodaysLooks(closet, w, 10)) outfits.push([`Today ${name}`, l.recommendation.items]);
  }
  return outfits;
};

// ---------------- 호환 변환 ----------------

test("앱 41개 세부분류(올바른 대분류)는 모두 exact, 값 변경 없음", () => {
  for (const category of CLOTHING_CATEGORIES) {
    for (const sub of CLOTHING_SUBCATEGORIES[category]) {
      const r = E.resolveTaxonomy(category, sub);
      assert.deepEqual([r.status, r.category, r.subCategory, r.appListSubCategory], ["exact", category, sub, sub], `${category}/${sub}`);
    }
  }
});

test("Lab 점프수트·롬퍼·베스트 3종: 앱 대분류 7개 안으로, 세부분류는 원래 값 유지(가까운 값으로 바꾸지 않음)", () => {
  const cases = [
    ["jumpsuit", "jumpsuit", "converted", "dress", "jumpsuit", "jumpsuit"],
    ["jumpsuit", "romper", "preserved", "dress", "romper", null],
    ["top", "knit-vest", "preserved", "top", "knit-vest", null],
    ["top", "tailored-vest", "preserved", "top", "tailored-vest", null],
    ["outer", "padded-vest", "preserved", "outer", "padded-vest", "vest"],
  ];
  for (const [category, sub, status, appCategory, appSub, appList] of cases) {
    const r = E.resolveTaxonomy(category, sub);
    assert.deepEqual([r.status, r.category, r.subCategory, r.appListSubCategory], [status, appCategory, appSub, appList], `${category}/${sub}`);
    assert.deepEqual(r.source, { category, subCategory: sub });
    assert.ok(CLOTHING_CATEGORIES.includes(r.category));
  }
  assert.notEqual(E.resolveTaxonomy("jumpsuit", "romper").subCategory, "jumpsuit");
  assert.notEqual(E.resolveTaxonomy("top", "knit-vest").subCategory, "vest");
});

test("Lab 상위가 다른 값으로 들어와도 Lab 상위 기준(knit-vest는 아우터가 아니라 상의)", () => {
  const r = E.resolveTaxonomy("outer", "knit-vest");
  assert.equal(r.category, "top");
  assert.ok(r.notes.some((n) => n.includes("Lab 상위")));
});

test("알 수 없는 값: 대분류를 모르면 unsupported(null), 대분류만 알면 역할로만 처리", () => {
  assert.deepEqual([E.resolveTaxonomy("foo", "bar").status, E.resolveTaxonomy("foo", "bar").category], ["unsupported", null]);
  assert.deepEqual([E.resolveTaxonomy("", "").status, E.resolveTaxonomy("", "").category], ["unsupported", null]);
  const mules = E.resolveTaxonomy("shoes", "mules");
  assert.deepEqual([mules.status, mules.category, mules.subCategory, mules.appListSubCategory], ["preserved", "shoes", "mules", null]);
  // 대분류가 비어 있어도 세부분류가 앱 값이면 정할 수 있음
  assert.equal(E.resolveTaxonomy("", "loafer").category, "shoes");
});

test("새 분석 결과의 어긋난 쌍은 세부분류 기준으로 바로잡고 원래 값을 남긴다", () => {
  const r = E.resolveTaxonomy("top", "midi-dress");
  assert.deepEqual([r.status, r.category], ["converted", "dress"]);
  assert.deepEqual(r.source, { category: "top", subCategory: "midi-dress" });
});

test("구버전·저장 데이터: 앱 대분류가 있으면 엔진은 그 값을 그대로 믿는다(기존 결과 불변)", () => {
  assert.equal(E.getEngineCategory({ category: "top", subCategory: "midi-dress" }), "top");
  assert.equal(E.getEngineCategory({ category: "jumpsuit", subCategory: "jumpsuit" }), "dress");
  assert.equal(E.getEngineCategory({ category: "foo", subCategory: "bar" }), null);
});

test("중복 변환: 같은 값을 여러 번 넣어도 결과·원래 값이 같다", () => {
  const inputs = [["jumpsuit", "jumpsuit"], ["jumpsuit", "romper"], ["top", "knit-vest"], ["outer", "padded-vest"], ["top", "midi-dress"], ["dress", "jumpsuit"], ["shoes", "mules"]];
  for (const [category, sub] of inputs) {
    const once = E.normalizeAnalysisTaxonomy({ category, subCategory: sub, color: "black" });
    const twice = E.normalizeAnalysisTaxonomy(once.analysis);
    const thrice = E.normalizeAnalysisTaxonomy(twice.analysis);
    assert.deepEqual(twice.analysis, once.analysis, `${category}/${sub}`);
    assert.deepEqual(thrice.analysis, once.analysis, `${category}/${sub}`);
    assert.equal(twice.resolution.status, once.resolution.status, `${category}/${sub}`);
    if (once.analysis.taxonomySource) assert.deepEqual(once.analysis.taxonomySource, { category, subCategory: sub });
  }
  // 앱 값 그대로면 원래 값 칸을 만들지 않는다
  assert.equal(E.normalizeAnalysisTaxonomy({ category: "top", subCategory: "shirt" }).analysis.taxonomySource, undefined);
});

test("원본 보존: 앱 값 → Lab 분류 되돌리기가 원래 Lab 분류와 같다", () => {
  for (const [category, sub] of [["jumpsuit", "jumpsuit"], ["jumpsuit", "romper"], ["top", "knit-vest"], ["top", "tailored-vest"], ["outer", "padded-vest"]]) {
    const r = E.resolveTaxonomy(category, sub);
    assert.deepEqual(E.toLabTaxonomy(r.category, r.subCategory), { category, subCategory: sub });
  }
  for (const category of CLOTHING_CATEGORIES) {
    for (const sub of CLOTHING_SUBCATEGORIES[category]) {
      if (sub === "jumpsuit") continue;
      assert.deepEqual(E.toLabTaxonomy(category, sub), { category, subCategory: sub });
    }
  }
});

test("수정 화면 선택지: 모르는 대분류도 오류 없이, 앱 목록 밖 현재 값은 남긴다", () => {
  assert.deepEqual(E.getSubcategoryOptions("jumpsuit", "jumpsuit"), ["jumpsuit"]);
  assert.deepEqual(E.getSubcategoryOptions("foo"), []);
  assert.deepEqual(E.getSubcategoryOptions("dress", "romper"), [...CLOTHING_SUBCATEGORIES.dress, "romper"]);
  assert.deepEqual(E.getSubcategoryOptions("top", "knit-vest").slice(-1), ["knit-vest"]);
  assert.deepEqual(E.getSubcategoryOptions("dress", "midi-dress"), [...CLOTHING_SUBCATEGORIES.dress]);
});

test("분석 결과 정리: 대분류 jumpsuit → dress, 저장될 값은 앱 대분류 + 원래 세부분류", () => {
  const gemini = { category: "jumpsuit", subCategory: "romper", color: "black", colorTone: "dark", fit: "relaxed", material: "linen", season: ["summer"], tpo: ["casual"], style: ["minimal"], box2d: [0, 0, 1000, 1000], mask: [] };
  const { analysis, resolution } = E.normalizeAnalysisTaxonomy(gemini);
  assert.deepEqual([analysis.category, analysis.subCategory, resolution.status], ["dress", "romper", "preserved"]);
  assert.deepEqual(analysis.taxonomySource, { category: "jumpsuit", subCategory: "romper" });
  assert.equal(analysis.color, "black");
  // 대분류를 정할 수 없으면 값을 바꾸지 않고 알린다
  const unknown = E.normalizeAnalysisTaxonomy({ category: "foo", subCategory: "bar" });
  assert.deepEqual([unknown.analysis.category, unknown.resolution.status], ["foo", "unsupported"]);
});

// ---------------- 역할 ----------------

test("코디 역할", () => {
  const roles = [
    [["dress", "midi-dress"], "onePiece"], [["dress", "jumpsuit"], "onePiece"], [["jumpsuit", "jumpsuit"], "onePiece"], [["jumpsuit", "romper"], "onePiece"], [["dress", "romper"], "onePiece"],
    [["top", "knit-vest"], "topLayer"], [["top", "tailored-vest"], "topLayer"], [["outer", "padded-vest"], "outer"], [["outer", "vest"], "outer"],
    [["top", "shirt"], "top"], [["outer", "cardigan"], "outer"], [["foo", "bar"], "unknown"],
  ];
  for (const [[category, subCategory], role] of roles) assert.equal(E.getOutfitRole({ category, subCategory }), role, `${category}/${subCategory}`);
});

// ---------------- 엔진 ----------------

const oneOf = () => {
  nextId = 2000;
  return {
    tshirt: item("top", "tshirt", { color: "white", colorTone: "bright" }),
    shirt: item("top", "shirt", { color: "white", colorTone: "bright" }),
    jeans: item("bottom", "jeans", { color: "blue", colorTone: "muted", material: "denim" }),
    skirt: item("bottom", "skirt", { color: "beige", colorTone: "muted" }),
    sneakers: item("shoes", "sneakers", { color: "white" }),
    loafer: item("shoes", "loafer", { color: "brown" }),
    jacket: item("outer", "jacket", { color: "navy" }),
    coat: item("outer", "coat", { color: "beige", material: "wool", season: ["fall", "winter"] }),
  };
};

for (const [label, category, sub] of [["Lab 점프수트(대분류 jumpsuit 그대로)", "jumpsuit", "jumpsuit"], ["앱 점프수트(dress/jumpsuit)", "dress", "jumpsuit"], ["롬퍼(dress/romper)", "dress", "romper"], ["롬퍼(대분류 jumpsuit 그대로)", "jumpsuit", "romper"]]) {
  test(`${label}: 상의·하의를 대체하는 한 벌 — Styling·Looks·Today에서 상의·하의 중복 0, 아우터 레이어 가능`, () => {
    const c = oneOf();
    const onePiece = item(category, sub, { color: "beige", colorTone: "muted", fit: "wide" });
    const closet = [onePiece, ...Object.values(c)];
    for (const [where, items] of allOutfits(closet)) checkOutfit(items, where);

    const styling = E.getRecommendedOutfit(onePiece, closet);
    assert.deepEqual(styling.items.map(E.getOutfitRole).sort(), ["onePiece", "shoes"]);
    assert.deepEqual(styling.missingCategories, []);

    const forItem = E.getRankedLooksForItem(onePiece, closet, 10);
    assert.ok(forItem.length >= 2);
    assert.ok(forItem.some((l) => l.items.some((i) => E.getOutfitRole(i) === "outer")), "아우터를 더한 코디");
    for (const l of forItem) assert.equal(l.completeness, 1, "한 벌 + 신발이면 완성도 1");

    assert.ok(E.getRankedLooks(closet, 50).some((l) => l.items.includes(onePiece)), "Looks 전체에 포함");
    const cold = E.getTodaysLooks(closet, weathers.cold, 20).find((l) => l.base === onePiece);
    assert.ok(cold, "Today 기준 옷으로 쓰임");
    assert.ok(cold.recommendation.items.some((i) => E.getOutfitRole(i) === "outer"), "추운 날 아우터 레이어");
  });
}

test("Lab 대분류 jumpsuit와 앱 dress/jumpsuit는 엔진 점수가 같다(변환 결과 일치)", () => {
  const make = (category) => {
    const c = oneOf();
    nextId = 3000;
    const js = item(category, "jumpsuit", { color: "beige", colorTone: "muted", fit: "wide" });
    return { js, closet: [js, ...Object.values(c)] };
  };
  const lab = make("jumpsuit");
  const app = make("dress");
  const summarize = (looks) => looks.map((l) => [l.total, l.items.map((i) => i.id)]);
  assert.deepEqual(summarize(E.getRankedLooksForItem(lab.js, lab.closet, 5)), summarize(E.getRankedLooksForItem(app.js, app.closet, 5)));
  assert.deepEqual(summarize(E.getRankedLooks(lab.closet, 10)), summarize(E.getRankedLooks(app.closet, 10)));
});

for (const sub of ["knit-vest", "tailored-vest"]) {
  test(`${sub}: 상의 자리 + 셔츠 위 레이어로 처리, 아우터로 추천하지 않음`, () => {
    const c = oneOf();
    const vest = item("top", sub, { color: "gray", material: sub === "knit-vest" ? "knit" : "wool" });
    const closet = [vest, ...Object.values(c)];
    for (const [where, items] of allOutfits(closet)) checkOutfit(items, where);

    // Styling: 베스트 기준 → 하의·신발 + 안에 입을 상의
    const styling = E.getRecommendedOutfit(vest, closet);
    assert.deepEqual(styling.items.map(E.getOutfitRole).sort(), ["bottom", "shoes", "top", "topLayer"]);

    // Looks: 베스트 단독(상의 자리)과 셔츠 위 레이어 코디가 모두 후보
    const forVest = E.getRankedLooksForItem(vest, closet, 20);
    assert.ok(forVest.some((l) => !l.items.some((i) => E.getOutfitRole(i) === "top")), "베스트를 상의로");
    assert.ok(forVest.some((l) => l.items.some((i) => E.getOutfitRole(i) === "top")), "셔츠 위 레이어");
    for (const l of forVest) assert.ok(l.completeness >= 2 / 3);
    const forShirt = E.getRankedLooksForItem(c.shirt, closet, 20);
    assert.ok(forShirt.some((l) => l.items.includes(vest)), "셔츠 기준 코디에 베스트 레이어 후보");

    // 추운 날: 아우터 자리는 코트·재킷(베스트 아님)
    for (const look of E.getTodaysLooks(closet, weathers.cold, 20)) {
      const outers = look.recommendation.items.filter((i) => E.getOutfitRole(i) === "outer");
      for (const o of outers) assert.ok(["coat", "jacket"].includes(o.subCategory));
    }
    // 아우터 기준 코디에서 베스트는 상의 자리로만
    for (const l of E.getRankedLooksForItem(c.coat, closet, 20)) checkOutfit(l.items, "ForItem coat");
  });
}

test("padded-vest: 아우터로 처리, 겨울 선호·더위 회피(충전재 정보 유지)", () => {
  const c = oneOf();
  const padded = item("outer", "padded-vest", { material: "nylon", season: ["fall", "winter"] });
  const closet = [padded, ...Object.values(c)];
  for (const [where, items] of allOutfits(closet)) checkOutfit(items, where);
  assert.equal(E.getOutfitRole(padded), "outer");
  const plainVest = item("outer", "vest", { material: "nylon", season: ["fall", "winter"] });
  const hot = E.getWeatherRule(weathers.hot);
  const cold = E.getWeatherRule(weathers.cold);
  assert.ok(E.getWeatherFitScore(padded, hot) < E.getWeatherFitScore(plainVest, hot), "더위에는 일반 vest보다 낮게");
  assert.ok(E.getWeatherFitScore(padded, cold) > E.getWeatherFitScore(plainVest, cold), "추위에는 일반 vest보다 높게");
  assert.ok(E.getRankedLooksForItem(padded, closet, 10).every((l) => l.items.filter((i) => E.getOutfitRole(i) === "outer").length === 1));
});

test("알 수 없는 값: 예외 없음, 코디에 들어가지 않음, 기존 옷장 결과는 그대로", () => {
  nextId = 5000;
  const unknown = item("foo", "bar");
  const closet = [...legacyCloset, unknown];
  for (const [where, items] of allOutfits(closet)) checkOutfit(items, where);
  assert.deepEqual(E.getRankedLooksForItem(unknown, closet, 5), []);
  assert.doesNotThrow(() => E.getRecommendedOutfit(unknown, closet));
  assert.deepEqual(E.getRecommendedOutfit(unknown, closet).items, [unknown]);
  const ids = (looks) => looks.map((l) => l.items.map((i) => i.id));
  assert.deepEqual(ids(E.getRankedLooks(closet, 5)), ids(E.getRankedLooks(legacyCloset, 5)));
  for (const w of Object.values(weathers)) {
    assert.deepEqual(E.getTodaysLooks(closet, w, 3).map((l) => l.recommendation.items.map((i) => i.id)), E.getTodaysLooks(legacyCloset, w, 3).map((l) => l.recommendation.items.map((i) => i.id)));
  }
});

test("기존 41개 옷장: 역할 규칙 위반 0(구버전 데이터 회귀)", () => {
  for (const [where, items] of allOutfits(legacyCloset)) checkOutfit(items, where);
});

test("Missing Item: 신규 값이 있는 코디도 앱 값으로 제안, 오류 없음", () => {
  nextId = 6000;
  const vest = item("top", "knit-vest", { material: "knit" });
  const closet = [vest, item("top", "shirt")];
  const styling = E.getRecommendedOutfit(vest, closet);
  assert.deepEqual(styling.missingCategories, ["bottom", "shoes"]);
  for (const category of styling.missingCategories) {
    const s = E.getMissingItemSuggestion(category, styling.items);
    assert.ok(CLOTHING_SUBCATEGORIES[s.category].includes(s.subCategory), `${category} → ${s.subCategory}`);
  }
  const romper = item("jumpsuit", "romper");
  assert.deepEqual(E.getRecommendedOutfit(romper, [romper]).missingCategories, ["shoes"]);
});

test("Core: 대분류 jumpsuit 옷도 상·하의가 없을 때 한 벌 슬롯으로 쓰임", () => {
  nextId = 7000;
  const js = item("jumpsuit", "jumpsuit", { color: "brown", material: "wool", season: ["fall"] });
  const closet = [js, item("shoes", "loafer", { color: "brown" })];
  const look = E.buildPrototypeCoreLook(closet, POETCORE_DEMO_RULE);
  assert.ok(look.items.includes(js));
});
