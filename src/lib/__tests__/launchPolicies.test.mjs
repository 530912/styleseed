// Beta Launch: 계정 삭제 응답 해석(AC-01 ~ 05), 사진 AI 동의 판단(CS-01 ~ 04)
import test from "node:test";
import assert from "node:assert/strict";

import {
  ACCOUNT_DELETE_CONFIRM,
  interpretAccountDeletion,
} from "../accountDeletionPolicy.ts";

import {
  consentOwnerFromSession,
  createAiConsentRecord,
  isAiConsentValid,
  parseAiConsent,
  resolveAiConsent,
} from "../aiConsentPolicy.ts";

test("AC-01 200 deleted=true만 삭제 완료로 본다", () => {
  assert.deepEqual(interpretAccountDeletion(200, { deleted: true }), { kind: "deleted" });
  assert.equal(interpretAccountDeletion(200, {}).kind, "retry");
  assert.equal(interpretAccountDeletion(200, null).kind, "retry");
});

test("AC-02 REAUTH_REQUIRED는 비밀번호 재입력 안내(로그인 만료와 구분)", () => {
  const outcome = interpretAccountDeletion(401, { code: "REAUTH_REQUIRED" });

  assert.equal(outcome.kind, "reauth");
  assert.match(outcome.message, /비밀번호/);
});

test("AC-03 로그인 만료·익명 세션은 다시 로그인 안내", () => {
  for (const [status, code] of [
    [401, "AUTH_INVALID"],
    [401, "AUTH_REQUIRED"],
    [403, "ANONYMOUS_NOT_ALLOWED"],
    [401, undefined],
  ]) {
    assert.equal(interpretAccountDeletion(status, { code }).kind, "signed-out", `${status} ${code}`);
  }
});

test("AC-04 일부 진행 후 실패·서버 설정 문제·알 수 없는 응답은 재시도 안내", () => {
  const partial = interpretAccountDeletion(502, { code: "ACCOUNT_DELETION_FAILED", step: "storage" });

  assert.equal(partial.kind, "retry");
  assert.match(partial.message, /이어서/);

  assert.equal(interpretAccountDeletion(503, { code: "ACCOUNT_DELETION_UNAVAILABLE" }).kind, "retry");
  assert.equal(interpretAccountDeletion(500, null).kind, "retry");
});

test("AC-05 앱과 서버의 확인 문구가 같다", async () => {
  const { CONFIRM_PHRASE } = await import("../../../backend/accountRoutes.js");

  assert.equal(ACCOUNT_DELETE_CONFIRM, CONFIRM_PHRASE);
});

test("CS-01 현재 버전으로 저장한 동의만 유효", () => {
  const record = createAiConsentRecord("v2", { now: new Date("2026-10-19T00:00:00Z") });

  assert.deepEqual(record, { version: "v2", acceptedAt: "2026-10-19T00:00:00.000Z", ownerId: null });
  assert.equal(isAiConsentValid(record, "v2"), true);
  assert.equal(isAiConsentValid(record, "v3"), false, "문구가 바뀌면 다시 동의");
});

test("CS-02 기록이 없거나 깨졌으면 동의하지 않은 것으로 본다", () => {
  assert.equal(isAiConsentValid(null, "v2"), false);
  assert.equal(isAiConsentValid({ version: "v2" }, "v2"), false);
  assert.equal(isAiConsentValid({ version: "v2", acceptedAt: "not-a-date" }, "v2"), false);
  assert.equal(isAiConsentValid("v2", "v2"), false);
  // ownerId가 없는 예전(기기 단위) 기록은 다시 동의(BUG-31)
  assert.equal(isAiConsentValid({ version: "v2", acceptedAt: "2026-10-19T00:00:00.000Z" }, "v2"), false);
  assert.equal(isAiConsentValid({ version: "v2", acceptedAt: "2026-10-19T00:00:00.000Z", ownerId: "" }, "v2"), false);
});

test("CS-03 저장소 문자열 파싱", () => {
  assert.equal(parseAiConsent(null), null);
  assert.equal(parseAiConsent("{broken"), null);
  assert.equal(parseAiConsent("123"), null);
  assert.deepEqual(parseAiConsent('{"version":"v2","acceptedAt":"2026-10-19T00:00:00.000Z"}'), {
    version: "v2",
    acceptedAt: "2026-10-19T00:00:00.000Z",
  });
});

// BUG-31: 동의는 동의한 사용자에게 묶인다
const USER_A = "00000000-0000-4000-8000-00000000000a";
const USER_B = "00000000-0000-4000-8000-00000000000b";

test("CS-05 동의 주인: 정식 사용자만 ID, 세션 없음·익명은 null", () => {
  assert.equal(consentOwnerFromSession(null), null);
  assert.equal(consentOwnerFromSession({ user: null }), null);
  assert.equal(consentOwnerFromSession({ user: { id: USER_A, is_anonymous: true } }), null);
  assert.equal(consentOwnerFromSession({ user: { id: USER_A, is_anonymous: false } }), USER_A);
  assert.equal(consentOwnerFromSession({ user: { id: USER_A } }), USER_A);
});

test("CS-06 같은 사용자 동의는 유효, 다른 사용자 동의는 무효", () => {
  const byA = createAiConsentRecord("v2", { ownerId: USER_A });

  assert.equal(resolveAiConsent(byA, "v2", USER_A), "valid");
  assert.equal(resolveAiConsent(byA, "v2", USER_B), "invalid", "참가자 B는 다시 동의");
  assert.equal(resolveAiConsent(byA, "v2", null), "invalid", "로그아웃 상태에서 A의 동의를 쓰지 않음");
  assert.equal(resolveAiConsent(byA, "v3", USER_A), "invalid", "문구 버전이 바뀌면 다시 동의");
});

test("CS-07 로그인 전 동의는 로그인 전에는 유효, 로그인하면 그 사용자에게 귀속", () => {
  const beforeLogin = createAiConsentRecord("v2", { ownerId: null });

  assert.equal(resolveAiConsent(beforeLogin, "v2", null), "valid");
  assert.equal(resolveAiConsent(beforeLogin, "v2", USER_A), "adopt");

  const adopted = createAiConsentRecord("v2", { ownerId: USER_A });

  assert.equal(resolveAiConsent(adopted, "v2", USER_B), "invalid");
});

test("CS-08 기록 없음·예전 형식은 다시 동의", () => {
  assert.equal(resolveAiConsent(null, "v2", USER_A), "invalid");
  assert.equal(resolveAiConsent({ version: "v2", acceptedAt: "2026-10-19T00:00:00.000Z" }, "v2", null), "invalid");
});
