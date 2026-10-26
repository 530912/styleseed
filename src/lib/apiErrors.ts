// 백엔드 응답을 공통 오류 코드와 사용자 문구로 바꾼다.
// 외부 모듈을 import하지 않는 순수 함수만 둔다(Node 테스트에서 직접 불러온다).

export type ApiErrorCode =
  | "AUTH_REQUIRED"
  | "AUTH_INVALID"
  | "AUTH_UNAVAILABLE"
  | "ANONYMOUS_NOT_ALLOWED"
  | "USER_RATE_LIMITED"
  | "PAYLOAD_TOO_LARGE"
  | "TIMEOUT"
  | "AI_TIMEOUT"
  | "AI_RATE_LIMITED"
  | "GUEST_RATE_LIMITED"
  | "AI_BUSY"
  | "NETWORK"
  | "INVALID_IMAGE"
  | "UNKNOWN";

type ErrorBody = {
  code?: unknown;
  message?: unknown;
  retryAfterSeconds?: unknown;
} | null;

const KNOWN_CODES: readonly ApiErrorCode[] = [
  "AUTH_REQUIRED",
  "AUTH_INVALID",
  "AUTH_UNAVAILABLE",
  "ANONYMOUS_NOT_ALLOWED",
  "USER_RATE_LIMITED",
  "PAYLOAD_TOO_LARGE",
  "TIMEOUT",
  "AI_TIMEOUT",
  "AI_RATE_LIMITED",
  "GUEST_RATE_LIMITED",
  "AI_BUSY",
  "NETWORK",
  "INVALID_IMAGE",
];

export class ApiError extends Error {
  code: ApiErrorCode;

  status: number | null;

  retryAfterSeconds: number | null;

  constructor(
    code: ApiErrorCode,
    options: {
      status?: number | null;
      message?: string;
      retryAfterSeconds?: number | null;
    } = {},
  ) {
    super(options.message ?? code);

    this.name = "ApiError";
    this.code = code;
    this.status = options.status ?? null;
    this.retryAfterSeconds = options.retryAfterSeconds ?? null;
  }
}

export const isApiError = (error: unknown): error is ApiError =>
  error instanceof ApiError;

const codeFromStatus = (status: number): ApiErrorCode => {
  if (status === 401) return "AUTH_INVALID";
  if (status === 413) return "PAYLOAD_TOO_LARGE";
  if (status === 429) return "AI_RATE_LIMITED";
  if (status === 503) return "AI_BUSY";
  if (status === 504) return "AI_TIMEOUT";

  return "UNKNOWN";
};

// 실패 응답(status + JSON 본문) → ApiError. 본문의 code가 상태 코드보다 우선한다.
export const toApiError = (status: number, body: ErrorBody): ApiError => {
  const bodyCode = body?.code;

  const code =
    typeof bodyCode === "string" &&
    (KNOWN_CODES as readonly string[]).includes(bodyCode)
      ? (bodyCode as ApiErrorCode)
      : codeFromStatus(status);

  const retryAfterSeconds =
    typeof body?.retryAfterSeconds === "number" &&
    Number.isFinite(body.retryAfterSeconds)
      ? body.retryAfterSeconds
      : null;

  return new ApiError(code, {
    status,
    message: typeof body?.message === "string" ? body.message : undefined,
    retryAfterSeconds,
  });
};

export const buildJsonHeaders = (
  accessToken?: string | null,
): Record<string, string> => ({
  "Content-Type": "application/json",
  ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
});

// 로그인·회원가입은 성공했지만 보류 중인 옷 저장이 실패했을 때의 안내(PRD FR-AUTH-03)
// authLabel: "로그인" 또는 "회원가입"
export const getSaveAfterAuthFailureAlert = (
  authLabel: string,
  error: unknown,
) => ({
  title: `${authLabel}은 완료됐어요`,
  message: `옷을 옷장에 저장하지 못했어요.\n${getApiErrorMessage(
    error,
    "잠시 후 다시 시도해주세요.",
  )}`,
  retryLabel: "다시 시도",
  laterLabel: "나중에",
});

// 대기 시간을 읽기 쉬운 문구로(예: 49초, 약 5분, 약 16시간)
export const formatRetryAfter = (seconds: number) => {
  if (seconds < 120) return `${seconds}초`;
  if (seconds < 3600) return `약 ${Math.ceil(seconds / 60)}분`;

  return `약 ${Math.ceil(seconds / 3600)}시간`;
};

// 사용자에게 보여줄 문구. fallback은 화면별 기본 문구.
export const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (!isApiError(error)) {
    return fallback;
  }

  switch (error.code) {
    case "AI_RATE_LIMITED":
      return error.retryAfterSeconds
        ? `AI 요청 한도에 도달했어요. ${formatRetryAfter(error.retryAfterSeconds)} 후 다시 시도해주세요.`
        : "AI 요청 한도에 도달했어요. 1분 정도 후 다시 시도해주세요.";

    case "GUEST_RATE_LIMITED": {
      const minutes = error.retryAfterSeconds
        ? Math.ceil(error.retryAfterSeconds / 60)
        : null;

      return minutes
        ? `로그인 없이 쓸 수 있는 분석 횟수를 모두 사용했어요. 로그인하면 바로 계속 분석할 수 있어요. (또는 약 ${minutes}분 후 다시 시도)`
        : "로그인 없이 쓸 수 있는 분석 횟수를 모두 사용했어요. 로그인하면 바로 계속 분석할 수 있어요.";
    }

    case "USER_RATE_LIMITED":
      return error.retryAfterSeconds
        ? `분석 요청이 많아요. 약 ${Math.ceil(error.retryAfterSeconds / 60)}분 후 다시 시도해주세요.`
        : "분석 요청이 많아요. 잠시 후 다시 시도해주세요.";

    case "AI_BUSY":
      return "AI 서버가 혼잡해요. 잠시 후 다시 시도해주세요.";

    case "TIMEOUT":
    case "AI_TIMEOUT":
      return "응답이 늦어지고 있어요. 잠시 후 다시 시도해주세요.";

    case "PAYLOAD_TOO_LARGE":
      return "사진 용량이 너무 커요. 다른 사진을 선택해주세요.";

    // 서버가 이미지 형식을 확인하지 못함(Gemini 호출 전 검사, Claude B R-8)
    case "INVALID_IMAGE":
      return "이 사진은 분석할 수 없어요. 다른 사진으로 다시 시도해주세요.";

    case "NETWORK":
      return "서버에 연결할 수 없어요. 네트워크 상태를 확인해주세요.";

    case "AUTH_REQUIRED":
    case "AUTH_INVALID":
    case "ANONYMOUS_NOT_ALLOWED":
      return "로그인이 필요해요. 다시 로그인해주세요.";

    case "AUTH_UNAVAILABLE":
      return "로그인 확인이 잠시 지연되고 있어요. 잠시 후 다시 시도해주세요.";

    default:
      return fallback;
  }
};
