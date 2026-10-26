// 사진 AI 처리 동의 판단 (Beta Launch, Apple 5.1.2(i) · PRD SEC-11)
// 외부 모듈을 import하지 않는 순수 함수만 둔다(Node 테스트에서 직접 불러온다).
//
// 동의는 "누가 했는지"(ownerId)와 함께 저장한다(BUG-31, 2026-11 조사).
// - ownerId: 동의할 때 로그인한 정식 사용자 ID. 로그인 전·익명 세션이면 null
// - 로그인 전 동의(null)는 그 뒤 처음 로그인한 사용자에게 귀속(adopt)된다
//   (사진 선택 → 동의 → 분석 → 가입·로그인이 한 사람의 흐름이므로)
// - 다른 사용자의 동의는 무효 → 동의 화면을 다시 보여준다
// - 로그아웃하면 기록을 지운다(aiConsent.ts). 진행자 기기를 여러 참가자가 써도 참가자마다 동의를 받는다

export type AiConsentRecord = {
  version: string;
  acceptedAt: string;
  ownerId: string | null;
};

// 저장된 기록이 현재 동의 문구 버전과 같고 형식이 맞을 때만 유효.
// ownerId가 없는 예전 기록(기기 단위 저장)은 무효로 보고 다시 동의를 받는다
export const isAiConsentValid = (
  record: unknown,
  currentVersion: string,
): record is AiConsentRecord => {
  if (!record || typeof record !== "object") {
    return false;
  }

  const { version, acceptedAt, ownerId } = record as Partial<AiConsentRecord>;

  return (
    version === currentVersion &&
    typeof acceptedAt === "string" &&
    !Number.isNaN(Date.parse(acceptedAt)) &&
    (ownerId === null || (typeof ownerId === "string" && ownerId.length > 0))
  );
};

// valid: 지금 사용자의 동의 / adopt: 로그인 전 동의 → 지금 로그인한 사용자에게 귀속 / invalid: 다시 동의
export type AiConsentResolution = "valid" | "adopt" | "invalid";

export const resolveAiConsent = (
  record: unknown,
  currentVersion: string,
  currentOwnerId: string | null,
): AiConsentResolution => {
  if (!isAiConsentValid(record, currentVersion)) {
    return "invalid";
  }

  if (record.ownerId === null) {
    return currentOwnerId === null ? "valid" : "adopt";
  }

  return record.ownerId === currentOwnerId ? "valid" : "invalid";
};

// Supabase 세션 → 동의 주인. 세션이 없거나 익명 세션이면 null
export const consentOwnerFromSession = (
  session: { user?: { id?: string; is_anonymous?: boolean } | null } | null | undefined,
): string | null => {
  const user = session?.user;

  if (!user?.id || user.is_anonymous === true) {
    return null;
  }

  return user.id;
};

export const parseAiConsent = (raw: string | null): AiConsentRecord | null => {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);

    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

export const createAiConsentRecord = (
  version: string,
  { ownerId = null, now = new Date() }: { ownerId?: string | null; now?: Date } = {},
): AiConsentRecord => ({ version, acceptedAt: now.toISOString(), ownerId });
