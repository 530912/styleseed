// colorTone·명도·채도가 현재 추천 결과에 영향을 주지 않는다는 회귀 테스트 (D-F02 설계 r2 5장 "단계 0")
// 앞으로 엔진이 명도·채도를 읽게 되면(단계 3) 이 테스트를 의도적으로 고쳐야 한다. 조용히 영향이 생기는 것을 막는 장치다.
// (엔진은 tsc로 임시 폴더에 컴파일)
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
const { closet, weathers } = JSON.parse(fs.readFileSync(path.join(here, "fixtures/engine-closet.json"), "utf8"));

const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "styleseed-colortone-"));
execFileSync(
  path.join(root, "node_modules/.bin/tsc"),
  ["--ignoreConfig", "--outDir", outDir, "--module", "commonjs", "--target", "es2022", "--moduleResolution", "node",
    "--ignoreDeprecations", "6.0", "--skipLibCheck", "--esModuleInterop",
    "src/utils/outfitScore.ts", "src/utils/recommendation.ts", "src/utils/weatherRecommendation.ts", "src/utils/prototypeCore.ts"],
  { cwd: root, stdio: "pipe" },
);
const require = createRequire(path.join(outDir, "index.js"));
const E = {
  ...require(path.join(outDir, "utils/outfitScore.js")),
  ...require(path.join(outDir, "utils/recommendation.js")),
  ...require(path.join(outDir, "utils/weatherRecommendation.js")),
  ...require(path.join(outDir, "utils/prototypeCore.js")),
};
const { POETCORE_DEMO_RULE } = require(path.join(outDir, "data/coreDemo.js"));

const ids = (items) => items.map((i) => i.id);

// Styling·Looks(아이템 기준·전체)·Today(모든 날씨)·Core·Missing·Look 인사이트를 한 문자열로
const signature = (clothes) =>
  JSON.stringify({
    styling: clothes.map((c) => {
      const r = E.getRecommendedOutfit(c, clothes);
      return [ids(r.items), r.score, r.missingCategories, E.getLookInsights(r).map((x) => [x.key, x.value, x.score])];
    }),
    forItem: clothes.map((c) => E.getRankedLooksForItem(c, clothes).map((l) => [l.total, ids(l.items)])),
    looks: E.getRankedLooks(clothes).map((l) => [l.total, ids(l.items), l.details.map((d) => d.score)]),
    today: Object.values(weathers).map((w) => E.getTodaysLooks(clothes, w).map((l) => [l.score, ids(l.recommendation.items)])),
    core: E.rankClosetByPrototypeCore(clothes, POETCORE_DEMO_RULE).map((m) => [m.clothing.id, m.prototypeCoreScore]),
    missing: ["top", "bottom", "outer", "shoes", "dress", "bag", "accessory"].map((c) => E.getMissingItemSuggestion(c, clothes)),
  });

const baseline = signature(closet);

test("검증 장치 확인: 주색상(color)을 바꾸면 결과가 달라진다(서명이 실제 차이를 잡아냄)", () => {
  const recolored = closet.map((c) => (c.color === "black" ? { ...c, color: "red" } : c));
  assert.notEqual(signature(recolored), baseline);
});

test("단계 0: colorTone 5가지 값으로 옷장 전체를 바꿔도 Styling·Looks·Today·Core·Missing 결과가 같다", () => {
  for (const tone of ["bright", "light", "muted", "dark", "vivid"]) {
    assert.equal(signature(closet.map((c) => ({ ...c, colorTone: tone }))), baseline, tone);
  }
});

test("단계 0: 옷마다 colorTone을 섞어 바꿔도 결과가 같다(값 하나라도 영향이 있으면 실패)", () => {
  const tones = ["vivid", "dark", "bright", "muted", "light"];
  assert.equal(signature(closet.map((c, i) => ({ ...c, colorTone: tones[i % 5] }))), baseline);
});

test("단계 0: 목록 밖 colorTone(백엔드 테스트의 warm·neutral)이나 빈 값이어도 오류 없이 결과가 같다", () => {
  for (const tone of ["warm", "neutral", "", undefined]) {
    assert.equal(signature(closet.map((c) => ({ ...c, colorTone: tone }))), baseline, String(tone));
  }
});

test("단계 0~2: 새 명도·채도·무채색·금속성 필드가 붙어도 엔진은 읽지 않는다(결과 동일)", () => {
  const withTone = closet.map((c, i) => ({
    ...c,
    tone: {
      value: { value: ["light", "medium", "dark"][i % 3], status: "assessed", source: "measured" },
      saturation: c.color === "multi" ? { value: null, status: "multiple" } : { value: ["low", "medium", "high"][i % 3], status: "assessed", source: "gemini" },
    },
    achromatic: ["black", "white", "gray"].includes(c.color),
    metallic: false,
  }));
  assert.equal(signature(withTone), baseline);
});

test("단계 0: 같은 코디의 상세 점수(색·핏·소재·계절·TPO·취향)도 colorTone과 무관하다", () => {
  const items = closet.slice(0, 4);
  const detail = (tone) => E.evaluateOutfit(items.map((c) => ({ ...c, colorTone: tone })), closet).details.map((d) => [d.key, d.score]);
  for (const tone of ["light", "dark", "vivid"]) assert.deepEqual(detail(tone), detail("muted"));
});
