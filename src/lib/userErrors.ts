// 저장·사진 교체 실패 → 사용자 안내 문구 (2026-11 MVP 감사 BUG-07)
// Supabase Storage·DB 오류는 영어 원문("new row violates row-level security policy", "Failed to fetch" 등)이라
// 그대로 보여주지 않는다. 앱이 직접 만든 한국어 오류만 그대로 쓰고, 나머지는 기본 안내로 바꾼다.
// 외부 모듈을 import하지 않는 순수 함수만 둔다(Node 테스트에서 직접 불러온다).

const HANGUL = /[가-힣]/;

const NETWORK_HINT = /failed to fetch|network request failed|networkerror|load failed/i;

export const getUserErrorMessage = (error: unknown, fallback: string) => {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? (error as { message?: unknown }).message
      : undefined;

  if (typeof message !== "string" || message.length === 0) {
    return fallback;
  }

  if (NETWORK_HINT.test(message)) {
    return "서버에 연결하지 못했어요. 인터넷 연결을 확인한 뒤 다시 시도해주세요.";
  }

  return HANGUL.test(message) ? message : fallback;
};
