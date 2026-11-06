// Sprint 1A-2 종료 QA: Supabase Auth 오류 안내 (PQ-3, FR-AUTH-03·06)
// 코드·메시지는 2026-10-19 QA 프로젝트 실제 응답(backend/test/e2e/sprint-1a-2-qa.e2e.js Q-02 등)
import test from "node:test";
import assert from "node:assert/strict";

import { getAuthErrorMessage, isEmailAlreadyRegistered } from "../authErrors.ts";

const FALLBACK = "기본 안내";

test("잘못된 비밀번호(invalid_credentials) → 한국어 안내, 영어 원문 노출 없음", () => {
  const message = getAuthErrorMessage(
    { status: 400, code: "invalid_credentials", message: "Invalid login credentials" },
    FALLBACK,
  );

  assert.equal(message, "이메일 또는 비밀번호가 올바르지 않아요.");
  assert.doesNotMatch(message, /Invalid/);
});

test("가입 오류 코드별 안내", () => {
  const cases = [
    [{ code: "user_already_exists", message: "User already registered" }, /이미 가입된 이메일/],
    [{ code: "email_exists", message: "A user with this email address has already been registered" }, /이미 가입된 이메일/],
    [{ code: "weak_password", message: "Password should be at least 6 characters." }, /6자 이상/],
    [{ code: "validation_failed", message: "Unable to validate email address: invalid format" }, /이메일 형식/],
    [{ code: "over_request_rate_limit" }, /요청이 많아요/],
    [{ name: "AuthRetryableFetchError", message: "Failed to fetch" }, /서버에 연결할 수 없어요/],
  ];

  for (const [error, pattern] of cases) {
    assert.match(getAuthErrorMessage(error, FALLBACK), pattern, JSON.stringify(error));
  }
});

test("알 수 없는 오류는 기본 안내(영어 원문을 그대로 보이지 않음)", () => {
  assert.equal(getAuthErrorMessage({ code: "something_new", message: "Some English text" }, FALLBACK), FALLBACK);
  assert.equal(getAuthErrorMessage(new Error("boom"), FALLBACK), FALLBACK);
  assert.equal(getAuthErrorMessage(null, FALLBACK), FALLBACK);
});

test("익명 → 정식 전환 시 이미 가입된 이메일 판별", () => {
  assert.equal(isEmailAlreadyRegistered({ code: "email_exists" }), true);
  assert.equal(isEmailAlreadyRegistered({ code: "user_already_exists" }), true);
  assert.equal(isEmailAlreadyRegistered({ message: "A user with this email address has already been registered" }), true);
  assert.equal(isEmailAlreadyRegistered({ code: "weak_password" }), false);
});
