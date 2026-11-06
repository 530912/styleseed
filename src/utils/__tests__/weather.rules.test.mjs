// 날씨 기반 오늘의 코디 규칙 회귀 (2026-11 사용자 조사 전 P0)
//
// 같은 테스트 옷장(fixtures/weather-closet.json, 가짜 데이터)에서 기온·날씨만 바꿔
// 구간 구분, 차단 아이템, 부족 안내, 비·눈 신발/아우터, 사계절 태그, 추천 이유를 확인한다.
// 엔진은 engine.snapshot.test.mjs와 같은 방식(tsc → 임시 폴더 CommonJS)으로 불러온다.
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
const { closet } = JSON.parse(
  fs.readFileSync(path.join(here, "fixtures/weather-closet.json"), "utf8"),
);

const loadEngine = () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "styleseed-weather-"));

  execFileSync(
    path.join(root, "node_modules/.bin/tsc"),
    [
      "--ignoreConfig",
      "--outDir", outDir,
      "--module", "commonjs",
      "--target", "es2022",
      "--moduleResolution", "node",
      "--ignoreDeprecations", "6.0",
      "--skipLibCheck",
      "--esModuleInterop",
      "src/utils/weatherRecommendation.ts",
    ],
    { cwd: root, stdio: "pipe" },
  );

  return createRequire(path.join(outDir, "index.js"))(
    path.join(outDir, "utils/weatherRecommendation.js"),
  );
};

const E = loadEngine();

const weather = (temperature, kind = "clear", label = "맑음", apparent = temperature) => ({
  temperature,
  apparentTemperature: apparent,
  kind,
  label,
  isDay: true,
  city: null,
  observedAt: "2026-10-27T09:00:00+09:00",
});

const subs = (look) => look.recommendation.items.map((item) => item.subCategory);
const allItems = (clothes, w) =>
  E.getTodaysLooks(clothes, w, 99).flatMap((look) => look.recommendation.items);

const ALL_SEASONS = ["spring", "summer", "fall", "winter"];

test("-5°C와 5°C를 다른 구간으로 본다 (영하는 패딩·코트, 5°C는 코트 우선)", () => {
  assert.equal(E.getTemperatureBand(-5), "freezing");
  assert.equal(E.getTemperatureBand(5), "cold");

  const freezing = E.getTodaysLooks(closet, weather(-5, "clear", "맑음", -9), 3);
  const cold = E.getTodaysLooks(closet, weather(5, "clear", "맑음", 3), 3);

  assert.notDeepEqual(freezing.map(subs), cold.map(subs));

  for (const look of freezing) {
    assert.ok(subs(look).some((s) => ["padding", "coat"].includes(s)), "영하에는 두꺼운 아우터");
  }
  assert.equal(subs(cold[0]).includes("coat"), true, "5°C 1위는 코트");
});

test("체감온도가 있으면 체감온도로 구간을 정한다", () => {
  // 실제 2°C, 체감 -4°C → 영하 구간
  assert.equal(E.getWeatherRule(weather(2, "clear", "맑음", -4)).band, "freezing");
  assert.equal(E.getWeatherRule({ ...weather(2), apparentTemperature: null }).band, "cold");
});

test("추운 날 반바지·민소매·샌들, 더운 날 패딩·코트는 어떤 코디에도 들어가지 않는다", () => {
  const cases = [
    [weather(-5), ["shorts", "sleeveless", "sandals"]],
    [weather(5), ["shorts", "sleeveless", "sandals"]],
    [weather(-2, "snow", "눈"), ["shorts", "sleeveless", "sandals"]],
    [weather(23), ["padding", "coat"]],
    [weather(30), ["padding", "coat"]],
  ];

  for (const [w, blocked] of cases) {
    for (const clothes of [closet, closet.map((c) => ({ ...c, season: ALL_SEASONS })), closet.map((c) => ({ ...c, season: [] }))]) {
      const used = allItems(clothes, w).map((item) => item.subCategory);
      for (const sub of blocked) {
        assert.ok(!used.includes(sub), `${w.temperature}°C ${w.kind}: ${sub} 차단`);
      }
    }
  }
});

test("사계절·계절 없음 태그여도 아이템·소재로 판단한다 (사계절 태그만으로 통과하지 않음)", () => {
  const allSeason = closet.map((c) => ({ ...c, season: ALL_SEASONS }));
  const rule = E.getWeatherRule(weather(-5));
  const fit = (id) => E.getWeatherFitScore(allSeason.find((c) => c.id === id), rule);

  assert.ok(fit(4) > fit(1), "니트 > 반팔");
  assert.ok(fit(9) > fit(6), "패딩 > 가디건");
  assert.ok(fit(1) < 40 && fit(6) < 40, "반팔·가디건은 기준 미만");

  const hot = E.getTodaysLooks(allSeason, weather(30), 3);
  for (const look of hot) {
    assert.ok(!subs(look).some((s) => ["hoodie", "knit", "boots"].includes(s)), "30°C 상위에 후드·니트·부츠 없음");
  }
});

test("비·눈이 오면 신발·아우터를 우선한다 (샌들·로퍼·가디건이 뒤로)", () => {
  const rain = E.getTodaysLooks(closet, weather(12, "rain", "비"), 3);
  for (const look of rain) {
    assert.ok(subs(look).includes("boots"), "쌀쌀한 비: 부츠");
    assert.ok(!subs(look).includes("cardigan"), "쌀쌀한 비: 가디건 대신 재킷 등");
  }

  const warmRain = E.getTodaysLooks(closet, weather(23, "rain", "비"), 3);
  for (const look of warmRain) {
    assert.ok(!subs(look).includes("sandals"), "따뜻한 비: 샌들 대신 운동화");
  }

  const snowNoBoots = closet.filter((c) => ![14, 15, 16].includes(c.id));
  const notes = E.getTodaysWeatherNotes(snowNoBoots, weather(-2, "snow", "눈"));
  assert.ok(notes.some((n) => n.category === "shoes" && n.message.includes("부츠")), "눈 오는 날 부츠 없음 안내");
});

test("맞는 옷이 부족하면 억지로 채우지 않고 카테고리와 이유를 안내한다", () => {
  const summerOnly = closet.filter((c) => [1, 2, 11, 14, 16].includes(c.id));
  const w = weather(-5);
  const notes = E.getTodaysWeatherNotes(summerOnly, w);
  const byCategory = Object.fromEntries(notes.map((n) => [n.category, n]));

  assert.equal(byCategory.bottom.kind, "blocked");
  assert.equal(byCategory.outer.kind, "missing");
  assert.equal(byCategory.top.kind, "fallback");
  assert.ok(byCategory.bottom.message.includes("-5°C"), "안내에 실제 기온");

  const looks = E.getTodaysLooks(summerOnly, w, 3);
  for (const look of looks) {
    assert.ok(!subs(look).includes("shorts"));
    assert.ok(look.recommendation.missingCategories.includes("bottom"));
  }

  // 아우터가 얇은 것뿐이면 가장 가까운 옷 + 안내
  const thinOuter = closet.filter((c) => ![8, 9].includes(c.id));
  assert.ok(E.getTodaysWeatherNotes(thinOuter, w).some((n) => n.category === "outer" && n.kind === "fallback"));

  // 충분한 옷장, 날씨 없음 → 안내 없음
  assert.deepEqual(E.getTodaysWeatherNotes(closet, w), []);
  assert.deepEqual(E.getTodaysWeatherNotes(closet, null), []);
});

test("추천 이유에 실제 기온·체감온도·날씨가 들어가고, AI라는 표현은 없다", () => {
  const [look] = E.getTodaysLooks(closet, weather(-5, "snow", "눈", -9), 1);

  assert.match(look.weatherReasons[0], /-5°C \(체감 -9°C\) · 눈/);
  assert.match(look.weatherLabel, /-5°C/);
  assert.ok(look.weatherReasons.length >= 2, "아이템별 이유");

  for (const w of [weather(-5), weather(15), weather(30), weather(12, "rain", "비")]) {
    for (const l of E.getTodaysLooks(closet, w, 3)) {
      for (const text of [l.weatherLabel, ...l.weatherReasons]) assert.ok(!/AI|Gemini/i.test(text));
    }
    for (const n of E.getTodaysWeatherNotes(closet.slice(0, 3), w)) assert.ok(!/AI|Gemini/i.test(n.message));
  }

  assert.deepEqual(E.getTodaysLooks(closet, null, 1)[0].weatherReasons, []);
});

test("점수 구조 유지: 최종 = 코디 70% + 날씨 30%", () => {
  for (const look of E.getTodaysLooks(closet, weather(15), 3)) {
    assert.equal(look.score, Math.round(look.styleScore * 0.7 + look.weatherScore * 0.3));
  }
});
