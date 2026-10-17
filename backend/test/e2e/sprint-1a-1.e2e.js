// Sprint 1A-1 실연동 E2E — QA Supabase 프로젝트 전용
//
// 실제 서비스(QA Supabase Auth·DB·Storage, Gemini, 로컬 SlimSAM 또는 BRIA)를 호출한다.
// 운영 프로젝트에는 연결하지 않는다(아래 PROD_REF 가드).
//
// 실행:
//   E2E_SUPABASE_URL=https://<qa-ref>.supabase.co \
//   E2E_SUPABASE_PUBLISHABLE_KEY=sb_publishable_... \
//   node --test backend/test/e2e/sprint-1a-1.e2e.js
//
// 테스트 계정은 실행마다 새로 만들고(QA 프로젝트의 이메일 인증은 꺼져 있어야 함),
// 테스트가 만든 옷 행·Storage 파일은 끝에서 지운다. Auth 사용자 행은 관리자 키가 없어
// 지울 수 없으므로 QA 프로젝트에 남는다.

const PROD_REF = "zkgsxavpyvxhrivzmqsp";

const qaUrl = process.env.E2E_SUPABASE_URL;
const qaKey = process.env.E2E_SUPABASE_PUBLISHABLE_KEY;

if (!qaUrl || !qaKey) {
  throw new Error("E2E_SUPABASE_URL / E2E_SUPABASE_PUBLISHABLE_KEY가 필요합니다.");
}

if (qaUrl.includes(PROD_REF)) {
  throw new Error("운영 Supabase 프로젝트에는 E2E를 실행하지 않습니다.");
}

// 백엔드가 QA 프로젝트 토큰을 검증하도록 server.js보다 먼저 설정한다
process.env.SUPABASE_URL = qaUrl;
process.env.SUPABASE_PUBLISHABLE_KEY = qaKey;
process.env.GUEST_ANALYZE_LIMIT_PER_HOUR = "3";

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
const PRODUCT_IMAGES = path.join(__dirname, "../../../assets/images/products");

// 핵심 흐름은 배경 제거가 정상 동작하는 이미지로 검증한다
const IMAGE_PATH = path.join(PRODUCT_IMAGES, "brown-loafer.jpg");

// 알려진 결함 재현용: 2026-10-17 Gemini가 이 이미지에 돌려준 box2d
const KNOWN_DEFECT = {
  image: path.join(PRODUCT_IMAGES, "white-shirts.jpg"),
  box2d: [19, 67, 965, 941],
};

const newClient = () =>
  createClient(qaUrl, qaKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

const makeUser = (label) => ({
  email: `qa-${RUN_ID}-${label}@styleseed-qa.dev`,
  password: crypto.randomBytes(18).toString("base64url"),
  client: newClient(),
  session: null,
  userId: null,
});

const userA = makeUser("a");
const userB = makeUser("b");

const state = { server: null, baseUrl: null, analysis: null, rowId: null, paths: [] };

const report = {};

const record = (key, value) => {
  report[key] = value;
};

const api = async (route, { token, body, raw } = {}) => {
  const response = await fetch(`${state.baseUrl}${route}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: raw ?? JSON.stringify(body ?? {}),
  });

  return response;
};

// 배경 제거 성공 판정: PNG + 알파 채널 + 투명 픽셀이 일부(5~95%) 존재
const inspectCutout = async (buffer) => {
  const image = sharp(buffer);
  const meta = await image.metadata();
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  let transparent = 0;
  const pixels = info.width * info.height;

  for (let i = 3; i < data.length; i += info.channels) {
    if (data[i] < 16) transparent += 1;
  }

  return {
    format: meta.format,
    hasAlpha: Boolean(meta.hasAlpha),
    width: info.width,
    height: info.height,
    transparentRatio: Number((transparent / pixels).toFixed(3)),
  };
};

// boxArea: 원본 이미지에서 Gemini box2d가 차지하는 픽셀 면적.
// 잘라낸 결과가 옷 영역의 25% 미만이면(예: 단추 하나만 남음) 실패로 본다.
const isBackgroundRemoved = (info, boxArea) =>
  info.format === "png" &&
  info.hasAlpha &&
  info.transparentRatio > 0.05 &&
  info.transparentRatio < 0.95 &&
  (boxArea ? (info.width * info.height) / boxArea >= 0.25 : true);

const boxPixelArea = async (imageBuffer, box2d) => {
  const { width, height } = await sharp(imageBuffer).metadata();
  const [yMin, xMin, yMax, xMax] = box2d;

  return ((xMax - xMin) / 1000) * width * (((yMax - yMin) / 1000) * height);
};

test.before(async () => {
  await new Promise((resolve) => {
    state.server = app.listen(0, "127.0.0.1", () => {
      state.baseUrl = `http://127.0.0.1:${state.server.address().port}`;
      resolve();
    });
  });

  for (const user of [userA, userB]) {
    const { data, error } = await user.client.auth.signUp({
      email: user.email,
      password: user.password,
    });

    assert.ifError(error);
    assert.ok(data.session, "QA 프로젝트의 이메일 인증이 꺼져 있어야 합니다");

    user.session = data.session;
    user.userId = data.user.id;
  }
});

test.after(async () => {
  // 테스트가 만든 데이터만 정리한다(각 사용자 본인 권한으로)
  for (const user of [userA, userB]) {
    if (!user.session) continue;

    await user.client.from("clothes").delete().eq("user_id", user.userId);

    for (const folder of ["originals", "cutouts", "processing"]) {
      const prefix = `${user.userId}/${folder}`;
      const { data } = await user.client.storage.from(BUCKET).list(prefix);

      if (data?.length) {
        await user.client.storage.from(BUCKET).remove(data.map((f) => `${prefix}/${f.name}`));
      }
    }

    const { data: left } = await user.client.from("clothes").select("id");
    record(`cleanup_${user === userA ? "A" : "B"}_rows_left`, left?.length ?? null);
  }

  await new Promise((resolve) => state.server.close(resolve));

  const out = process.env.E2E_REPORT_PATH;
  if (out) fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log("E2E_REPORT", JSON.stringify(report));
});

test("E2E-01 실제 로그인: QA 계정 2개 가입·재로그인 성공", async () => {
  const fresh = newClient();
  const { data, error } = await fresh.auth.signInWithPassword({
    email: userA.email,
    password: userA.password,
  });

  assert.ifError(error);
  assert.equal(data.user.id, userA.userId);

  userA.client = fresh;
  userA.session = data.session;
  record("login", "ok");
});

test("E2E-02 익명 로그인은 QA에서도 꺼져 있다(운영과 동일)", async () => {
  const { error } = await newClient().auth.signInAnonymously();

  assert.ok(error, "익명 로그인은 거절되어야 한다");
  record("anonymous_signin_rejected", error.message.slice(0, 60));
});

test("E2E-03 백엔드가 실제 Supabase 토큰을 검증한다", async () => {
  const token = userA.session.access_token;

  // 본문이 비어 있으면 핸들러 입력 검증(400)까지 간 것 = 인증 통과
  assert.equal((await api("/remove-background", { token })).status, 400);
  assert.equal((await api("/segment-garment-local", { token })).status, 400);
  assert.equal((await api("/analyze-clothing", { token })).status, 400);

  assert.equal((await api("/remove-background")).status, 401);

  const tampered = `${token.slice(0, -4)}AAAA`;
  assert.equal((await api("/remove-background", { token: tampered })).status, 401);

  record("backend_real_token", "accepted; missing=401; tampered=401");
});

test("E2E-04 로그인 전(guest) 실제 Gemini 분석", async () => {
  const imageBase64 = fs.readFileSync(IMAGE_PATH).toString("base64");

  let response;
  let attempts = 0;

  for (; attempts < 3; attempts += 1) {
    response = await api("/analyze-clothing", { body: { imageBase64 } });

    // 외부 Gemini 혼잡(503)·지연(504)은 재시도한다
    if (![503, 504].includes(response.status)) break;

    await new Promise((resolve) => setTimeout(resolve, 15000));
  }

  const body = await response.json();

  record("guest_analyze", { status: response.status, attempts: attempts + 1, category: body.category, subCategory: body.subCategory });

  assert.equal(response.status, 200, JSON.stringify(body).slice(0, 200));
  assert.ok(Array.isArray(body.box2d) && body.box2d.length === 4);

  state.analysis = body;
});

test("E2E-05 로그인 후 저장: 원본 업로드 → 배경 제거 → DB 저장 (앱 saveClothingToSupabase 순서)", async () => {
  assert.ok(state.analysis, "E2E-04 분석 결과 필요");

  const client = userA.client;
  const token = userA.session.access_token;
  const userId = userA.userId;
  const original = fs.readFileSync(IMAGE_PATH);

  const originalPath = `${userId}/originals/${Date.now()}.jpg`;
  const up = await client.storage.from(BUCKET).upload(originalPath, original, { contentType: "image/jpeg", upsert: false });
  assert.ifError(up.error);
  state.paths.push(originalPath);

  const signed = await client.storage.from(BUCKET).createSignedUrl(originalPath, 600);
  assert.ifError(signed.error);

  let cutoutBuffer = null;
  let cutoutPathKind = null;
  const pathNotes = {};

  // 1) 로컬 SlimSAM (앱의 1순위)
  const started = Date.now();
  const sam = await api("/segment-garment-local", {
    token,
    body: { imageUrl: signed.data.signedUrl, box2d: state.analysis.box2d },
  });
  pathNotes.slimsam = { status: sam.status, ms: Date.now() - started };

  if (sam.ok) {
    cutoutBuffer = Buffer.from(await sam.arrayBuffer());
    cutoutPathKind = "slimsam";
  } else {
    pathNotes.slimsam.error = (await sam.json().catch(() => ({}))).message?.slice(0, 120);

    // 2) BRIA 대체 경로 (앱의 2순위)
    const bria = await api("/remove-background", { token, body: { imageUrl: signed.data.signedUrl } });
    const briaBody = await bria.json().catch(() => ({}));
    pathNotes.bria = { status: bria.status };

    if (bria.ok && briaBody.cutoutUrl) {
      const download = await fetch(briaBody.cutoutUrl);
      cutoutBuffer = Buffer.from(await download.arrayBuffer());
      cutoutPathKind = "bria";
    }
  }

  record("cutout_paths", pathNotes);

  assert.ok(cutoutBuffer, "배경 제거 결과가 없음(원본 대체는 성공으로 보지 않음)");

  const info = await inspectCutout(cutoutBuffer);
  const boxArea = await boxPixelArea(original, state.analysis.box2d);
  const coverage = Number(((info.width * info.height) / boxArea).toFixed(3));
  record("cutout_image", { via: cutoutPathKind, ...info, coverageOfBox: coverage });
  assert.ok(isBackgroundRemoved(info, boxArea), `배경 제거 판정 실패: ${JSON.stringify({ ...info, coverage })}`);
  state.boxArea = boxArea;

  const cutoutPath = `${userId}/cutouts/${Date.now()}.png`;
  const upCut = await client.storage.from(BUCKET).upload(cutoutPath, cutoutBuffer, { contentType: "image/png", upsert: false });
  assert.ifError(upCut.error);
  state.paths.push(cutoutPath);

  const a = state.analysis;
  const { data: row, error } = await client
    .from("clothes")
    .insert({
      user_id: userId,
      category: a.category,
      sub_category: a.subCategory,
      color: a.color,
      color_tone: a.colorTone,
      fit: a.fit,
      material: a.material,
      season: a.season,
      tpo: a.tpo,
      style: a.style,
      original_image_path: originalPath,
      cutout_image_path: cutoutPath,
    })
    .select("id")
    .single();

  assert.ifError(error);
  state.rowId = row.id;
});

test("E2E-06 재로그인 후 옷장 재조회: 저장한 옷과 배경 제거 이미지가 그대로", async () => {
  const fresh = newClient();
  const { error: loginError } = await fresh.auth.signInWithPassword({ email: userA.email, password: userA.password });
  assert.ifError(loginError);

  // 앱 fetchClothesFromSupabase와 같은 쿼리(사용자 조건 없이 RLS에 의존)
  const { data, error } = await fresh.from("clothes").select("*").order("created_at", { ascending: false });
  assert.ifError(error);
  assert.equal(data.length, 1);
  assert.equal(data[0].id, state.rowId);
  assert.ok(data[0].cutout_image_path);

  const signed = await fresh.storage.from(BUCKET).createSignedUrl(data[0].cutout_image_path, 600);
  assert.ifError(signed.error);
  const downloaded = Buffer.from(await (await fetch(signed.data.signedUrl)).arrayBuffer());
  assert.ok(isBackgroundRemoved(await inspectCutout(downloaded), state.boxArea));

  record("refetch", { rows: data.length, cutoutDownloaded: downloaded.length });
});

test("E2E-07 사용자 간 접근 차단(V-3): B는 A의 옷장과 사진에 접근할 수 없다", async () => {
  const b = userB.client;
  const results = {};

  const read = await b.from("clothes").select("*").eq("id", state.rowId);
  results.select = read.data?.length ?? read.error?.message;
  assert.equal(read.data.length, 0);

  const upd = await b.from("clothes").update({ color: "black" }).eq("id", state.rowId).select("id");
  results.update = upd.data?.length ?? upd.error?.message;
  assert.equal(upd.data.length, 0);

  const del = await b.from("clothes").delete().eq("id", state.rowId).select("id");
  results.delete = del.data?.length ?? del.error?.message;
  assert.equal(del.data.length, 0);

  const ins = await b.from("clothes").insert({
    user_id: userA.userId, category: "top", sub_category: "shirt", color: "white",
    color_tone: "neutral", fit: "regular", material: "cotton",
  });
  results.insertAsA = ins.error ? "rejected" : "ALLOWED";
  assert.ok(ins.error);

  const [originalPath, cutoutPath] = state.paths;

  const dl = await b.storage.from(BUCKET).download(cutoutPath);
  results.downloadA = dl.error ? "rejected" : "ALLOWED";
  assert.ok(dl.error);

  const sign = await b.storage.from(BUCKET).createSignedUrl(originalPath, 60);
  results.signA = sign.error ? "rejected" : "ALLOWED";
  assert.ok(sign.error);

  const list = await b.storage.from(BUCKET).list(`${userA.userId}/originals`);
  results.listA = list.data?.length ?? 0;
  assert.equal(list.data?.length ?? 0, 0);

  const upA = await b.storage.from(BUCKET).upload(`${userA.userId}/originals/intruder.jpg`, Buffer.from("x"), { contentType: "image/jpeg" });
  results.uploadToA = upA.error ? "rejected" : "ALLOWED";
  assert.ok(upA.error);

  const rm = await b.storage.from(BUCKET).remove([cutoutPath]);
  const stillThere = await userA.client.storage.from(BUCKET).download(cutoutPath);
  results.removeA = stillThere.error ? "DELETED" : "kept";
  assert.ok(!stillThere.error, `B가 A의 파일을 지움: ${JSON.stringify(rm)}`);

  const own = await userA.client.from("clothes").update({ user_id: userB.userId }).eq("id", state.rowId).select("id");
  results.reassignOwner = own.error ? "rejected" : `ALLOWED(${own.data?.length})`;
  assert.ok(own.error);

  const anon = newClient();
  const anonRead = await anon.from("clothes").select("id");
  results.anonSelect = anonRead.data?.length ?? anonRead.error?.message;
  assert.equal(anonRead.data.length, 0);

  const aStill = await userA.client.from("clothes").select("id, color").eq("id", state.rowId);
  assert.equal(aStill.data.length, 1);
  assert.notEqual(aStill.data[0].color, "black");

  record("cross_user", results);
});

test("E2E-08 실서버 요청 크기·Guest 한도", async () => {
  const big = await api("/analyze-clothing", { raw: JSON.stringify({ imageBase64: "a".repeat(11 * 1024 * 1024) }) });
  assert.equal(big.status, 413);

  app.locals.guestAnalyzeLimiter.reset();

  const statuses = [];
  for (let i = 0; i < 4; i += 1) {
    statuses.push((await api("/analyze-clothing", { body: {} })).status);
  }
  assert.deepEqual(statuses, [400, 400, 400, 429]);

  const loggedIn = await api("/analyze-clothing", { token: userA.session.access_token, body: {} });
  assert.equal(loggedIn.status, 400);

  record("limits", { oversize: 413, guestSequence: statuses, loggedInAfterGuestLimit: loggedIn.status });
});

test(
  "E2E-09 [알려진 결함] 흰 셔츠: SlimSAM이 단추만 잘라내 옷 영역 25% 미만",
  { todo: "SlimSAM 중심 점 프롬프트 결함(Sprint 1A-1 범위 밖, 결과 문서 참고)" },
  async () => {
    const token = userA.session.access_token;
    const buffer = fs.readFileSync(KNOWN_DEFECT.image);
    const filePath = `${userA.userId}/originals/defect-${Date.now()}.jpg`;

    const up = await userA.client.storage.from(BUCKET).upload(filePath, buffer, { contentType: "image/jpeg" });
    assert.ifError(up.error);

    const signed = await userA.client.storage.from(BUCKET).createSignedUrl(filePath, 600);
    const response = await api("/segment-garment-local", {
      token,
      body: { imageUrl: signed.data.signedUrl, box2d: KNOWN_DEFECT.box2d },
    });

    const info = await inspectCutout(Buffer.from(await response.arrayBuffer()));
    const boxArea = await boxPixelArea(buffer, KNOWN_DEFECT.box2d);

    record("known_defect_white_shirt", {
      status: response.status,
      ...info,
      coverageOfBox: Number(((info.width * info.height) / boxArea).toFixed(4)),
    });

    assert.ok(isBackgroundRemoved(info, boxArea));
  },
);
