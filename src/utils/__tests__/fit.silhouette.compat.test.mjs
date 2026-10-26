// 핏·실루엣 분리(D-F01) 호환 초안이 지금 추천 결과를 바꾸지 않는다는 회귀 테스트
// - 기존 fit을 새 칸(fit, silhouette)으로 나눴다가 엔진 키로 되돌리면 Styling·Looks·Today·Core·Missing 결과가 같다
// - 새 silhouette 칸이 붙어도 엔진은 읽지 않는다
// - 위험 고정: fit 칸을 먼저 비우거나 새 핏 값으로 바꾸면 결과가 달라진다(엔진이 중립 처리하기 전에는 기존 fit을 바꾸면 안 되는 이유)
// 초안 규칙: scripts/analysis/attribute-eval-2026-10-23/silhouette-compat.mjs (엔진은 tsc로 임시 폴더에 컴파일)
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { buildDictionary } from "../../../scripts/analysis/attribute-eval-2026-10-23/dictionary.mjs";
import { splitLegacyFit, toEngineFit } from "../../../scripts/analysis/attribute-eval-2026-10-23/silhouette-compat.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const draft = path.join(root, "scripts/analysis/attribute-eval-2026-10-23");
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const { closet, weathers } = readJson(path.join(here, "fixtures/engine-closet.json"));

const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "styleseed-fitsil-"));
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
const { CLOTHING_FITS } = require(path.join(outDir, "constants/clothingOptions.js"));

const rowsOf = (j) => [...j.active, ...j.retired];
const cfg = readJson(path.join(draft, "compat-draft.json"));
const keys = {
  fit: buildDictionary(rowsOf(readJson(path.join(draft, "fixtures/fit-rows.sample.json")))).activeKeys,
  silhouette: buildDictionary(rowsOf(readJson(path.join(draft, "fixtures/silhouette-rows.sample.json")))).activeKeys,
};

const ids = (items) => items.map((i) => i.id);
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

test("검증 장치 확인: 픽스처 옷장에 핏 straight·wide 하의가 있고, 핏을 바꾸면 결과가 달라진다", () => {
  assert.ok(closet.some((c) => c.fit === "straight") && closet.some((c) => c.fit === "wide"));
  assert.notEqual(signature(closet.map((c) => (c.fit === "wide" ? { ...c, fit: "slim" } : c))), baseline);
});

test("기존 fit → 새 칸(fit·silhouette) → 엔진 키로 되돌리면 모든 추천 결과가 같다", () => {
  const roundTrip = closet.map((c) => ({ ...c, fit: toEngineFit(splitLegacyFit(c, cfg, keys), cfg, CLOTHING_FITS).fit }));
  assert.deepEqual(roundTrip.map((c) => c.fit), closet.map((c) => c.fit));
  assert.equal(signature(roundTrip), baseline);
});

test("새 실루엣·핏 상태 칸이 붙어도 엔진은 읽지 않는다(결과 동일)", () => {
  const withNew = closet.map((c) => ({ ...c, ...(({ fit, silhouette }) => ({ fitV2: fit, silhouette }))(splitLegacyFit(c, cfg, keys)) }));
  assert.equal(signature(withNew), baseline);
});

test("위험 고정: 하의 fit을 미평가(null)나 새 값(fitted)으로 바꾸면 결과가 달라지고, 핏 점수는 중립이 아니라 58점(가장 낮은 구간)이 된다", () => {
  const wideId = closet.find((c) => c.fit === "wide").id;
  for (const v of [null, "fitted"]) {
    assert.notEqual(signature(closet.map((c) => (c.id === wideId ? { ...c, fit: v } : c))), baseline, String(v));
  }
  const top = closet.find((c) => c.category === "top");
  const bottom = { ...closet.find((c) => c.id === wideId), fit: null };
  const fitScore = E.evaluateOutfit([top, bottom], closet).details.find((d) => d.key === "fit").score;
  assert.equal(fitScore, 58);
});
