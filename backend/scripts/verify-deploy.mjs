// 배포 검증 러너 R-1 ~ R-10 + 보안 점검 S-* (Beta Launch)
//
// 배포된(또는 로컬) 백엔드에 실제 요청을 보내 시나리오별 통과·실패를 판정하고 JSON 보고서를 남긴다.
// 상세 기준: docs/launch/RAILWAY_DEPLOY_RUNBOOK.md
//
// 묶음
//   smoke : Supabase 계정 없이 가능(R-1, R-2 대기 메모리, R-8, S-1~S-5). 운영 주소에도 안전
//   full  : QA Supabase에 테스트 계정을 만들어 R-1~R-10 + S-6~S-8 전체. 끝에 계정 삭제로 정리
//
// 실행 예
//   node backend/scripts/verify-deploy.mjs --api https://<railway-host> --suite smoke
//   QA_SUPABASE_URL=… QA_SUPABASE_PUBLISHABLE_KEY=… [QA_SUPABASE_SECRET_KEY=…] OPS_METRICS_TOKEN=… \
//     node backend/scripts/verify-deploy.mjs --api https://<railway-host> --suite full \
//     --samples /tmp/styleseed-samples --sequential 50 --concurrency 2,3,5 --soak-minutes 30 \
//     --analyze 10 --with-bria --report verify-report.json
//
// 비용이 드는 호출은 기본으로 끈다: --analyze N(Gemini N회), --with-bria(BRIA 1회).
// 비밀값은 환경변수로만 받고 보고서·로그에 남기지 않는다.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

import {
  criterion,
  isPrivateAddress,
  summarizeMemory,
  summarizeRuns,
  verdict,
} from "./lib/deploy-verify-lib.mjs";

const PRODUCTION_PROJECT_REF = "zkgsxavpyvxhrivzmqsp";

const here = path.dirname(fileURLToPath(import.meta.url));

const BUCKET = "clothing-images";

const SEGMENT_TIMEOUT_MS = 90_000; // 앱의 LOCAL_SEGMENT_TIMEOUT_MS와 같게

const ANALYZE_TIMEOUT_MS = 30_000;

const DEFAULTS = {
  suite: "smoke",
  users: 3,
  sequential: 50,
  concurrency: [2, 3, 5],
  concurrencyRounds: 2,
  soakMinutes: 0,
  analyze: 0,
  withBria: false,
  memoryLimitMB: 8192,
  memoryRatio: 0.75,
  sampleIntervalMs: 1000,
  local: false,
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const timed = async (fn) => {
  const startedAt = performance.now();

  try {
    const value = await fn();

    return { ...value, ms: Math.round(performance.now() - startedAt) };
  } catch (error) {
    return {
      status: error?.name === "TimeoutError" || error?.name === "AbortError" ? "timeout" : "network",
      ms: Math.round(performance.now() - startedAt),
    };
  }
};

// ---------------------------------------------------------------------------
// 원격 API 호출
// ---------------------------------------------------------------------------

const createApi = ({ api, opsToken }) => {
  const base = api.replace(/\/+$/, "");

  const health = async (headers = {}) => {
    const response = await fetch(`${base}/healthz`, {
      headers: { ...(opsToken ? { "X-Ops-Token": opsToken } : {}), ...headers },
      signal: AbortSignal.timeout(10_000),
    });

    return { status: response.status, body: await response.json().catch(() => null) };
  };

  const postJson = async (route, body, { token, timeoutMs = 30_000, headers = {} } = {}) => {
    const response = await fetch(`${base}${route}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });

    const text = await response.text();

    let json = null;

    try {
      json = JSON.parse(text);
    } catch {
      // PNG 등
    }

    return { status: response.status, json, headers: response.headers, bytes: text.length };
  };

  return { base, health, postJson };
};

// 1초마다 /healthz 운영 지표로 RSS·bootId를 기록한다(토큰이 없으면 아무것도 안 함)
const startMemorySampler = (api, intervalMs) => {
  const samples = [];

  let stopped = false;

  const loop = (async () => {
    while (!stopped) {
      try {
        const { body } = await api.health();

        samples.push({ t: Date.now(), rss: body?.ops?.memoryMB?.rss, bootId: body?.ops?.bootId });
      } catch {
        samples.push({ t: Date.now(), rss: undefined, bootId: undefined, down: true });
      }

      await sleep(intervalMs);
    }
  })();

  return {
    samples,
    stop: async () => {
      stopped = true;

      await loop;

      return samples;
    },
  };
};

// ---------------------------------------------------------------------------
// 샘플 이미지와 box
// ---------------------------------------------------------------------------

const loadSamples = (dir) => {
  const folder = dir ?? path.join(here, "../../assets/images/products");

  const files = fs
    .readdirSync(folder)
    .filter((name) => /\.(jpe?g)$/i.test(name))
    .sort()
    .map((name) => path.join(folder, name));

  if (files.length === 0) {
    throw new Error(`샘플 이미지가 없습니다: ${folder}`);
  }

  // 개발 트랙 품질 회귀 세트의 Gemini box를 재사용(파일 이름이 같으면)
  let knownBoxes = {};

  try {
    const fixture = JSON.parse(
      fs.readFileSync(path.join(here, "../test/fixtures/cutout-cases.json"), "utf8"),
    );

    knownBoxes = Object.fromEntries(fixture.cases.map((c) => [c.file, c.box2d]));
  } catch {
    // 없으면 가운데 80%
  }

  return files.map((file) => {
    const base = path.basename(file).replace(/^\d+x\d+-/, "");

    return { file, name: path.basename(file), box2d: knownBoxes[base] ?? [100, 100, 900, 900] };
  });
};

// ---------------------------------------------------------------------------
// QA 계정 준비·정리
// ---------------------------------------------------------------------------

const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};

const createTestUser = async ({ url, key }) => {
  const creds = {
    email: `verify-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}@example.com`,
    password: `Vrf-${crypto.randomBytes(12).toString("base64url")}`,
  };

  const client = createClient(url, key, clientOptions);

  const { data, error } = await client.auth.signUp(creds);

  if (error || !data.session) {
    throw new Error(`테스트 계정 생성 실패(QA 프로젝트 이메일 인증이 꺼져 있어야 함): ${error?.message ?? "세션 없음"}`);
  }

  return { creds, client, userId: data.user.id, token: data.session.access_token, deleted: false };
};

const uploadSamples = async (user, samples) => {
  const paths = [];

  for (const [index, sample] of samples.entries()) {
    const objectPath = `${user.userId}/originals/verify-${index}.jpg`;

    const { error } = await user.client.storage
      .from(BUCKET)
      .upload(objectPath, fs.readFileSync(sample.file), { contentType: "image/jpeg", upsert: true });

    if (error) {
      throw new Error(`샘플 업로드 실패: ${error.message}`);
    }

    paths.push({ ...sample, imagePath: objectPath });
  }

  return paths;
};

const freshToken = async (user, { url, key }) => {
  const client = createClient(url, key, clientOptions);

  const { data, error } = await client.auth.signInWithPassword(user.creds);

  if (error) throw new Error(`재로그인 실패: ${error.message}`);

  return data.session.access_token;
};

// ---------------------------------------------------------------------------
// 시나리오
// ---------------------------------------------------------------------------

const segment = (api, user, sample) =>
  timed(async () => {
    const response = await api.postJson(
      "/segment-garment-local",
      { imagePath: sample.imagePath, box2d: sample.box2d },
      { token: user.token, timeoutMs: SEGMENT_TIMEOUT_MS },
    );

    return { status: response.status, image: sample.name, code: response.json?.code };
  });

const memoryCriteria = (memory, options, label) => {
  const limit = options.memoryLimitMB * options.memoryRatio;

  return [
    criterion(`${label} 재시작 0`, memory.samples === 0 && memory.restarts === 0 ? null : memory.restarts === 0, `restarts=${memory.restarts}`),
    criterion(
      `${label} 최대 RSS ≤ ${Math.round(limit)}MB`,
      memory.peakMB === null ? null : memory.peakMB <= limit,
      `peak=${memory.peakMB}MB`,
    ),
  ];
};

export const runVerification = async (input) => {
  const options = { ...DEFAULTS, ...input };

  const api = createApi(options);

  const report = {
    startedAt: new Date().toISOString(),
    api: api.base,
    suite: options.suite,
    opsMetrics: Boolean(options.opsToken),
    scenarios: [],
  };

  const record = (id, title, criteria, metrics = {}) => {
    const entry = { id, title, verdict: verdict(criteria), criteria, metrics };

    report.scenarios.push(entry);

    options.log?.(`${entry.verdict.toUpperCase().padEnd(4)} ${id} ${title}`);

    return entry;
  };

  // ---------------- R-1 헬스 체크 ----------------
  const firstHealth = await timed(async () => {
    const result = await api.health();

    return { status: result.status, body: result.body };
  });

  const opsAvailable = Boolean(firstHealth.body?.ops);

  record("R-1", "헬스 체크·기동", [
    criterion("/healthz 200", firstHealth.status === 200, `status=${firstHealth.status}`),
    criterion("응답 2초 이내", firstHealth.ms <= 2000, `${firstHealth.ms}ms`),
    criterion(
      "운영 지표 사용 가능(OPS_METRICS_TOKEN)",
      options.opsToken ? opsAvailable : null,
      options.opsToken ? (opsAvailable ? "ok" : "토큰 불일치 또는 미설정") : "토큰 없이 실행",
    ),
  ], { uptimeSeconds: firstHealth.body?.uptimeSeconds, latencyMs: firstHealth.ms });

  const idleRss = firstHealth.body?.ops?.memoryMB?.rss ?? null;

  // ---------------- S-1~S-5 보안 점검 (계정 불필요) ----------------
  {
    const plain = await fetch(`${api.base}/healthz`).then((r) => r.json()).catch(() => null);

    const unauth = await api.postJson("/segment-garment-local", { imagePath: "x", box2d: [0, 0, 1, 1] }).catch(() => null);

    const badToken = await api.postJson("/segment-garment-local", {}, { token: "not-a-jwt" }).catch(() => null);

    const cors = await fetch(`${api.base}/healthz`, { headers: { Origin: "https://evil.example" } }).catch(() => null);

    const page = await fetch(`${api.base}/account-deletion`).catch(() => null);

    record("S-1..5", "보안 기본값(인증·CORS·헤더)", [
      criterion("S-1 토큰 없는 /healthz에 운영 지표 없음", plain ? plain.ops === undefined : false, plain ? "ok" : "응답 없음"),
      criterion("S-2 토큰 없는 이미지 처리 401", unauth?.status === 401, `status=${unauth?.status}`),
      criterion("S-3 잘못된 토큰 401", badToken?.status === 401, `status=${badToken?.status}`),
      criterion(
        "S-4 허용되지 않은 Origin에 CORS 허용 헤더 없음",
        cors ? cors.headers.get("access-control-allow-origin") === null : false,
        `acao=${cors?.headers.get("access-control-allow-origin")}`,
      ),
      criterion(
        "S-5 계정 삭제 페이지 200 + CSP·X-Frame-Options",
        page?.status === 200 &&
          /frame-ancestors 'none'/.test(page.headers.get("content-security-policy") ?? "") &&
          page.headers.get("x-frame-options") === "DENY",
        `status=${page?.status}`,
      ),
    ]);
  }

  // ---------------- R-8 프록시 IP ----------------
  {
    const spoofed = opsAvailable
      ? (await api.health({ "X-Forwarded-For": "203.0.113.7" })).body?.ops
      : null;

    record("R-8", "프록시 뒤 클라이언트 IP(TRUST_PROXY)", [
      criterion("X-Forwarded-For로 IP를 바꿀 수 없음", spoofed ? spoofed.clientIp !== "203.0.113.7" : null, `clientIp=${spoofed?.clientIp ?? "-"}`),
      criterion(
        "서버가 본 IP가 프록시(사설) 주소가 아님",
        spoofed && !options.local ? !isPrivateAddress(spoofed.clientIp) : null,
        options.local ? "로컬 실행: 판정 생략" : `trustProxy=${spoofed?.trustProxy ?? "-"}`,
      ),
    ], { clientIp: spoofed?.clientIp, trustProxy: spoofed?.trustProxy });
  }

  if (options.suite !== "full") {
    record("R-2", "대기 메모리", [
      criterion("기동 직후 RSS ≤ 512MB(첫 처리 전)", idleRss === null ? null : idleRss <= 512, `rss=${idleRss ?? "-"}MB`),
    ]);

    return finish(report);
  }

  // ---------------- full: 준비 ----------------
  const supa = { url: options.qaUrl, key: options.qaKey };

  if (!supa.url || !supa.key) {
    throw new Error("full 묶음에는 QA_SUPABASE_URL / QA_SUPABASE_PUBLISHABLE_KEY가 필요합니다.");
  }

  if (supa.url.includes(PRODUCTION_PROJECT_REF)) {
    throw new Error("운영 Supabase 프로젝트로는 full 검증을 실행하지 않습니다(테스트 계정·사진을 만듦).");
  }

  const samples = loadSamples(options.samples);

  const users = [];

  try {
    for (let i = 0; i < options.users; i += 1) {
      const user = await createTestUser(supa);

      user.samples = await uploadSamples(user, samples);

      users.push(user);
    }

    const [userA, userB] = users;

    // ---------------- S-6~S-8 데이터 보호 ----------------
    {
      const otherPath = await api.postJson(
        "/segment-garment-local",
        { imagePath: userB.samples[0].imagePath, box2d: [100, 100, 900, 900] },
        { token: userA.token },
      );

      const traversal = await api.postJson(
        "/segment-garment-local",
        { imagePath: `${userA.userId}/originals/../${userB.userId}/originals/verify-0.jpg`, box2d: [1, 1, 2, 2] },
        { token: userA.token },
      );

      const crossSign = await userA.client.storage.from(BUCKET).createSignedUrl(userB.samples[0].imagePath, 60);

      const tooLarge = await api.postJson(
        "/analyze-clothing",
        JSON.stringify({ imageBase64: "A".repeat(11 * 1024 * 1024) }),
        { token: userA.token, timeoutMs: 60_000 },
      ).catch(() => ({ status: "network" }));

      record("S-6..8", "사용자 데이터 보호(경로·RLS·본문 크기)", [
        criterion("S-6 다른 사용자 사진 경로 403", otherPath.status === 403 && otherPath.json?.code === "IMAGE_PATH_FORBIDDEN", `status=${otherPath.status}`),
        criterion("S-6 경로 조작(..) 400", traversal.status === 400, `status=${traversal.status}`),
        criterion("S-7 Storage RLS: 다른 사용자 파일 서명 불가", Boolean(crossSign.error) && !crossSign.data?.signedUrl, crossSign.error ? "거절됨" : "서명됨(위험)"),
        criterion("S-8 분석 본문 10MB 초과 413", tooLarge.status === 413, `status=${tooLarge.status}`),
      ]);
    }

    // ---------------- R-2 첫 처리 전후 메모리 ----------------
    const warmRun = await segment(api, userA, userA.samples[0]);

    await sleep(3000);

    const warmRss = (await api.health()).body?.ops?.memoryMB?.rss ?? null;

    record("R-2", "대기 메모리(첫 처리 전후)", [
      criterion(
        "첫 처리 전 RSS ≤ 512MB",
        idleRss === null || (firstHealth.body?.uptimeSeconds ?? 0) > 600 ? null : idleRss <= 512,
        idleRss === null ? "운영 지표 없음" : `rss=${idleRss}MB, uptime=${firstHealth.body?.uptimeSeconds}s`,
      ),
      criterion("첫 처리 성공", warmRun.status === 200 || warmRun.status === 422, `status=${warmRun.status}, ${warmRun.ms}ms`),
      criterion("첫 처리 후 RSS ≤ 2560MB", warmRss === null ? null : warmRss <= 2560, `rss=${warmRss ?? "-"}MB`),
    ], { idleRssMB: idleRss, warmRssMB: warmRss, firstSegmentMs: warmRun.ms });

    // ---------------- R-3 순차 처리 ----------------
    {
      const sampler = startMemorySampler(api, options.sampleIntervalMs);

      const runs = [];

      for (let i = 0; i < options.sequential; i += 1) {
        runs.push(await segment(api, userA, userA.samples[i % userA.samples.length]));
      }

      const memory = summarizeMemory(await sampler.stop());

      const summary = summarizeRuns(runs);

      record(`R-3`, `순차 처리 ${options.sequential}건`, [
        criterion("5xx·시간 초과 0", summary.serverErrors === 0 && summary.timeouts === 0, JSON.stringify(summary.statuses)),
        criterion("p90 ≤ 15초", summary.latencyMs.p90 === null ? null : summary.latencyMs.p90 <= 15_000, `p90=${summary.latencyMs.p90}ms`),
        ...memoryCriteria(memory, options, "R-3"),
      ], { summary, memory });
    }

    // ---------------- R-4 동시 처리 ----------------
    for (const level of options.concurrency) {
      const sampler = startMemorySampler(api, options.sampleIntervalMs);

      const runs = [];

      for (let round = 0; round < options.concurrencyRounds; round += 1) {
        const batch = Array.from({ length: level }, (_, i) => {
          const user = users[i % users.length];

          return segment(api, user, user.samples[(round + i) % user.samples.length]);
        });

        runs.push(...(await Promise.all(batch)));
      }

      const memory = summarizeMemory(await sampler.stop());

      const summary = summarizeRuns(runs);

      record(`R-4/c${level}`, `동시 처리 ${level}건 × ${options.concurrencyRounds}회`, [
        criterion("5xx·시간 초과(90초) 0", summary.serverErrors === 0 && summary.timeouts === 0, JSON.stringify(summary.statuses)),
        ...memoryCriteria(memory, options, `R-4/c${level}`),
      ], { summary, memory });
    }

    // ---------------- R-5 혼합 부하(시간 기반) ----------------
    if (options.soakMinutes > 0) {
      const sampler = startMemorySampler(api, options.sampleIntervalMs);

      const runs = [];

      const until = Date.now() + options.soakMinutes * 60_000;

      for (let i = 0; Date.now() < until; i += 1) {
        const user = users[i % users.length];

        runs.push(await segment(api, user, user.samples[i % user.samples.length]));

        if (i % 5 === 4) {
          // 옷 사진 교체·삭제와 비슷한 Storage 쓰기·지우기
          const tempPath = `${user.userId}/processing/soak-${i}.jpg`;

          await user.client.storage.from(BUCKET).upload(tempPath, fs.readFileSync(user.samples[0].file), { contentType: "image/jpeg" });

          await user.client.storage.from(BUCKET).remove([tempPath]);
        }
      }

      const memory = summarizeMemory(await sampler.stop());

      const summary = summarizeRuns(runs);

      record("R-5", `혼합 부하 ${options.soakMinutes}분`, [
        criterion("오류율 ≤ 1%(422 제외)", summary.errorRate <= 0.01, `${(summary.errorRate * 100).toFixed(2)}%`),
        criterion("메모리 상승 추세 없음(뒤 20% 평균 ≤ 앞 20% × 1.10)", memory.trend ? memory.trend.ratio <= 1.1 : null, JSON.stringify(memory.trend)),
        ...memoryCriteria(memory, options, "R-5"),
      ], { summary, memory });
    } else {
      record("R-5", "혼합 부하", [criterion("실행", null, "--soak-minutes 0 (건너뜀)")]);
    }

    // ---------------- R-6 품질 미달 → BRIA ----------------
    {
      const loafer = userA.samples.find((sample) => /brown-loafer/.test(sample.name)) ?? userA.samples[0];

      const lowQuality = await api.postJson(
        "/segment-garment-local",
        { imagePath: loafer.imagePath, box2d: [0, 0, 120, 120] },
        { token: userA.token, timeoutMs: SEGMENT_TIMEOUT_MS },
      );

      let bria = null;

      if (options.withBria) {
        const processingPath = `${userA.userId}/processing/verify-bria.jpg`;

        await userA.client.storage.from(BUCKET).upload(processingPath, fs.readFileSync(loafer.file), { contentType: "image/jpeg", upsert: true });

        bria = await timed(async () => {
          const response = await api.postJson("/remove-background", { imagePath: processingPath }, { token: userA.token, timeoutMs: 60_000 });

          return { status: response.status, hasUrl: Boolean(response.json?.cutoutUrl) };
        });

        await userA.client.storage.from(BUCKET).remove([processingPath]);
      }

      record("R-6", "품질 미달 판정과 BRIA 대체", [
        criterion("배경만 있는 상자 → 422 LOW_QUALITY_CUTOUT", lowQuality.status === 422 && lowQuality.json?.code === "LOW_QUALITY_CUTOUT", `status=${lowQuality.status}`),
        criterion("BRIA 배경 제거 200 + 결과 URL", bria ? bria.status === 200 && bria.hasUrl : null, bria ? `status=${bria.status}, ${bria.ms}ms` : "--with-bria 없음(비용 절약)"),
      ]);
    }

    // ---------------- R-10 Gemini 분석 ----------------
    if (options.analyze > 0) {
      const runs = [];

      for (let i = 0; i < options.analyze; i += 1) {
        const sample = userA.samples[i % userA.samples.length];

        runs.push(
          await timed(async () => {
            const response = await api.postJson(
              "/analyze-clothing",
              { imageBase64: fs.readFileSync(sample.file).toString("base64") },
              { token: userA.token, timeoutMs: ANALYZE_TIMEOUT_MS },
            );

            return { status: response.status, code: response.json?.code };
          }),
        );
      }

      const summary = summarizeRuns(runs);

      record("R-10", `Gemini 분석 ${options.analyze}회`, [
        criterion("모두 200", summary.statuses[200] === runs.length, JSON.stringify(summary.statuses)),
        criterion("p90 ≤ 10초", summary.latencyMs.p90 <= 10_000, `p90=${summary.latencyMs.p90}ms`),
      ], { summary });
    } else {
      record("R-10", "Gemini 분석", [criterion("실행", null, "--analyze 0 (건너뜀, 비용 절약)")]);
    }
  } finally {
    // ---------------- R-9 계정 삭제(= 정리) ----------------
    const deletions = [];

    for (const [index, user] of users.entries()) {
      try {
        if (index === users.length - 1 && users.length > 1) {
          // 마지막 계정은 웹 삭제 페이지로
          const response = await fetch(`${api.base}/account-deletion`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ ...user.creds, confirm: "yes" }).toString(),
          });

          deletions.push({ via: "web", status: response.status });
        } else {
          const token = await freshToken(user, supa);

          const response = await api.postJson("/account/delete", { confirm: "DELETE" }, { token });

          deletions.push({ via: "app", status: response.status });
        }

        user.deleted = deletions.at(-1).status === 200;
      } catch (error) {
        deletions.push({ via: "error", status: String(error?.message ?? error) });
      }
    }

    // 삭제 확인: 다시 로그인이 안 되는지, (관리자 키가 있으면) 사용자·파일·행이 0인지
    const checks = [];

    for (const user of users) {
      const login = await createClient(supa.url, supa.key, clientOptions).auth.signInWithPassword(user.creds);

      const entry = { loginBlocked: Boolean(login.error) };

      if (options.qaSecret) {
        const admin = createClient(supa.url, options.qaSecret, clientOptions);

        const { data: found } = await admin.auth.admin.getUserById(user.userId);

        const files = await Promise.all(
          ["originals", "processing", "cutouts"].map(async (folder) => (await admin.storage.from(BUCKET).list(`${user.userId}/${folder}`)).data?.length ?? 0),
        );

        const clothes = await admin.from("clothes").select("id", { count: "exact", head: true }).eq("user_id", user.userId);

        const usage = await admin.from("ai_usage").select("user_id", { count: "exact", head: true }).eq("user_id", user.userId);

        Object.assign(entry, {
          authUserGone: !found?.user,
          files: files.reduce((a, b) => a + b, 0),
          clothes: clothes.error ? null : clothes.count,
          aiUsage: usage.error ? null : usage.count,
        });

        // 삭제가 실패했으면 관리자 키로 정리(테스트 데이터를 남기지 않음)
        if (!user.deleted && found?.user) {
          const leftovers = (await admin.storage.from(BUCKET).list(`${user.userId}/originals`)).data ?? [];

          await admin.storage.from(BUCKET).remove(leftovers.map((f) => `${user.userId}/originals/${f.name}`));

          await admin.auth.admin.deleteUser(user.userId);

          entry.cleanedUpByAdmin = true;
        }
      }

      checks.push(entry);
    }

    if (users.length > 0) {
      record("R-9", "계정 삭제(앱·웹) 실연동", [
        criterion("삭제 요청 모두 200", deletions.every((d) => d.status === 200), JSON.stringify(deletions)),
        criterion("삭제 후 로그인 불가", checks.every((c) => c.loginBlocked), JSON.stringify(checks.map((c) => c.loginBlocked))),
        criterion(
          "Auth·Storage·clothes·ai_usage 0건",
          options.qaSecret ? checks.every((c) => c.authUserGone && c.files === 0 && c.clothes === 0 && c.aiUsage === 0) : null,
          options.qaSecret ? JSON.stringify(checks) : "QA_SUPABASE_SECRET_KEY 없음(관리자 확인 생략)",
        ),
      ]);
    }
  }

  return finish(report);
};

const finish = (report) => {
  report.finishedAt = new Date().toISOString();

  report.summary = {
    pass: report.scenarios.filter((s) => s.verdict === "pass").length,
    fail: report.scenarios.filter((s) => s.verdict === "fail").length,
    skip: report.scenarios.filter((s) => s.verdict === "skip").length,
  };

  return report;
};

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const parseArgs = (argv) => {
  const read = (name) => {
    const index = argv.indexOf(name);

    return index === -1 ? undefined : argv[index + 1];
  };

  const num = (name, fallback) => (read(name) === undefined ? fallback : Number(read(name)));

  return {
    api: read("--api"),
    suite: read("--suite") ?? DEFAULTS.suite,
    samples: read("--samples"),
    users: num("--users", DEFAULTS.users),
    sequential: num("--sequential", DEFAULTS.sequential),
    concurrency: (read("--concurrency") ?? DEFAULTS.concurrency.join(",")).split(",").map(Number).filter((n) => n > 0),
    concurrencyRounds: num("--rounds", DEFAULTS.concurrencyRounds),
    soakMinutes: num("--soak-minutes", DEFAULTS.soakMinutes),
    analyze: num("--analyze", DEFAULTS.analyze),
    withBria: argv.includes("--with-bria"),
    memoryLimitMB: num("--memory-limit-mb", DEFAULTS.memoryLimitMB),
    local: argv.includes("--local"),
    report: read("--report"),
  };
};

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  const args = parseArgs(process.argv.slice(2));

  if (!args.api || !["smoke", "full"].includes(args.suite)) {
    console.error("사용법: node backend/scripts/verify-deploy.mjs --api <URL> --suite smoke|full [옵션] (파일 머리말 참고)");
    process.exit(2);
  }

  const report = await runVerification({
    ...args,
    opsToken: process.env.OPS_METRICS_TOKEN,
    qaUrl: process.env.QA_SUPABASE_URL,
    qaKey: process.env.QA_SUPABASE_PUBLISHABLE_KEY,
    qaSecret: process.env.QA_SUPABASE_SECRET_KEY,
    log: (line) => console.log(line),
  });

  console.log(`\n통과 ${report.summary.pass} · 실패 ${report.summary.fail} · 건너뜀 ${report.summary.skip}`);

  if (args.report) {
    fs.writeFileSync(args.report, `${JSON.stringify(report, null, 2)}\n`);

    console.log(`보고서: ${args.report}`);
  }

  process.exit(report.summary.fail > 0 ? 1 : 0);
}
