// 2026-11 MVP 감사: 저장·사진 교체 실패 안내(BUG-07), 프로토타입 노출 설정(BUG-05)
import test from "node:test";
import assert from "node:assert/strict";

import { getUserErrorMessage } from "../userErrors.ts";
import { isPrototypeEnabled } from "../featureFlags.ts";

const FALLBACK = "옷을 저장하지 못했어요. 잠시 후 다시 시도해주세요.";

test("앱이 만든 한국어 오류는 그대로 보여준다", () => {
  assert.equal(
    getUserErrorMessage(new Error("원본 이미지를 불러오지 못했습니다."), FALLBACK),
    "원본 이미지를 불러오지 못했습니다.",
  );
});

test("Supabase 영어 원문은 기본 안내로 바꾼다", () => {
  for (const error of [
    { message: "new row violates row-level security policy" },
    { statusCode: "403", message: "Unauthorized" },
    new Error("JWT expired"),
  ]) {
    const message = getUserErrorMessage(error, FALLBACK);

    assert.equal(message, FALLBACK);
    assert.doesNotMatch(message, /[A-Za-z]{4,}/);
  }
});

test("연결 실패는 인터넷 확인 안내", () => {
  for (const text of ["Failed to fetch", "Network request failed", "TypeError: Load failed"]) {
    assert.match(getUserErrorMessage(new TypeError(text), FALLBACK), /인터넷 연결/);
  }
});

test("메시지가 없거나 오류 객체가 아니면 기본 안내", () => {
  for (const error of [null, undefined, "문자열", 42, {}, { message: "" }]) {
    assert.equal(getUserErrorMessage(error, FALLBACK), FALLBACK);
  }
});

test("프로토타입 화면은 값이 정확히 \"true\"일 때만 켜진다(기본 숨김)", () => {
  assert.equal(isPrototypeEnabled("true"), true);

  for (const value of [undefined, "", "false", "TRUE", "1", "yes"]) {
    assert.equal(isPrototypeEnabled(value), false);
  }
});
