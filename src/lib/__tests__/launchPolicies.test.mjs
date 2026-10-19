// Beta Launch: 계정 삭제 응답 해석(AC-01 ~ 05), 사진 AI 동의 판단(CS-01 ~ 04)
import test from "node:test";
import assert from "node:assert/strict";

import {
  ACCOUNT_DELETE_CONFIRM,
  interpretAccountDeletion,
} from "../accountDeletionPolicy.ts";

import {
  createAiConsentRecord,
  isAiConsentValid,
  parseAiConsent,
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
  const record = createAiConsentRecord("v2", new Date("2026-10-19T00:00:00Z"));

  assert.deepEqual(record, { version: "v2", acceptedAt: "2026-10-19T00:00:00.000Z" });
  assert.equal(isAiConsentValid(record, "v2"), true);
  assert.equal(isAiConsentValid(record, "v3"), false, "문구가 바뀌면 다시 동의");
});

test("CS-02 기록이 없거나 깨졌으면 동의하지 않은 것으로 본다", () => {
  assert.equal(isAiConsentValid(null, "v2"), false);
  assert.equal(isAiConsentValid({ version: "v2" }, "v2"), false);
  assert.equal(isAiConsentValid({ version: "v2", acceptedAt: "not-a-date" }, "v2"), false);
  assert.equal(isAiConsentValid("v2", "v2"), false);
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
