// 두 평가자의 독립 평가 비교 — 일치도 지표와 불일치 검토 목록(disagreement_review)을 만든다.
// 두 사람 모두 평가를 마친 뒤에만 실행한다(결과에 두 사람의 점수가 함께 보이므로).

import { LISTS } from "./lib.mjs";

const DIMENSION_LABEL = {
  score_color: "색",
  score_silhouette_fit: "핏·실루엣",
  score_material_season: "소재·계절",
  score_tpo: "TPO",
  score_mood: "무드",
  score_overall: "종합",
};

const ratedRows = (table) =>
  new Map(
    table.rows
      .map((r) => r.values)
      .filter((v) => v.data_origin === "사람" && v.score_overall && !v.outfit_id.startsWith("EX-"))
      .map((v) => [v.outfit_id, v]),
  );

// 1~5 점수의 이차 가중 kappa(두 평가자 일치도, 우연 일치 보정)
export const weightedKappa = (pairs, k = 5) => {
  if (pairs.length === 0) return null;
  const observed = Array.from({ length: k }, () => Array(k).fill(0));
  const rowSum = Array(k).fill(0);
  const colSum = Array(k).fill(0);

  for (const [a, b] of pairs) {
    observed[a - 1][b - 1] += 1;
    rowSum[a - 1] += 1;
    colSum[b - 1] += 1;
  }

  const n = pairs.length;
  let num = 0;
  let den = 0;

  for (let i = 0; i < k; i += 1) {
    for (let j = 0; j < k; j += 1) {
      const w = ((i - j) ** 2) / ((k - 1) ** 2);
      num += w * observed[i][j];
      den += w * ((rowSum[i] * colSum[j]) / n);
    }
  }

  return den === 0 ? 1 : 1 - num / den;
};

const ranks = (values) => {
  const order = values.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const result = Array(values.length);
  for (let i = 0; i < order.length; ) {
    let j = i;
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j += 1;
    for (let t = i; t <= j; t += 1) result[order[t][1]] = (i + j) / 2 + 1;
    i = j + 1;
  }
  return result;
};

// 스피어만 순위 상관(동점은 평균 순위)
export const spearman = (xs, ys) => {
  if (xs.length < 3) return null;
  const rx = ranks(xs);
  const ry = ranks(ys);
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const mx = mean(rx);
  const my = mean(ry);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < rx.length; i += 1) {
    num += (rx[i] - mx) * (ry[i] - my);
    dx += (rx[i] - mx) ** 2;
    dy += (ry[i] - my) ** 2;
  }
  return dx === 0 || dy === 0 ? null : num / Math.sqrt(dx * dy);
};

const round = (value) => (value === null ? null : Number(value.toFixed(3)));

export const REVIEW_HEADERS = [
  "코디 ID [outfit_id]",
  "평가 차원 [dimension]",
  "평가자1 ID [evaluator_1]",
  "평가자1 점수 [score_1]",
  "평가자2 ID [evaluator_2]",
  "평가자2 점수 [score_2]",
  "차이 [gap]",
  "평가자1 판정 [label_1]",
  "평가자2 판정 [label_2]",
  "평가자1 이유 [reason_1]",
  "평가자2 이유 [reason_2]",
  "원인 분류 [cause]",
  "합의 점수 [agreed_score]",
  "합의 판정 [agreed_label]",
  "합의 이유 [agreed_reason]",
  "후속 조치 [action]",
  "관련 규칙 ID [rule_id]",
  "검토 상태 [status]",
  "검토일 [reviewed_at]",
  "메모 [note]",
];

// gapThreshold 이상 차이 나는 차원, 또는 판정이 다른 코디를 검토 목록에 올린다
export const compareEvaluations = (tableA, tableB, { gapThreshold = 2 } = {}) => {
  const a = ratedRows(tableA);
  const b = ratedRows(tableB);
  const ids = [...a.keys()].filter((id) => b.has(id)).sort();
  const evaluatorA = a.values().next().value?.evaluator_id ?? "평가자1";
  const evaluatorB = b.values().next().value?.evaluator_id ?? "평가자2";

  const metrics = {};
  for (const key of LISTS.scoreKeys) {
    const pairs = ids.map((id) => [Number(a.get(id)[key]), Number(b.get(id)[key])]);
    const gaps = pairs.map(([x, y]) => Math.abs(x - y));
    metrics[DIMENSION_LABEL[key]] = {
      n: pairs.length,
      exact: round(gaps.filter((g) => g === 0).length / (pairs.length || 1)),
      within1: round(gaps.filter((g) => g <= 1).length / (pairs.length || 1)),
      meanAbsGap: round(gaps.reduce((s, g) => s + g, 0) / (pairs.length || 1)),
      weightedKappa: round(weightedKappa(pairs)),
    };
  }

  const overallA = ids.map((id) => Number(a.get(id).score_overall));
  const overallB = ids.map((id) => Number(b.get(id).score_overall));
  const labelAgreement = ids.filter((id) => a.get(id).label === b.get(id).label).length / (ids.length || 1);

  const review = [];
  for (const id of ids) {
    const x = a.get(id);
    const y = b.get(id);
    for (const key of LISTS.scoreKeys) {
      const gap = Math.abs(Number(x[key]) - Number(y[key]));
      const labelDiffers = key === "score_overall" && x.label !== y.label;
      if (gap >= gapThreshold || labelDiffers) {
        review.push([
          id, DIMENSION_LABEL[key], evaluatorA, x[key], evaluatorB, y[key], gap,
          x.label, y.label, x.reason, y.reason, "", "", "", "", "", "", "미검토", "", "",
        ]);
      }
    }
  }

  return {
    evaluators: [evaluatorA, evaluatorB],
    compared: ids.length,
    onlyA: [...a.keys()].filter((id) => !b.has(id)),
    onlyB: [...b.keys()].filter((id) => !a.has(id)),
    metrics,
    overallSpearman: round(spearman(overallA, overallB)),
    labelAgreement: round(labelAgreement),
    review,
  };
};
