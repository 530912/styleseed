// R-7 재시작 복구 감시 (Beta Launch)
//
// /healthz를 1초마다 확인해 응답이 끊긴 구간(다운타임)과 재시작(bootId 변경)을 기록한다.
// 실행 중에 Railway 대시보드에서 재시작(또는 재배포)을 누르고, 끝나면 복구 시간을 판정한다.
//
//   OPS_METRICS_TOKEN=… node backend/scripts/watch-health.mjs --api https://<host> --minutes 5 [--max-recovery-seconds 60]
//
// 종료 코드: 다운타임 하나라도 기준 초과면 1

const args = process.argv.slice(2);

const read = (name, fallback) => {
  const index = args.indexOf(name);

  return index === -1 ? fallback : args[index + 1];
};

const api = read("--api")?.replace(/\/+$/, "");

const minutes = Number(read("--minutes", "5"));

const maxRecoverySeconds = Number(read("--max-recovery-seconds", "60"));

if (!api) {
  console.error("사용법: node backend/scripts/watch-health.mjs --api <URL> [--minutes 5] [--max-recovery-seconds 60]");
  process.exit(2);
}

const token = process.env.OPS_METRICS_TOKEN;

const until = Date.now() + minutes * 60_000;

const outages = [];

let downSince = null;

let lastBootId = null;

let restarts = 0;

while (Date.now() < until) {
  const at = Date.now();

  let ok = false;

  let bootId = null;

  try {
    const response = await fetch(`${api}/healthz`, {
      headers: token ? { "X-Ops-Token": token } : {},
      signal: AbortSignal.timeout(3000),
    });

    ok = response.status === 200;

    bootId = (await response.json().catch(() => null))?.ops?.bootId ?? null;
  } catch {
    ok = false;
  }

  if (!ok && downSince === null) {
    downSince = at;

    console.log(`${new Date(at).toISOString()} DOWN`);
  }

  if (ok && downSince !== null) {
    const seconds = Math.round((at - downSince) / 1000);

    outages.push({ from: new Date(downSince).toISOString(), seconds });

    console.log(`${new Date(at).toISOString()} UP (다운타임 ${seconds}초)`);

    downSince = null;
  }

  if (bootId && lastBootId && bootId !== lastBootId) {
    restarts += 1;

    console.log(`${new Date(at).toISOString()} 재시작 감지(bootId 변경)`);
  }

  if (bootId) lastBootId = bootId;

  await new Promise((resolve) => setTimeout(resolve, 1000));
}

if (downSince !== null) {
  outages.push({ from: new Date(downSince).toISOString(), seconds: null, note: "감시 종료 시점까지 복구 안 됨" });
}

const failed = outages.filter((o) => o.seconds === null || o.seconds > maxRecoverySeconds);

console.log(JSON.stringify({ minutes, restarts, outages, maxRecoverySeconds, pass: failed.length === 0 }, null, 2));

process.exit(failed.length === 0 ? 0 : 1);
