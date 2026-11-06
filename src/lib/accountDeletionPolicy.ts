// 계정 삭제 응답 해석 (Beta Launch, PRD SEC-09)
// 외부 모듈을 import하지 않는 순수 함수만 둔다(Node 테스트에서 직접 불러온다).
//
// 서버(backend/accountRoutes.js) 응답
// - 200 { deleted: true }                  → 삭제 완료
// - 401 REAUTH_REQUIRED                     → 비밀번호 재확인이 오래됨
// - 401 AUTH_REQUIRED / AUTH_INVALID        → 로그인 만료
// - 400 CONFIRMATION_REQUIRED               → 앱 버그(확인 문구 누락)
// - 503 ACCOUNT_DELETION_UNAVAILABLE        → 서버 설정 문제(관리자 키 없음)
// - 502 ACCOUNT_DELETION_FAILED { step }    → 일부만 진행됨. 다시 시도하면 이어서 삭제

export const ACCOUNT_DELETE_CONFIRM = "DELETE";

export type AccountDeletionOutcome =
  | { kind: "deleted" }
  | { kind: "reauth"; message: string }
  | { kind: "signed-out"; message: string }
  | { kind: "retry"; message: string };

type Body = { code?: unknown; deleted?: unknown } | null;

export const interpretAccountDeletion = (
  status: number,
  body: Body,
): AccountDeletionOutcome => {
  if (status === 200 && body?.deleted === true) {
    return { kind: "deleted" };
  }

  const code = typeof body?.code === "string" ? body.code : null;

  if (code === "REAUTH_REQUIRED") {
    return {
      kind: "reauth",
      message: "보안을 위해 비밀번호를 다시 입력한 뒤 바로 삭제해주세요.",
    };
  }

  if (
    status === 401 ||
    code === "AUTH_REQUIRED" ||
    code === "AUTH_INVALID" ||
    code === "ANONYMOUS_NOT_ALLOWED"
  ) {
    return {
      kind: "signed-out",
      message: "로그인이 만료됐어요. 다시 로그인한 뒤 계정을 삭제해주세요.",
    };
  }

  if (code === "ACCOUNT_DELETION_FAILED") {
    return {
      kind: "retry",
      message:
        "계정 삭제를 끝내지 못했어요. 잠시 후 다시 시도하면 남은 부분부터 이어서 삭제해요.",
    };
  }

  return {
    kind: "retry",
    message: "지금은 계정을 삭제할 수 없어요. 잠시 후 다시 시도해주세요.",
  };
};
