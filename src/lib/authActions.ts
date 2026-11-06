import type { Session } from "@supabase/supabase-js";

import { isEmailAlreadyRegistered } from "./authErrors";

import { isAnonymousSession, isConvertedFromAnonymous } from "./sessionPolicy";

import { supabase } from "./supabase";

type SignUpResult = {
  // null이면 이메일 인증이 필요한 상태(운영은 현재 이메일 인증이 꺼져 있음)
  session: Session | null;
  // 익명 세션을 같은 사용자 ID의 정식 계정으로 전환했는지
  convertedFromAnonymous: boolean;
};

// 회원가입 (Sprint 1A-2 S2-08)
// - 로그인 전 분석으로 익명 세션이 있으면, 그 사용자를 이메일·비밀번호 계정으로 전환한다
//   (같은 사용자 ID 유지). 전환 후 세션을 새로 받아야 토큰의 익명 표시가 사라진다.
// - 익명 세션이 없거나 전환이 안 되면 기존처럼 새 계정을 만든다.
export const signUpWithEmail = async (
  email: string,
  password: string,
): Promise<SignUpResult> => {
  const {
    data: { session: current },
  } = await supabase.auth.getSession();

  if (isAnonymousSession(current)) {
    const { error } = await supabase.auth.updateUser({ email, password });

    if (error && isEmailAlreadyRegistered(error)) {
      // 이미 가입된 이메일: 기존 계정으로 로그인하도록 안내(회원가입 실패로 표시)
      throw error;
    }

    if (!error) {
      const { data: refreshed, error: refreshError } =
        await supabase.auth.refreshSession();

      if (
        !refreshError &&
        isConvertedFromAnonymous(current, refreshed.session)
      ) {
        return {
          session: refreshed.session,
          convertedFromAnonymous: true,
        };
      }
    }

    console.warn(
      "익명 세션 전환 실패 - 새 계정 가입으로 진행:",
      error?.message ?? "전환 확인 실패",
    );
  }

  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    throw error;
  }

  return { session: data.session, convertedFromAnonymous: false };
};
