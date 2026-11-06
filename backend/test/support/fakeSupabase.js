// 메모리 가짜 Supabase (Beta Launch 배포 검증 러너 자체 시험용)
//
// supabase-js 2.x가 부르는 경로만 흉내낸다. 실제 보안 규칙(RLS)은 단순화했다:
// - Storage: 첫 폴더 = 토큰 사용자일 때만 업로드·서명·목록·삭제, 관리자 키는 모두 허용
// - Auth: 이메일·비밀번호 가입/로그인, 토큰 → 사용자, 관리자 사용자 조회·삭제
// - Storage 객체를 가진 사용자는 관리자 삭제가 실패한다(실제 Supabase 제약)
// 토큰은 서명 없는 HS256 형태 → supabase-js getClaims가 /auth/v1/user로 확인한다.

const crypto = require("node:crypto");
const http = require("node:http");

const b64url = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

const createFakeSupabase = ({ secretKey = "sb_secret_fake_local" } = {}) => {
  const users = new Map(); // id → { id, email, password }
  const tokens = new Map(); // access token → user id
  const objects = new Map(); // "bucket/path" → { owner, body, contentType }
  const signed = new Map(); // sign token → "bucket/path"
  const usage = new Map(); // user id → count

  const issueSession = (user) => {
    const now = Math.floor(Date.now() / 1000);

    const accessToken = [
      b64url({ alg: "HS256", typ: "JWT" }),
      b64url({
        sub: user.id,
        email: user.email,
        role: "authenticated",
        is_anonymous: false,
        aal: "aal1",
        amr: [{ method: "password", timestamp: now }],
        session_id: crypto.randomUUID(),
        iat: now,
        exp: now + 3600,
      }),
      crypto.randomBytes(16).toString("base64url"),
    ].join(".");

    tokens.set(accessToken, user.id);

    return {
      access_token: accessToken,
      token_type: "bearer",
      expires_in: 3600,
      expires_at: now + 3600,
      refresh_token: crypto.randomBytes(12).toString("hex"),
      user: publicUser(user),
    };
  };

  const publicUser = (user) => ({
    id: user.id,
    aud: "authenticated",
    role: "authenticated",
    email: user.email,
    is_anonymous: false,
    app_metadata: { provider: "email" },
    user_metadata: {},
    created_at: new Date().toISOString(),
  });

  const send = (res, status, body, headers = {}) => {
    res.writeHead(status, { "Content-Type": "application/json", ...headers });
    res.end(body === undefined ? "" : JSON.stringify(body));
  };

  const readBody = (req) =>
    new Promise((resolve) => {
      const chunks = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => resolve(Buffer.concat(chunks)));
    });

  // 요청자: 관리자 키 / 사용자 / 익명(공개 키)
  const caller = (req) => {
    const apikey = req.headers.apikey;

    const bearer = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization ?? "")?.[1];

    if (apikey === secretKey || bearer === secretKey) {
      return { admin: true };
    }

    const userId = bearer ? tokens.get(bearer) : null;

    return userId && users.has(userId) ? { userId } : {};
  };

  const ownerOf = (path) => path.split("/")[0];

  const handler = async (req, res) => {
    const url = new URL(req.url, "http://fake");
    const p = decodeURIComponent(url.pathname);
    const raw = await readBody(req);
    const json = () => {
      try {
        return JSON.parse(raw.toString("utf8") || "{}");
      } catch {
        return {};
      }
    };
    const who = caller(req);

    // ---------- Auth ----------
    if (req.method === "POST" && p === "/auth/v1/signup") {
      const { email, password } = json();

      if ([...users.values()].some((u) => u.email === email)) {
        return send(res, 422, { code: "user_already_exists", msg: "User already registered" });
      }

      const user = { id: crypto.randomUUID(), email, password };

      users.set(user.id, user);

      return send(res, 200, issueSession(user));
    }

    if (req.method === "POST" && p === "/auth/v1/token" && url.searchParams.get("grant_type") === "password") {
      const { email, password } = json();

      const user = [...users.values()].find((u) => u.email === email && u.password === password);

      return user
        ? send(res, 200, issueSession(user))
        : send(res, 400, { code: "invalid_credentials", msg: "Invalid login credentials" });
    }

    if (req.method === "GET" && p === "/auth/v1/user") {
      return who.userId
        ? send(res, 200, publicUser(users.get(who.userId)))
        : send(res, 403, { code: "user_not_found", msg: "User from sub claim in JWT does not exist" });
    }

    const adminUser = /^\/auth\/v1\/admin\/users\/([^/]+)$/.exec(p);

    if (adminUser) {
      if (!who.admin) {
        return send(res, 401, { msg: "admin only" });
      }

      const user = users.get(adminUser[1]);

      if (!user) {
        return send(res, 404, { code: "user_not_found", msg: "User not found" });
      }

      if (req.method === "GET") {
        return send(res, 200, publicUser(user));
      }

      if (req.method === "DELETE") {
        if ([...objects.keys()].some((key) => ownerOf(key.split("/").slice(1).join("/")) === user.id)) {
          return send(res, 500, { code: "unexpected_failure", msg: "user owns storage objects" });
        }

        users.delete(user.id);
        usage.delete(user.id);

        for (const [token, id] of tokens) if (id === user.id) tokens.delete(token);

        return send(res, 200, {});
      }
    }

    // ---------- PostgREST RPC ----------
    if (req.method === "POST" && p === "/rest/v1/rpc/consume_ai_quota") {
      if (!who.userId) {
        return send(res, 401, { message: "not authenticated" });
      }

      const count = (usage.get(who.userId) ?? 0) + 1;

      usage.set(who.userId, count);

      return send(res, 200, [{ used_count: count, window_started_at: new Date().toISOString() }]);
    }

    // 관리자 행 개수 확인(select … count=exact, head=true). 옷 행은 만들지 않으므로 항상 0
    const table = /^\/rest\/v1\/(clothes|ai_usage)$/.exec(p);

    if (table && (req.method === "HEAD" || req.method === "GET")) {
      if (!who.admin) {
        return send(res, 401, { message: "admin only" });
      }

      const userId = (url.searchParams.get("user_id") ?? "").replace(/^eq\./, "");

      const count = table[1] === "ai_usage" && usage.has(userId) ? 1 : 0;

      res.writeHead(200, { "Content-Type": "application/json", "Content-Range": `*/${count}` });

      return res.end(req.method === "HEAD" ? undefined : "[]");
    }

    // ---------- Storage ----------
    const canTouch = (path) => who.admin || (who.userId && ownerOf(path) === who.userId);

    const list = /^\/storage\/v1\/object\/list\/([^/]+)$/.exec(p);

    if (list && req.method === "POST") {
      const bucket = list[1];
      const { prefix = "", limit = 100, offset = 0 } = json();
      const folder = prefix.replace(/\/+$/, "");

      if (!canTouch(`${folder}/x`)) {
        return send(res, 200, []);
      }

      const names = new Map();

      for (const key of objects.keys()) {
        if (!key.startsWith(`${bucket}/${folder}/`)) continue;

        const rest = key.slice(bucket.length + folder.length + 2).split("/");

        names.set(rest[0], rest.length > 1 ? null : crypto.createHash("md5").update(key).digest("hex"));
      }

      const entries = [...names.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(offset, offset + limit)
        .map(([name, id]) => ({ name, id, metadata: id ? { size: 1 } : null }));

      return send(res, 200, entries);
    }

    const sign = /^\/storage\/v1\/object\/sign\/([^/]+)\/(.+)$/.exec(p);

    if (sign && req.method === "POST") {
      const [, bucket, path] = sign;

      if (!canTouch(path) || !objects.has(`${bucket}/${path}`)) {
        return send(res, 400, { statusCode: "404", error: "not_found", message: "Object not found" });
      }

      const token = crypto.randomBytes(12).toString("hex");

      signed.set(token, `${bucket}/${path}`);

      return send(res, 200, { signedURL: `/object/sign/${bucket}/${path}?token=${token}` });
    }

    if (sign && req.method === "GET") {
      const key = signed.get(url.searchParams.get("token"));

      const object = key && objects.get(key);

      if (!object) {
        return send(res, 400, { message: "invalid signature" });
      }

      res.writeHead(200, { "Content-Type": object.contentType });

      return res.end(object.body);
    }

    const removeBucket = /^\/storage\/v1\/object\/([^/]+)$/.exec(p);

    if (removeBucket && req.method === "DELETE") {
      const bucket = removeBucket[1];
      const removed = [];

      for (const path of json().prefixes ?? []) {
        if (canTouch(path) && objects.delete(`${bucket}/${path}`)) {
          removed.push({ name: path });
        }
      }

      return send(res, 200, removed);
    }

    const upload = /^\/storage\/v1\/object\/([^/]+)\/(.+)$/.exec(p);

    if (upload && req.method === "POST") {
      const [, bucket, path] = upload;

      if (!canTouch(path)) {
        return send(res, 403, { statusCode: "403", error: "Unauthorized", message: "new row violates row-level security policy" });
      }

      if (objects.has(`${bucket}/${path}`) && req.headers["x-upsert"] !== "true") {
        return send(res, 409, { statusCode: "409", error: "Duplicate", message: "The resource already exists" });
      }

      objects.set(`${bucket}/${path}`, {
        owner: ownerOf(path),
        body: raw,
        contentType: req.headers["content-type"] ?? "application/octet-stream",
      });

      return send(res, 200, { Key: `${bucket}/${path}`, Id: crypto.randomUUID() });
    }

    return send(res, 404, { message: `fake supabase: ${req.method} ${p} not implemented` });
  };

  const server = http.createServer((req, res) => {
    handler(req, res).catch((error) => send(res, 500, { message: String(error) }));
  });

  return {
    secretKey,
    users,
    objects,
    usage,
    listen: () =>
      new Promise((resolve) => {
        server.listen(0, "127.0.0.1", () => resolve(`http://127.0.0.1:${server.address().port}`));
      }),
    close: () => new Promise((resolve) => server.close(resolve)),
    filesOf: (userId) => [...objects.keys()].filter((key) => key.split("/")[1] === userId),
  };
};

module.exports = { createFakeSupabase };
