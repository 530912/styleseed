// 핏·실루엣 분리 호환 규칙 초안 검증(Lab 실루엣 인계 S1~S8 시나리오 + 기존 데이터 보존)
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { buildDictionary } from "./dictionary.mjs";
import { allowedSilhouettes, checkScope, normalizeSilhouette, resolveCandidates, splitLegacyFit, toEngineFit, validateFitSilhouette } from "./silhouette-compat.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => JSON.parse(fs.readFileSync(path.join(here, p), "utf8"));
const rowsOf = (j) => [...j.active, ...j.retired];
const cfg = read("compat-draft.json");
const fitDict = buildDictionary(rowsOf(read("fixtures/fit-rows.sample.json")));
const silDict = buildDictionary(rowsOf(read("fixtures/silhouette-rows.sample.json")));
const contract = JSON.parse(fs.readFileSync(path.join(here, "../../../data/fkd/contract/fkd-contract-v0.1.json"), "utf8"));
const APP_FITS = contract.app_compat.app_values.fit; // 앱 CLOTHING_FITS와 같음(계약 테스트가 확인)
const keys = { fit: fitDict.activeKeys, silhouette: silDict.activeKeys };
const jeans = { category: "bottom", subCategory: "jeans" };

test("S1: 앱 핏 straight·wide → 실루엣으로 옮기고, 핏은 regular로 채우지 않고 미평가", () => {
  for (const legacy of ["straight", "wide"]) {
    const t = splitLegacyFit({ ...jeans, fit: legacy }, cfg, keys);
    assert.deepEqual([t.fit.value, t.fit.status, t.fit.reason], [null, "unrecorded", "legacy_fit_moved_to_silhouette"]);
    assert.deepEqual([t.silhouette.value, t.silhouette.source], [legacy, "derived_from_legacy_fit"]);
    assert.equal(t.legacyFit, legacy, "원래 값은 그대로 보존");
    assert.deepEqual(validateFitSilhouette(jeans, t, cfg, keys), []);
  }
});

test("앱 핏 slim·regular·relaxed·oversized는 핏 그대로(출처 legacy_app_fit), 실루엣은 미평가", () => {
  for (const legacy of ["slim", "regular", "relaxed", "oversized"]) {
    const t = splitLegacyFit({ category: "top", subCategory: "shirt", fit: legacy }, cfg, keys);
    assert.deepEqual([t.fit.value, t.fit.source, t.silhouette.status], [legacy, "legacy_app_fit", "unrecorded"]);
  }
});

test("신발·가방·액세서리: Gemini가 강제로 낸 fit(regular)은 원본에만 남고, 새 핏·실루엣은 해당 없음", () => {
  const t = splitLegacyFit({ category: "shoes", subCategory: "loafer", fit: "regular" }, cfg, keys);
  assert.deepEqual([t.fit.status, t.silhouette.status, t.legacyFit], ["not_applicable", "not_applicable", "regular"]);
  assert.deepEqual(allowedSilhouettes({ category: "bag", subCategory: "tote-bag" }, cfg, keys.silhouette), []);
});

test("기존 데이터 보존: 앱 핏 6개 모두 새 칸으로 나눴다가 엔진 키로 되돌리면 원래 값과 같다(추천 결과 유지 조건)", () => {
  for (const item of [jeans, { category: "top", subCategory: "shirt" }, { category: "dress", subCategory: "jumpsuit" }, { category: "shoes", subCategory: "sneakers" }]) {
    for (const legacy of APP_FITS) {
      const back = toEngineFit(splitLegacyFit({ ...item, fit: legacy }, cfg, keys), cfg, APP_FITS);
      assert.equal(back.fit, legacy, `${item.subCategory}/${legacy}`);
    }
  }
});

test("새 핏 값(fitted·semi-fitted·compression)이나 미평가 핏은 지금 엔진 키가 없다 → null과 사유(엔진이 중립 처리하기 전에는 저장 금지)", () => {
  for (const v of ["fitted", "semi-fitted", "compression"]) {
    const back = toEngineFit({ fit: { value: v, status: "assessed" }, silhouette: { value: null, status: "unrecorded" }, legacyFit: null }, cfg, APP_FITS);
    assert.deepEqual([back.fit, back.reason], [null, "fit_value_unknown_to_engine"]);
  }
  const unrec = toEngineFit({ fit: { value: null, status: "unrecorded" }, silhouette: { value: "barrel", status: "assessed" }, legacyFit: null }, cfg, APP_FITS);
  assert.deepEqual([unrec.fit, unrec.reason], [null, "fit_unrecorded"]);
});

test("S2: 폐기값 H·I → rectangular(원본 보존, 경고), volume → 자동 변환하지 않고 미해결", () => {
  for (const raw of ["H", "I"]) {
    const n = normalizeSilhouette(raw, cfg, keys.silhouette);
    assert.deepEqual([n.value, n.original, n.codes], ["rectangular", raw, ["W_SILHOUETTE_RETIRED_MAPPED"]]);
  }
  const v = normalizeSilhouette("volume", cfg, keys.silhouette);
  assert.deepEqual([v.value, v.status, v.original], [null, "unresolved", "volume"]);
});

test("S3: 대소문자를 합치지 않는다 — 'a'는 A로 바꾸지 않고 오류 + 제안만", () => {
  const n = normalizeSilhouette("a", cfg, keys.silhouette);
  assert.deepEqual([n.value, n.status, n.suggestion, n.codes], [null, "invalid", "A", ["E_SILHOUETTE_CASE_MISMATCH"]]);
  assert.equal(normalizeSilhouette("A", cfg, keys.silhouette).value, "A");
});

test("S6(r2 초안): skater → circle(별도 키를 만들지 않음, 원본 보존)", () => {
  const n = normalizeSilhouette("skater", cfg, keys.silhouette);
  assert.deepEqual([n.value, n.original, n.codes], ["circle", "skater", ["W_SILHOUETTE_ALIAS"]]);
  assert.ok(!keys.silhouette.includes("skater"));
});

test("S4: 상의에 팬츠 전용 실루엣(jogger) → 지우지 않고 경고, 신발에 실루엣 값 → 오류", () => {
  const top = { category: "top", subCategory: "hoodie" };
  assert.deepEqual(checkScope(top, "jogger", cfg), { status: "warn", code: "W_SILHOUETTE_SCOPE", group: "top" });
  assert.equal(checkScope(jeans, "jogger", cfg).status, "ok");
  assert.equal(checkScope({ category: "dress", subCategory: "jumpsuit" }, "wide", cfg).status, "ok", "점프수트는 다리통 실루엣 허용");
  assert.equal(checkScope({ category: "shoes", subCategory: "boots" }, "straight", cfg).code, "E_SILHOUETTE_NOT_APPLICABLE");
  const t = { fit: { value: "relaxed", status: "assessed" }, silhouette: { value: "jogger", status: "assessed" } };
  assert.ok(validateFitSilhouette(top, t, cfg, keys).includes("W_SILHOUETTE_SCOPE"));
});

test("한 칸에 다른 속성 값: 핏 칸의 straight·실루엣 칸의 slim은 오류", () => {
  const bad = { fit: { value: "straight", status: "assessed" }, silhouette: { value: "slim", status: "assessed" } };
  const issues = validateFitSilhouette(jeans, bad, cfg, keys);
  assert.ok(issues.includes("E_FIT_HAS_SILHOUETTE_VALUE"));
  assert.ok(issues.includes("E_SILHOUETTE_HAS_FIT_VALUE"));
});

test("S7·S8(r2 초안) 전체·부분 충돌: 원피스에서 상체 폭+허리 수축이 있으면 X, 없으면 하단 형태. 스커트는 하단 형태", () => {
  const dress = { category: "dress", subCategory: "midi-dress" };
  assert.equal(resolveCandidates(dress, ["X", "circle"], cfg, { upperEmphasis: true }).value, "X");
  assert.equal(resolveCandidates(dress, ["X", "circle"], cfg, { upperEmphasis: false }).status, "conflict");
  assert.equal(resolveCandidates({ category: "bottom", subCategory: "skirt" }, ["X", "flared"], cfg, { upperEmphasis: true }).status, "conflict", "스커트에는 X 우선 규칙이 없다");
  assert.equal(resolveCandidates(dress, ["flared", "mermaid"], cfg).value, "mermaid");
  assert.equal(resolveCandidates(jeans, ["tapered", "jogger"], cfg).value, "jogger");
});

test("우선순위 규칙이 없는 쌍은 정하지 않고 사람 검토(conflict)로 보낸다", () => {
  const r = resolveCandidates(jeans, ["barrel", "balloon"], cfg);
  assert.deepEqual([r.value, r.status, r.candidates], [null, "conflict", ["barrel", "balloon"]]);
});
