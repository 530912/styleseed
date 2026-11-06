// 추천엔진 기준 스냅샷 (Sprint 1A-3 회귀, Phase 1B 비교 기준)
//
// 고정 옷장(fixtures/engine-closet.json)과 고정 날씨로 Styling / Looks / Today's Look 결과를 만든 뒤
// fixtures/engine-baseline.json과 비교한다. 엔진 코드를 바꾸지 않았다면 결과가 같아야 한다.
// Phase 1B에서 점수를 의도적으로 바꾼 경우에만 UPDATE_ENGINE_BASELINE=1 로 기준을 다시 만든다.
//
// 엔진 파일은 경로 별칭 없이 상대 경로만 쓰므로 tsc로 임시 폴더에 CommonJS로 컴파일해서 불러온다.
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
const baselinePath = path.join(here, "fixtures/engine-baseline.json");
const { closet, weathers } = JSON.parse(
  fs.readFileSync(path.join(here, "fixtures/engine-closet.json"), "utf8"),
);

const loadEngine = () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "styleseed-engine-"));

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
      "src/utils/outfitScore.ts",
      "src/utils/recommendation.ts",
      "src/utils/weatherRecommendation.ts",
    ],
    { cwd: root, stdio: "pipe" },
  );

  const require = createRequire(path.join(outDir, "index.js"));

  return {
    ...require(path.join(outDir, "utils/outfitScore.js")),
    ...require(path.join(outDir, "utils/recommendation.js")),
    ...require(path.join(outDir, "utils/weatherRecommendation.js")),
  };
};

const ids = (items) => items.map((item) => item.id);

const summarizeEvaluation = (evaluation) => ({
  items: ids(evaluation.items),
  total: evaluation.total,
  details: Object.fromEntries(evaluation.details.map((d) => [d.key, d.score])),
  reasons: evaluation.reasons,
  completeness: evaluation.completeness,
});

const buildSnapshot = (engine) => ({
  // Styling 화면: 선택한 옷 기준 추천 코디
  styling: Object.fromEntries(
    closet.map((item) => {
      const r = engine.getRecommendedOutfit(item, closet);
      return [item.id, { items: ids(r.items), score: r.score, missing: r.missingCategories }];
    }),
  ),

  // Looks 화면: 옷장 전체 순위, 옷 하나를 포함한 순위
  looks: engine.getRankedLooks(closet, 5).map(summarizeEvaluation),
  looksForItem: Object.fromEntries(
    [1, 6, 11].map((id) => [
      id,
      engine
        .getRankedLooksForItem(closet.find((c) => c.id === id), closet, 3)
        .map(summarizeEvaluation),
    ]),
  ),

  // Today's Look: 날씨 없음 + 고정 날씨 4종
  today: Object.fromEntries(
    [["none", null], ...Object.entries(weathers)].map(([key, weather]) => [
      key,
      engine.getTodaysLooks(closet, weather, 3).map((look) => ({
        base: look.base.id,
        items: ids(look.recommendation.items),
        styleScore: look.styleScore,
        weatherScore: look.weatherScore,
        score: look.score,
        weatherLabel: look.weatherLabel,
      })),
    ]),
  ),
});

test("추천엔진 결과가 기준 스냅샷과 같다 (Styling / Looks / Today's Look)", () => {
  const snapshot = buildSnapshot(loadEngine());

  if (process.env.UPDATE_ENGINE_BASELINE === "1" || !fs.existsSync(baselinePath)) {
    fs.writeFileSync(baselinePath, `${JSON.stringify(snapshot, null, 1)}\n`);
    console.log(`기준 스냅샷 저장: ${path.relative(root, baselinePath)}`);
    return;
  }

  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));

  assert.deepEqual(snapshot, baseline);
});

test("빈 옷장과 옷 1벌에서도 예외 없이 빈 결과 또는 부분 결과", () => {
  const engine = loadEngine();

  assert.deepEqual(engine.getTodaysLooks([], weathers.mild, 3), []);
  assert.deepEqual(engine.getRankedLooks([], 3), []);

  const single = [closet[0]];
  assert.doesNotThrow(() => engine.getTodaysLooks(single, weathers.cold, 3));
  assert.doesNotThrow(() => engine.getRecommendedOutfit(closet[0], single));
  assert.doesNotThrow(() => engine.getRankedLooksForItem(closet[0], single, 3));
});
