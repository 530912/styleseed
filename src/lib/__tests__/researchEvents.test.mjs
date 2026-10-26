// 사용자 조사 이벤트(R1-02-03): 앱이 만드는 이벤트가 계약·분석 스크립트와 맞는지, 개인정보를 담지 않는지
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  appendResearchEvent,
  buildResearchEvent,
  createUuid,
  getEditedFields,
  sanitizeProperties,
  startResearchSession,
  toAnalysisErrorCode,
  toJsonLines,
} from "../researchEventsPolicy.ts";

import { coreRows, coreSummary, runAnalysis, validateEvent } from "../../../scripts/round1/events.mjs";

const readJson = (relative) => JSON.parse(fs.readFileSync(new URL(relative, import.meta.url), "utf8"));

const contract = readJson("../../../data/round1/contract/research-events-v0.3.json");
const assignment = readJson("../../../data/round1/experiment/assignment-r1-plus-price-v1.json");

let counter = 0;
const nextByte = () => (counter++ * 37) % 256;

const openSession = (code = "R1-P01", testEnv = "research") => {
  const result = startResearchSession({
    contract,
    assignment,
    participantCode: code,
    testEnv,
    sessionId: createUuid(nextByte),
    startedAt: "2026-11-09T10:00:00.000Z",
  });
  assert.equal(result.ok, true);
  return result.session;
};

let clock = Date.parse("2026-11-09T10:00:00.000Z");
const make = (session, eventName, properties = {}) =>
  buildResearchEvent({
    contract,
    session,
    eventName,
    properties,
    eventId: createUuid(nextByte),
    occurredAt: new Date((clock += 1000)).toISOString(),
    appVersion: "1.0.0",
    platform: "android",
  });

test("참가 코드: 형식·배정표·환경을 검사하고 그룹·가격은 배정표에서 정한다", () => {
  const session = openSession(" r1-p02 ");
  assert.equal(session.participantCode, "R1-P02");
  assert.equal(session.experimentGroup, assignment.assignments["R1-P02"]);
  assert.equal(session.displayedPriceKrw, contract.groups[session.experimentGroup]);

  const base = { contract, assignment, sessionId: createUuid(nextByte), startedAt: "2026-11-09T10:00:00.000Z" };
  assert.deepEqual(startResearchSession({ ...base, participantCode: "kim", testEnv: "research" }), { ok: false, error: "E_CODE_PATTERN" });
  assert.deepEqual(startResearchSession({ ...base, participantCode: "R1-P99", testEnv: "research" }), { ok: false, error: "E_UNKNOWN_CODE" });
  assert.deepEqual(startResearchSession({ ...base, participantCode: "R1-P01", testEnv: "prod" }), { ok: false, error: "E_TEST_ENV" });
});

test("UUID v4 형식", () => {
  const uuid = createUuid(nextByte);
  assert.match(uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test("세션이 없거나 계약에 없는 이벤트는 기록하지 않는다", () => {
  assert.equal(make(null, "analysis_started"), null);
  assert.equal(make(openSession(), "photo_uploaded"), null);
});

test("앱이 만드는 핵심 흐름 이벤트는 모두 분석 스크립트 검사를 통과한다", () => {
  const session = openSession();
  const events = [
    make(session, "app_opened"),
    make(session, "register_started"),
    make(session, "analysis_started"),
    make(session, "analysis_completed", { duration_ms: 6100, category: "bottom" }),
    make(session, "analysis_failed", { duration_ms: 30000, error_code: toAnalysisErrorCode("AI_TIMEOUT") }),
    make(session, "analysis_reviewed", { edited: true, edited_count: 2, edited_fields: "color|fit", category: "bottom" }),
    make(session, "register_completed", { duration_ms: 9000, cutout_via: "slimsam", after_auth: false }),
    make(session, "register_failed", { duration_ms: 1200, after_auth: true }),
    make(session, "outfit_viewed", { screen: "styling", items_count: 3, missing_count: 1, closet_size: 4 }),
    make(session, "missing_item_clicked"),
    make(session, "missing_item_viewed", { missing_category: "shoes", has_suggestion: true }),
    make(session, "missing_products_clicked", { missing_category: "shoes" }),
  ];

  for (const event of events) {
    assert.deepEqual(validateEvent(contract, event, assignment), [], event.event_name);
  }
});

test("계약에 없는 속성·금지 필드·허용값 밖의 값은 버린다", () => {
  const clean = sanitizeProperties(contract, "analysis_completed", {
    duration_ms: 5000.4,
    category: "spaceship",
    email: "a@b.c",
    image: "data:image/jpeg;base64,xxx",
    latitude: 37.5,
  });
  assert.deepEqual(clean, { duration_ms: 5000 });

  const event = make(openSession(), "analysis_completed", { duration_ms: 5000, user_id: "abc", photo: "x" });
  const text = JSON.stringify(event);
  for (const field of contract.forbidden_fields) {
    assert.ok(!text.includes(`"${field}"`), `금지 필드 ${field}가 이벤트에 들어감`);
  }
});

test("AI 결과 수정 여부: 고친 속성만 찾고 스타일 순서는 무시한다", () => {
  const ai = { category: "bottom", subCategory: "jeans", color: "black", fit: "wide", material: "denim", style: ["casual", "street"] };
  assert.deepEqual(getEditedFields(ai, { ...ai, style: ["street", "casual"] }), []);
  assert.deepEqual(getEditedFields(ai, { ...ai, color: "navy", style: ["casual"] }), ["color", "style"]);
});

test("분석 오류 코드 → 계약 값", () => {
  assert.equal(toAnalysisErrorCode("NETWORK"), "NETWORK");
  assert.equal(toAnalysisErrorCode("GUEST_RATE_LIMITED"), "RATE_LIMITED");
  assert.equal(toAnalysisErrorCode("AUTH_INVALID"), "AUTH");
  assert.equal(toAnalysisErrorCode(undefined), "OTHER");
  for (const code of ["NETWORK", "TIMEOUT", "AI_BUSY", "UNKNOWN", "USER_RATE_LIMITED"]) {
    assert.ok(contract.enums.analysis_error.includes(toAnalysisErrorCode(code)), code);
  }
});

test("기기 보관 개수를 넘으면 오래된 것부터 버린다", () => {
  const session = openSession();
  let events = [];
  for (let i = 0; i < 5; i += 1) events = appendResearchEvent(events, make(session, "app_opened"), 3);
  assert.equal(events.length, 3);
});

test("내보낸 JSON Lines → 분석: 리허설 제외, 등록 완료율·AI 수정률·Missing 클릭 집계", () => {
  const p01 = openSession("R1-P01");
  const p02 = openSession("R1-P02");
  const rehearsal = openSession("R1-T01", "rehearsal");

  const events = [
    make(p01, "register_started"),
    make(p01, "analysis_started"),
    make(p01, "analysis_completed", { duration_ms: 6000, category: "top" }),
    make(p01, "analysis_reviewed", { edited: true, edited_count: 1, edited_fields: "color", category: "top" }),
    make(p01, "register_completed", { duration_ms: 8000, cutout_via: "bria", after_auth: false }),
    make(p01, "outfit_viewed", { screen: "styling", items_count: 3, missing_count: 1, closet_size: 3 }),
    make(p01, "missing_item_clicked"),
    make(p02, "register_started"),
    make(p02, "analysis_started"),
    make(p02, "analysis_failed", { duration_ms: 30000, error_code: "AI_TIMEOUT" }),
    make(p02, "analysis_started"),
    make(p02, "analysis_completed", { duration_ms: 8000, category: "bottom" }),
    make(p02, "analysis_reviewed", { edited: false, edited_count: 0, edited_fields: "none", category: "bottom" }),
    make(p02, "register_completed", { duration_ms: 9000, cutout_via: "slimsam", after_auth: true }),
    make(p02, "outfit_viewed", { screen: "styling", items_count: 2, missing_count: 1, closet_size: 2 }),
    make(rehearsal, "register_started"),
  ];

  const lines = toJsonLines(events).split("\n").map((line) => JSON.parse(line));
  const result = runAnalysis(lines, contract, assignment);

  assert.equal(result.excluded.env_rehearsal, 1);
  assert.equal(result.excluded.invalid ?? 0, 0);

  const core = coreSummary(coreRows(contract, result.kept));
  assert.equal(core.participants, 2);
  assert.equal(core.register_completion.text, "2/2");
  assert.equal(core.analysis_failure.text, "1/3");
  assert.equal(core.ai_edit_rate.text, "1/2");
  assert.deepEqual(core.edited_fields, { color: 1 });
  assert.equal(core.missing_click_participants.text, "1/2");
  assert.equal(core.analysis_median_ms, 7000);
  assert.match(result.summary, /AI 결과를 고친 비율 \(고침\/저장 시도\) \| 1\/2/);
});

test("1차 범위 추가 기능 이벤트(온보딩·카메라·저장 후 수정·코디 저장)도 분석 검사를 통과하고 집계된다", () => {
  const p03 = openSession("R1-P03");
  const p04 = openSession("R1-P04");

  const events = [
    make(p03, "onboarding_completed", { skipped: false, steps_viewed: 3 }),
    make(p03, "register_started", { source: "camera" }),
    make(p03, "register_completed", { duration_ms: 9000, cutout_via: "slimsam", after_auth: false }),
    make(p03, "attribute_edited", { edited_count: 1, edited_fields: "fit", category: "bottom" }),
    make(p03, "outfit_viewed", { screen: "styling", items_count: 3, missing_count: 0, closet_size: 3 }),
    make(p03, "outfit_saved", { screen: "styling", items_count: 3 }),
    make(p03, "saved_outfits_viewed", { saved_count: 1 }),
    make(p03, "outfit_unsaved", { screen: "saved" }),
    make(p04, "onboarding_completed", { skipped: true, steps_viewed: 1 }),
    make(p04, "register_started", { source: "library" }),
    make(p04, "register_completed", { duration_ms: 7000, cutout_via: "original", after_auth: true }),
    make(p04, "outfit_viewed", { screen: "looks", items_count: 2, missing_count: 0, closet_size: 2 }),
  ];

  for (const event of events) {
    assert.deepEqual(validateEvent(contract, event, assignment), [], event.event_name);
  }

  // 허용값 밖의 사진 출처는 버린다
  assert.deepEqual(make(p03, "register_started", { source: "screenshot" }).properties, {});

  const result = runAnalysis(events, contract, assignment);
  const core = coreSummary(coreRows(contract, result.kept));

  assert.equal(core.onboarding_completed.text, "1/2");
  assert.equal(core.camera_registers.text, "1/2");
  assert.equal(core.attribute_edit_participants.text, "1/2");
  assert.equal(core.outfit_save_participants.text, "1/2");
  assert.match(result.summary, /추천 코디 저장 \(저장한 사람\/코디 본 사람\) \| 1\/2/);
});

test("서버의 잘못된 이미지 응답(INVALID_IMAGE)은 그대로 기록한다", () => {
  assert.equal(toAnalysisErrorCode("INVALID_IMAGE"), "INVALID_IMAGE");
  assert.ok(contract.enums.analysis_error.includes("INVALID_IMAGE"));
});
