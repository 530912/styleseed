// 계정 삭제·웹 삭제 요청 페이지·헬스 체크 (Beta Launch AD-01 ~ AD-20)
// 실제 Supabase에는 연결하지 않는다. 관리자 클라이언트는 메모리 가짜를 쓴다.
process.env.SUPABASE_URL = "https://test-project.supabase.co";
process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
process.env.ALLOWED_ORIGINS = "http://localhost:8081";
delete process.env.SUPABASE_SECRET_KEY;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const test = require("node:test");
const assert = require("node:assert/strict");

const { realFetch, startServer, stopServer, post, captureConsole } = require("./helpers");

const {
  createAdminClientFactory,
  isRecentlyAuthenticated,
  userTag,
} = require("../accountDeletion");

const { escapeHtml } = require("../webPages");

const app = require("../server");

const USER_A = "00000000-0000-4000-8000-0000000000a1";
const USER_B = "00000000-0000-4000-8000-0000000000b2";
const ANON = "00000000-0000-4000-8000-0000000000c3";

const nowSeconds = () => Math.floor(Date.now() / 1000);

// 서명은 가짜 검증기가 대신하므로 payload만 의미가 있다
const makeToken = (claims) =>
  [
    Buffer.from(JSON.stringify({ alg: "ES256" })).toString("base64url"),
    Buffer.from(JSON.stringify(claims)).toString("base64url"),
    "signature",
  ].join(".");

const freshToken = (sub = USER_A) =>
  makeToken({ sub, role: "authenticated", amr: [{ method: "password", timestamp: nowSeconds() - 30 }] });

const staleToken = makeToken({
  sub: USER_A,
  role: "authenticated",
  amr: [{ method: "password", timestamp: nowSeconds() - 3600 }],
});

const noAmrToken = makeToken({ sub: USER_A, role: "authenticated" });

const anonToken = makeToken({
  sub: ANON,
  role: "authenticated",
  is_anonymous: true,
  amr: [{ method: "anonymous", timestamp: nowSeconds() }],
});

const decode = (token) => {
  try {
    return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
};

const fakeVerify = async (token) => {
  const claims = decode(token);

  return claims?.sub ? { ok: true, claims } : { ok: false, reason: "invalid" };
};

// 관리자 Supabase 클라이언트 대역
// - Storage: 경로 집합. list는 바로 아래 파일(id 있음)과 폴더(id null)를 돌려준다
// - Auth: Storage 파일을 가진 사용자는 지울 수 없다(실제 Supabase 제약을 흉내)
const createFakeAdmin = () => {
  const files = new Set();

  const users = new Set();

  const fake = {
    files,
    users,
    deleteCalls: [],
    failList: false,
    failRemove: false,
    failDelete: false,
    deleteDelayMs: 0,
    onDelete: null,
    storage: {
      from: () => ({
        list: async (folder, { limit, offset }) => {
          if (fake.failList) {
            return { data: null, error: { name: "StorageApiError", status: 500 } };
          }

          const prefix = `${folder}/`;

          const names = new Map();

          for (const file of files) {
            if (!file.startsWith(prefix)) continue;

            const rest = file.slice(prefix.length);

            const [head, ...tail] = rest.split("/");

            names.set(head, tail.length > 0 ? null : `id-${head}`);
          }

          const entries = [...names.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([name, id]) => ({ name, id }));

          return { data: entries.slice(offset, offset + limit), error: null };
        },
        remove: async (paths) => {
          if (fake.failRemove) {
            return { data: null, error: { name: "StorageApiError", status: 500 } };
          }

          assert.ok(paths.length <= 100, "한 번에 100개 이하로 지운다");

          for (const path of paths) files.delete(path);

          return { data: paths.map((name) => ({ name })), error: null };
        },
      }),
    },
    auth: {
      admin: {
        deleteUser: async (id, shouldSoftDelete) => {
          fake.deleteCalls.push({ id, shouldSoftDelete });

          if (fake.deleteDelayMs) {
            await new Promise((resolve) => setTimeout(resolve, fake.deleteDelayMs));
          }

          if (fake.failDelete) {
            return { data: null, error: { name: "AuthApiError", status: 500 } };
          }

          if (!users.has(id)) {
            return { data: null, error: { name: "AuthApiError", status: 404, code: "user_not_found" } };
          }

          if ([...files].some((file) => file.startsWith(`${id}/`))) {
            return { data: null, error: { name: "AuthApiError", status: 400, code: "unexpected_failure" } };
          }

          users.delete(id);

          fake.onDelete?.();

          return { data: {}, error: null };
        },
      },
    },
  };

  return fake;
};

const seedUser = (admin, userId, { originals = 2, cutouts = 1, processing = 1 } = {}) => {
  admin.users.add(userId);

  for (let i = 0; i < originals; i += 1) admin.files.add(`${userId}/originals/${1000 + i}.jpg`);
  for (let i = 0; i < cutouts; i += 1) admin.files.add(`${userId}/cutouts/${2000 + i}.png`);
  for (let i = 0; i < processing; i += 1) admin.files.add(`${userId}/processing/${3000 + i}.jpg`);
};

const filesOf = (admin, userId) => [...admin.files].filter((file) => file.startsWith(`${userId}/`));

let server;
let baseUrl;
let admin;

const PASSWORDS = { "a@example.com": { password: "correct-pass", userId: USER_A } };

const fakeVerifyPassword = async (email, password) => {
  const entry = PASSWORDS[email];

  return entry && entry.password === password
    ? { ok: true, userId: entry.userId }
    : { ok: false, reason: "invalid" };
};

const postForm = (path, fields) =>
  realFetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });

test.before(async () => {
  app.locals.verifyToken = fakeVerify;

  ({ server, baseUrl } = await startServer(app));
});

test.after(async () => {
  await stopServer(server);
});

test.beforeEach(() => {
  admin = createFakeAdmin();

  seedUser(admin, USER_A);
  seedUser(admin, USER_B);

  app.locals.getAdminClient = () => admin;
  app.locals.verifyPassword = fakeVerifyPassword;
  app.locals.resetAccountDeletionCounters();
});

const deleteRequest = (token, body = { confirm: "DELETE" }) =>
  post(baseUrl, "/account/delete", { token, body });

test("AD-01 토큰 없이 탈퇴 요청하면 401 AUTH_REQUIRED", async () => {
  const response = await deleteRequest(null);

  assert.equal(response.status, 401);
  assert.equal((await response.json()).code, "AUTH_REQUIRED");
  assert.equal(admin.deleteCalls.length, 0);
});

test("AD-02 익명 세션 토큰은 403 ANONYMOUS_NOT_ALLOWED", async () => {
  const response = await deleteRequest(anonToken);

  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, "ANONYMOUS_NOT_ALLOWED");
});

test("AD-03 무효 토큰은 401 AUTH_INVALID", async () => {
  const response = await deleteRequest("not-a-jwt");

  assert.equal(response.status, 401);
  assert.equal((await response.json()).code, "AUTH_INVALID");
});

test("AD-04 확인 문구가 없으면 400 CONFIRMATION_REQUIRED, 아무것도 지우지 않음", async () => {
  const response = await deleteRequest(freshToken(), {});

  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, "CONFIRMATION_REQUIRED");
  assert.equal(filesOf(admin, USER_A).length, 4);
});

test("AD-05 비밀번호 재확인이 오래됐거나 없으면 401 REAUTH_REQUIRED", async () => {
  for (const token of [staleToken, noAmrToken]) {
    const response = await deleteRequest(token);

    assert.equal(response.status, 401);
    assert.equal((await response.json()).code, "REAUTH_REQUIRED");
  }

  assert.equal(admin.users.has(USER_A), true);
});

test("AD-06 관리자 키가 없으면 503 ACCOUNT_DELETION_UNAVAILABLE", async () => {
  app.locals.getAdminClient = () => null;

  const response = await deleteRequest(freshToken());

  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "ACCOUNT_DELETION_UNAVAILABLE");
});

test("AD-07 정상 탈퇴: 본인 Storage 파일 전부 + Auth 사용자 영구 삭제, 다른 사용자는 그대로", async () => {
  const response = await deleteRequest(freshToken());

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { deleted: true, alreadyDeleted: false });

  assert.equal(filesOf(admin, USER_A).length, 0);
  assert.equal(admin.users.has(USER_A), false);
  assert.deepEqual(admin.deleteCalls, [{ id: USER_A, shouldSoftDelete: false }]);

  assert.equal(filesOf(admin, USER_B).length, 4);
  assert.equal(admin.users.has(USER_B), true);
});

test("AD-08 파일이 많아도(1,000개 초과·하위 폴더) 모두 지운다", async () => {
  seedUser(admin, USER_A, { originals: 1205, cutouts: 150, processing: 0 });
  admin.files.add(`${USER_A}/originals/nested/deep/x.jpg`);

  const response = await deleteRequest(freshToken());

  assert.equal(response.status, 200);
  assert.equal(filesOf(admin, USER_A).length, 0);
  assert.equal(admin.users.has(USER_A), false);
});

test("AD-09 Storage 삭제 실패 → 502 step=storage, 계정 유지 → 재시도하면 완료", async () => {
  admin.failList = true;

  const first = await deleteRequest(freshToken());

  assert.equal(first.status, 502);
  assert.deepEqual(
    { code: (await first.clone().json()).code, step: (await first.json()).step },
    { code: "ACCOUNT_DELETION_FAILED", step: "storage" },
  );
  assert.equal(admin.users.has(USER_A), true);
  assert.equal(admin.deleteCalls.length, 0);

  admin.failList = false;

  const retry = await deleteRequest(freshToken());

  assert.equal(retry.status, 200);
  assert.equal(admin.users.has(USER_A), false);
});

test("AD-10 일부 파일만 지운 뒤 실패해도 재시도로 남은 파일부터 이어서 지운다", async () => {
  admin.failRemove = true;

  const first = await deleteRequest(freshToken());

  assert.equal(first.status, 502);

  // 일부를 손으로 지운 상태(앞선 요청이 중간까지 진행된 경우)
  admin.files.delete(`${USER_A}/originals/1000.jpg`);
  admin.failRemove = false;

  const retry = await deleteRequest(freshToken());

  assert.equal(retry.status, 200);
  assert.equal(filesOf(admin, USER_A).length, 0);
});

test("AD-11 Auth 삭제 실패 → 502 step=auth → 재시도하면 완료", async () => {
  admin.failDelete = true;

  const first = await deleteRequest(freshToken());

  assert.equal(first.status, 502);
  assert.equal((await first.json()).step, "auth");
  assert.equal(admin.users.has(USER_A), true);

  admin.failDelete = false;

  const retry = await deleteRequest(freshToken());

  assert.equal(retry.status, 200);
  assert.equal(admin.users.has(USER_A), false);
});

test("AD-12 이미 삭제된 계정(토큰은 아직 유효)은 200 alreadyDeleted=true, 남은 파일도 정리", async () => {
  admin.users.delete(USER_A);

  const response = await deleteRequest(freshToken());

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { deleted: true, alreadyDeleted: true });
  assert.equal(filesOf(admin, USER_A).length, 0);
});

test("AD-13 같은 사용자의 중복·동시 요청은 한 번만 삭제하고 모두 200", async () => {
  admin.deleteDelayMs = 50;

  const responses = await Promise.all([
    deleteRequest(freshToken()),
    deleteRequest(freshToken()),
    deleteRequest(freshToken()),
  ]);

  assert.deepEqual(responses.map((r) => r.status), [200, 200, 200]);
  assert.equal(admin.deleteCalls.length, 1);

  // 끝난 뒤 다시 보내도 200(이미 삭제)
  const again = await deleteRequest(freshToken());

  assert.equal(again.status, 200);
  assert.equal((await again.json()).alreadyDeleted, true);
});

test("AD-14 삭제 도중 올라간 파일도 마지막 정리에서 지운다", async () => {
  admin.onDelete = () => admin.files.add(`${USER_A}/originals/late-upload.jpg`);

  const response = await deleteRequest(freshToken());

  assert.equal(response.status, 200);
  assert.equal(filesOf(admin, USER_A).length, 0);
});

test("AD-15 로그에 사용자 ID·토큰 원문을 남기지 않는다", async () => {
  const token = freshToken();

  const logs = captureConsole();

  try {
    admin.failDelete = true;
    await deleteRequest(token);
    admin.failDelete = false;
    await deleteRequest(token);
  } finally {
    logs.restore();
  }

  const joined = logs.lines.join("\n");

  assert.ok(joined.includes(userTag(USER_A)), "해시 태그로는 남긴다");
  assert.ok(!joined.includes(USER_A));
  assert.ok(!joined.includes(token));
});

test("AD-16 관리자 클라이언트는 키가 있을 때만 만들어진다", () => {
  assert.equal(createAdminClientFactory({ url: "https://x.supabase.co", secretKey: "" })(), null);
  assert.equal(createAdminClientFactory({ url: "", secretKey: "sb_secret_x" })(), null);
  assert.ok(createAdminClientFactory({ url: "https://x.supabase.co", secretKey: "sb_secret_x" })());
});

test("AD-17 최근 인증 판단 경계값", () => {
  const now = 1_800_000_000;

  assert.equal(isRecentlyAuthenticated({ amr: [{ timestamp: now - 600 }] }, 600, now), true);
  assert.equal(isRecentlyAuthenticated({ amr: [{ timestamp: now - 601 }] }, 600, now), false);
  assert.equal(
    isRecentlyAuthenticated({ amr: [{ timestamp: now - 5000 }, { timestamp: now - 10 }] }, 600, now),
    true,
    "여러 방법 중 가장 최근 시각",
  );
  assert.equal(isRecentlyAuthenticated({ amr: [{ timestamp: now + 3600 }] }, 600, now), false, "미래 시각 거부");
  assert.equal(isRecentlyAuthenticated({ amr: "x" }, 600, now), false);
  assert.equal(isRecentlyAuthenticated(null, 600, now), false);
});

test("AD-18 웹 삭제 페이지: 200 HTML + 보안 헤더 + 검색 제외", async () => {
  const response = await realFetch(`${baseUrl}/account-deletion`);

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/html/);
  assert.match(response.headers.get("content-security-policy"), /default-src 'none'/);
  assert.match(response.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  assert.equal(response.headers.get("x-frame-options"), "DENY");

  const html = await response.text();

  assert.match(html, /계정 삭제 요청/);
  assert.match(html, /noindex/);
  assert.match(html, /삭제되는 정보/);
});

test("AD-19 웹 삭제: 입력 누락 400, 틀린 비밀번호 401(입력값 이스케이프), 맞으면 삭제 완료", async () => {
  const missing = await postForm("/account-deletion", { email: "a@example.com", password: "correct-pass" });

  assert.equal(missing.status, 400);
  assert.equal(admin.users.has(USER_A), true);

  const wrong = await postForm("/account-deletion", {
    email: '"><script>alert(1)</script>',
    password: "nope",
    confirm: "yes",
  });

  assert.equal(wrong.status, 401);

  const wrongHtml = await wrong.text();

  assert.ok(!wrongHtml.includes("<script>alert(1)</script>"));
  assert.ok(wrongHtml.includes(escapeHtml('"><script>alert(1)</script>')));
  assert.match(wrongHtml, /이메일 또는 비밀번호가 올바르지 않습니다/);

  const ok = await postForm("/account-deletion", {
    email: "a@example.com",
    password: "correct-pass",
    confirm: "yes",
  });

  assert.equal(ok.status, 200);
  assert.match(await ok.text(), /계정을 삭제했습니다/);
  assert.equal(admin.users.has(USER_A), false);
  assert.equal(filesOf(admin, USER_A).length, 0);
  assert.equal(admin.users.has(USER_B), true);
});

test("AD-20 웹 삭제: IP당 시간당 5회를 넘으면 429(비밀번호 대입 방지)", async () => {
  const statuses = [];

  for (let i = 0; i < 6; i += 1) {
    const response = await postForm("/account-deletion", {
      email: "a@example.com",
      password: `wrong-${i}`,
      confirm: "yes",
    });

    statuses.push(response.status);
  }

  assert.deepEqual(statuses, [401, 401, 401, 401, 401, 429]);
  assert.equal(admin.users.has(USER_A), true);
});

test("AD-21 GET /healthz 는 인증 없이 200", async () => {
  const response = await realFetch(`${baseUrl}/healthz`);

  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, "ok");
});
