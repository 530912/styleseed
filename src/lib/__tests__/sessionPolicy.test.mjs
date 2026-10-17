// Sprint 1A-2: 세션 판단 규칙 (T2-01·02·22 단위)
import test from "node:test";
import assert from "node:assert/strict";

import {
  getAnalysisAccessToken,
  isAnonymousSession,
  isConvertedFromAnonymous,
  isSignedIn,
} from "../sessionPolicy.ts";

import { ApiError, formatRetryAfter, getApiErrorMessage } from "../apiErrors.ts";

const userSession = { access_token: "user-token", user: { id: "u1", is_anonymous: false } };
const legacyUserSession = { access_token: "user-token", user: { id: "u1" } };
const anonSession = { access_token: "anon-token", user: { id: "a1", is_anonymous: true } };

test("isSignedIn: 정식 세션만 로그인으로 본다(익명·없음은 로그아웃)", () => {
  assert.equal(isSignedIn(userSession), true);
  assert.equal(isSignedIn(legacyUserSession), true);
  assert.equal(isSignedIn(anonSession), false);
  assert.equal(isSignedIn(null), false);
  assert.equal(isSignedIn(undefined), false);
  assert.equal(isAnonymousSession(anonSession), true);
  assert.equal(isAnonymousSession(userSession), false);
});

const fakeAuth = ({ session = null, anonResult, anonThrows = false } = {}) => {
  const calls = { signInAnonymously: 0 };

  return {
    calls,
    getSession: async () => ({ data: { session } }),
    signInAnonymously: async () => {
      calls.signInAnonymously += 1;

      if (anonThrows) throw new Error("network");

      return anonResult;
    },
  };
};

test("T2-01 분석 토큰: 세션이 없으면 익명 세션을 만든다", async () => {
  const auth = fakeAuth({ anonResult: { data: { session: anonSession }, error: null } });

  assert.equal(await getAnalysisAccessToken(auth), "anon-token");
  assert.equal(auth.calls.signInAnonymously, 1);
});

test("T2-01b 분석 토큰: 이미 세션(정식·익명)이 있으면 새로 만들지 않는다", async () => {
  for (const session of [userSession, anonSession]) {
    const auth = fakeAuth({ session });

    assert.equal(await getAnalysisAccessToken(auth), session.access_token);
    assert.equal(auth.calls.signInAnonymously, 0);
  }
});

test("T2-02 익명 로그인이 실패해도(오류·예외) 토큰 없이 분석을 계속한다", async () => {
  const failed = fakeAuth({ anonResult: { data: { session: null }, error: new Error("rate limited") } });
  assert.equal(await getAnalysisAccessToken(failed), null);

  const thrown = fakeAuth({ anonThrows: true });
  assert.equal(await getAnalysisAccessToken(thrown), null);
});

test("익명 → 정식 전환 확인: 같은 ID이고 익명 표시가 사라져야 한다", () => {
  const converted = { access_token: "t2", user: { id: "a1", is_anonymous: false } };
  const otherUser = { access_token: "t3", user: { id: "b9", is_anonymous: false } };
  const stillAnon = { access_token: "t4", user: { id: "a1", is_anonymous: true } };

  assert.equal(isConvertedFromAnonymous(anonSession, converted), true);
  assert.equal(isConvertedFromAnonymous(anonSession, otherUser), false);
  assert.equal(isConvertedFromAnonymous(anonSession, stillAnon), false);
  assert.equal(isConvertedFromAnonymous(userSession, converted), false);
});

test("새 오류 코드 문구: ANONYMOUS_NOT_ALLOWED, USER_RATE_LIMITED", () => {
  const fallback = "기본";

  assert.match(getApiErrorMessage(new ApiError("ANONYMOUS_NOT_ALLOWED"), fallback), /로그인이 필요해요/);
  assert.match(
    getApiErrorMessage(new ApiError("USER_RATE_LIMITED", { retryAfterSeconds: 600 }), fallback),
    /약 10분 후/,
  );
});

test("대기 시간 문구: 초·분·시간", () => {
  assert.equal(formatRetryAfter(49), "49초");
  assert.equal(formatRetryAfter(600), "약 10분");
  assert.equal(formatRetryAfter(55595), "약 16시간");
  assert.match(
    getApiErrorMessage(new ApiError("AI_RATE_LIMITED", { retryAfterSeconds: 55595 }), "x"),
    /약 16시간 후 다시 시도/,
  );
});
