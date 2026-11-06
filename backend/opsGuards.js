// 사용자 조사 MVP 운영 보호 장치 (2026-11, 출시 트랙)
//
// 1) inspectImageBase64: Gemini를 부르기 전에 이미지 데이터를 검사한다(R-8, BUG-10)
//    base64가 아니거나 JPEG/PNG/WEBP/HEIC 시그니처가 아니면 Gemini 호출 없이 400 INVALID_IMAGE
// 2) createDailyCap: 서버 전체 Gemini 호출 일일 상한(한국 시간 자정 초기화, 서버 메모리)
//    사용자별 시간당 한도와 별개로, 계정을 여러 개 만들어도 하루 비용이 정해진 값을 넘지 않게 한다
// 3) logEvent / createErrorLogger: 한 줄 JSON 로그(R-9, BUG-11). Railway 로그에서 grep으로 집계한다
//    예) grep '"evt":"http_error"' | grep '"status":5'
//    토큰·이미지·요청 본문은 남기지 않는다.

const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

// 시그니처 → Gemini에 넘길 mimeType
const detectImageMime = (head) => {
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    head.length >= 8 &&
    head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "image/png";
  }

  if (
    head.length >= 12 &&
    head.toString("latin1", 0, 4) === "RIFF" &&
    head.toString("latin1", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }

  // ISO BMFF: 4~8바이트가 "ftyp", 브랜드가 HEIC 계열
  if (head.length >= 12 && head.toString("latin1", 4, 8) === "ftyp") {
    const brand = head.toString("latin1", 8, 12);

    if (["heic", "heix", "heim", "heis"].includes(brand)) {
      return "image/heic";
    }

    if (["mif1", "msf1", "heif"].includes(brand)) {
      return "image/heif";
    }
  }

  return null;
};

// { ok: true, mimeType } 또는 { ok: false, reason }
const inspectImageBase64 = (value) => {
  if (typeof value !== "string" || value.length === 0) {
    return { ok: false, reason: "missing" };
  }

  if (value.length % 4 !== 0 || !BASE64_PATTERN.test(value)) {
    return { ok: false, reason: "not_base64" };
  }

  // 앞 16바이트(base64 24글자)만 풀어 시그니처를 본다
  const mimeType = detectImageMime(Buffer.from(value.slice(0, 24), "base64"));

  if (!mimeType) {
    return { ok: false, reason: "unsupported_format" };
  }

  return { ok: true, mimeType };
};

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

// 서버 전체 일일 상한. limit이 0이면 끈다
const createDailyCap = ({ now = () => Date.now() } = {}) => {
  let dayKey = null;
  let count = 0;

  const currentDay = () => Math.floor((now() + KST_OFFSET_MS) / DAY_MS);

  const roll = () => {
    const day = currentDay();

    if (day !== dayKey) {
      dayKey = day;
      count = 0;
    }
  };

  return {
    // 한 번 쓴다. 상한을 넘으면 쓰지 않고 allowed: false
    take(limit) {
      roll();

      if (limit > 0 && count >= limit) {
        const nextMidnight = (dayKey + 1) * DAY_MS - KST_OFFSET_MS;

        return {
          allowed: false,
          count,
          retryAfterSeconds: Math.max(1, Math.ceil((nextMidnight - now()) / 1000)),
        };
      }

      count += 1;

      return { allowed: true, count };
    },

    snapshot() {
      roll();

      return { count };
    },

    reset() {
      dayKey = null;
      count = 0;
    },
  };
};

const logEvent = (evt, fields = {}) => {
  console.log(JSON.stringify({ ts: new Date().toISOString(), evt, ...fields }));
};

// 400 이상 응답을 한 줄 JSON으로 남긴다. 응답 본문의 code만 읽는다
const createErrorLogger = ({ log = logEvent } = {}) => (req, res, next) => {
  const startedAt = Date.now();

  const originalJson = res.json;

  res.json = function json(body) {
    if (body && typeof body === "object" && typeof body.code === "string") {
      res.locals.errorCode = body.code;
    }

    return originalJson.call(this, body);
  };

  res.on("finish", () => {
    if (res.statusCode < 400) {
      return;
    }

    log("http_error", {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      code: res.locals.errorCode ?? null,
      tier: req.auth?.tier ?? null,
      ms: Date.now() - startedAt,
    });
  });

  next();
};

module.exports = {
  inspectImageBase64,
  createDailyCap,
  logEvent,
  createErrorLogger,
};
