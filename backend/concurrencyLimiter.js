// 동시 처리 제한 + 대기열 (R1-02-01 H-1)
//
// SlimSAM은 1600px 이미지 2건을 동시에 처리하면 최대 RSS가 약 3.6GB까지 오른다.
// 컨테이너 메모리를 넘으면 서버가 재시작되고 진행 중인 요청이 모두 실패하므로,
// 한 번에 concurrency건만 처리하고 나머지는 차례를 기다리게 한다.
// 대기열이 가득 찼거나 maxWaitMs 안에 차례가 오지 않으면 LimiterBusyError로 거절한다.
// 기록은 서버 메모리에만 있다(인스턴스 1개 기준).

class LimiterBusyError extends Error {
  constructor(reason) {
    super(`처리 대기열이 가득 찼습니다 (${reason}).`);

    this.name = "LimiterBusyError";

    this.reason = reason;
  }
}

const createConcurrencyLimiter = ({
  concurrency = 1,
  maxQueue = 4,
  maxWaitMs = 45_000,
} = {}) => {
  let active = 0;

  const waiting = [];

  // 같은 자리를 두 번 돌려주지 않도록 한 번만 동작하는 release를 만든다
  const createRelease = () => {
    let released = false;

    return () => {
      if (released) {
        return;
      }

      released = true;

      active -= 1;

      drain();
    };
  };

  const drain = () => {
    while (active < concurrency && waiting.length > 0) {
      const next = waiting.shift();

      clearTimeout(next.timer);

      active += 1;

      next.resolve(createRelease());
    }
  };

  // 자리를 얻으면 release 함수를 돌려준다. 처리가 끝나면 반드시 호출해야 한다
  const acquire = () =>
    new Promise((resolve, reject) => {
      if (active < concurrency) {
        active += 1;

        resolve(createRelease());

        return;
      }

      if (waiting.length >= maxQueue) {
        reject(new LimiterBusyError("queue_full"));

        return;
      }

      const entry = { resolve, timer: null };

      entry.timer = setTimeout(() => {
        const index = waiting.indexOf(entry);

        if (index >= 0) {
          waiting.splice(index, 1);
        }

        reject(new LimiterBusyError("wait_timeout"));
      }, maxWaitMs);

      waiting.push(entry);
    });

  return {
    acquire,
    stats: () => ({ active, waiting: waiting.length }),
  };
};

module.exports = { createConcurrencyLimiter, LimiterBusyError };
