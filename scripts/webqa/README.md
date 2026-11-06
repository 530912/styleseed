# 모바일 웹 QA 도구 (2026-11 사용자 조사)

모두 이 Mac 안에서만 동작한다. 실제 Supabase·운영 DB·Gemini에는 연결하지 않는다.

| 파일 | 하는 일 |
|---|---|
| `run-safari-sim.sh` | **실제 iOS Safari(Xcode 시뮬레이터) 회귀 시험.** ① [옷장 → 옷 탭 → 코디 → TOP 3 → 뒤로 → 새로고침] N회 ② 24MP·HEIC 사진 처리와 24MP 15회 반복 메모리. `bash scripts/webqa/run-safari-sim.sh 5` |
| `mock-supabase.mjs` | 가짜 Supabase(인증·옷장 DB·사진 저장소, 사용자별 접근 제한 흉내), 127.0.0.1:54321 |
| `static-server.mjs` | Cloudflare Pages·Caddy와 같은 clean URL 정적 서버 |
| `seed.mjs` | 가짜 Supabase에 시험 사용자 + 옷 3벌 |
| `qa-driver.js`, `qa-image.html` | 시험 빌드 **복사본에만** 넣는 드라이버(배포 빌드에는 없음, `deploy-web-cloudflare.sh`가 `__qa-*` 파일이 있으면 중단) |

## Playwright WebKit 주의 (2026-10-27 확인)

Playwright WebKit(build v2215, WebKit 26.0)은 **`history.pushState` 2번 → 뒤로 → 새로고침/이동**에서 페이지 프로세스가 죽는다. 앱 코드가 전혀 없는 빈 HTML에서도, 데스크톱 설정에서도 같다. **실제 iOS Safari(26.5)에서는 같은 순서·같은 앱 경로가 정상**(위 시험 ①). 그래서 이 경로는 Playwright가 아니라 `run-safari-sim.sh`로 확인한다.
