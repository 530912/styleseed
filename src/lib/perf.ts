// 단계별 처리 시간 기록 (Sprint 1A-3). 개발 빌드에서만 콘솔에 남긴다.
// 출시 후 행동 이벤트(PRD FR-DATA-01)가 생기면 그쪽으로 옮긴다.

export const now = () => Date.now();

export const perfLog = (
  stage: string,
  startedAt: number,
  extra: Record<string, unknown> = {},
) => {
  if (!__DEV__) {
    return;
  }

  console.log(
    `[perf] ${stage}`,
    JSON.stringify({ ms: Date.now() - startedAt, ...extra }),
  );
};
