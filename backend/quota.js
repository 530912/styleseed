// AI 분석 호출 한도 (PRD SEC-02, Sprint 1A-2 S2-06)
//
// 1) 익명·토큰 없는 요청: IP 상한(서버 메모리). 익명 세션을 새로 만들어 우회하는 것을 막는다
// 2) 토큰 없는 guest(임시 호환 모드): IP 기준 guest 한도(서버 메모리)
// 3) 익명·정식 사용자: Supabase ai_usage(consume_ai_quota)에 기록 → 서버를 재시작해도 유지
//    저장소에 닿지 못하면 분석을 막지 않고 메모리 한도로 대체한다(경고 로그)
//
// 한도 값은 server.js에서 환경변수로 받는다(운영·QA 별도 설정).

const ONE_HOUR_MS = 60 * 60 * 1000;

// ai_usage 기록: 사용자 본인 토큰으로 함수를 호출한다
const createSupabaseQuotaStore = ({ getUserClient }) => ({
  async consume(accessToken) {
    const { data, error } = await getUserClient(accessToken).rpc(
      "consume_ai_quota",
      { p_kind: "analyze" },
    );

    if (error) {
      throw error;
    }

    const row = Array.isArray(data) ? data[0] : data;

    if (!row || typeof row.used_count !== "number") {
      throw new Error("사용량 응답 형식이 올바르지 않습니다.");
    }

    return {
      used: row.used_count,
      windowStart: new Date(row.window_started_at).getTime(),
    };
  },
});

const sendLimited = (res, { code, limit, retryAfterSeconds, message }) => {
  res.set("Retry-After", String(retryAfterSeconds));

  return res.status(429).json({ code, message, limit, retryAfterSeconds });
};

const guestMessage = (limit) =>
  `로그인하지 않은 상태에서는 시간당 ${limit}회까지 분석할 수 있어요. 로그인하면 바로 계속 분석할 수 있어요.`;

const createAnalyzeQuota = ({
  getConfig,
  getStore,
  ipCounter,
  guestCounter,
  fallbackCounter,
  now = () => Date.now(),
}) => {
  return async (req, res, next) => {
    const { tier, userId, accessToken } = req.auth ?? {};

    const config = getConfig();

    const ipKey = req.ip || "unknown";

    // 1) IP 상한 (정식 사용자는 제외)
    if (tier !== "user") {
      const ip = ipCounter.hit(ipKey, config.ipLimit);

      if (!ip.allowed) {
        return sendLimited(res, {
          code: "GUEST_RATE_LIMITED",
          limit: config.ipLimit,
          retryAfterSeconds: ip.retryAfterSeconds,
          message: guestMessage(config.ipLimit),
        });
      }
    }

    // 2) 토큰 없는 guest
    if (tier === "guest") {
      const guest = guestCounter.hit(ipKey, config.guestLimit);

      if (!guest.allowed) {
        return sendLimited(res, {
          code: "GUEST_RATE_LIMITED",
          limit: config.guestLimit,
          retryAfterSeconds: guest.retryAfterSeconds,
          message: guestMessage(config.guestLimit),
        });
      }

      return next();
    }

    // 3) 익명·정식 사용자: 영구 기록
    const limit =
      tier === "anonymous" ? config.anonymousLimit : config.userLimit;

    const code =
      tier === "anonymous" ? "GUEST_RATE_LIMITED" : "USER_RATE_LIMITED";

    const message =
      tier === "anonymous"
        ? guestMessage(limit)
        : `분석은 시간당 ${limit}회까지 가능해요. 잠시 후 다시 시도해주세요.`;

    let used;
    let retryAfterSeconds;

    try {
      const usage = await getStore().consume(accessToken);

      used = usage.used;

      retryAfterSeconds = Math.max(
        1,
        Math.ceil((usage.windowStart + ONE_HOUR_MS - now()) / 1000),
      );
    } catch (error) {
      console.warn(
        `사용량 저장소 오류 - 메모리 한도로 대체 (${error?.code ?? error?.name ?? "unknown"})`,
      );

      const fallback = fallbackCounter.hit(`${tier}:${userId}`, limit);

      used = fallback.count;
      retryAfterSeconds = fallback.retryAfterSeconds;
    }

    if (used > limit) {
      return sendLimited(res, { code, limit, retryAfterSeconds, message });
    }

    return next();
  };
};

module.exports = { createAnalyzeQuota, createSupabaseQuotaStore };
