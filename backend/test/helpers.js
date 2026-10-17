// 테스트 공용 도구: 서버를 임의 포트로 띄우고, 가짜 토큰 검증기를 제공한다.
// 실제 Supabase·Gemini에는 연결하지 않는다.

const realFetch = globalThis.fetch;

const startServer = (app) =>
  new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const { port } = server.address();

      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });

const stopServer = (server) =>
  new Promise((resolve) => server.close(() => resolve()));

// 테스트용 토큰 → 검증 결과
const FAKE_TOKENS = {
  "valid-user-token": {
    ok: true,
    claims: { sub: "00000000-0000-4000-8000-00000000000a", role: "authenticated" },
  },
  "anonymous-token": {
    ok: true,
    claims: {
      sub: "00000000-0000-4000-8000-00000000000b",
      role: "authenticated",
      is_anonymous: true,
    },
  },
  "auth-down-token": { ok: false, reason: "unavailable" },
};

const fakeVerifyToken = async (token) =>
  FAKE_TOKENS[token] ?? { ok: false, reason: "invalid" };

const post = (baseUrl, path, { token, body, rawBody, headers = {} } = {}) =>
  realFetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: rawBody ?? JSON.stringify(body ?? {}),
  });

// console 출력 수집(토큰 노출 검사용)
const captureConsole = () => {
  const lines = [];

  const methods = ["log", "warn", "error"];

  const originals = Object.fromEntries(
    methods.map((name) => [name, console[name]]),
  );

  for (const name of methods) {
    console[name] = (...args) => {
      lines.push(args.map(String).join(" "));
    };
  }

  return {
    lines,
    restore: () => {
      for (const name of methods) {
        console[name] = originals[name];
      }
    },
  };
};

module.exports = {
  realFetch,
  startServer,
  stopServer,
  fakeVerifyToken,
  post,
  captureConsole,
};
