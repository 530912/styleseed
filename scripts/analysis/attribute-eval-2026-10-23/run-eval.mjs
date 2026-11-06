// 평가 보고서 만들기(외부 호출 없음)
//   node run-eval.mjs --truth <정답.csv> --results <gemini-runner 결과.json> --fit-json <핏 행> --silhouette-json <실루엣 인계> [--compare A1,A2] [--out report.json]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { FIELDS, evaluate, normalizePrediction, pairedCompare, parseCsv, selfConsistency, toTruth } from "./eval-core.mjs";
import { enumsFor, loadInputs } from "./gemini-runner.mjs";
import { buildSchema } from "./prompt-variants.mjs";

/** 결과 묶음 전체를 평가. 같은 팔의 반복 실행은 1회차로 정확도를, 전체로 자기 일관성을 본다 */
export const buildReport = ({ truths, results, inputs, compare = [] }) => {
  const byArm = {};
  for (const [runKey, { run, items }] of Object.entries(results)) {
    const enums = enumsFor(buildSchema(run.arm, inputs.dicts, inputs.cfg, inputs.appEnums));
    const preds = new Map(items.filter((i) => i.ok).map((i) => [i.garment_id, normalizePrediction(i.response, enums, { cfg: inputs.cfg, silhouetteKeys: inputs.dicts.silhouette.activeKeys })]));
    (byArm[run.arm] ??= []).push({ runKey, enums, preds, failed: items.filter((i) => !i.ok).length });
  }
  const arms = {};
  for (const [arm, runs] of Object.entries(byArm)) {
    const first = runs[0];
    const all = evaluate(truths, first.preds, first.enums);
    arms[arm] = {
      runs: runs.length,
      failedCalls: runs.reduce((s, r) => s + r.failed, 0),
      all: all.report,
      boundary: evaluate(truths, first.preds, first.enums, { filter: (t) => Boolean(t.boundarySet) }).report,
      worn: evaluate(truths, first.preds, first.enums, { filter: (t) => t.shotType === "worn" }).report,
      product: evaluate(truths, first.preds, first.enums, { filter: (t) => t.shotType === "product" }).report,
      selfConsistency: runs.length > 1 ? Object.fromEntries(FIELDS.map((f) => [f, selfConsistency(runs.map((r) => r.preds), f)])) : null,
      rows: all.rows,
    };
  }
  const comparisons = [];
  for (const pair of compare) {
    const [a, b] = pair.split(",");
    if (!arms[a] || !arms[b]) continue;
    for (const f of FIELDS) comparisons.push({ armA: a, armB: b, field: f, ...pairedCompare(arms[a].rows, arms[b].rows, f) });
  }
  return { arms, comparisons };
};

const pct = (x) => (x === null || x === undefined ? "—" : `${(x * 100).toFixed(1)}%`);

export const toMarkdown = (report) => {
  const lines = ["| 팔 | 필드 | 채점 | 정확(엄격) | 95% 구간 | 경계 대안 포함 | 답한 것 중 정확 | 답한 비율 | 추측 비율 | 미지원 |", "|---|---|---|---|---|---|---|---|---|---|"];
  for (const [arm, r] of Object.entries(report.arms)) {
    for (const f of FIELDS) {
      const m = r.all[f];
      lines.push(`| ${arm} | ${f} | ${m.scored} | ${pct(m.strict)} | ${pct(m.strictCi95[0])}~${pct(m.strictCi95[1])} | ${pct(m.lenient)} | ${pct(m.precisionAnswered)} | ${pct(m.coverage)} | ${pct(m.guessRate)} | ${m.unsupported} |`);
    }
  }
  if (report.comparisons.length) {
    lines.push("", "| 비교 | 필드 | 짝 | A만 정답 | B만 정답 | 차이(B−A) | 95% 구간 | p(McNemar) |", "|---|---|---|---|---|---|---|---|");
    for (const c of report.comparisons) lines.push(`| ${c.armA}→${c.armB} | ${c.field} | ${c.n} | ${c.b} | ${c.c} | ${pct(c.deltaStrict)} | ${pct(c.ci95[0])}~${pct(c.ci95[1])} | ${c.p.toFixed(3)} |`);
  }
  return lines.join("\n");
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (name, fallback = null) => { const i = process.argv.indexOf(`--${name}`); return i < 0 ? fallback : process.argv[i + 1]; };
  const truths = parseCsv(fs.readFileSync(arg("truth"), "utf8")).map(toTruth);
  const results = JSON.parse(fs.readFileSync(arg("results"), "utf8"));
  const inputs = loadInputs({ fitJson: arg("fit-json"), silhouetteJson: arg("silhouette-json") });
  const report = buildReport({ truths, results, inputs, compare: arg("compare") ? [arg("compare")] : [] });
  if (arg("out")) fs.writeFileSync(arg("out"), JSON.stringify(report, (k, v) => (k === "rows" ? undefined : v), 2));
  console.log(toMarkdown(report));
}
