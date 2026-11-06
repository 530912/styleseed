// 계정 삭제 실연동 E2E — QA Supabase 프로젝트 전용 (Beta Launch AD-E1 ~ E3)
//
// QA 프로젝트의 관리자 키(Secret key)가 있어야 실행된다. 없으면 건너뛴다(다른 E2E 실행에 영향 없음).
// 운영 프로젝트 주소면 실행을 거부한다.
//
// 실행:
//   E2E_SUPABASE_URL=https://<qa-ref>.supabase.co \
//   E2E_SUPABASE_PUBLISHABLE_KEY=sb_publishable_... \
//   E2E_SUPABASE_SECRET_KEY=sb_secret_... \
//   node --test backend/test/e2e/account-deletion.e2e.js
//
// 확인하는 것: 실제 토큰의 amr(최근 인증) 형식, Storage → Auth 삭제 순서, clothes·ai_usage 연쇄 삭제,
// 웹 삭제 페이지의 비밀번호 확인. 테스트 계정은 삭제 자체가 정리다(남지 않음).

const PROD_REF = "zkgsxavpyvxhrivzmqsp";

const qaUrl = process.env.E2E_SUPABASE_URL;
const qaKey = process.env.E2E_SUPABASE_PUBLISHABLE_KEY;
const qaSecret = process.env.E2E_SUPABASE_SECRET_KEY;

const test = require("node:test");

const skip = !qaUrl || !qaKey || !qaSecret ? "QA 관리자 키(E2E_SUPABASE_SECRET_KEY) 없음" : false;

if (qaUrl?.includes(PROD_REF)) {
  throw new Error("운영 Supabase 프로젝트에는 E2E를 실행하지 않습니다.");
}

if (!skip) {
  process.env.SUPABASE_URL = qaUrl;
  process.env.SUPABASE_PUBLISHABLE_KEY = qaKey;
  process.env.SUPABASE_SECRET_KEY = qaSecret;
}

const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const sharp = require("sharp");
const { createClient } = require("@supabase/supabase-js");

const BUCKET = "clothing-images";

const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

const state = { server: null, baseUrl: null };

const newUser = () => ({
  email: `e2e-delete-${Date.now().toString(36)}${crypto.randomBytes(2).toString("hex")}@example.com`,
  password: `E2e-${crypto.randomBytes(9).toString("base64url")}`,
});

// 가입 → 사진 2장·옷 1벌·사용량 1회를 만든다
const seedAccount = async () => {
  const creds = newUser();
  const client = createClient(qaUrl, qaKey, options);

  const { data, error } = await client.auth.signUp(creds);
  assert.ifError(error);
  assert.ok(data.session, "QA 프로젝트는 이메일 인증 꺼짐");

  const userId = data.user.id;
  const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#888" } }).png().toBuffer();

  for (const filePath of [`${userId}/originals/e2e.png`, `${userId}/cutouts/e2e.png`]) {
    const { error: uploadError } = await client.storage.from(BUCKET).upload(filePath, png, { contentType: "image/png" });
    assert.ifError(uploadError);
  }

  const { error: insertError } = await client.from("clothes").insert({
    user_id: userId, category: "top", sub_category: "t-shirt", color: "white", color_tone: "neutral",
    fit: "regular", material: "cotton", season: ["summer"], tpo: ["daily"], style: ["casual"],
    original_image_path: `${userId}/originals/e2e.png`,
  });
  assert.ifError(insertError);

  const { error: quotaError } = await client.rpc("consume_ai_quota", { p_kind: "analyze" });
  assert.ifError(quotaError);

  return { creds, userId, client, session: data.session };
};

const assertFullyDeleted = async (userId) => {
  const admin = createClient(qaUrl, qaSecret, options);

  const { data: user, error: userError } = await admin.auth.admin.getUserById(userId);
  assert.ok(userError || !user?.user, "Auth 사용자가 남아 있으면 안 된다");

  for (const folder of ["originals", "cutouts", "processing"]) {
    const { data } = await admin.storage.from(BUCKET).list(`${userId}/${folder}`);
    assert.equal(data?.length ?? 0, 0, `Storage ${folder}`);
  }

  const { count: clothes } = await admin.from("clothes").select("id", { count: "exact", head: true }).eq("user_id", userId);
  assert.equal(clothes, 0, "clothes");

  const { count: usage, error: usageError } = await admin
    .from("ai_usage").select("user_id", { count: "exact", head: true }).eq("user_id", userId);
  assert.ifError(usageError);
  assert.equal(usage, 0, "ai_usage");
};

test.before(async () => {
  if (skip) return;

  const app = require("../../server");

  await new Promise((resolve) => {
    state.server = app.listen(0, "127.0.0.1", () => {
      state.baseUrl = `http://127.0.0.1:${state.server.address().port}`;
      resolve();
    });
  });
});

test.after(async () => {
  if (state.server) await new Promise((resolve) => state.server.close(resolve));
});

test("AD-E1 실제 토큰에 amr 시각이 있고, 앱 탈퇴로 Auth·Storage·clothes·ai_usage가 모두 지워진다", { skip }, async () => {
  const { userId, session } = await seedAccount();

  const claims = JSON.parse(Buffer.from(session.access_token.split(".")[1], "base64url").toString("utf8"));
  assert.ok(Array.isArray(claims.amr) && Number.isFinite(Number(claims.amr[0]?.timestamp)), "amr 형식");

  const response = await fetch(`${state.baseUrl}/account/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ confirm: "DELETE" }),
  });

  assert.equal(response.status, 200, await response.clone().text());
  await assertFullyDeleted(userId);

  // 같은 토큰으로 다시 보내도(아직 만료 전) 성공으로 끝난다
  const again = await fetch(`${state.baseUrl}/account/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ confirm: "DELETE" }),
  });
  assert.ok([200, 401].includes(again.status), `재요청 ${again.status}`);
});

test("AD-E2 웹 삭제 페이지: 틀린 비밀번호는 거절, 맞으면 전부 삭제", { skip }, async () => {
  const { creds, userId } = await seedAccount();

  const form = (password) =>
    fetch(`${state.baseUrl}/account-deletion`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ email: creds.email, password, confirm: "yes" }).toString(),
    });

  assert.equal((await form("wrong-password")).status, 401);

  const ok = await form(creds.password);
  assert.equal(ok.status, 200);
  await assertFullyDeleted(userId);
});

test("AD-E3 다른 사용자의 데이터는 지우지 않는다", { skip }, async () => {
  const victim = await seedAccount();
  const attacker = await seedAccount();

  const response = await fetch(`${state.baseUrl}/account/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${attacker.session.access_token}` },
    body: JSON.stringify({ confirm: "DELETE" }),
  });
  assert.equal(response.status, 200);
  await assertFullyDeleted(attacker.userId);

  const { data } = await victim.client.storage.from(BUCKET).list(`${victim.userId}/originals`);
  assert.equal(data?.length, 1, "피해자 파일 유지");

  // 정리: 피해자 계정도 삭제
  const cleanup = await fetch(`${state.baseUrl}/account/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${victim.session.access_token}` },
    body: JSON.stringify({ confirm: "DELETE" }),
  });
  assert.equal(cleanup.status, 200);
});
