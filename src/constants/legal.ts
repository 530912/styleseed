// 정책 문서 주소 (Beta Launch)
// 개인정보처리방침·이용약관은 법률 검토 후 게시 주소가 정해지면 EAS 환경변수로 넣는다.
// 값이 없으면 앱은 "준비 중"으로 표시한다(임의 주소를 넣지 않는다).

const readUrl = (value: string | undefined) => {
  const trimmed = value?.trim();

  return trimmed && /^https:\/\//.test(trimmed) ? trimmed : null;
};

export const PRIVACY_POLICY_URL = readUrl(
  process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL,
);

export const TERMS_URL = readUrl(process.env.EXPO_PUBLIC_TERMS_URL);

// Gemini 무료 등급 고지(PRD SEC-11 ②). 유료 등급으로 바꾼 빌드에서만
// EXPO_PUBLIC_GEMINI_PAID_TIER=true로 끈다. 기본값은 현재 상태(무료 등급)에 맞춰 고지한다.
export const GEMINI_FREE_TIER_NOTICE =
  process.env.EXPO_PUBLIC_GEMINI_PAID_TIER !== "true";

// 동의 문구가 바뀌면 버전을 올린다 → 기존 사용자도 다시 동의한다
export const AI_CONSENT_VERSION = "2026-10-19";
