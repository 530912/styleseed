// 두 평가자의 독립 평가 비교 — 일치도 지표와 불일치 검토 목록(disagreement_review)을 만든다.
// 입력은 검증을 통과한 평가 레코드(제출된 것만). 두 사람 모두 제출을 마친 뒤에만 실행한다.

import { headerFor, listLabel } from "./lib.mjs";

export const SCORE_FIELDS = [
  ["score_color", "color"],
  ["score_silhouette_fit", "silhouette_fit"],
  ["score_material_season", "material_season"],
  ["score_tpo", "tpo"],
  ["score_mood", "mood"],
  ["score_overall", "overall"],
];

const submitted = (records) =>
  new Map(records.filter((r) => !r.example && r.v.submission_status === "submitted").map((r) => [`${r.v.outfit_id}/${r.v.round}`, r.v]));

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
      const w = (i - j) ** 2 / (k - 1) ** 2;
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

const round3 = (value) => (value === null ? null : Number(value.toFixed(3)));

export const reviewHeaders = (contract) => contract.entities.disagreement_reviews.fields.map(headerFor);

// gapThreshold 이상 차이 나는 차원, 또는 판정이 다른 코디를 검토 목록에 올린다
export const compareEvaluations = (contract, recordsA, recordsB, { gapThreshold = 2 } = {}) => {
  const a = submitted(recordsA);
  const b = submitted(recordsB);
  const keys = [...a.keys()].filter((k) => b.has(k)).sort();
  const evaluatorA = a.values().next().value?.evaluator_id ?? null;
  const evaluatorB = b.values().next().value?.evaluator_id ?? null;

  const metrics = {};
  for (const [field, dim] of SCORE_FIELDS) {
    const pairs = keys.map((k) => [Number(a.get(k)[field]), Number(b.get(k)[field])]);
    const gaps = pairs.map(([x, y]) => Math.abs(x - y));
    const n = pairs.length || 1;
    metrics[dim] = {
      n: pairs.length,
      exact: round3(gaps.filter((g) => g === 0).length / n),
      within1: round3(gaps.filter((g) => g <= 1).length / n),
      meanAbsGap: round3(gaps.reduce((s, g) => s + g, 0) / n),
      weightedKappa: round3(weightedKappa(pairs)),
    };
  }

  const fields = contract.entities.disagreement_reviews.fields.map((f) => f.key);
  const review = [];
  for (const k of keys) {
    const x = a.get(k);
    const y = b.get(k);
    for (const [field, dim] of SCORE_FIELDS) {
      const gap = Math.abs(Number(x[field]) - Number(y[field]));
      if (gap >= gapThreshold || (dim === "overall" && x.label !== y.label)) {
        const row = {
          outfit_id: x.outfit_id, dimension: listLabel(contract, "review_dimension", dim), round: x.round,
          evaluator_1: evaluatorA, score_1: x[field], evaluator_2: evaluatorB, score_2: y[field], gap,
          label_1: listLabel(contract, "label", x.label), label_2: listLabel(contract, "label", y.label),
          reason_1: x.reason, reason_2: y.reason, status: listLabel(contract, "review_status", "open"),
          data_origin: listLabel(contract, "data_origin", "human"),
        };
        review.push(fields.map((f) => row[f] ?? ""));
      }
    }
  }

  return {
    evaluators: [evaluatorA, evaluatorB],
    compared: keys.length,
    onlyA: [...a.keys()].filter((k) => !b.has(k)),
    onlyB: [...b.keys()].filter((k) => !a.has(k)),
    metrics,
    overallSpearman: round3(spearman(keys.map((k) => Number(a.get(k).score_overall)), keys.map((k) => Number(b.get(k).score_overall)))),
    labelAgreement: round3(keys.filter((k) => a.get(k).label === b.get(k).label).length / (keys.length || 1)),
    review,
  };
};
