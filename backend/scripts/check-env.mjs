// 백엔드 배포 환경변수 점검 (Beta Launch) — 값은 절대 출력하지 않는다
//
// 이름이 있는지, 형식이 맞는지, 대상(QA/운영) 프로젝트가 맞는지만 확인한다.
// Railway 셸이나 배포 전 로컬에서 실행한다.
//
//   node backend/scripts/check-env.mjs --target qa
//   node backend/scripts/check-env.mjs --target production
//   node backend/scripts/check-env.mjs --target research     # 2026-11 사용자 조사 전용 프로젝트(운영·QA가 아니어야 함)
//   node backend/scripts/check-env.mjs --app --target research   # 앱 빌드(EAS) 변수 EXPO_PUBLIC_* 점검(R-13)
//   railway run node scripts/check-env.mjs --target production     # (승인 후) 서비스 변수로 실행
//
// 종료 코드: 오류(error)가 하나라도 있으면 1. 경고(warn)만 있으면 0.

import { fileURLToPath } from "node:url";

export const PRODUCTION_PROJECT_REF = "zkgsxavpyvxhrivzmqsp";

export const QA_PROJECT_REF = "xcwlgaoknxkxoqzfcrdf";

export const TARGETS = ["qa", "production", "research"];

const SUPABASE_URL_PATTERN = /^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/;

const isPositiveInt = (value) => /^[1-9][0-9]*$/.test(value);

// level: required(없으면 오류) | recommended(없으면 경고) | optional | forbidden(있으면 경고)
export const ENV_SPEC = [
  { name: "SUPABASE_URL", level: "required", secret: false, check: (v) => SUPABASE_URL_PATTERN.test(v) || "https://<ref>.supabase.co 형식이 아님" },
  { name: "SUPABASE_PUBLISHABLE_KEY", level: "required", secret: false, check: (v) => v.startsWith("sb_publishable_") || "sb_publishable_ 로 시작하지 않음(레거시 anon 키면 교체 권장)" },
  { name: "SUPABASE_SECRET_KEY", level: "required", secret: true, alt: "SUPABASE_SERVICE_ROLE_KEY", check: (v) => v.startsWith("sb_secret_") || "sb_secret_ 로 시작하지 않음(레거시 service_role 키면 교체 권장)" },
  { name: "GEMINI_API_KEY", level: "required", secret: true, check: (v) => v.length >= 20 || "길이가 너무 짧음" },
  { name: "BRIA_API_TOKEN", level: "required", secret: true, check: (v) => v.length >= 16 || "길이가 너무 짧음" },
  { name: "TRUST_PROXY", level: "required", secret: false, check: (v) => isPositiveInt(v) || "Railway 프록시 뒤에서는 1 이상의 정수여야 함" },
  { name: "OPS_METRICS_TOKEN", level: "recommended", secret: true, check: (v) => v.length >= 24 || "24자 이상 무작위 문자열 권장" },
  { name: "ALLOW_TOKENLESS_GUEST", level: "recommended", secret: false, check: (v) => ["true", "false", "1", "0", "on", "off", "yes", "no"].includes(v.toLowerCase()) || "true/false 값이 아님" },
  { name: "SUPPORT_EMAIL", level: "recommended", secret: false, check: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || "이메일 형식이 아님" },
  { name: "ANON_ANALYZE_LIMIT_PER_HOUR", level: "optional", secret: false, check: (v) => isPositiveInt(v) || "양의 정수가 아님" },
  { name: "USER_ANALYZE_LIMIT_PER_HOUR", level: "optional", secret: false, check: (v) => isPositiveInt(v) || "양의 정수가 아님" },
  { name: "IP_ANALYZE_LIMIT_PER_HOUR", level: "optional", secret: false, check: (v) => isPositiveInt(v) || "양의 정수가 아님" },
  { name: "GUEST_ANALYZE_LIMIT_PER_HOUR", level: "optional", secret: false, check: (v) => isPositiveInt(v) || "양의 정수가 아님" },
  { name: "GEMINI_MODEL", level: "optional", secret: false, check: (v) => /^gemini-[a-z0-9.-]+$/.test(v) || "gemini-… 형식이 아님" },
  { name: "GEMINI_THINKING_LEVEL", level: "optional", secret: false, check: () => true },
  { name: "GEMINI_REQUEST_MASK", level: "optional", secret: false, check: (v) => !["true", "1", "on", "yes"].includes(v.toLowerCase()) || "운영은 비워 두는 것이 기준(개발 트랙 인계)" },
  { name: "ALLOWED_ORIGINS", level: "optional", secret: false, check: (v) => v.split(",").every((o) => /^https?:\/\/[^/]+$/.test(o.trim())) || "Origin 목록 형식이 아님" },
  { name: "GEMINI_DAILY_LIMIT", level: "recommended", secret: false, check: (v) => isPositiveInt(v) || "양의 정수가 아님(서버 전체 Gemini 일일 상한, 한국 시간 자정 초기화)" },
  { name: "IMAGE_TASK_LIMIT_PER_HOUR", level: "optional", secret: false, check: (v) => isPositiveInt(v) || "양의 정수가 아님" },
  { name: "SLIMSAM_CONCURRENCY", level: "optional", secret: false, check: (v) => isPositiveInt(v) || "양의 정수가 아님" },
  { name: "SLIMSAM_MAX_QUEUE", level: "optional", secret: false, check: (v) => isPositiveInt(v) || "양의 정수가 아님" },
  { name: "SLIMSAM_QUEUE_WAIT_MS", level: "optional", secret: false, check: (v) => isPositiveInt(v) || "양의 정수가 아님" },
  { name: "ACCOUNT_DELETE_REAUTH_MAX_AGE_SECONDS", level: "optional", secret: false, check: (v) => isPositiveInt(v) || "양의 정수가 아님" },
  { name: "ACCOUNT_DELETE_WEB_ATTEMPTS_PER_HOUR", level: "optional", secret: false, check: (v) => isPositiveInt(v) || "양의 정수가 아님" },
  { name: "FAL_KEY", level: "forbidden", secret: true, reason: "앱이 fal 경로를 쓰지 않음 — 넣지 않는 것을 권장" },
];

// env를 받아 결과 목록을 돌려준다. 결과에는 값이 들어가지 않는다
export const checkEnv = (env, { target } = {}) => {
  const results = [];

  for (const spec of ENV_SPEC) {
    const usedName = env[spec.name] ? spec.name : spec.alt && env[spec.alt] ? spec.alt : null;

    const value = usedName ? String(env[usedName]).trim() : "";

    if (spec.level === "forbidden") {
      results.push({ name: spec.name, status: value ? "warn" : "ok", note: value ? spec.reason : "없음" });
      continue;
    }

    if (!value) {
      const status = spec.level === "required" ? "error" : spec.level === "recommended" ? "warn" : "ok";

      results.push({ name: spec.name, status, note: spec.level === "optional" ? "기본값 사용" : "설정 안 됨" });
      continue;
    }

    const verdict = spec.check(value);

    results.push({
      name: usedName === spec.name ? spec.name : `${spec.name} (${usedName})`,
      status: verdict === true ? "ok" : spec.level === "required" ? "error" : "warn",
      note: verdict === true ? (spec.secret ? "설정됨(값 숨김)" : "형식 확인") : verdict,
    });
  }

  // 대상 프로젝트 확인: QA 검증에 운영 DB를, 운영 배포에 QA DB를 쓰지 않게 한다
  const ref = SUPABASE_URL_PATTERN.exec(String(env.SUPABASE_URL ?? "").trim())?.[1];

  if (target && ref) {
    const isProduction = ref === PRODUCTION_PROJECT_REF;

    const isQa = ref === QA_PROJECT_REF;

    // research: 조사 데이터가 기존 운영·QA 데이터와 섞이지 않도록 둘 다 아니어야 한다
    const mismatch =
      target === "research" ? isProduction || isQa : (target === "production") !== isProduction;

    const kind = isProduction ? "운영" : isQa ? "QA" : "운영·QA가 아닌";

    results.push({
      name: "(대상 프로젝트)",
      status: mismatch ? "error" : "ok",
      note: mismatch
        ? `--target ${target} 인데 SUPABASE_URL은 ${kind} 프로젝트`
        : `${target} 프로젝트와 일치`,
    });
  }

  // 같은 값이 두 이름에 들어간 실수(관리자 키를 공개 키 자리에 넣는 등)
  const publishable = String(env.SUPABASE_PUBLISHABLE_KEY ?? "");

  const secret = String(env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY ?? "");

  if (publishable && secret && publishable === secret) {
    results.push({ name: "(키 중복)", status: "error", note: "공개 키와 관리자 키가 같은 값" });
  }

  for (const name of Object.keys(env)) {
    if (name.startsWith("EXPO_PUBLIC_") && /SECRET|SERVICE_ROLE|GEMINI_API_KEY|BRIA/.test(name)) {
      results.push({ name, status: "error", note: "비밀값처럼 보이는 EXPO_PUBLIC_ 변수(앱 번들에 노출됨)" });
    }
  }

  return results;
};

// 앱 빌드 변수(EXPO_PUBLIC_*) 점검 (R-13). 빌드 전에 EAS 환경 값으로 실행한다.
// API 주소가 비면 앱이 localhost로 가서 실기기 분석이 모두 실패한다(BUG-32)
export const checkAppEnv = (env, { target } = {}) => {
  const results = [];

  const value = (name) => String(env[name] ?? "").trim();

  const push = (name, status, note) => results.push({ name, status, note });

  const apiUrl = value("EXPO_PUBLIC_API_URL");

  if (!apiUrl) {
    push("EXPO_PUBLIC_API_URL", "error", "설정 안 됨 — 앱이 localhost로 요청함");
  } else if (!/^https:\/\/[^/\s]+(\/api)?\/?$/.test(apiUrl) || /localhost|127\.0\.0\.1/.test(apiUrl)) {
    push("EXPO_PUBLIC_API_URL", "error", "배포 서버의 https 주소가 아님(https://<호스트> 또는 같은 도메인 웹이면 https://<호스트>/api)");
  } else {
    push("EXPO_PUBLIC_API_URL", "ok", "형식 확인");
  }

  const supabaseUrl = value("EXPO_PUBLIC_SUPABASE_URL");

  const ref = SUPABASE_URL_PATTERN.exec(supabaseUrl)?.[1];

  push("EXPO_PUBLIC_SUPABASE_URL", ref ? "ok" : "error", ref ? "형식 확인" : "https://<ref>.supabase.co 형식이 아님");

  const publishable = value("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

  push(
    "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    publishable.startsWith("sb_publishable_") ? "ok" : "error",
    publishable.startsWith("sb_publishable_") ? "형식 확인" : "sb_publishable_ 로 시작하지 않음",
  );

  if (target && ref) {
    const isProduction = ref === PRODUCTION_PROJECT_REF;

    const isQa = ref === QA_PROJECT_REF;

    const mismatch =
      target === "research" ? isProduction || isQa : (target === "production") !== isProduction;

    push("(앱 대상 프로젝트)", mismatch ? "error" : "ok", mismatch ? `--target ${target}와 다른 프로젝트` : `${target} 프로젝트와 일치`);
  }

  const researchMode = value("EXPO_PUBLIC_RESEARCH_MODE");

  if (target === "research") {
    push("EXPO_PUBLIC_RESEARCH_MODE", researchMode === "true" ? "ok" : "error", researchMode === "true" ? "연구 빌드" : "조사 빌드는 true여야 함(이벤트 기록·진행자 화면)");
  } else if (researchMode) {
    push("EXPO_PUBLIC_RESEARCH_MODE", "warn", "조사 빌드가 아니면 비워 둠");
  }

  if (value("EXPO_PUBLIC_SHOW_PROTOTYPES")) {
    push("EXPO_PUBLIC_SHOW_PROTOTYPES", "error", "연구·배포 빌드에는 넣지 않음(프로토타입 화면 노출)");
  }

  if (value("EXPO_PUBLIC_GEMINI_PAID_TIER") !== "true") {
    push("EXPO_PUBLIC_GEMINI_PAID_TIER", "warn", "유료 등급 전환 후 true(무료 등급 고지 문구가 표시됨)");
  }

  for (const name of Object.keys(env)) {
    if (name.startsWith("EXPO_PUBLIC_") && /SECRET|SERVICE_ROLE|GEMINI_API_KEY|BRIA|FAL/.test(name)) {
      push(name, "error", "비밀값처럼 보이는 EXPO_PUBLIC_ 변수(앱 번들에 노출됨)");
    }
  }

  if (publishable && publishable.startsWith("sb_secret_")) {
    push("(키 종류)", "error", "앱에 관리자 키를 넣음");
  }

  return results;
};

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  const targetIndex = process.argv.indexOf("--target");

  const target = targetIndex === -1 ? undefined : process.argv[targetIndex + 1];

  if (target && !TARGETS.includes(target)) {
    console.error("--target 은 qa, production, research 중 하나");
    process.exit(2);
  }

  const results = process.argv.includes("--app")
    ? checkAppEnv(process.env, { target })
    : checkEnv(process.env, { target });

  const mark = { ok: "OK  ", warn: "WARN", error: "ERR " };

  for (const result of results) {
    console.log(`${mark[result.status]}  ${result.name.padEnd(40)} ${result.note}`);
  }

  const errors = results.filter((r) => r.status === "error").length;

  const warnings = results.filter((r) => r.status === "warn").length;

  console.log(`\n오류 ${errors} · 경고 ${warnings}${target ? ` · 대상 ${target}` : ""}`);

  process.exit(errors > 0 ? 1 : 0);
}
