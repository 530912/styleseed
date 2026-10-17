// Sprint 1A-2 실연동 E2E — QA Supabase 프로젝트 전용
//
// 전제(QA 프로젝트): 1A-1 기준 정책 + Sprint 1A-2 마이그레이션 적용, 이메일 인증 꺼짐, 익명 로그인 켜짐.
// 실행: E2E_SUPABASE_URL=... E2E_SUPABASE_PUBLISHABLE_KEY=... npm run test:e2e
// 테스트가 만든 옷 행·Storage 파일은 끝에서 지운다. Auth 사용자·ai_usage 행은 권한이 없어 QA에 남는다.

const PROD_REF = "zkgsxavpyvxhrivzmqsp";

const qaUrl = process.env.E2E_SUPABASE_URL;
const qaKey = process.env.E2E_SUPABASE_PUBLISHABLE_KEY;

if (!qaUrl || !qaKey) {
  throw new Error("E2E_SUPABASE_URL / E2E_SUPABASE_PUBLISHABLE_KEY가 필요합니다.");
}

if (qaUrl.includes(PROD_REF)) {
  throw new Error("운영 Supabase 프로젝트에는 E2E를 실행하지 않습니다.");
}

process.env.SUPABASE_URL = qaUrl;
process.env.SUPABASE_PUBLISHABLE_KEY = qaKey;
process.env.ANON_ANALYZE_LIMIT_PER_HOUR = "3";
process.env.USER_ANALYZE_LIMIT_PER_HOUR = "50";
process.env.IP_ANALYZE_LIMIT_PER_HOUR = "500";
process.env.GUEST_ANALYZE_LIMIT_PER_HOUR = "50";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const sharp = require("sharp");
const { createClient } = require("@supabase/supabase-js");

const app = require("../../server");

const BUCKET = "clothing-images";
const RUN_ID = `${Date.now().toString(36)}${crypto.randomBytes(2).toString("hex")}`;
const LOAFER = path.join(__dirname, "../../../assets/images/products/brown-loafer.jpg");

const newClient = () =>
  createClient(qaUrl, qaKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

const newCredentials = (label) => ({
  email: `qa-${RUN_ID}-${label}@styleseed-qa.dev`,
  password: crypto.randomBytes(18).toString("base64url"),
});

const state = { server: null, baseUrl: null, cleanup: [] };
const report = {};
const record = (key, value) => {
  report[key] = value;
};

const listen = () =>
  new Promise((resolve) => {
    state.server = app.listen(0, "127.0.0.1", () => {
      state.baseUrl = `http://127.0.0.1:${state.server.address().port}`;
      resolve();
    });
  });

const api = (route, { token, body } = {}) =>
  fetch(`${state.baseUrl}${route}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body ?? {}),
  });

// 정식 사용자 생성(정리 대상 등록)
const createUser = async (label) => {
  const client = newClient();
  const creds = newCredentials(label);
  const { data, error } = await client.auth.signUp(creds);
  assert.ifError(error);
  assert.ok(data.session);
  const user = { client, creds, session: data.session, userId: data.user.id };
  state.cleanup.push(user);
  return user;
};

const createAnonymous = async () => {
  const client = newClient();
  const { data, error } = await client.auth.signInAnonymously();
  assert.ifError(error);
  return { client, session: data.session, userId: data.user.id };
};

// 실제 Gemini 분석(혼잡 503·지연 504는 재시도)
const analyzeLoafer = async (token) => {
  const imageBase64 = fs.readFileSync(LOAFER).toString("base64");
  let response;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    response = await api("/analyze-clothing", { token, body: { imageBase64 } });
    if (![503, 504].includes(response.status)) break;
    await new Promise((resolve) => setTimeout(resolve, 15000));
  }
  return { status: response.status, body: await response.json() };
};

// Gemini 무료 등급 일일 한도(429 AI_RATE_LIMITED)에 걸리면 쓰는 대체 분석값.
// box2d는 2026-10-17 실제 Gemini가 brown-loafer.jpg에 돌려준 값이다.
const LOAFER_FIXTURE = {
  category: "shoes",
  subCategory: "loafer",
  color: "brown",
  colorTone: "warm",
  fit: "regular",
  material: "leather",
  season: ["spring", "fall"],
  tpo: ["daily"],
  style: ["classic"],
  box2d: [269, 58, 856, 942],
};

// 분석 단계: 익명·정식 토큰이 분석 경로를 통과하는지는 항상 확인하고,
// Gemini 일일 한도 때문에 결과를 못 받으면 대체 분석값으로 저장 단계를 계속 검증한다
const analyzeOrFixture = async (token, label) => {
  const result = await analyzeLoafer(token);

  if (result.status === 200) {
    record(`${label}_analysis`, "gemini");
    return result.body;
  }

  assert.equal(result.status, 429, JSON.stringify(result.body).slice(0, 200));
  assert.equal(result.body.code, "AI_RATE_LIMITED", "Gemini 한도 외의 429는 실패로 본다");
  record(`${label}_analysis`, "fixture (Gemini 일일 한도 소진)");
  return LOAFER_FIXTURE;
};

const cutoutQuality = async (buffer, original, box2d) => {
  const meta = await sharp(buffer).metadata();
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let transparent = 0;
  for (let i = 3; i < data.length; i += info.channels) if (data[i] < 16) transparent += 1;
  const { width, height } = await sharp(original).metadata();
  const [y1, x1, y2, x2] = box2d;
  const boxArea = ((x2 - x1) / 1000) * width * (((y2 - y1) / 1000) * height);
  return {
    format: meta.format,
    hasAlpha: Boolean(meta.hasAlpha),
    size: [info.width, info.height],
    transparentRatio: Number((transparent / (info.width * info.height)).toFixed(3)),
    coverageOfBox: Number(((info.width * info.height) / boxArea).toFixed(3)),
  };
};

const isGoodCutout = (q) =>
  q.format === "png" && q.hasAlpha && q.transparentRatio > 0.05 && q.transparentRatio < 0.95 && q.coverageOfBox >= 0.25;

// 앱 saveClothingToSupabase와 같은 순서(Storage 경로 방식)
const saveWithCutout = async (user, analysis) => {
  const original = fs.readFileSync(LOAFER);
  const originalPath = `${user.userId}/originals/${Date.now()}.jpg`;
  const up = await user.client.storage.from(BUCKET).upload(originalPath, original, { contentType: "image/jpeg" });
  assert.ifError(up.error);

  const sam = await api("/segment-garment-local", {
    token: user.session.access_token,
    body: { imagePath: originalPath, box2d: analysis.box2d },
  });
  assert.equal(sam.status, 200, `SlimSAM ${sam.status}`);
  const cutout = Buffer.from(await sam.arrayBuffer());
  const quality = await cutoutQuality(cutout, original, analysis.box2d);
  assert.ok(isGoodCutout(quality), JSON.stringify(quality));

  const cutoutPath = `${user.userId}/cutouts/${Date.now()}.png`;
  const upCut = await user.client.storage.from(BUCKET).upload(cutoutPath, cutout, { contentType: "image/png" });
  assert.ifError(upCut.error);

  const { data, error } = await user.client
    .from("clothes")
    .insert({
      user_id: user.userId,
      category: analysis.category,
      sub_category: analysis.subCategory,
      color: analysis.color,
      color_tone: analysis.colorTone,
      fit: analysis.fit,
      material: analysis.material,
      season: analysis.season,
      tpo: analysis.tpo,
      style: analysis.style,
      original_image_path: originalPath,
      cutout_image_path: cutoutPath,
    })
    .select("id, user_id")
    .single();
  assert.ifError(error);

  return { row: data, originalPath, quality };
};

test.before(listen);

test.after(async () => {
  for (const user of state.cleanup) {
    if (!user.session) continue;
    const client = newClient();
    const { error } = await client.auth.signInWithPassword(user.creds);
    if (error) continue;
    await client.from("clothes").delete().eq("user_id", user.userId);
    for (const folder of ["originals", "cutouts", "processing"]) {
      const prefix = `${user.userId}/${folder}`;
      const { data } = await client.storage.from(BUCKET).list(prefix);
      if (data?.length) await client.storage.from(BUCKET).remove(data.map((f) => `${prefix}/${f.name}`));
    }
  }
  await new Promise((resolve) => state.server.close(resolve));
  if (process.env.E2E_REPORT_PATH) fs.writeFileSync(process.env.E2E_REPORT_PATH, JSON.stringify(report, null, 2));
  console.log("E2E_REPORT", JSON.stringify(report));
});

test("T2-01/T2-03 익명 세션: 분석은 허용, 이미지 처리 4종은 403 ANONYMOUS_NOT_ALLOWED", async () => {
  const anon = await createAnonymous();
  assert.equal(anon.session.user.is_anonymous, true);
  const token = anon.session.access_token;

  assert.equal((await api("/analyze-clothing", { token })).status, 400);

  const codes = {};
  for (const route of ["/segment-garment", "/segment-garment-local", "/apply-garment-mask", "/remove-background"]) {
    const response = await api(route, { token, body: { imagePath: `${anon.userId}/originals/x.jpg` } });
    codes[route] = `${response.status} ${(await response.json()).code}`;
    assert.equal(response.status, 403, route);
  }
  record("anonymous_image_tasks", codes);
});

test("T2-06/T2-07 익명 세션은 clothes·Storage에 접근할 수 없다(restrictive 정책)", async () => {
  const anon = await createAnonymous();
  const results = {};

  const sel = await anon.client.from("clothes").select("id");
  results.select = sel.error ? `error ${sel.error.code}` : sel.data.length;
  assert.equal(sel.error ? 0 : sel.data.length, 0);

  const ins = await anon.client.from("clothes").insert({
    user_id: anon.userId, category: "top", sub_category: "shirt", color: "white",
    color_tone: "neutral", fit: "regular", material: "cotton",
  });
  results.insertOwn = ins.error ? "rejected" : "ALLOWED";
  assert.ok(ins.error);

  const up = await anon.client.storage.from(BUCKET).upload(`${anon.userId}/originals/anon.jpg`, fs.readFileSync(LOAFER), { contentType: "image/jpeg" });
  results.uploadOwnFolder = up.error ? "rejected" : "ALLOWED";
  assert.ok(up.error);

  const list = await anon.client.storage.from(BUCKET).list(`${anon.userId}/originals`);
  results.listOwnFolder = list.data?.length ?? 0;

  record("anonymous_data_access", results);
});

test("T2-08/T2-19 정식 사용자: 경로 방식 저장 + 배경 제거(품질 기준) + 재조회", async () => {
  const user = await createUser("main");
  const analysis = await analyzeLoafer(user.session.access_token);
  assert.equal(analysis.status, 200, JSON.stringify(analysis.body).slice(0, 200));

  const saved = await saveWithCutout(user, analysis.body);
  record("user_save", { quality: saved.quality });

  const { data } = await user.client.from("clothes").select("id, cutout_image_path");
  assert.equal(data.length, 1);
  assert.ok(data[0].cutout_image_path);

  const upd = await user.client.from("clothes").update({ color: "black" }).eq("id", saved.row.id).select("color");
  assert.equal(upd.data[0].color, "black");

  state.mainUser = user;
  state.mainOriginalPath = saved.originalPath;
});

test("T2-09/T2-18 사용자 간 차단: B가 A의 경로로 처리 요청 → 403, A의 옷장 접근 차단", async () => {
  const a = state.mainUser;
  assert.ok(a, "T2-08 필요");
  const b = await createUser("other");

  const forbidden = await api("/segment-garment-local", {
    token: b.session.access_token,
    body: { imagePath: state.mainOriginalPath, box2d: [0, 0, 1000, 1000] },
  });
  assert.equal(forbidden.status, 403);
  assert.equal((await forbidden.json()).code, "IMAGE_PATH_FORBIDDEN");

  const notFound = await api("/remove-background", {
    token: b.session.access_token,
    body: { imagePath: `${b.userId}/processing/missing.jpg` },
  });
  assert.equal(notFound.status, 404);

  const rows = await b.client.from("clothes").select("id");
  assert.equal(rows.data.length, 0);

  const dl = await b.client.storage.from(BUCKET).download(state.mainOriginalPath);
  assert.ok(dl.error);

  record("cross_user", { pathOfOtherUser: 403, missingOwnFile: 404, otherRows: 0, downloadOther: "rejected" });
});

test("T2-10/T2-11 익명 사용량: 한도(3) 초과 429, 서버 재시작(메모리 초기화) 후에도 유지", async () => {
  const anon = await createAnonymous();
  const token = anon.session.access_token;

  const before = [];
  for (let i = 0; i < 4; i += 1) before.push((await api("/analyze-clothing", { token })).status);
  assert.deepEqual(before, [400, 400, 400, 429]);

  // 서버 재시작 흉내: 리스너 종료 + 메모리 카운터 전부 초기화 + 새 리스너
  await new Promise((resolve) => state.server.close(resolve));
  app.locals.resetQuotaCounters();
  await listen();

  const after = await api("/analyze-clothing", { token });
  const body = await after.json();
  assert.equal(after.status, 429);
  assert.equal(body.code, "GUEST_RATE_LIMITED");

  record("persistent_quota", { before, afterRestart: after.status, retryAfterSeconds: body.retryAfterSeconds });
});

test("T2-14/T2-15 ai_usage: 직접 접근 거절, 비로그인 호출 거절, 동시 10회 정확 집계", async () => {
  const user = await createUser("quota");

  const sel = await user.client.from("ai_usage").select("*");
  assert.ok(sel.error, "직접 조회는 거절되어야 한다");

  const ins = await user.client.from("ai_usage").insert({ user_id: user.userId, kind: "analyze", window_start: new Date().toISOString(), count: 0 });
  assert.ok(ins.error);

  const anonRole = await newClient().rpc("consume_ai_quota", { p_kind: "analyze" });
  assert.ok(anonRole.error, "토큰 없는 호출은 거절되어야 한다");

  const bad = await user.client.rpc("consume_ai_quota", { p_kind: "other" });
  assert.ok(bad.error);

  const results = await Promise.all(
    Array.from({ length: 10 }, () => user.client.rpc("consume_ai_quota", { p_kind: "analyze" })),
  );
  assert.ok(results.every((r) => !r.error));
  const next = await user.client.rpc("consume_ai_quota", { p_kind: "analyze" });
  assert.equal(next.data[0].used_count, 11);

  record("ai_usage", { directSelect: "rejected", directInsert: "rejected", anonRpc: "rejected", invalidKind: "rejected", concurrent10Then: 11 });
});

test("T2-16 버킷 제한: 이미지 외 형식·10MB 초과 거절, 정상 사진 허용", async () => {
  const user = state.mainUser ?? (await createUser("bucket"));
  const base = `${user.userId}/originals/${Date.now()}`;

  const text = await user.client.storage.from(BUCKET).upload(`${base}-a.txt`, Buffer.from("hello"), { contentType: "text/plain" });
  assert.ok(text.error);

  const big = await user.client.storage.from(BUCKET).upload(`${base}-big.jpg`, Buffer.alloc(10.5 * 1024 * 1024, 1), { contentType: "image/jpeg" });
  assert.ok(big.error);

  const ok = await user.client.storage.from(BUCKET).upload(`${base}-ok.jpg`, fs.readFileSync(LOAFER), { contentType: "image/jpeg" });
  assert.ifError(ok.error);

  record("bucket_limits", { textPlain: text.error.message.slice(0, 60), over10MB: big.error.message.slice(0, 60), jpeg: "ok" });
});

test("T2-20 익명 → 분석 → 회원가입 전환(같은 ID) → 옷장 저장", async () => {
  const anon = await createAnonymous();
  const analysis = await analyzeOrFixture(anon.session.access_token, "convert");

  // 앱 signUpWithEmail과 같은 순서: updateUser → refreshSession
  const creds = newCredentials("convert");
  const { error: updateError } = await anon.client.auth.updateUser(creds);
  assert.ifError(updateError);
  const { data: refreshed, error: refreshError } = await anon.client.auth.refreshSession();
  assert.ifError(refreshError);

  const session = refreshed.session;
  record("conversion", {
    sameUserId: session.user.id === anon.userId,
    isAnonymousAfter: session.user.is_anonymous,
    email: session.user.email ? "set" : "missing",
  });
  assert.equal(session.user.id, anon.userId);
  assert.equal(session.user.is_anonymous, false);

  const converted = { client: anon.client, creds, session, userId: anon.userId };
  state.cleanup.push(converted);

  const saved = await saveWithCutout(converted, analysis);
  assert.equal(saved.row.user_id, anon.userId);

  // 같은 이메일·비밀번호로 새로 로그인해도 같은 계정
  const relog = newClient();
  const { data: login, error: loginError } = await relog.auth.signInWithPassword(creds);
  assert.ifError(loginError);
  assert.equal(login.user.id, anon.userId);
});

test("T2-21 익명 → 분석 → 기존 계정 로그인 → 그 계정에 저장", async () => {
  const existing = await createUser("existing");
  const anon = await createAnonymous();

  const analysis = await analyzeOrFixture(anon.session.access_token, "existing");

  const { data, error } = await anon.client.auth.signInWithPassword(existing.creds);
  assert.ifError(error);
  assert.equal(data.user.id, existing.userId);

  const user = { client: anon.client, creds: existing.creds, session: data.session, userId: existing.userId };
  const saved = await saveWithCutout(user, analysis);
  assert.equal(saved.row.user_id, existing.userId);
  record("existing_login_save", { savedToExisting: true });
});
