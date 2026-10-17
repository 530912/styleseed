// 로그인하지 않은 사용자(guest)의 AI 분석 횟수 제한 — 임시 정책
//
// - 기준: 요청 IP, 1시간 고정 창. 기본 시간당 10회(초기 개발 가설)
// - 서버 메모리에 저장하므로 서버를 재시작하면 초기화된다.
//   영구·사용자별 한도는 PRD 1A-08(SEC-02)에서 대체한다.
// - IP는 Express의 req.ip를 쓴다. "trust proxy"를 켜지 않으면 X-Forwarded-For 같은
//   프록시 헤더는 무시되고 실제 연결 주소만 쓴다(server.js의 TRUST_PROXY 참고).
// - 같은 Wi-Fi(NAT) 사용자는 한도를 함께 쓴다.

const ONE_HOUR_MS = 60 * 60 * 1000;

// 메모리 누수를 막기 위해 기록이 많아지면 만료된 항목을 정리한다
const SWEEP_THRESHOLD = 5000;

const createGuestLimiter = ({
  limit,
  windowMs = ONE_HOUR_MS,
  now = () => Date.now(),
}) => {
  const hits = new Map();

  const sweep = (currentTime) => {
    for (const [key, entry] of hits) {
      if (entry.resetAt <= currentTime) {
        hits.delete(key);
      }
    }
  };

  const middleware = (req, res, next) => {
    if (req.auth?.tier !== "guest") {
      return next();
    }

    const currentTime = now();

    if (hits.size > SWEEP_THRESHOLD) {
      sweep(currentTime);
    }

    const key = req.ip || "unknown";

    let entry = hits.get(key);

    if (!entry || entry.resetAt <= currentTime) {
      entry = { count: 0, resetAt: currentTime + windowMs };

      hits.set(key, entry);
    }

    entry.count += 1;

    if (entry.count > limit) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((entry.resetAt - currentTime) / 1000),
      );

      res.set("Retry-After", String(retryAfterSeconds));

      return res.status(429).json({
        code: "GUEST_RATE_LIMITED",
        message: `로그인하지 않은 상태에서는 시간당 ${limit}회까지 분석할 수 있어요. 로그인하면 바로 계속 분석할 수 있어요.`,
        limit,
        retryAfterSeconds,
      });
    }

    return next();
  };

  middleware.reset = () => hits.clear();

  return middleware;
};

module.exports = { createGuestLimiter };
