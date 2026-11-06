// 배포 검증 러너 자체 시험 (Beta Launch DV-01 ~ 03)
//
// DV-01·02: 순수 함수(통계·판정·사설 IP) — 항상 실행
// DV-03: 실제 server.js + 실제 SlimSAM + 가짜 Supabase(backend/test/support/fakeSupabase.js)로
//        verify-deploy.mjs의 full 묶음을 처음부터 끝까지 실행한다. 모델 실행으로 30초 안팎 걸려
//        기본은 건너뛴다:  DEPLOY_VERIFY_SELFTEST=1 node --test backend/test/deploy-verify.test.js
const test = require("node:test");
const assert = require("node:assert/strict");

const lib = () => import("../scripts/lib/deploy-verify-lib.mjs");

test("DV-01 통계: 상태 집계, 422는 오류 아님, 백분위", async () => {
  const { summarizeRuns, percentile } = await lib();

  const summary = summarizeRuns([
    { status: 200, ms: 100 },
    { status: 422, ms: 200 },
    { status: 502, ms: 300 },
    { status: "timeout", ms: 90_000 },
  ]);

  assert.deepEqual(summary.statuses, { 200: 1, 422: 1, 502: 1, timeout: 1 });
  assert.equal(summary.serverErrors, 1);
  assert.equal(summary.timeouts, 1);
  assert.equal(summary.unexpected, 2);
  assert.equal(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 90), 9);
  assert.equal(percentile([], 50), null);
});

test("DV-02 메모리 요약(재시작·추세), 판정 규칙, 사설 IP", async () => {
  const { summarizeMemory, verdict, criterion, isPrivateAddress } = await lib();

  const memory = summarizeMemory([
    { rss: 2000, bootId: "a" },
    { rss: 2100, bootId: "a" },
    { rss: undefined, bootId: undefined, down: true },
    { rss: 300, bootId: "b" },
    { rss: 2400, bootId: "b" },
  ]);

  assert.equal(memory.peakMB, 2400);
  assert.equal(memory.restarts, 1);
  assert.equal(memory.trend.headAvgMB, 2000);
  assert.equal(memory.trend.tailAvgMB, 2400);

  assert.equal(verdict([criterion("a", true), criterion("b", null)]), "pass");
  assert.equal(verdict([criterion("a", true), criterion("b", false)]), "fail");
  assert.equal(verdict([criterion("a", null)]), "skip");

  for (const ip of ["10.1.2.3", "::ffff:192.168.0.1", "172.20.0.1", "100.64.0.9", "127.0.0.1", "fd12:3456::1"]) {
    assert.equal(isPrivateAddress(ip), true, ip);
  }

  for (const ip of ["203.0.113.7", "8.8.8.8", "172.32.0.1", "100.128.0.1"]) {
    assert.equal(isPrivateAddress(ip), false, ip);
  }
});

test(
  "DV-03 full 묶음 종단 실행(실제 서버·SlimSAM, 가짜 Supabase): 모든 시나리오 pass 또는 의도된 skip",
  { skip: process.env.DEPLOY_VERIFY_SELFTEST === "1" ? false : "DEPLOY_VERIFY_SELFTEST=1 일 때만", timeout: 300_000 },
  async () => {
    const { createFakeSupabase } = require("./support/fakeSupabase");

    const fake = createFakeSupabase();

    const supabaseUrl = await fake.listen();

    process.env.SUPABASE_URL = supabaseUrl;
    process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_fake_local";
    process.env.SUPABASE_SECRET_KEY = fake.secretKey;
    process.env.OPS_METRICS_TOKEN = "selftest-ops-token-0123456789";
    process.env.ALLOWED_ORIGINS = "http://localhost:8081";

    const app = require("../server");

    const server = await new Promise((resolve) => {
      const s = app.listen(0, "127.0.0.1", () => resolve(s));
    });

    const { runVerification } = await import("../scripts/verify-deploy.mjs");

    try {
      const report = await runVerification({
        api: `http://127.0.0.1:${server.address().port}`,
        suite: "full",
        local: true,
        opsToken: process.env.OPS_METRICS_TOKEN,
        qaUrl: supabaseUrl,
        qaKey: "sb_publishable_fake_local",
        qaSecret: fake.secretKey,
        users: 2,
        sequential: 3,
        concurrency: [2],
        concurrencyRounds: 1,
        soakMinutes: 0,
        analyze: 0,
        withBria: false,
      });

      const byId = Object.fromEntries(report.scenarios.map((s) => [s.id, s]));

      const failures = report.scenarios.filter((s) => s.verdict === "fail");

      assert.deepEqual(failures.map((f) => ({ id: f.id, criteria: f.criteria.filter((c) => c.ok === false) })), []);

      for (const id of ["R-1", "S-1..5", "R-8", "S-6..8", "R-2", "R-3", "R-4/c2", "R-6", "R-9"]) {
        assert.equal(byId[id]?.verdict, "pass", id);
      }

      assert.equal(byId["R-5"].verdict, "skip");
      assert.equal(byId["R-10"].verdict, "skip");

      // 테스트 계정·파일이 남지 않는다
      assert.equal(fake.users.size, 0);
      assert.equal(fake.objects.size, 0);

      console.log(JSON.stringify(report.scenarios.map((s) => [s.id, s.verdict, s.metrics?.memory?.peakMB ?? null])));
    } finally {
      await new Promise((resolve) => server.close(resolve));
      await fake.close();
    }
  },
);
