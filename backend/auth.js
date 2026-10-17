const { createClient } = require("@supabase/supabase-js");

// 요청 인증 등급 (PRD SEC-01)
// - user:      정식 로그인 토큰
// - anonymous: Supabase 익명 세션 토큰(is_anonymous). 로그인 전 분석에 쓴다
// - guest:     토큰 없음. 임시 호환 모드(ALLOW_TOKENLESS_GUEST)에서만 분석을 허용한다
//
// 토큰이 "있는데 무효"이면 guest로 내려보내지 않고 401로 거절한다.

// Supabase 토큰 검증기. getClaims는 비대칭 서명 키면 JWKS로 직접 검증하고,
// 레거시 대칭 키면 Supabase Auth의 getUser로 확인한다. Secret은 필요 없다.
const createSupabaseTokenVerifier = ({ url, publishableKey }) => {
  if (!url || !publishableKey) {
    console.warn(
      "Supabase URL 또는 Publishable key가 없어 로그인 토큰을 검증할 수 없습니다.",
    );

    return async () => ({ ok: false, reason: "unavailable" });
  }

  const client = createClient(url, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return async (token) => {
    try {
      const { data, error } = await client.auth.getClaims(token);

      if (error) {
        // 네트워크·Auth 서버 장애는 토큰 문제와 구분한다
        const unavailable =
          error.name === "AuthRetryableFetchError" ||
          (typeof error.status === "number" && error.status >= 500);

        return { ok: false, reason: unavailable ? "unavailable" : "invalid" };
      }

      if (!data?.claims?.sub) {
        return { ok: false, reason: "invalid" };
      }

      return { ok: true, claims: data.claims };
    } catch {
      return { ok: false, reason: "unavailable" };
    }
  };
};

// "Bearer <token>"만 인정한다. 헤더가 없으면 null, 형식이 틀리면 ""
const readBearerToken = (req) => {
  const header = req.get("authorization");

  if (!header) {
    return null;
  }

  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());

  return match ? match[1] : "";
};

const sendAuthError = (res, status, code, message) =>
  res.status(status).json({ code, message });

// getVerifier는 요청 시점에 검증기를 가져온다(테스트에서 가짜 검증기로 바꿀 수 있게)
const createAuthenticate =
  ({ getVerifier }) =>
  async (req, res, next) => {
    const token = readBearerToken(req);

    if (token === null) {
      req.auth = { tier: "guest", userId: null, accessToken: null };

      return next();
    }

    if (!token) {
      return sendAuthError(
        res,
        401,
        "AUTH_INVALID",
        "로그인 정보가 올바르지 않습니다. 다시 로그인해주세요.",
      );
    }

    const result = await getVerifier()(token);

    if (!result.ok) {
      // 토큰 값은 로그에 남기지 않는다
      console.warn(`토큰 검증 실패: ${result.reason} (${req.method} ${req.path})`);

      if (result.reason === "unavailable") {
        return sendAuthError(
          res,
          503,
          "AUTH_UNAVAILABLE",
          "로그인 확인이 잠시 지연되고 있습니다. 잠시 후 다시 시도해주세요.",
        );
      }

      return sendAuthError(
        res,
        401,
        "AUTH_INVALID",
        "로그인 정보가 만료되었거나 올바르지 않습니다. 다시 로그인해주세요.",
      );
    }

    // 검증된 토큰은 이후 Supabase 호출(사용량 기록, Storage 서명)에 사용자 권한으로 쓴다
    req.auth = {
      tier: result.claims.is_anonymous === true ? "anonymous" : "user",
      userId: result.claims.sub,
      accessToken: token,
    };

    return next();
  };

// 정식 로그인 사용자만 (이미지 처리·저장 관련)
const requireUser = (req, res, next) => {
  const tier = req.auth?.tier;

  if (tier === "user") {
    return next();
  }

  if (tier === "anonymous") {
    return sendAuthError(
      res,
      403,
      "ANONYMOUS_NOT_ALLOWED",
      "로그인한 사용자만 이용할 수 있습니다.",
    );
  }

  return sendAuthError(res, 401, "AUTH_REQUIRED", "로그인이 필요합니다.");
};

// 분석: user·anonymous 허용. 토큰 없는 guest는 임시 호환 모드에서만 허용
const createAllowAnalyze =
  ({ isTokenlessGuestAllowed }) =>
  (req, res, next) => {
    const tier = req.auth?.tier;

    if (tier === "user" || tier === "anonymous") {
      return next();
    }

    if (tier === "guest" && isTokenlessGuestAllowed()) {
      return next();
    }

    return sendAuthError(res, 401, "AUTH_REQUIRED", "로그인이 필요합니다.");
  };

module.exports = {
  createSupabaseTokenVerifier,
  createAuthenticate,
  createAllowAnalyze,
  requireUser,
  readBearerToken,
};
