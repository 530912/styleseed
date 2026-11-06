import { resetClosetSync } from "../hooks/use-closet-loader";

import { useAnalysisStore } from "../store/useAnalysisStore";

import { useClosetStore } from "../store/useClosetStore";

import { useImagePreferenceStore } from "../store/useImagePreferenceStore";

import { usePendingClothingStore } from "../store/usePendingClothingStore";

import {
  ACCOUNT_DELETE_CONFIRM,
  interpretAccountDeletion,
  type AccountDeletionOutcome,
} from "./accountDeletionPolicy";

import { API_URL } from "./api";

import { buildJsonHeaders } from "./apiErrors";

import { getAuthErrorMessage } from "./authErrors";

import { isSignedIn } from "./sessionPolicy";

import { supabase } from "./supabase";

// 회원 탈퇴 (Beta Launch, PRD FR-AUTH-05 · SEC-09)
// 1) 비밀번호로 다시 로그인 → 서버가 "최근 인증" 토큰인지 확인한다
// 2) 백엔드 /account/delete → Storage 파일, 옷장 데이터, 사용량 기록, 계정 삭제
// 3) 기기에 남은 세션과 옷장 캐시를 지운다
//
// apiPost는 알 수 없는 오류 코드를 일반 오류로 바꾸므로(REAUTH_REQUIRED 등) 여기서는 직접 호출한다.

const DELETE_TIMEOUT_MS = 60_000;

export const clearLocalAccountData = async () => {
  resetClosetSync();

  useClosetStore.getState().clearClothes();

  usePendingClothingStore.getState().clearPendingClothing();

  useImagePreferenceStore.setState({ preferences: {} });

  useAnalysisStore.getState().clearImage();

  // 서버에서 세션이 이미 사라졌으므로 기기의 세션만 지운다
  await supabase.auth.signOut({ scope: "local" });
};

const readJson = async (response: Response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

export const deleteMyAccount = async (
  password: string,
): Promise<AccountDeletionOutcome> => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const email = session?.user?.email;

  if (!isSignedIn(session) || !email) {
    return {
      kind: "signed-out",
      message: "로그인한 계정만 삭제할 수 있어요. 다시 로그인해주세요.",
    };
  }

  const { data: reauth, error: reauthError } =
    await supabase.auth.signInWithPassword({ email, password });

  if (reauthError || !reauth.session) {
    return {
      kind: "reauth",
      message: getAuthErrorMessage(
        reauthError,
        "비밀번호를 확인하지 못했어요. 다시 입력해주세요.",
      ),
    };
  }

  const controller = new AbortController();

  const timer = setTimeout(() => controller.abort(), DELETE_TIMEOUT_MS);

  let response: Response;

  try {
    response = await fetch(`${API_URL}/account/delete`, {
      method: "POST",
      headers: buildJsonHeaders(reauth.session.access_token),
      body: JSON.stringify({ confirm: ACCOUNT_DELETE_CONFIRM }),
      signal: controller.signal,
    });
  } catch {
    return {
      kind: "retry",
      message: "서버에 연결하지 못했어요. 네트워크를 확인한 뒤 다시 시도해주세요.",
    };
  } finally {
    clearTimeout(timer);
  }

  const outcome = interpretAccountDeletion(response.status, await readJson(response));

  if (outcome.kind === "deleted") {
    await clearLocalAccountData();
  }

  return outcome;
};
