// 사진 AI 처리 동의 판단 (Beta Launch, Apple 5.1.2(i) · PRD SEC-11)
// 외부 모듈을 import하지 않는 순수 함수만 둔다(Node 테스트에서 직접 불러온다).

export type AiConsentRecord = {
  version: string;
  acceptedAt: string;
};

// 저장된 기록이 현재 동의 문구 버전과 같을 때만 유효
export const isAiConsentValid = (
  record: unknown,
  currentVersion: string,
): record is AiConsentRecord => {
  if (!record || typeof record !== "object") {
    return false;
  }

  const { version, acceptedAt } = record as Partial<AiConsentRecord>;

  return (
    version === currentVersion &&
    typeof acceptedAt === "string" &&
    !Number.isNaN(Date.parse(acceptedAt))
  );
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
  now: Date = new Date(),
): AiConsentRecord => ({ version, acceptedAt: now.toISOString() });
