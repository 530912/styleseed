const { createClient } = require("@supabase/supabase-js");

// 요청 인증 등급
// - user: 유효한 Supabase 로그인 토큰
// - guest: 토큰 없음. 또는 익명 세션 토큰(is_anonymous). 현재 익명 로그인은 꺼져 있다(PRD FR-AUTH-07)
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
      req.auth = { tier: "guest", userId: null };

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

    const isAnonymous = result.claims.is_anonymous === true;

    req.auth = {
      tier: isAnonymous ? "guest" : "user",
      userId: result.claims.sub,
    };

    return next();
  };

const requireUser = (req, res, next) => {
  if (req.auth?.tier === "user") {
    return next();
  }

  return sendAuthError(res, 401, "AUTH_REQUIRED", "로그인이 필요합니다.");
};

module.exports = {
  createSupabaseTokenVerifier,
  createAuthenticate,
  requireUser,
  readBearerToken,
};
