// 실제 Safari 회귀 시험용 드라이버 — run-safari-sim.sh가 QA 빌드 복사본의 HTML에만 넣는다(배포물에는 없음)
// [옷장 로드 → 옷 탭 → 코디 → TOP 3 → history.back() → 새로고침]을 N회 반복하고 단계마다 가짜 Supabase에 기록한다
// (2026-10-27 Playwright WebKit은 이 경로에서 페이지가 죽지만 실제 iOS Safari는 정상 — 도구 결함 구분용)
(() => {
  const ping = (stage) => fetch("http://127.0.0.1:54321/__ping/" + stage).catch(() => {});
  const ss = sessionStorage;
  // 주소 끝: #qa-session=<base64 세션>~runs=<N> (base64의 +·/·=를 그대로 두려고 URLSearchParams를 쓰지 않는다)
  const m = /^#qa-session=([^~]+)(?:~runs=(\d+))?$/.exec(location.hash);
  if (m) {
    // 이전 시험의 옷장·세션 캐시가 남지 않게 비우고 세션만 넣는다
    localStorage.clear(); ss.clear();
    localStorage.setItem("sb-127-auth-token", atob(decodeURIComponent(m[1])));
    ss.setItem("qa-active", "1"); ss.setItem("qa-run", "0"); ss.setItem("qa-stage", "start"); ss.setItem("qa-runs", m[2] ?? "3");
    location.replace("/closet"); return;
  }
  if (ss.getItem("qa-active") !== "1") return;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const waitText = async (re, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (re.test(document.body?.innerText ?? "")) return; await sleep(250); } throw new Error("wait " + re.source.slice(0, 20)); };
  const tap = async (re) => {
    const t0 = Date.now();
    while (Date.now() - t0 < 15000) {
      const el = [...document.querySelectorAll("div,span")].reverse().find((e) => e.childElementCount === 0 && re.test(e.textContent));
      if (el) { const o = { bubbles: true, cancelable: true, view: window };
        for (const t of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) el.dispatchEvent(t.startsWith("pointer") ? new PointerEvent(t, o) : new MouseEvent(t, o)); return; }
      await sleep(250);
    }
    throw new Error("tap " + re.source.slice(0, 20));
  };
  // load 이벤트는 이미지가 다 받아져야 오므로 기다리지 않는다(스크립트는 body 끝에서 실행)
  setTimeout(async () => {
    const run = Number(ss.getItem("qa-run")); const stage = ss.getItem("qa-stage");
    try {
      if (stage === "reloading") { ping(`survived-${run}`); if (run >= Number(ss.getItem("qa-runs"))) { ss.setItem("qa-active", "0"); ping("done"); document.title = "QA DONE"; return; } ss.setItem("qa-stage", "start"); location.href = "/closet"; return; }
      const n = run + 1; ss.setItem("qa-run", String(n)); ping(`start-${n}`);
      await waitText(/DIGITAL CLOSET · 3벌/); await sleep(800);
      await tap(/^WHITE SHIRT$/); await sleep(300); await tap(/^이 옷으로 코디하기$/);
      await waitText(/MATCH/); ping(`styling-${n}-${encodeURIComponent(location.pathname)}`); await sleep(500);
      await tap(/^TOP 3 코디$/); await waitText(/TOP 3 LOOK/); ping(`top3-${n}-hist${history.length}`); await sleep(500);
      history.back(); await waitText(/베스트 코디/); ping(`back-${n}-${encodeURIComponent(location.pathname)}`); await sleep(800);
      ss.setItem("qa-stage", "reloading"); location.reload();
    } catch (e) { ping("err-" + encodeURIComponent(String(e.message))); ss.setItem("qa-active", "0"); }
  }, 0);
})();
