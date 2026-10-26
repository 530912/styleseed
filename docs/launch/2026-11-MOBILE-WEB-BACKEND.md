# 2026-11 사용자 조사 — iPhone Safari 모바일 웹 MVP 백엔드 준비

| 항목 | 내용 |
|---|---|
| 작성 | 2026-10-27, 출시 트랙 Claude B |
| 변경 | 배포 방식: iOS TestFlight → **iPhone Safari 모바일 웹**(Expo Web). 백엔드는 카페24 EASY C 유지 |
| 유지 | Railway 이전 계획(`2026-11-CAFE24-TO-RAILWAY-PLAN.md`), iOS·EAS 자료(`EAS_SETUP.md`, `STORE_*`) — 삭제하지 않음 |
| 브랜치 | `integration/mvp-2026-11` (커밋 `388e051` 이후, 로컬) |
| 하지 않은 것 | 운영 DB 변경, 결제, 외부 배포 |

---

## 0. 결론: 웹 화면과 API를 같은 도메인에 둔다

```
https://styleseed.mycafe24.com/          → Expo Web 정적 파일 (Caddy file_server)
https://styleseed.mycafe24.com/api/...   → Express 백엔드 (Caddy → api:3001)
```

- **같은 출처**라 CORS 사전 요청·허용 목록·쿠키 문제가 **생기지 않는다.** 인증은 쿠키가 아니라 `Authorization: Bearer` 헤더라 다른 도메인이어도 동작하지만, 같은 도메인이 설정할 것이 가장 적다.
- 앱의 API 주소: **`EXPO_PUBLIC_API_URL=https://styleseed.mycafe24.com/api`** (앱 코드 변경 없음 — 주소 뒤에 경로를 붙이는 구조).
- 서버는 `/api/x`와 `/x`를 같은 경로로 처리한다(이번 수정). 그래서 나중에 Railway(접두어 없음)로 옮겨도 같은 앱 빌드가 `…/api`로 동작한다.
- 웹을 **다른 도메인**(예: Vercel)에 두는 경우: 서버 `ALLOWED_ORIGINS=https://<웹 주소>` 한 줄. 허용 Origin의 사전 요청(Authorization·Content-Type 헤더 포함)이 통과하는 것을 테스트로 확인했다(OG-15).

## 1. 항목별 점검

| # | 항목 | 상태 | 근거 |
|---|---|---|---|
| 1 | 카페24 Ubuntu 배포 준비 | **준비 완료, 서버 미개통** | `deploy/vm/`: `bootstrap.sh`(키·보안·Docker) → `deploy.sh`(API) → `deploy-web.sh`(웹) → `status.sh`. 문법·YAML 확인만, 실서버 미실행 |
| 2 | HTTPS·CORS | **준비 완료** | Caddy 자동 인증서(Let's Encrypt). 같은 도메인 `/api`. 다른 도메인이면 `ALLOWED_ORIGINS`. 테스트 OG-14(`/api` 별칭), OG-15(사전 요청 허용·차단) |
| 3 | 웹에서 Gemini 분석 | **코드 준비, 실서버 미검증** | 앱 → `POST /api/analyze-clothing`(base64 JPEG) → 이미지 사전 검사 → Gemini. 웹 분석은 Claude A가 로컬 웹에서 5회 성공(10/26). 배포 후 E2E에서 확인 |
| 4 | Safari HEIC/HEIF·JPEG | **앱이 JPEG로 변환** | 사진 선택 직후 `prepareClothingImage`가 긴 변 1600px·JPEG로 다시 저장(웹은 canvas). iPhone Safari는 앨범 사진을 파일 선택 시 보통 JPEG로 넘긴다. 서버도 JPEG·PNG·WEBP·HEIC 시그니처를 받는다. **실기기 미확인** — W-3에서 HEIC 원본(아이폰 기본 카메라 사진)으로 확인 |
| 5 | 웹 인증·세션·리디렉션 | **설정 2개만** | 웹 세션은 브라우저 localStorage(`persistSession`). 앱은 이메일·비밀번호와 익명 로그인만 쓰고 **리디렉션(매직 링크·OAuth)을 쓰지 않는다**(코드 확인). 이메일 인증 끔 → 메일 링크 없음. 조사 프로젝트 Auth의 **Site URL**과 **Redirect URLs**에 `https://styleseed.mycafe24.com` 등록(만일을 위해) |
| 6 | 조사용 Supabase DB·Storage | **절차 준비, PO 생성 대기** | `supabase/research/README.md`. Supabase API·Storage는 브라우저에서 바로 호출(Supabase가 CORS 허용) |
| 7 | 참가자별 권한·RLS | **확인** | 마이그레이션 재구성 DB에서 본인 행만·남의 행 쓰기 거절·익명 차단·Storage 본인 폴더만(10/26), 확인 SQL 9항목. 웹이라도 같은 Supabase 정책 |
| 8 | 비밀키 비공개 | **확인** | 웹 번들에는 `EXPO_PUBLIC_*`(공개 값)만. `deploy-web.sh`가 업로드 전 번들에서 서버 비밀값 문자열을 찾으면 중단. 서버 비밀값은 서버 `api.env`(권한 600)만 |
| 9 | 요청 제한·비용·로그 | **조정** | 같은 Wi-Fi에서 로그인 전 분석이 한 IP를 공유 → `IP_ANALYZE_LIMIT_PER_HOUR=120` 권장(템플릿 반영). 비용 상한 `GEMINI_DAILY_LIMIT=300`·Gemini 선불 $10. 오류는 한 줄 JSON(`http_error`, `gemini_call`) |
| 10 | Claude A 인계 | 3장 | |

## 2. 이번 수정 (웹 때문에 필요했던 것)

| 수정 | 이유 | 확인 |
|---|---|---|
| **웹에서 `Alert.alert` → 브라우저 `alert`/`confirm`** (`src/lib/webAlert.ts`, `_layout.tsx`에서 1회 설치) | react-native-web의 `Alert.alert`는 **빈 함수**다(`node_modules/react-native-web/.../Alert/index.js`). 웹에서 **옷 삭제·계정 삭제 확인 창이 안 떠서 삭제 불가**, 로그인 실패·저장 실패 안내도 안 보였다(8개 화면) | 규칙 단위 테스트 WA-01~04. **웹 실제 실행**: 동의 철회 → 브라우저 alert에 안내 문구 표시 |
| 서버 `/api` 별칭 | 같은 도메인에서 웹(`/`)과 API(`/api`) 공존, Railway 이전 시 앱 재빌드 불필요 | OG-14 |
| 웹 삭제 페이지 폼 `action=""` | `/api` 아래에서도 자기 주소로 전송 | OG-14 |
| Caddy: 웹 정적 + `/api` 프록시, 캐시 헤더 | 같은 도메인 배포 | 실서버 미실행 |
| `check-env --app`이 `https://<호스트>/api` 허용 | 앱 빌드 변수 점검 | EV-06 |

회귀(`verify-all.sh --export`): backend 103(+1 skip), client 55, engine 35, fkd 36, round1 16, tsc 0, 웹 내보내기 성공.

## 3. Claude A 인계 — 웹 배포 직후 바로 연동 테스트

### 3-1. 웹 빌드 변수 (`expo export --platform web` 할 때 셸에)

```bash
EXPO_PUBLIC_API_URL=https://styleseed.mycafe24.com/api
EXPO_PUBLIC_SUPABASE_URL=<조사 프로젝트 URL>
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<조사 프로젝트 publishable key>
EXPO_PUBLIC_RESEARCH_MODE=true
EXPO_PUBLIC_GEMINI_PAID_TIER=true        # Gemini 유료 전환 후
# 넣지 않음: EXPO_PUBLIC_SHOW_PROTOTYPES
node backend/scripts/check-env.mjs --app --target research   # 오류 0이어야 함
npx expo export --platform web --output-dir dist
```

### 3-2. 웹 올리기

`SERVER=root@<IP> bash deploy/vm/deploy-web.sh dist` — 번들 비밀값 검사 → 업로드 → 한 번에 교체 → Caddy 재생성. (SSH 키는 이 Mac의 `~/.ssh/styleseed_cafe24`. A 작업 트리에서 하려면 `dist`를 B 작업 트리로 넘기거나 B가 실행)

### 3-3. 연동 테스트 (iPhone Safari, 순서대로)

| # | 확인 | 통과 기준 |
|---|---|---|
| W-1 | `https://styleseed.mycafe24.com/api/healthz` | 200, `gemini.model = gemini-3.6-flash` |
| W-2 | `https://styleseed.mycafe24.com/` | 홈 화면, 자물쇠(HTTPS), 콘솔에 Mixed Content·CORS 오류 없음 |
| W-3 | 업로드 → **아이폰 카메라 원본(HEIC)** 선택 | 미리보기 표시(JPEG 변환), 분석 화면으로 진행 |
| W-4 | 첫 분석 전 **AI 동의 화면** → 동의 | 분석 30초 안에 결과. 서버 로그 `gemini_call` 200 |
| W-5 | 결과 수정 → 저장 → 가입(이메일·비밀번호) | 가입 직후 저장, 옷장에 배경 제거 이미지(또는 원본) |
| W-6 | 새로고침·Safari 종료 후 다시 열기 | 로그인 유지, 옷장 그대로 |
| W-7 | 옷 삭제 | **확인 창이 뜨고**(이번 수정), 삭제 후 목록에서 사라짐 |
| W-8 | 틀린 비밀번호로 로그인 | 한국어 오류 **창이 뜸**(이번 수정) |
| W-9 | 진행자 화면 [세션 종료] → 다음 참가자가 업로드·분석 | 이전 옷장 안 보임, **동의 화면 다시 표시**(BUG-31) |
| W-10 | 웹 삭제 페이지 `…/api/account-deletion` | 페이지 표시(계정 삭제는 앱 계정 화면으로 테스트) |
| W-11 | 같은 Wi-Fi에서 2명이 동시에 저장 | 둘 다 저장, `status.sh` 메모리 6GB 미만 |
| B | `verify-deploy --api https://styleseed.mycafe24.com/api --suite smoke` → `full --analyze 1` → `verify-research-db.sql` | 통과, 테스트 계정 정리 |

### 3-4. Safari 주의 (A 화면 점검 시)
- **개인정보 보호 브라우징(비공개 탭)**은 탭을 닫으면 로그인·동의·조사 이벤트 기록(localStorage)이 지워진다 → 일반 탭 사용 안내.
- Safari는 7일 이상 방문하지 않은 사이트의 저장소를 지울 수 있다(ITP) → 조사 기간 짧아 영향 적음.
- 웹 알림 창은 브라우저 기본 모양(`alert`/`confirm`). 확인 창 문구 끝에 `[확인] 삭제 · [취소] 취소`처럼 버튼 의미를 붙였다.
- 조사 이벤트 기록은 출처(도메인)별 저장소에 남는다 → 도메인이 바뀌면 기록이 이어지지 않으니 세션마다 내보내기.

## 4. 남은 차단 문제

| # | 문제 | 해결 |
|---|---|---|
| 1 | 카페24 서버 **설치 중(IP 미발급)** | 개통 대기 |
| 2 | 이 세션에서 서버로 **SSH 불가**(샌드박스, 네트워크 22번 차단 가능성) | PO가 `bootstrap.sh` 실행(다른 네트워크 필요할 수 있음), 이후 SSH 허용 또는 PO가 `deploy*.sh` 실행 |
| 3 | **조사용 Supabase**·**Gemini 키** 미준비 | PO(`supabase/research/README.md`, `GO-LIVE-STEPS` 2장) |
| 4 | `mycafe24.com` 주소는 Railway로 가져갈 수 없음 | 12월 이전 시 웹·API 주소가 바뀌어 **웹 재배포 필요**(모바일 웹은 재배포가 쉬워 큰 문제 아님). 자체 도메인을 쓰면 DNS만 변경 |
| 5 | Railway 이전 시 웹 정적 호스팅 | Railway는 API만 → 웹은 별도 호스팅(다른 도메인) → `ALLOWED_ORIGINS` 설정 필요(이미 지원) |
| 6 | 서버 위치 일본 | 처리방침 국외 이전 항목 갱신(출시 트랙) |
| 7 | 실기기(iPhone Safari) 미검증 | 3-3 W-1~W-11 |
