// Supabase Auth 오류 → 사용자 안내 문구 (FR-AUTH-03·06)
// Supabase는 영어 메시지를 돌려주므로 코드로 판단해 한국어로 바꾼다.
// 외부 모듈을 import하지 않는 순수 함수만 둔다(Node 테스트에서 직접 불러온다).

type AuthErrorLike = {
  code?: unknown;
  name?: unknown;
  status?: unknown;
  message?: unknown;
};

const asAuthError = (error: unknown): AuthErrorLike =>
  typeof error === "object" && error !== null ? (error as AuthErrorLike) : {};

// 2026-10-19 QA 프로젝트에서 실제로 확인한 코드 기준
export const getAuthErrorMessage = (error: unknown, fallback: string) => {
  const { code, name, message } = asAuthError(error);

  switch (code) {
    case "invalid_credentials":
      return "이메일 또는 비밀번호가 올바르지 않아요.";

    case "user_already_exists":
    case "email_exists":
      return "이미 가입된 이메일이에요. 로그인해주세요.";

    case "weak_password":
      return "비밀번호는 6자 이상으로 입력해주세요.";

    case "validation_failed":
    case "email_address_invalid":
      return "이메일 형식을 확인해주세요.";

    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "요청이 많아요. 잠시 후 다시 시도해주세요.";

    case "signup_disabled":
      return "지금은 새 계정을 만들 수 없어요.";

    default:
      break;
  }

  if (name === "AuthRetryableFetchError") {
    return "서버에 연결할 수 없어요. 네트워크 상태를 확인해주세요.";
  }

  // 코드가 없는 옛 형식 응답 대비
  if (typeof message === "string" && /invalid login credentials/i.test(message)) {
    return "이메일 또는 비밀번호가 올바르지 않아요.";
  }

  return fallback;
};

// 익명 → 정식 전환 시 "이미 가입된 이메일"인지(전환 대신 오류로 안내해야 함)
export const isEmailAlreadyRegistered = (error: unknown) => {
  const { code, message } = asAuthError(error);

  return (
    code === "email_exists" ||
    code === "user_already_exists" ||
    (typeof message === "string" &&
      /already (been )?registered|already exists/i.test(message))
  );
};
