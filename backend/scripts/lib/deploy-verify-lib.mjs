// 배포 검증 러너의 순수 함수 (Beta Launch) — 네트워크·파일을 쓰지 않는다(단위 테스트 대상)

export const percentile = (values, p) => {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);

  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
};

// 요청 결과 목록 → 상태별 개수·지연 통계
export const summarizeRuns = (runs) => {
  const statuses = {};

  for (const run of runs) {
    statuses[run.status] = (statuses[run.status] ?? 0) + 1;
  }

  const latencies = runs.filter((run) => typeof run.ms === "number").map((run) => run.ms);

  const serverErrors = runs.filter((run) => typeof run.status === "number" && run.status >= 500).length;

  const timeouts = runs.filter((run) => run.status === "timeout" || run.status === "network").length;

  // 422(품질 미달)는 정상 판정 결과라 오류로 세지 않는다
  const unexpected = runs.filter(
    (run) => !(run.status === 200 || run.status === 422),
  ).length;

  return {
    count: runs.length,
    statuses,
    serverErrors,
    timeouts,
    unexpected,
    errorRate: runs.length === 0 ? 0 : unexpected / runs.length,
    latencyMs: {
      p50: percentile(latencies, 50),
      p90: percentile(latencies, 90),
      max: latencies.length ? Math.max(...latencies) : null,
    },
  };
};

// 메모리 표본([{t, rss, bootId}]) → 최대값, 재시작 횟수, 앞·뒤 구간 평균(추세)
export const summarizeMemory = (samples, { windowRatio = 0.2 } = {}) => {
  const valid = samples.filter((sample) => typeof sample.rss === "number");

  if (valid.length === 0) {
    return { samples: 0, peakMB: null, restarts: countRestarts(samples), trend: null };
  }

  const size = Math.max(1, Math.floor(valid.length * windowRatio));

  const average = (list) => list.reduce((sum, sample) => sum + sample.rss, 0) / list.length;

  const head = average(valid.slice(0, size));

  const tail = average(valid.slice(-size));

  return {
    samples: valid.length,
    peakMB: Math.max(...valid.map((sample) => sample.rss)),
    restarts: countRestarts(samples),
    trend: { headAvgMB: round(head), tailAvgMB: round(tail), ratio: round(tail / head, 3) },
  };
};

export const countRestarts = (samples) => {
  let restarts = 0;

  let previous = null;

  for (const sample of samples) {
    if (!sample.bootId) continue;

    if (previous && sample.bootId !== previous) restarts += 1;

    previous = sample.bootId;
  }

  return restarts;
};

const round = (value, digits = 1) => {
  const factor = 10 ** digits;

  return Math.round(value * factor) / factor;
};

// 기준 하나: { name, ok: boolean | null(측정 불가), detail }
export const criterion = (name, ok, detail) => ({ name, ok, detail });

// 시나리오 판정: 기준이 모두 true면 pass, 하나라도 false면 fail, 판정 가능한 기준이 없으면 skip
export const verdict = (criteria) => {
  if (criteria.some((c) => c.ok === false)) return "fail";

  if (criteria.some((c) => c.ok === true)) return "pass";

  return "skip";
};

// 사설·프록시 주소인지(배포 환경에서 서버가 본 클라이언트 IP가 이것이면 TRUST_PROXY 설정이 틀린 것)
export const isPrivateAddress = (ip) => {
  const value = String(ip ?? "").replace(/^::ffff:/, "");

  return (
    /^(10\.|127\.|192\.168\.|169\.254\.)/.test(value) ||
    /^172\.(1[6-9]|2[0-9]|3[01])\./.test(value) ||
    /^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\./.test(value) ||
    value === "::1" ||
    /^f[cd][0-9a-f]{2}:/i.test(value)
  );
};
