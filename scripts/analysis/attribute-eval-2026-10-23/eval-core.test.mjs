// 평가 파이프라인 자체 검증(소규모 합성 12벌, 외부 호출 없음)
// 손으로 계산한 기대값과 맞는지 확인한다. 300벌 평가 전에 이 테스트가 통과해야 한다.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { cohenKappa, evaluate, mcnemarExact, normalizePrediction, pairedCompare, parseCsv, selfConsistency, toTruth, wilson } from "./eval-core.mjs";
import { loadInputs, planRun, runArms, enumsFor } from "./gemini-runner.mjs";
import { buildReport } from "./run-eval.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const fx = (p) => path.join(here, "fixtures", p);
const inputs = loadInputs({ fitJson: fx("fit-rows.sample.json"), silhouetteJson: fx("silhouette-rows.sample.json") });
const manifest = parseCsv(fs.readFileSync(fx("pilot-manifest.csv"), "utf8"));
const truths = parseCsv(fs.readFileSync(fx("pilot-truth.csv"), "utf8")).map(toTruth);
const plan = planRun({ manifest, arms: ["A0", "A1", "A2"], inputs });
const results = await runArms({ plan, manifest, mockDir: fx("mock") });
const report = buildReport({ truths, results, inputs, compare: ["A1,A2"] });

test("CSV: 따옴표 안 쉼표·줄바꿈·이중 따옴표를 보존", () => {
  const rows = parseCsv('a,b\n"x, y","say ""hi""\nnext"\n');
  assert.deepEqual(rows, [{ a: "x, y", b: 'say "hi"\nnext' }]);
});

test("정답 그대로 낸 예측(오라클)은 모든 필드 엄격 정확도 100%, 추측 0", () => {
  const enums = enumsFor(plan.arms[2].schema);
  const preds = new Map(truths.map((t) => [t.id, Object.fromEntries(Object.entries(t.fields).map(([f, c]) => [f,
    c.status === "assessed" ? { value: c.app && !enums[f]?.includes(c.value) ? c.app : c.value, status: "assessed" } : { value: null, status: c.status === "undeterminable" ? "undeterminable" : "not_applicable" }]))]));
  const { report: r } = evaluate(truths, preds, enums);
  for (const f of ["category", "subcategory", "main_color", "silhouette"]) assert.equal(r[f].strict, 1, f);
  assert.equal(r.fit.strict, 1);
  assert.equal(r.fit.guessRate, 0);
  assert.equal(r.fit.unsupported, 1, "compression은 사진 분석 enum에 없음 → 미지원으로 분모에서 뺌");
});

test("모두 미확정으로 답하면 답한 비율 0, 정확도 0(미확정을 정답으로 세지 않음)", () => {
  const enums = enumsFor(plan.arms[2].schema);
  const preds = new Map(truths.map((t) => [t.id, normalizePrediction({ category: t.fields.category.app ?? t.fields.category.value, fit: "undetermined", silhouette: "undetermined" }, enums)]));
  const { report: r } = evaluate(truths, preds, enums);
  assert.equal(r.silhouette.coverage, 0);
  assert.equal(r.silhouette.strict, 0);
  assert.equal(r.fit.guessRate, 0);
});

test("A1(스키마만) 실루엣: 정확 5 · 경계 대안 2 · 오답 3 / 10 → 엄격 50%, 대안 포함 70%", () => {
  const s = report.arms.A1.all.silhouette;
  assert.deepEqual([s.counts.correct, s.counts.acceptable, s.counts.wrong, s.scored], [5, 2, 3, 10]);
  assert.equal(s.strict, 0.5);
  assert.equal(s.lenient, 0.7);
  assert.equal(s.counts.na_ok, 1, "신발은 해당 없음");
  assert.equal(s.counts.unlabeled, 1, "정답이 없는 의류는 채점하지 않음");
});

test("A1 핏: 판단 불가 2벌 중 1벌에 값을 냄 → 추측 비율 50%, compression은 미지원", () => {
  const f = report.arms.A1.all.fit;
  assert.deepEqual([f.counts.guess, f.counts.abstain_ok, f.unsupported, f.strict], [1, 1, 1, 0.75]);
});

test("A0(운영 스키마): fitted·semi-fitted·compression을 표현할 수 없음(미지원 3), 신발에도 fit을 냄(해당 없음 위반), 실루엣은 묻지 않음", () => {
  const a0 = report.arms.A0.all;
  assert.equal(a0.fit.unsupported, 3);
  assert.equal(a0.fit.counts.na_violation, 1);
  assert.equal(a0.fit.guessRate, 1);
  assert.equal(a0.silhouette.counts.not_asked, 11);
  assert.equal(a0.silhouette.scored, 0);
});

test("Lab 대분류 jumpsuit는 앱 변환값(dress)으로 채점(app_converted)", () => {
  const row = report.arms.A1.rows.find((r) => r.id === "P08" && r.field === "category");
  assert.equal(row.outcome, "correct");
});

test("A1→A2 짝 비교(실루엣): A1만 정답 1, A2만 정답 5, 차이 +40%p, 정확 McNemar p = 14/64", () => {
  const c = report.comparisons.find((x) => x.field === "silhouette");
  assert.deepEqual([c.n, c.b, c.c], [10, 1, 5]);
  assert.equal(c.deltaStrict, 0.4);
  assert.ok(Math.abs(c.p - 14 / 64) < 1e-12);
});

test("경계 세트·촬영 유형별 부분 평가", () => {
  assert.equal(report.arms.A2.boundary.silhouette.scored, 6);
  assert.equal(report.arms.A2.product.fit.counts.abstain_ok, 2);
});

test("통계 보조: 윌슨 구간, McNemar 경계값, 카파, 자기 일관성", () => {
  const [lo, hi] = wilson(5, 10);
  assert.ok(lo > 0.23 && lo < 0.24 && hi > 0.76 && hi < 0.77);
  assert.equal(mcnemarExact(0, 0), 1);
  assert.ok(Math.abs(mcnemarExact(0, 6) - 2 / 64) < 1e-12);
  assert.equal(cohenKappa([["a", "a"], ["b", "b"]]), 1);
  assert.equal(cohenKappa([["a", "b"], ["b", "a"]]), -1);
  const m = new Map([["x", { fit: { value: "slim", status: "assessed" } }]]);
  assert.equal(selfConsistency([m, m], "fit"), 1);
});

test("기록 응답이 없는 의류는 실패로 세고 채점에서 빠진다(조용히 정답 처리하지 않음)", async () => {
  const res = await runArms({ plan: { arms: [plan.arms[1]] }, manifest: [{ garment_id: "P99", image: "x.jpg" }], mockDir: fx("mock") });
  assert.deepEqual(res["A1#1"].items[0], { garment_id: "P99", ok: false, error: "no_recording" });
});

test("pairedCompare: 한쪽 팔에만 있는 의류는 짝에서 빠진다", () => {
  const a = [{ id: "1", field: "fit", outcome: "correct" }];
  const b = [{ id: "1", field: "fit", outcome: "wrong" }, { id: "2", field: "fit", outcome: "correct" }];
  assert.deepEqual((({ n, b: x, c }) => [n, x, c])(pairedCompare(a, b, "fit")), [1, 1, 0]);
});
