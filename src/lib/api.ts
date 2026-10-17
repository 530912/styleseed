import { ApiError, buildJsonHeaders, toApiError } from "./apiErrors";

import { getAnalysisAccessToken } from "./sessionPolicy";

import { supabase } from "./supabase";

// 백엔드 주소. 실기기에서는 EXPO_PUBLIC_API_URL에 PC의 LAN 주소나 배포 주소를 넣는다.
export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001"
).replace(/\/+$/, "");

// session: 정식·익명 세션 토큰을 붙인다. 세션이 없으면 익명 세션을 만들고,
//          그것도 실패하면 토큰 없이 보낸다(분석, 로그인 전 체험 보호)
// required: 로그인 토큰이 없으면 요청하지 않는다(이미지 처리)
type AuthMode = "session" | "required";

type ResponseType = "json" | "arrayBuffer";

type ApiPostOptions<R extends ResponseType> = {
  auth: AuthMode;
  timeoutMs: number;
  responseType?: R;
};

type ApiPostResult<R extends ResponseType> = R extends "arrayBuffer"
  ? ArrayBuffer
  : unknown;

// 만료가 가까운 세션은 getSession이 갱신한 뒤 돌려준다
const getAccessToken = async () => {
  const { data } = await supabase.auth.getSession();

  return data.session?.access_token ?? null;
};

const readJson = async (response: Response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

export const apiPost = async <R extends ResponseType = "json">(
  path: string,
  body: unknown,
  { auth, timeoutMs, responseType }: ApiPostOptions<R>,
): Promise<ApiPostResult<R>> => {
  const accessToken =
    auth === "session"
      ? await getAnalysisAccessToken(supabase.auth)
      : await getAccessToken();

  if (auth === "required" && !accessToken) {
    throw new ApiError("AUTH_REQUIRED", { message: "로그인이 필요합니다." });
  }

  const controller = new AbortController();

  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: buildJsonHeaders(accessToken),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(controller.signal.aborted ? "TIMEOUT" : "NETWORK");
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw toApiError(response.status, await readJson(response));
  }

  if (responseType === "arrayBuffer") {
    return (await response.arrayBuffer()) as ApiPostResult<R>;
  }

  return (await readJson(response)) as ApiPostResult<R>;
};
