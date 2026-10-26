// 배포 환경변수 점검 (Beta Launch EV-01 ~ 05) — 값이 결과에 섞이지 않는지 포함
const test = require("node:test");
const assert = require("node:assert/strict");

const load = () => import("../scripts/check-env.mjs");

const QA_URL = "https://abcdefghijklmnopqrst.supabase.co";

const validEnv = () => ({
  SUPABASE_URL: QA_URL,
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_FAKEVALUE0001",
  SUPABASE_SECRET_KEY: "sb_secret_FAKEVALUE0002",
  GEMINI_API_KEY: "FAKE-GEMINI-KEY-0000000000",
  BRIA_API_TOKEN: "FAKE-BRIA-TOKEN-00000",
  TRUST_PROXY: "1",
  OPS_METRICS_TOKEN: "x".repeat(32),
  ALLOW_TOKENLESS_GUEST: "false",
  SUPPORT_EMAIL: "support@example.com",
});

const statusOf = (results, name) => results.find((r) => r.name.startsWith(name))?.status;

test("EV-01 필수값이 모두 맞으면 오류 0", async () => {
  const { checkEnv } = await load();

  const results = checkEnv(validEnv(), { target: "qa" });

  assert.deepEqual(results.filter((r) => r.status === "error"), []);
});

test("EV-02 필수값 누락·형식 오류는 오류", async () => {
  const { checkEnv } = await load();

  const env = validEnv();
  delete env.GEMINI_API_KEY;
  env.TRUST_PROXY = "0";
  env.SUPABASE_URL = "http://localhost:54321";

  const results = checkEnv(env);

  assert.equal(statusOf(results, "GEMINI_API_KEY"), "error");
  assert.equal(statusOf(results, "TRUST_PROXY"), "error");
  assert.equal(statusOf(results, "SUPABASE_URL"), "error");
});

test("EV-03 대상 프로젝트가 다르면 오류(QA 검증에 운영 DB 금지)", async () => {
  const { checkEnv, PRODUCTION_PROJECT_REF } = await load();

  const prodEnv = { ...validEnv(), SUPABASE_URL: `https://${PRODUCTION_PROJECT_REF}.supabase.co` };

  assert.equal(statusOf(checkEnv(prodEnv, { target: "qa" }), "(대상 프로젝트)"), "error");
  assert.equal(statusOf(checkEnv(prodEnv, { target: "production" }), "(대상 프로젝트)"), "ok");
  assert.equal(statusOf(checkEnv(validEnv(), { target: "production" }), "(대상 프로젝트)"), "error");
});

test("EV-03b research 대상은 운영·QA 프로젝트가 아니어야 한다(2026-11 조사 DB 분리)", async () => {
  const { checkEnv, PRODUCTION_PROJECT_REF, QA_PROJECT_REF } = await load();

  const withRef = (ref) => ({ ...validEnv(), SUPABASE_URL: `https://${ref}.supabase.co` });

  assert.equal(statusOf(checkEnv(withRef(PRODUCTION_PROJECT_REF), { target: "research" }), "(대상 프로젝트)"), "error");
  assert.equal(statusOf(checkEnv(withRef(QA_PROJECT_REF), { target: "research" }), "(대상 프로젝트)"), "error");
  assert.equal(statusOf(checkEnv(withRef("abcdefghijklmnopqrst"), { target: "research" }), "(대상 프로젝트)"), "ok");
});

test("EV-04 위험한 설정: 공개·관리자 키 중복, 비밀값처럼 보이는 EXPO_PUBLIC_, FAL_KEY", async () => {
  const { checkEnv } = await load();

  const env = {
    ...validEnv(),
    SUPABASE_PUBLISHABLE_KEY: "sb_secret_SAME",
    SUPABASE_SECRET_KEY: "sb_secret_SAME",
    EXPO_PUBLIC_SUPABASE_SECRET_KEY: "x",
    FAL_KEY: "fal-x",
  };

  const results = checkEnv(env);

  assert.equal(statusOf(results, "(키 중복)"), "error");
  assert.equal(statusOf(results, "EXPO_PUBLIC_SUPABASE_SECRET_KEY"), "error");
  assert.equal(statusOf(results, "FAL_KEY"), "warn");
});

test("EV-05 결과 어디에도 실제 값이 들어가지 않는다", async () => {
  const { checkEnv } = await load();

  const env = { ...validEnv(), SUPABASE_PUBLISHABLE_KEY: "bad-format-PUBLIC-VALUE", GEMINI_API_KEY: "short" };

  const serialized = JSON.stringify(checkEnv(env, { target: "qa" }));

  for (const value of Object.values(env)) {
    assert.ok(!serialized.includes(value), `값 노출: ${value.slice(0, 6)}…`);
  }
});

test("EV-06 앱 빌드 변수(R-13): API 주소 누락·localhost·http는 오류, 조사 빌드 조건", async () => {
  const { checkAppEnv, PRODUCTION_PROJECT_REF } = await load();

  const app = {
    EXPO_PUBLIC_API_URL: "https://styleseed-api.up.railway.app",
    EXPO_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abc",
    EXPO_PUBLIC_RESEARCH_MODE: "true",
    EXPO_PUBLIC_GEMINI_PAID_TIER: "true",
  };

  const errors = (env) => checkAppEnv(env, { target: "research" }).filter((r) => r.status === "error").map((r) => r.name);

  assert.deepEqual(errors(app), []);
  assert.deepEqual(errors({ ...app, EXPO_PUBLIC_API_URL: "" }), ["EXPO_PUBLIC_API_URL"]);
  assert.deepEqual(errors({ ...app, EXPO_PUBLIC_API_URL: "http://192.168.0.5:3001" }), ["EXPO_PUBLIC_API_URL"]);
  assert.deepEqual(errors({ ...app, EXPO_PUBLIC_API_URL: "https://localhost:3001" }), ["EXPO_PUBLIC_API_URL"]);
  assert.deepEqual(errors({ ...app, EXPO_PUBLIC_RESEARCH_MODE: "" }), ["EXPO_PUBLIC_RESEARCH_MODE"]);
  assert.deepEqual(errors({ ...app, EXPO_PUBLIC_SHOW_PROTOTYPES: "true" }), ["EXPO_PUBLIC_SHOW_PROTOTYPES"]);
  assert.deepEqual(
    errors({ ...app, EXPO_PUBLIC_SUPABASE_URL: `https://${PRODUCTION_PROJECT_REF}.supabase.co` }),
    ["(앱 대상 프로젝트)"],
  );
  assert.ok(errors({ ...app, EXPO_PUBLIC_GEMINI_API_KEY: "x" }).includes("EXPO_PUBLIC_GEMINI_API_KEY"));
});
