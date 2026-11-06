// 서버 메모리 고정 창(1시간) 카운터
//
// 쓰임:
// - IP 상한: 익명·토큰 없는 요청을 IP 기준으로 제한(익명 세션을 계속 새로 만들어 우회하는 것 방지)
// - 토큰 없는 guest 한도: 임시 호환 모드(ALLOW_TOKENLESS_GUEST)
// - 사용량 저장소(Supabase) 장애 시 대체 한도
//
// 영구 한도는 backend/quota.js(ai_usage 테이블)가 담당한다. 여기 값은 서버를 재시작하면 초기화된다.
// IP는 Express의 req.ip를 쓴다. "trust proxy"를 켜지 않으면 X-Forwarded-For 같은
// 프록시 헤더는 무시되고 실제 연결 주소만 쓴다(server.js의 TRUST_PROXY 참고).

const ONE_HOUR_MS = 60 * 60 * 1000;

// 메모리 누수를 막기 위해 기록이 많아지면 만료된 항목을 정리한다
const SWEEP_THRESHOLD = 5000;

const createFixedWindowCounter = ({
  windowMs = ONE_HOUR_MS,
  now = () => Date.now(),
} = {}) => {
  const hits = new Map();

  const sweep = (currentTime) => {
    for (const [key, entry] of hits) {
      if (entry.resetAt <= currentTime) {
        hits.delete(key);
      }
    }
  };

  // key의 횟수를 1 늘리고 limit 이내인지 돌려준다
  const hit = (key, limit) => {
    const currentTime = now();

    if (hits.size > SWEEP_THRESHOLD) {
      sweep(currentTime);
    }

    let entry = hits.get(key);

    if (!entry || entry.resetAt <= currentTime) {
      entry = { count: 0, resetAt: currentTime + windowMs };

      hits.set(key, entry);
    }

    entry.count += 1;

    return {
      allowed: entry.count <= limit,
      count: entry.count,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((entry.resetAt - currentTime) / 1000),
      ),
    };
  };

  return { hit, reset: () => hits.clear() };
};

module.exports = { createFixedWindowCounter, ONE_HOUR_MS };
