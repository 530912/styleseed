// 세션 판단 규칙 (Sprint 1A-2 S2-07·S2-08)
// 외부 모듈을 import하지 않는 순수 함수만 둔다(Node 테스트에서 직접 불러온다).
//
// - 정식 로그인: 세션이 있고 익명이 아님 → 옷장·저장·사진 교체 등 로그인 기능 사용
// - 익명 세션: 로그인 전 분석에만 쓴다. 화면에서는 "로그아웃" 상태와 똑같이 취급한다
// - 세션 없음: 로그아웃 상태

type SessionLike =
  | {
      access_token: string;
      user: { id: string; is_anonymous?: boolean | null };
    }
  | null
  | undefined;

export const isAnonymousSession = (session: SessionLike) =>
  Boolean(session?.user && session.user.is_anonymous === true);

// 로그인 여부 판단은 모두 이 함수를 쓴다(getSession() 결과를 직접 쓰지 않는다)
export const isSignedIn = <S extends SessionLike>(
  session: S,
): session is NonNullable<S> =>
  Boolean(session?.user && session.user.is_anonymous !== true);

type AuthLike = {
  getSession: () => Promise<{ data: { session: SessionLike } }>;
  signInAnonymously: () => Promise<{
    data: { session: SessionLike };
    error: unknown;
  }>;
};

// 분석 요청에 쓸 토큰
// 1) 세션(정식·익명)이 있으면 그 토큰
// 2) 없으면 익명 세션을 새로 만든다(사용자에게 보이지 않음)
// 3) 익명 로그인이 실패해도(장애·한도) null을 돌려 토큰 없이 분석을 계속한다(임시 호환 모드)
export const getAnalysisAccessToken = async (
  auth: AuthLike,
): Promise<string | null> => {
  const { data } = await auth.getSession();

  if (data.session?.access_token) {
    return data.session.access_token;
  }

  try {
    const result = await auth.signInAnonymously();

    if (!result.error && result.data.session?.access_token) {
      return result.data.session.access_token;
    }
  } catch {
    // 아래에서 토큰 없이 진행
  }

  return null;
};

// 익명 → 정식 계정 전환이 끝났는지(같은 사용자 ID, 익명 표시 해제)
export const isConvertedFromAnonymous = (
  before: SessionLike,
  after: SessionLike,
) =>
  Boolean(
    before?.user &&
      after?.user &&
      before.user.id === after.user.id &&
      before.user.is_anonymous === true &&
      after.user.is_anonymous !== true,
  );
