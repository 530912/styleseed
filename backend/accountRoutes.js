const express = require("express");

const { createClient } = require("@supabase/supabase-js");

const {
  AccountDeletionError,
  createAccountDeleter,
  createAdminClientFactory,
  isRecentlyAuthenticated,
  readVerifiedClaims,
} = require("./accountDeletion");

const { createFixedWindowCounter } = require("./guestLimiter");

const { renderDeletionPage } = require("./webPages");

// 출시 준비용 라우트 (Beta Launch)
// - GET  /healthz            배포 헬스 체크
// - POST /account/delete     앱 내 회원 탈퇴(정식 로그인 + 최근 비밀번호 확인)
// - GET  /account-deletion   웹 계정 삭제 요청 페이지(Google Play 요구사항)
// - POST /account-deletion   웹에서 이메일·비밀번호로 본인 확인 후 삭제
//
// server.js는 registerAccountRoutes(app, ...) 한 줄만 호출한다(개발 트랙과 충돌을 줄이기 위해 분리).
// 테스트는 app.locals.getAdminClient / app.locals.verifyPassword를 가짜로 바꾼다.

const CONFIRM_PHRASE = "DELETE";

const readPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value ?? "", 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

// 웹 페이지 로그인 확인: Publishable key로 비밀번호 로그인을 시도해 사용자 ID를 얻는다
const createPasswordVerifier = ({ url, publishableKey }) => {
  if (!url || !publishableKey) {
    return async () => ({ ok: false, reason: "unavailable" });
  }

  return async (email, password) => {
    const client = createClient(url, publishableKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    try {
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.status === 429) {
          return { ok: false, reason: "rate_limited" };
        }

        const unavailable =
          error.name === "AuthRetryableFetchError" ||
          (typeof error.status === "number" && error.status >= 500);

        return { ok: false, reason: unavailable ? "unavailable" : "invalid" };
      }

      if (!data?.user?.id) {
        return { ok: false, reason: "invalid" };
      }

      return { ok: true, userId: data.user.id };
    } catch {
      return { ok: false, reason: "unavailable" };
    }
  };
};

const sendWebPage = (res, status, page) => {
  res.set({
    "Content-Security-Policy":
      "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store",
  });

  return res.status(status).type("html").send(page);
};

const registerAccountRoutes = (
  app,
  { authenticate, requireUser, supabaseUrl, publishableKey, env = process.env },
) => {
  app.locals.getAdminClient = createAdminClientFactory({
    url: supabaseUrl,
    secretKey: env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY,
  });

  app.locals.verifyPassword = createPasswordVerifier({
    url: supabaseUrl,
    publishableKey,
  });

  app.locals.accountDeletionConfig = {
    // 삭제 직전 비밀번호 재확인 유효 시간(초)
    reauthMaxAgeSeconds: readPositiveInt(
      env.ACCOUNT_DELETE_REAUTH_MAX_AGE_SECONDS,
      600,
    ),
    // 웹 삭제 페이지의 IP당 시간당 시도 횟수(비밀번호 대입 방지)
    webAttemptsPerHour: readPositiveInt(
      env.ACCOUNT_DELETE_WEB_ATTEMPTS_PER_HOUR,
      5,
    ),
    supportEmail: env.SUPPORT_EMAIL || null,
  };

  const webAttempts = createFixedWindowCounter();

  app.locals.resetAccountDeletionCounters = () => webAttempts.reset();

  const deleteAccount = createAccountDeleter({
    getAdminClient: () => {
      const client = app.locals.getAdminClient();

      if (!client) {
        throw new AccountDeletionError("config");
      }

      return client;
    },
  });

  const parseSmallJson = express.json({ limit: "10kb" });

  const parseSmallForm = express.urlencoded({ extended: false, limit: "10kb" });

  app.get("/healthz", (req, res) => {
    res.set("Cache-Control", "no-store");

    res.json({ status: "ok", uptimeSeconds: Math.round(process.uptime()) });
  });

  // 앱 내 회원 탈퇴
  app.post(
    "/account/delete",
    authenticate,
    requireUser,
    parseSmallJson,
    async (req, res) => {
      if (req.body?.confirm !== CONFIRM_PHRASE) {
        return res.status(400).json({
          code: "CONFIRMATION_REQUIRED",
          message: "계정 삭제 확인이 필요합니다.",
        });
      }

      const claims = readVerifiedClaims(req.auth.accessToken);

      if (
        !isRecentlyAuthenticated(
          claims,
          app.locals.accountDeletionConfig.reauthMaxAgeSeconds,
        )
      ) {
        return res.status(401).json({
          code: "REAUTH_REQUIRED",
          message: "계정을 삭제하려면 비밀번호를 다시 입력해주세요.",
        });
      }

      if (!app.locals.getAdminClient()) {
        console.error("계정 삭제 비활성: SUPABASE_SECRET_KEY가 설정되지 않았습니다.");

        return res.status(503).json({
          code: "ACCOUNT_DELETION_UNAVAILABLE",
          message: "지금은 계정을 삭제할 수 없습니다. 잠시 후 다시 시도해주세요.",
        });
      }

      try {
        const result = await deleteAccount(req.auth.userId);

        return res.json({ deleted: true, alreadyDeleted: result.alreadyDeleted });
      } catch (error) {
        return res.status(502).json({
          code: "ACCOUNT_DELETION_FAILED",
          step: error instanceof AccountDeletionError ? error.step : "unknown",
          message:
            "계정 삭제를 끝내지 못했습니다. 지금까지 지운 내용은 그대로 두고, 다시 시도하면 이어서 삭제합니다.",
        });
      }
    },
  );

  // 웹 계정 삭제 요청 페이지
  app.get("/account-deletion", (req, res) =>
    sendWebPage(
      res,
      200,
      renderDeletionPage({
        state: "form",
        supportEmail: app.locals.accountDeletionConfig.supportEmail,
      }),
    ),
  );

  app.post("/account-deletion", parseSmallForm, async (req, res) => {
    const { supportEmail, webAttemptsPerHour } =
      app.locals.accountDeletionConfig;

    const render = (status, state, extra = {}) =>
      sendWebPage(res, status, renderDeletionPage({ state, supportEmail, ...extra }));

    const email = String(req.body?.email ?? "").trim();

    const password = String(req.body?.password ?? "");

    if (!email || !password || req.body?.confirm !== "yes") {
      return render(400, "form", {
        email,
        error: "이메일, 비밀번호를 입력하고 삭제 확인에 체크해주세요.",
      });
    }

    const attempt = webAttempts.hit(req.ip || "unknown", webAttemptsPerHour);

    if (!attempt.allowed) {
      res.set("Retry-After", String(attempt.retryAfterSeconds));

      return render(429, "form", {
        email,
        error: "시도 횟수가 너무 많습니다. 1시간 뒤에 다시 시도해주세요.",
      });
    }

    if (!app.locals.getAdminClient()) {
      console.error("계정 삭제 비활성: SUPABASE_SECRET_KEY가 설정되지 않았습니다.");

      return render(503, "form", {
        email,
        error: "지금은 계정을 삭제할 수 없습니다. 잠시 후 다시 시도해주세요.",
      });
    }

    const verified = await app.locals.verifyPassword(email, password);

    if (!verified.ok) {
      const message =
        verified.reason === "invalid"
          ? "이메일 또는 비밀번호가 올바르지 않습니다."
          : verified.reason === "rate_limited"
            ? "로그인 시도가 많습니다. 잠시 후 다시 시도해주세요."
            : "본인 확인이 잠시 지연되고 있습니다. 잠시 후 다시 시도해주세요.";

      return render(verified.reason === "invalid" ? 401 : 503, "form", {
        email,
        error: message,
      });
    }

    try {
      await deleteAccount(verified.userId);

      return render(200, "done");
    } catch {
      return render(502, "form", {
        email,
        error:
          "계정 삭제를 끝내지 못했습니다. 잠시 후 같은 정보로 다시 시도하면 이어서 삭제합니다.",
      });
    }
  });
};

module.exports = { registerAccountRoutes, CONFIRM_PHRASE };
