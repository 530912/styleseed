// 백엔드가 직접 보여주는 웹 페이지 (계정 삭제 요청)
// 외부 스크립트·이미지 없이 HTML과 인라인 CSS만 쓴다(Content-Security-Policy: default-src 'none').

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const STYLES = `
  :root { color-scheme: light dark; --ink: #111111; --body: #555555; --line: #dddddd; --bg: #ffffff; --danger: #cc0000; --surface: #f4f4f4; }
  @media (prefers-color-scheme: dark) { :root { --ink: #f2f2f2; --body: #b5b5b5; --line: #3a3a3a; --bg: #161616; --danger: #ff6b6b; --surface: #222222; } }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.6 -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif; }
  main { max-width: 560px; margin: 0 auto; padding: 32px 16px 48px; }
  h1 { font-size: 22px; margin: 0 0 4px; letter-spacing: -0.2px; }
  h2 { font-size: 15px; margin: 28px 0 8px; }
  p, li { color: var(--body); }
  ul { padding-left: 20px; margin: 8px 0; }
  .eyebrow { font-size: 12px; font-weight: 700; letter-spacing: 1.4px; color: var(--body); margin: 0 0 8px; }
  .box { background: var(--surface); padding: 14px 16px; margin: 16px 0; }
  label { display: block; font-weight: 600; margin: 16px 0 6px; }
  input[type=email], input[type=password] { width: 100%; padding: 12px; font: inherit; color: var(--ink); background: var(--bg); border: 1px solid var(--line); border-radius: 0; }
  .check { display: flex; gap: 10px; align-items: flex-start; font-weight: 400; color: var(--ink); }
  .check input { margin-top: 5px; }
  button { margin-top: 24px; width: 100%; padding: 14px; font: inherit; font-weight: 700; color: #ffffff; background: var(--danger); border: 0; cursor: pointer; }
  .error { color: var(--danger); font-weight: 600; }
  footer { margin-top: 40px; font-size: 13px; color: var(--body); }
`;

const layout = (title, body) => `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)}</title>
<style>${STYLES}</style>
</head>
<body>
<main>
${body}
</main>
</body>
</html>`;

const DELETED_DATA = `
<ul>
  <li>계정(이메일·로그인 정보)</li>
  <li>옷장에 등록한 옷 정보(종류·색상·소재·계절 등 분석 결과)</li>
  <li>올린 옷 사진 원본과 배경을 지운 이미지</li>
  <li>AI 분석 사용 횟수 기록</li>
</ul>`;

const supportLine = (supportEmail) =>
  supportEmail
    ? `<footer>비밀번호를 잊었거나 로그인할 수 없다면 <a href="mailto:${escapeHtml(supportEmail)}">${escapeHtml(supportEmail)}</a>로 계정 이메일과 함께 삭제를 요청해주세요.</footer>`
    : `<footer>비밀번호를 잊었다면 앱의 로그인 화면에서 비밀번호를 재설정한 뒤 다시 시도해주세요.</footer>`;

const renderDeletionPage = ({ state, email = "", error = null, supportEmail = null }) => {
  if (state === "done") {
    return layout(
      "STYLESEED 계정 삭제 완료",
      `<p class="eyebrow">STYLESEED</p>
<h1>계정을 삭제했습니다</h1>
<p>계정과 옷장 데이터, 사진을 모두 지웠습니다. 삭제한 정보는 되돌릴 수 없습니다.</p>
<p>앱에 로그인된 기기가 있다면 앱을 다시 열 때 로그아웃 상태로 바뀝니다.</p>`,
    );
  }

  return layout(
    "STYLESEED 계정 삭제 요청",
    `<p class="eyebrow">STYLESEED</p>
<h1>계정 삭제 요청</h1>
<p>STYLESEED 앱 계정과 관련 데이터를 삭제합니다. 앱에서는 <b>내 옷장 → 계정 → 회원 탈퇴</b>에서도 삭제할 수 있습니다.</p>

<h2>삭제되는 정보</h2>
${DELETED_DATA}
<p>삭제는 요청 즉시 처리되며 되돌릴 수 없습니다.</p>

<div class="box">본인 확인을 위해 앱에서 쓰는 이메일과 비밀번호를 입력해주세요. 입력한 비밀번호는 본인 확인에만 쓰고 저장하지 않습니다.</div>

${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ""}

<form method="post" action="/account-deletion" autocomplete="on">
  <label for="email">이메일</label>
  <input id="email" name="email" type="email" required autocomplete="username" value="${escapeHtml(email)}">

  <label for="password">비밀번호</label>
  <input id="password" name="password" type="password" required autocomplete="current-password">

  <label class="check"><input type="checkbox" name="confirm" value="yes" required> 계정과 모든 데이터가 삭제되며 되돌릴 수 없다는 것을 확인했습니다.</label>

  <button type="submit">계정 영구 삭제</button>
</form>

${supportLine(supportEmail)}`,
  );
};

module.exports = { escapeHtml, renderDeletionPage };
