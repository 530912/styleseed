// 사람 라벨(정답) ↔ Gemini 결과 평가(비파괴, 외부 호출 없음). 앱 코드가 아니다.
//
// 정답 CSV(의류 1벌 = 1행, 계약 키 이름):
//   garment_id, image, shot_type(product|worn),
//   category, subcategory, main_color, fit, silhouette          ← Lab 키
//   <필드>_status: assessed(기본) | undeterminable | not_applicable
//   <필드>_app: 앱 enum에 없는 Lab 값의 앱 변환값(계약 app_value). 비어 있으면 변환 없음
//   acceptable: 경계 사례에서 함께 인정할 값 "silhouette:flared|fit:regular"
//   boundary_set: 경계 검증 묶음 이름(300벌 구성안 4장), labeler, note
//
// 결과 판정(필드마다):
//   correct · acceptable(경계 대안) · wrong · abstain_miss(정답이 있는데 미확정) · invalid(형식·enum 밖)
//   abstain_ok(사진으로 판단 불가 → 미확정) · guess(판단 불가인데 값을 냄)
//   unsupported(정답 값을 이 실험 팔의 enum으로 표현할 수 없음 — 정확도 분모에서 뺌)
//   na_ok · na_violation(해당 없음인데 값을 냄)

import { normalizeSilhouette } from "./silhouette-compat.mjs";
import { NOT_APPLICABLE, UNDETERMINED } from "./prompt-variants.mjs";

export const FIELDS = ["category", "subcategory", "main_color", "fit", "silhouette"];
const PRED_KEY = { category: "category", subcategory: "subCategory", main_color: "color", fit: "fit", silhouette: "silhouette" };

/* ---------- CSV ---------- */

export const parseCsv = (text) => {
  const rows = [];
  let row = [], cur = "", q = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"' && s[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(cur); cur = "";
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
    } else cur += ch;
  }
  if (cur !== "" || row.length) { row.push(cur); if (row.some((c) => c !== "")) rows.push(row); }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
};

const parseAcceptable = (text) => {
  const out = {};
  for (const part of (text ?? "").split("|").map((p) => p.trim()).filter(Boolean)) {
    const [field, value] = part.split(":");
    (out[field] ??= []).push(value);
  }
  return out;
};

/** 정답 행 → { id, shotType, boundarySet, fields: { f: { value, status, app, acceptable[] } } } */
export const toTruth = (row) => {
  const acceptable = parseAcceptable(row.acceptable);
  const fields = {};
  for (const f of FIELDS) {
    const status = row[`${f}_status`] || (row[f] ? "assessed" : "unrecorded");
    fields[f] = { value: row[f] || null, status, app: row[`${f}_app`] || null, acceptable: acceptable[f] ?? [] };
  }
  return { id: row.garment_id, shotType: row.shot_type || null, boundarySet: row.boundary_set || null, labeler: row.labeler || null, fields };
};

/* ---------- 예측 정규화 ---------- */

/**
 * Gemini 원시 응답(또는 기록된 응답) → 필드별 { value, status, codes }
 * enums: 이 팔의 응답 스키마 enum(필드 → 허용값). 스키마 밖 값은 invalid
 */
export const normalizePrediction = (raw, enums, { cfg, silhouetteKeys } = {}) => {
  const out = {};
  for (const f of FIELDS) {
    const v = raw?.[PRED_KEY[f]];
    if (v === undefined) { out[f] = { value: null, status: enums[f] ? "missing" : "not_asked", codes: [] }; continue; }
    if (v === UNDETERMINED) { out[f] = { value: null, status: "undeterminable", codes: [] }; continue; }
    if (v === NOT_APPLICABLE) { out[f] = { value: null, status: "not_applicable", codes: [] }; continue; }
    if (enums[f] && !enums[f].includes(v)) { out[f] = { value: v, status: "invalid", codes: ["E_OUT_OF_SCHEMA"] }; continue; }
    if (f === "silhouette" && cfg && silhouetteKeys) {
      const n = normalizeSilhouette(v, cfg, silhouetteKeys);
      out[f] = { value: n.value, status: n.status === "assessed" ? "assessed" : "invalid", codes: n.codes };
      continue;
    }
    out[f] = { value: v, status: "assessed", codes: [] };
  }
  out.silhouette_runner_up = raw?.silhouette_runner_up && raw.silhouette_runner_up !== "none" ? raw.silhouette_runner_up : null;
  return out;
};

/* ---------- 판정 ---------- */

/** 정답 값을 이 팔의 enum으로 표현한 값. 표현할 수 없으면 null(=unsupported) */
const comparableTruth = (t, enumValues) => {
  if (!enumValues) return null;
  if (enumValues.includes(t.value)) return { value: t.value, via: "same" };
  if (t.app && enumValues.includes(t.app)) return { value: t.app, via: "app_converted" };
  return null;
};

export const judge = (t, p, enumValues) => {
  if (t.status === "unrecorded") return "unlabeled";
  if (p.status === "not_asked") return "not_asked";
  if (t.status === "not_applicable") {
    return p.value === null && ["not_applicable", "undeterminable", "missing"].includes(p.status) ? "na_ok" : "na_violation";
  }
  if (t.status === "undeterminable") return p.status === "undeterminable" ? "abstain_ok" : p.value !== null ? "guess" : "abstain_ok";
  const truth = comparableTruth(t, enumValues);
  if (!truth) return "unsupported";
  if (p.status === "invalid" || p.status === "missing") return "invalid";
  if (p.status === "undeterminable" || p.status === "not_applicable") return "abstain_miss";
  if (p.value === truth.value) return "correct";
  if (t.acceptable.includes(p.value)) return "acceptable";
  return "wrong";
};

const OUTCOMES = ["correct", "acceptable", "wrong", "abstain_miss", "invalid", "abstain_ok", "guess", "unsupported", "na_ok", "na_violation", "unlabeled", "not_asked"];

/** 윌슨 95% 구간 */
export const wilson = (k, n, z = 1.96) => {
  if (n === 0) return [null, null];
  const p = k / n, d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n), r = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [(c - r) / d, (c + r) / d];
};

const ratio = (a, b) => (b === 0 ? null : a / b);

/**
 * truths: toTruth 결과 배열, preds: Map(garment_id → normalizePrediction 결과), enums: 팔의 enum
 * filter: (truth) => boolean 로 부분집합(경계 세트, 착용 사진 등) 평가
 */
export const evaluate = (truths, preds, enums, { filter = () => true } = {}) => {
  const report = {};
  const rowsOut = [];
  for (const f of FIELDS) {
    const counts = Object.fromEntries(OUTCOMES.map((o) => [o, 0]));
    const confusion = {};
    let missingPred = 0;
    for (const t of truths.filter(filter)) {
      const p = preds.get(t.id);
      if (!p) { missingPred++; continue; }
      const outcome = judge(t.fields[f], p[f], enums[f]);
      counts[outcome]++;
      rowsOut.push({ id: t.id, field: f, outcome, truth: t.fields[f].value, pred: p[f].value ?? p[f].status });
      if (["correct", "acceptable", "wrong"].includes(outcome)) {
        const tv = comparableTruth(t.fields[f], enums[f]).value;
        confusion[tv] ??= {};
        confusion[tv][p[f].value] = (confusion[tv][p[f].value] ?? 0) + 1;
      }
    }
    const scored = counts.correct + counts.acceptable + counts.wrong + counts.abstain_miss + counts.invalid;
    const answered = counts.correct + counts.acceptable + counts.wrong + counts.invalid;
    const recalls = Object.entries(confusion).map(([tv, row]) => (row[tv] ?? 0) / Object.values(row).reduce((a, b) => a + b, 0));
    report[f] = {
      counts,
      missingPred,
      scored,
      strict: ratio(counts.correct, scored),
      strictCi95: wilson(counts.correct, scored),
      lenient: ratio(counts.correct + counts.acceptable, scored),
      precisionAnswered: ratio(counts.correct + counts.acceptable, answered),
      coverage: ratio(answered, scored),
      guessRate: ratio(counts.guess, counts.guess + counts.abstain_ok),
      naViolationRate: ratio(counts.na_violation, counts.na_violation + counts.na_ok),
      unsupported: counts.unsupported,
      macroRecall: recalls.length ? recalls.reduce((a, b) => a + b, 0) / recalls.length : null,
      confusion,
    };
  }
  // 계층: 대분류가 맞은 의류만 놓고 본 세부분류 정확도
  const catOk = new Set(rowsOut.filter((r) => r.field === "category" && r.outcome === "correct").map((r) => r.id));
  const sub = rowsOut.filter((r) => r.field === "subcategory" && catOk.has(r.id) && ["correct", "acceptable", "wrong", "abstain_miss", "invalid"].includes(r.outcome));
  report.subcategoryGivenCategory = ratio(sub.filter((r) => r.outcome === "correct").length, sub.length);
  return { report, rows: rowsOut };
};

/* ---------- 두 팔 비교(같은 사진) ---------- */

const logChoose = (n, k) => { let s = 0; for (let i = 1; i <= k; i++) s += Math.log(n - k + i) - Math.log(i); return s; };

/** 정확 McNemar(양측): 한쪽만 맞은 의류 수 b, c */
export const mcnemarExact = (b, c) => {
  const n = b + c;
  if (n === 0) return 1;
  const k = Math.min(b, c);
  let p = 0;
  for (let i = 0; i <= k; i++) p += Math.exp(logChoose(n, i) - n * Math.LN2);
  return Math.min(1, 2 * p);
};

const rng = (seed) => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);

/**
 * rowsA, rowsB: evaluate(...).rows. 두 팔 모두 채점 가능한(scored) 의류만 짝지어 비교
 * 반환: { n, b(A만 맞음), c(B만 맞음), deltaStrict(B−A), p, ci95(부트스트랩) }
 */
export const pairedCompare = (rowsA, rowsB, field, { iterations = 2000, seed = 7 } = {}) => {
  const scored = new Set(["correct", "acceptable", "wrong", "abstain_miss", "invalid"]);
  const a = new Map(rowsA.filter((r) => r.field === field && scored.has(r.outcome)).map((r) => [r.id, r.outcome === "correct"]));
  const pairs = rowsB.filter((r) => r.field === field && scored.has(r.outcome) && a.has(r.id)).map((r) => [a.get(r.id), r.outcome === "correct"]);
  const n = pairs.length;
  const b = pairs.filter(([x, y]) => x && !y).length;
  const c = pairs.filter(([x, y]) => !x && y).length;
  const delta = n ? (c - b) / n : null;
  const r = rng(seed);
  const deltas = [];
  for (let i = 0; i < iterations && n; i++) {
    let s = 0;
    for (let j = 0; j < n; j++) { const [x, y] = pairs[Math.floor(r() * n)]; s += (y ? 1 : 0) - (x ? 1 : 0); }
    deltas.push(s / n);
  }
  deltas.sort((x, y) => x - y);
  const ci95 = n ? [deltas[Math.floor(0.025 * deltas.length)], deltas[Math.floor(0.975 * deltas.length) - 1]] : [null, null];
  return { n, b, c, deltaStrict: delta, p: mcnemarExact(b, c), ci95 };
};

/* ---------- 사람 간 일치도(정답의 상한선) ---------- */

export const cohenKappa = (pairs) => {
  const n = pairs.length;
  if (!n) return null;
  const po = pairs.filter(([x, y]) => x === y).length / n;
  const cats = [...new Set(pairs.flat())];
  const pe = cats.reduce((s, k) => s + (pairs.filter(([x]) => x === k).length / n) * (pairs.filter(([, y]) => y === k).length / n), 0);
  return pe === 1 ? 1 : (po - pe) / (1 - pe);
};

/** 같은 팔을 여러 번 돌렸을 때 같은 답을 낸 비율(비결정성) */
export const selfConsistency = (runs, field) => {
  const ids = [...runs[0].keys()];
  const same = ids.filter((id) => new Set(runs.map((m) => JSON.stringify([m.get(id)?.[field]?.value, m.get(id)?.[field]?.status]))).size === 1);
  return ratio(same.length, ids.length);
};
