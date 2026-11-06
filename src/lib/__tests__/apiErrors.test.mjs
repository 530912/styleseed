// Sprint 1A-1: 클라이언트 오류 해석·토큰 헤더 (TS-02, TS-03, TS-11 문구)
// 실행: npm run test:client (Node의 TypeScript 타입 제거 기능으로 .ts를 직접 불러온다)
import test from "node:test";
import assert from "node:assert/strict";

import {
  ApiError,
  buildJsonHeaders,
  getApiErrorMessage,
  getSaveAfterAuthFailureAlert,
  isApiError,
  toApiError,
} from "../apiErrors.ts";

const FALLBACK = "옷 분석 중 오류가 발생했습니다.";

test("TS-02 로그인 토큰이 있으면 Bearer 헤더를 붙인다", () => {
  assert.deepEqual(buildJsonHeaders("access-token-123"), {
    "Content-Type": "application/json",
    Authorization: "Bearer access-token-123",
  });
});

test("TS-02b 토큰이 없으면(guest) Authorization 헤더를 붙이지 않는다", () => {
  for (const token of [null, undefined, ""]) {
    const headers = buildJsonHeaders(token);

    assert.equal("Authorization" in headers, false);
    assert.equal(headers["Content-Type"], "application/json");
  }
});

test("TS-03 응답 본문의 code가 상태 코드보다 우선한다", () => {
  const error = toApiError(429, {
    code: "GUEST_RATE_LIMITED",
    retryAfterSeconds: 1800,
  });

  assert.equal(error.code, "GUEST_RATE_LIMITED");
  assert.equal(error.status, 429);
  assert.equal(error.retryAfterSeconds, 1800);
});

test("TS-03b code가 없으면 상태 코드로 판단한다", () => {
  const cases = [
    [401, "AUTH_INVALID"],
    [413, "PAYLOAD_TOO_LARGE"],
    [429, "AI_RATE_LIMITED"],
    [503, "AI_BUSY"],
    [504, "AI_TIMEOUT"],
    [500, "UNKNOWN"],
  ];

  for (const [status, code] of cases) {
    assert.equal(toApiError(status, null).code, code, String(status));
  }
});

test("TS-03c 알 수 없는 code나 잘못된 retryAfterSeconds는 무시한다", () => {
  const error = toApiError(502, {
    code: "UPSTREAM_FAILED",
    retryAfterSeconds: "soon",
  });

  assert.equal(error.code, "UNKNOWN");
  assert.equal(error.retryAfterSeconds, null);
});

test("TS-03d 오류 코드별 사용자 문구", () => {
  const message = (code, retryAfterSeconds = null) =>
    getApiErrorMessage(new ApiError(code, { retryAfterSeconds }), FALLBACK);

  // 기존 분석 화면 문구 유지(회귀)
  assert.equal(
    message("AI_RATE_LIMITED", 49),
    "AI 요청 한도에 도달했어요. 49초 후 다시 시도해주세요.",
  );
  assert.equal(
    message("AI_RATE_LIMITED"),
    "AI 요청 한도에 도달했어요. 1분 정도 후 다시 시도해주세요.",
  );
  assert.equal(message("AI_BUSY"), "AI 서버가 혼잡해요. 잠시 후 다시 시도해주세요.");

  // 신규 문구
  assert.match(message("GUEST_RATE_LIMITED", 1800), /로그인하면 바로 계속 분석/);
  assert.match(message("GUEST_RATE_LIMITED", 1800), /약 30분 후/);
  assert.match(message("PAYLOAD_TOO_LARGE"), /사진 용량이 너무 커요/);
  assert.match(message("NETWORK"), /서버에 연결할 수 없어요/);
  assert.match(message("AUTH_REQUIRED"), /로그인이 필요해요/);
  assert.match(message("AUTH_UNAVAILABLE"), /지연/);
  assert.equal(message("UNKNOWN"), FALLBACK);
});

test("TS-11 앱 타임아웃과 서버 AI 타임아웃은 같은 '응답이 늦어요' 안내", () => {
  for (const code of ["TIMEOUT", "AI_TIMEOUT"]) {
    assert.match(
      getApiErrorMessage(new ApiError(code), FALLBACK),
      /응답이 늦어지고 있어요/,
    );
  }
});

test("ApiError가 아닌 오류는 화면별 기본 문구를 쓴다", () => {
  assert.equal(isApiError(new Error("x")), false);
  assert.equal(getApiErrorMessage(new TypeError("x"), FALLBACK), FALLBACK);
});

test("TS-15 로그인 성공 + 저장 실패 안내는 '로그인 실패'가 아니다", () => {
  const alert = getSaveAfterAuthFailureAlert(
    "로그인",
    new ApiError("NETWORK"),
  );

  assert.equal(alert.title, "로그인은 완료됐어요");
  assert.doesNotMatch(alert.title, /실패/);
  assert.match(alert.message, /옷을 옷장에 저장하지 못했어요/);
  assert.match(alert.message, /서버에 연결할 수 없어요/);
  assert.equal(alert.retryLabel, "다시 시도");
  assert.equal(alert.laterLabel, "나중에");
});

test("TS-17 회원가입 경로도 같은 안내, Supabase 오류는 기본 문구", () => {
  const alert = getSaveAfterAuthFailureAlert(
    "회원가입",
    new Error("storage upload failed"),
  );

  assert.equal(alert.title, "회원가입은 완료됐어요");
  assert.match(alert.message, /잠시 후 다시 시도해주세요/);
});

test("서버의 이미지 사전 검사 실패(400 INVALID_IMAGE)는 다른 사진을 고르라고 안내한다", () => {
  const error = toApiError(400, { code: "INVALID_IMAGE", message: "이미지 형식을 확인하지 못했어요." });

  assert.equal(error.code, "INVALID_IMAGE");
  assert.match(getApiErrorMessage(error, "fallback"), /다른 사진으로 다시 시도/);
});

test("서버 Gemini 미연결(503 AI_UNAVAILABLE)·잔액 소진은 '혼잡'이 아니라 사용 불가로 안내하고 재시도를 권하지 않는다", async () => {
  const { isAiUnavailableError } = await import("../apiErrors.ts");

  for (const code of ["AI_UNAVAILABLE", "AI_CREDIT_EXHAUSTED"]) {
    const error = toApiError(503, { code, message: "AI 분석을 준비 중이에요." });
    assert.equal(error.code, code);
    assert.equal(isAiUnavailableError(error), true);
    assert.match(getApiErrorMessage(error, "fallback"), /지금은 AI 분석을 사용할 수 없어요/);
  }

  // 코드 없는 503은 지금처럼 혼잡(재시도 가능)
  const busy = toApiError(503, {});
  assert.equal(busy.code, "AI_BUSY");
  assert.equal(isAiUnavailableError(busy), false);
});
