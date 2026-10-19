// Sprint 1A-2 종료 QA — QA Supabase 프로젝트 전용 실연동 E2E
//
// 앱의 Supabase 호출(src/lib/clothes.ts)과 같은 순서로 전체 흐름을 검증한다:
// 회원가입 → 로그아웃 → 로그인 → 저장(SlimSAM) → 조회 → 사진 교체(수정) → 삭제
// + 잘못된 비밀번호 응답, Storage 10MB 경계, 분석 요청 본문 경계
//
// 실행: E2E_SUPABASE_URL=... E2E_SUPABASE_PUBLISHABLE_KEY=... npm run test:e2e

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
process.env.USER_ANALYZE_LIMIT_PER_HOUR = "50";
process.env.IP_ANALYZE_LIMIT_PER_HOUR = "500";

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
const IMAGES = path.join(__dirname, "../../../assets/images/products");

const newClient = () =>
  createClient(qaUrl, qaKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

const creds = {
  email: `qa-${RUN_ID}-flow@styleseed-qa.dev`,
  password: crypto.randomBytes(18).toString("base64url"),
};

const state = { server: null, baseUrl: null, client: null, userId: null, token: null, rowId: null };
const report = {};
const record = (key, value) => {
  report[key] = value;
};

const api = (route, { token, body, raw } = {}) =>
  fetch(`${state.baseUrl}${route}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: raw ?? JSON.stringify(body ?? {}),
  });

const analyze = async (token, file) => {
  const imageBase64 = fs.readFileSync(path.join(IMAGES, file)).toString("base64");
  let response;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    response = await api("/analyze-clothing", { token, body: { imageBase64 } });
    if (![503, 504].includes(response.status)) break;
    await new Promise((resolve) => setTimeout(resolve, 15000));
  }
  const body = await response.json();

  // Gemini 무료 등급 일일 한도 소진 시: 저장 흐름 검증을 위해 2026-10-17 실제 Gemini 결과로 대체(보고서에 기록)
  if (response.status === 429 && body.code === "AI_RATE_LIMITED" && file === "brown-loafer.jpg") {
    record("analysis_source", "fixture (Gemini 일일 한도 소진)");
    return {
      category: "shoes", subCategory: "loafer", color: "brown", colorTone: "warm", fit: "regular",
      material: "leather", season: ["fall"], tpo: ["daily"], style: ["classic"], box2d: [269, 58, 856, 942],
    };
  }

  assert.equal(response.status, 200, JSON.stringify(body).slice(0, 200));
  record("analysis_source", "gemini");
  return body;
};

const objectExists = async (client, filePath) => {
  const folder = filePath.split("/").slice(0, -1).join("/");
  const name = filePath.split("/").pop();
  const { data } = await client.storage.from(BUCKET).list(folder, { search: name });
  return Boolean(data?.some((f) => f.name === name));
};

test.before(
  () =>
    new Promise((resolve) => {
      state.server = app.listen(0, "127.0.0.1", () => {
        state.baseUrl = `http://127.0.0.1:${state.server.address().port}`;
        resolve();
      });
    }),
);

test.after(async () => {
  if (state.userId) {
    const c = newClient();
    const { error } = await c.auth.signInWithPassword(creds);
    if (!error) {
      await c.from("clothes").delete().eq("user_id", state.userId);
      for (const folder of ["originals", "cutouts", "processing"]) {
        const prefix = `${state.userId}/${folder}`;
        const { data } = await c.storage.from(BUCKET).list(prefix);
        if (data?.length) await c.storage.from(BUCKET).remove(data.map((f) => `${prefix}/${f.name}`));
      }
    }
  }
  await new Promise((resolve) => state.server.close(resolve));
  if (process.env.E2E_REPORT_PATH) fs.writeFileSync(process.env.E2E_REPORT_PATH, JSON.stringify(report, null, 2));
  console.log("E2E_REPORT", JSON.stringify(report));
});

test("Q-01 회원가입 → 로그아웃 → 비밀번호 로그인", async () => {
  const signup = newClient();
  const { data, error } = await signup.auth.signUp(creds);
  assert.ifError(error);
  assert.ok(data.session, "QA 프로젝트는 이메일 인증 꺼짐");
  state.userId = data.user.id;

  await signup.auth.signOut();

  const login = newClient();
  const { data: loggedIn, error: loginError } = await login.auth.signInWithPassword(creds);
  assert.ifError(loginError);
  assert.equal(loggedIn.user.id, state.userId);
  assert.notEqual(loggedIn.user.is_anonymous, true);

  state.client = login;
  state.token = loggedIn.session.access_token;
  record("signup_login", "ok");
});

test("Q-02 잘못된 비밀번호 → 로그인 거절(앱은 '로그인 실패' 안내)", async () => {
  const { data, error } = await newClient().auth.signInWithPassword({ email: creds.email, password: `${creds.password}x` });
  assert.ok(error);
  assert.equal(data.session, null);
  record("wrong_password", { status: error.status, code: error.code, message: error.message });
});

test("Q-03 저장: 분석 → 원본 업로드 → SlimSAM 배경 제거 → 컷아웃 업로드 → clothes 저장", async () => {
  const analysis = await analyze(state.token, "brown-loafer.jpg");
  const client = state.client;
  const original = fs.readFileSync(path.join(IMAGES, "brown-loafer.jpg"));

  const originalPath = `${state.userId}/originals/${Date.now()}.jpg`;
  assert.ifError((await client.storage.from(BUCKET).upload(originalPath, original, { contentType: "image/jpeg", upsert: false })).error);

  const sam = await api("/segment-garment-local", { token: state.token, body: { imagePath: originalPath, box2d: analysis.box2d } });
  assert.equal(sam.status, 200);
  const cutout = Buffer.from(await sam.arrayBuffer());
  const meta = await sharp(cutout).metadata();
  assert.equal(meta.format, "png");
  assert.ok(meta.hasAlpha);

  const cutoutPath = `${state.userId}/cutouts/${Date.now()}.png`;
  assert.ifError((await client.storage.from(BUCKET).upload(cutoutPath, cutout, { contentType: "image/png", upsert: false })).error);

  const { data, error } = await client
    .from("clothes")
    .insert({
      user_id: state.userId,
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
    .select("id")
    .single();
  assert.ifError(error);

  state.rowId = data.id;
  state.originalPath = originalPath;
  state.cutoutPath = cutoutPath;
  record("save", { category: analysis.category, sub: analysis.subCategory, cutout: [meta.width, meta.height] });
});

test("Q-04 조회: 앱 fetchClothesFromSupabase와 같은 쿼리 + 서명 URL로 이미지 표시 가능", async () => {
  const { data, error } = await state.client.from("clothes").select("*").order("created_at", { ascending: false });
  assert.ifError(error);
  assert.equal(data.length, 1);
  assert.equal(data[0].id, state.rowId);

  for (const p of [data[0].cutout_image_path, data[0].original_image_path]) {
    const { data: signed, error: signError } = await state.client.storage.from(BUCKET).createSignedUrl(p, 3600);
    assert.ifError(signError);
    const res = await fetch(signed.signedUrl);
    assert.equal(res.status, 200);
  }
  record("fetch", { rows: data.length, imagesServed: 2 });
});

test("Q-05 수정: 앱 replaceClothingImage와 같은 순서로 사진 교체", async () => {
  const client = state.client;
  const { data: current, error: fetchError } = await client
    .from("clothes")
    .select("original_image_path, cutout_image_path")
    .eq("id", state.rowId)
    .single();
  assert.ifError(fetchError);

  const newOriginalPath = `${state.userId}/originals/${Date.now()}-replaced.jpg`;
  assert.ifError(
    (await client.storage.from(BUCKET).upload(newOriginalPath, fs.readFileSync(path.join(IMAGES, "white-sneakers.jpg")), { contentType: "image/jpeg", upsert: false })).error,
  );

  const { data: updated, error: updateError } = await client
    .from("clothes")
    .update({ original_image_path: newOriginalPath, cutout_image_path: null })
    .eq("id", state.rowId)
    .select("original_image_path, cutout_image_path");
  assert.ifError(updateError);
  assert.equal(updated.length, 1, "업데이트가 0행이면 정책에 막힌 것");
  assert.equal(updated[0].cutout_image_path, null);

  const { error: cleanupError } = await client.storage.from(BUCKET).remove([current.original_image_path, current.cutout_image_path]);
  assert.ifError(cleanupError);
  assert.equal(await objectExists(client, current.original_image_path), false);
  assert.equal(await objectExists(client, current.cutout_image_path), false);
  assert.equal(await objectExists(client, newOriginalPath), true);

  state.originalPath = newOriginalPath;
  record("replace", { rowUpdated: true, oldFilesRemoved: true });
});

test("Q-06 삭제: 앱 deleteClothingFromSupabase와 같은 순서(파일 → 행) 후 완전히 사라짐", async () => {
  const client = state.client;
  const { data, error: fetchError } = await client
    .from("clothes")
    .select("original_image_path, cutout_image_path")
    .eq("id", state.rowId)
    .single();
  assert.ifError(fetchError);

  const paths = [data.original_image_path, data.cutout_image_path].filter(Boolean);
  assert.ifError((await client.storage.from(BUCKET).remove(paths)).error);

  const { data: deleted, error: deleteError } = await client.from("clothes").delete().eq("id", state.rowId).select("id");
  assert.ifError(deleteError);
  assert.equal(deleted.length, 1);

  const { data: rows } = await client.from("clothes").select("id");
  assert.equal(rows.length, 0);
  for (const p of paths) assert.equal(await objectExists(client, p), false);
  record("delete", { rowsLeft: 0, filesLeft: 0 });
});

test("Q-07 Storage 10MB 경계: 9.9MB 허용, 10.1MB 거절, 이미지 외 형식 거절", async () => {
  const client = state.client;
  const base = `${state.userId}/originals/${Date.now()}`;
  const under = await client.storage.from(BUCKET).upload(`${base}-under.jpg`, Buffer.alloc(Math.floor(9.9 * 1024 * 1024), 1), { contentType: "image/jpeg" });
  const over = await client.storage.from(BUCKET).upload(`${base}-over.jpg`, Buffer.alloc(Math.ceil(10.1 * 1024 * 1024), 1), { contentType: "image/jpeg" });
  const pdf = await client.storage.from(BUCKET).upload(`${base}-doc.pdf`, Buffer.from("%PDF-1.4"), { contentType: "application/pdf" });

  assert.ifError(under.error);
  assert.ok(over.error);
  assert.ok(pdf.error);

  await client.storage.from(BUCKET).remove([`${base}-under.jpg`]);
  record("storage_limit", { "9.9MB": "accepted", "10.1MB": over.error.message.slice(0, 60), pdf: pdf.error.message.slice(0, 60) });
});

test("Q-08 분석 요청 본문 경계: 원본 약 7.4MB(base64 약 9.9MB) 통과, 약 7.7MB(base64 약 10.3MB) 413", async () => {
  // base64는 원본의 약 4/3. 이미지 내용은 무관(본문 크기 판정만 확인), 본문이 통과하면 Gemini 전에 400/502가 나도 크기 통과로 본다
  const asBase64 = (mb) => Buffer.alloc(Math.floor(mb * 1024 * 1024), 7).toString("base64");

  const passBody = JSON.stringify({ imageBase64: asBase64(7.4) });
  const failBody = JSON.stringify({ imageBase64: asBase64(7.7) });

  const fail = await api("/analyze-clothing", { token: state.token, raw: failBody });
  assert.equal(fail.status, 413);

  // 통과 쪽은 크기 검사만 확인하기 위해 Gemini 호출 전 단계에서 끝나도록 잘못된 이미지 데이터를 보낸다
  const pass = await api("/analyze-clothing", { token: state.token, raw: passBody });
  assert.notEqual(pass.status, 413);

  record("analyze_body_limit", {
    passBodyMB: Number((passBody.length / 1048576).toFixed(2)),
    passStatus: pass.status,
    failBodyMB: Number((failBody.length / 1048576).toFixed(2)),
    failStatus: fail.status,
  });
});
