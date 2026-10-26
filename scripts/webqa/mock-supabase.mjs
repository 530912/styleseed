// 웹 QA용 가짜 Supabase (127.0.0.1만 열림). 실제 Supabase·운영 DB에는 연결하지 않는다.
// 시험 단계 기록: GET /__ping/<단계> → /__state의 log에 남는다(실제 Safari 회귀 시험이 씀)
// Auth(가입·로그인·익명·갱신·로그아웃·사용자), REST(clothes CRUD, consume_ai_quota), Storage(업로드·서명 URL·삭제)
// 사용자별 접근 제한(RLS 흉내): clothes는 본인 행만, Storage는 첫 폴더가 본인 id인 경로만.
import http from "node:http";
import crypto from "node:crypto";

const PORT = Number(process.env.MOCK_PORT ?? 54321);
const users = new Map(); // id -> {id,email,password,is_anonymous}
const tokens = new Map(); // access token -> user id
const refresh = new Map(); // refresh token -> user id
const rows = []; // clothes
const objects = new Map(); // path -> {type, data}
const quota = new Map();
let nextId = 1000;
const log = [];

const b64u = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
const userJson = (u) => ({
  id: u.id, aud: "authenticated", role: "authenticated", email: u.email ?? "", is_anonymous: Boolean(u.is_anonymous),
  app_metadata: { provider: u.is_anonymous ? "anonymous" : "email" }, user_metadata: {}, created_at: new Date().toISOString(),
});
const issue = (u) => {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const access = `${b64u({ alg: "HS256", typ: "JWT" })}.${b64u({ sub: u.id, role: "authenticated", aud: "authenticated", exp, is_anonymous: Boolean(u.is_anonymous), email: u.email ?? "" })}.mock`;
  const rt = crypto.randomUUID();
  tokens.set(access, u.id);
  refresh.set(rt, u.id);
  return { access_token: access, token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token: rt, user: userJson(u) };
};
const authUser = (req) => {
  const m = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization ?? "");
  const id = m ? tokens.get(m[1]) : null;
  return id ? users.get(id) : null;
};
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS", "Access-Control-Expose-Headers": "*" };
const send = (res, status, body, type = "application/json") => {
  res.writeHead(status, { "Content-Type": type, ...cors });
  res.end(body === undefined ? "" : type === "application/json" ? JSON.stringify(body) : body);
};
const eqParam = (url, key) => {
  const v = url.searchParams.get(key);
  return v && v.startsWith("eq.") ? v.slice(3) : null;
};
const wantsObject = (req) => String(req.headers.accept ?? "").includes("vnd.pgrst.object");
const pick = (row, select) => {
  if (!select || select === "*") return row;
  return Object.fromEntries(select.split(",").map((k) => [k.trim(), row[k.trim()]]));
};

const server = http.createServer((req, res) => {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    const raw = Buffer.concat(chunks);
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    const p = url.pathname;
    log.push(`${req.method} ${p}`);
    if (req.method === "OPTIONS") return send(res, 204);
    const json = () => { try { return JSON.parse(raw.toString() || "{}"); } catch { return {}; } };

    // ---- 상태 확인(테스트용) ----
    if (p === "/__state") return send(res, 200, { users: [...users.values()].map((u) => ({ id: u.id, email: u.email, anon: u.is_anonymous })), rows, objects: [...objects.keys()], log: log.slice(-200) });

    // ---- Auth ----
    if (p === "/auth/v1/signup" && req.method === "POST") {
      const body = json();
      if (!body.email) {
        const u = { id: crypto.randomUUID(), is_anonymous: true };
        users.set(u.id, u);
        return send(res, 200, issue(u));
      }
      if ([...users.values()].some((u) => u.email === body.email)) return send(res, 422, { code: "user_already_exists", msg: "User already registered" });
      if (!body.password || body.password.length < 6) return send(res, 422, { code: "weak_password", msg: "Password should be at least 6 characters." });
      const u = { id: crypto.randomUUID(), email: body.email, password: body.password, is_anonymous: false };
      users.set(u.id, u);
      return send(res, 200, issue(u));
    }
    if (p === "/auth/v1/token" && req.method === "POST") {
      const body = json();
      if (url.searchParams.get("grant_type") === "password") {
        const u = [...users.values()].find((x) => x.email === body.email && x.password === body.password);
        return u ? send(res, 200, issue(u)) : send(res, 400, { code: "invalid_credentials", error: "invalid_grant", error_description: "Invalid login credentials", msg: "Invalid login credentials" });
      }
      if (url.searchParams.get("grant_type") === "refresh_token") {
        const id = refresh.get(body.refresh_token);
        return id ? send(res, 200, issue(users.get(id))) : send(res, 400, { code: "refresh_token_not_found", msg: "Invalid Refresh Token" });
      }
    }
    if (p === "/auth/v1/user" && req.method === "GET") {
      const u = authUser(req);
      return u ? send(res, 200, userJson(u)) : send(res, 401, { code: "bad_jwt", msg: "invalid JWT" });
    }
    // 익명 → 정식 계정 전환(이메일 인증 끔과 같게 바로 반영)
    if (p === "/auth/v1/user" && req.method === "PUT") {
      const u = authUser(req);
      if (!u) return send(res, 401, { code: "bad_jwt", msg: "invalid JWT" });
      const body = json();
      if (body.email && [...users.values()].some((x) => x.email === body.email && x.id !== u.id)) return send(res, 422, { code: "email_exists", msg: "A user with this email address has already been registered" });
      Object.assign(u, body.email ? { email: body.email, is_anonymous: false } : {}, body.password ? { password: body.password } : {});
      return send(res, 200, userJson(u));
    }
    if (p === "/auth/v1/logout") return send(res, 204);

    const me = authUser(req);

    // ---- REST ----
    if (p === "/rest/v1/rpc/consume_ai_quota") {
      if (!me) return send(res, 401, { message: "JWT required" });
      const used = (quota.get(me.id) ?? 0) + 1;
      quota.set(me.id, used);
      return send(res, 200, [{ used_count: used, window_started_at: new Date().toISOString() }]);
    }
    if (p === "/rest/v1/clothes") {
      if (!me || me.is_anonymous) return send(res, 401, { message: "permission denied" });
      const id = eqParam(url, "id");
      const mine = rows.filter((r) => r.user_id === me.id && (!id || String(r.id) === id));
      const select = url.searchParams.get("select");
      if (req.method === "GET") {
        const out = mine.sort((a, b) => b.created_at.localeCompare(a.created_at)).map((r) => pick(r, select));
        if (wantsObject(req)) return out.length === 1 ? send(res, 200, out[0]) : send(res, 406, { code: "PGRST116", message: "no rows" });
        return send(res, 200, out);
      }
      if (req.method === "POST") {
        const body = json();
        const list = Array.isArray(body) ? body : [body];
        const created = list.map((r) => {
          if (r.user_id !== me.id) return null;
          const row = { ...r, id: nextId++, created_at: new Date(Date.now() + nextId).toISOString() };
          rows.push(row);
          return row;
        });
        if (created.includes(null)) return send(res, 403, { message: "new row violates row-level security policy" });
        const out = created.map((r) => pick(r, select));
        return wantsObject(req) ? send(res, 201, out[0]) : send(res, 201, out);
      }
      if (req.method === "PATCH") {
        const body = json();
        mine.forEach((r) => Object.assign(r, body, { user_id: r.user_id, id: r.id }));
        return send(res, 200, mine.map((r) => pick(r, select ?? "id")));
      }
      if (req.method === "DELETE") {
        for (const r of mine) rows.splice(rows.indexOf(r), 1);
        return send(res, 200, mine.map((r) => pick(r, select ?? "id")));
      }
    }

    // ---- Storage ----
    const BUCKET = "clothing-images";
    const signPrefix = `/storage/v1/object/sign/${BUCKET}/`;
    const objPrefix = `/storage/v1/object/${BUCKET}/`;
    const owns = (path) => me && !me.is_anonymous && path.split("/")[0] === me.id;
    if (p.startsWith(signPrefix) && req.method === "POST") {
      const path = decodeURIComponent(p.slice(signPrefix.length));
      if (!owns(path)) return send(res, 400, { statusCode: "403", error: "Unauthorized", message: "new row violates row-level security policy" });
      if (!objects.has(path)) return send(res, 400, { statusCode: "404", error: "not_found", message: "Object not found" });
      return send(res, 200, { signedURL: `/object/sign/${BUCKET}/${encodeURIComponent(path).replace(/%2F/g, "/")}?token=mock-${crypto.randomUUID()}` });
    }
    if (p.startsWith(signPrefix) && req.method === "GET") {
      const obj = objects.get(decodeURIComponent(p.slice(signPrefix.length)));
      return obj ? send(res, 200, obj.data, obj.type) : send(res, 404, { message: "not found" });
    }
    if (p.startsWith(objPrefix) && (req.method === "POST" || req.method === "PUT")) {
      const path = decodeURIComponent(p.slice(objPrefix.length));
      if (!owns(path)) return send(res, 403, { statusCode: "403", error: "Unauthorized", message: "new row violates row-level security policy" });
      objects.set(path, { type: req.headers["content-type"] ?? "application/octet-stream", data: raw });
      return send(res, 200, { Key: `${BUCKET}/${path}`, Id: crypto.randomUUID() });
    }
    if (p === `/storage/v1/object/${BUCKET}` && req.method === "DELETE") {
      const { prefixes = [] } = json();
      const removed = prefixes.filter((path) => owns(path) && objects.delete(path));
      return send(res, 200, removed.map((name) => ({ name })));
    }
    return send(res, 404, { message: "mock: not implemented", path: p, method: req.method });
  });
});
// 실제 Supabase(프록시 뒤)처럼 연결을 오래 유지한다. Node 기본 5초는 WebKit이 연결을 재사용할 때 끊겨 "Load failed"를 낸다
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;
server.listen(PORT, "127.0.0.1", () => console.log(`full mock supabase on ${PORT}`));
