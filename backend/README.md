# STYLESEED Backend

Express 서버. Gemini 의류 분석과 이미지 처리(로컬 SlimSAM, BRIA 배경 제거)를 담당한다.

## 실행

```bash
npm run backend        # http://localhost:3001
npm run test:backend   # 백엔드 테스트 (Node 내장 테스트 러너, 외부 서비스에 연결하지 않음)
npm run test:client    # 앱 오류 처리 단위 테스트
```

### 실연동 E2E (QA Supabase 프로젝트 전용)

```bash
E2E_SUPABASE_URL=https://<qa-ref>.supabase.co \
E2E_SUPABASE_PUBLISHABLE_KEY=sb_publishable_... \
npm run test:e2e
```

- 실제 QA Supabase(Auth·DB·Storage), Gemini, 로컬 SlimSAM(실패 시 BRIA)을 호출한다. 운영 프로젝트 주소면 실행을 거부한다.
- QA 프로젝트는 운영과 같은 정책(`supabase/migrations/20261017000000_baseline_clothes_rls_storage.sql`)을 적용하고, **이메일 인증을 꺼 둔** 상태여야 한다.
- 실행마다 테스트 계정 2개를 새로 만든다. 옷 행·Storage 파일은 끝에서 지우지만 Auth 사용자 행은 관리자 키가 없어 QA 프로젝트에 남는다.
- Gemini 무료 등급 호출을 1~3회 쓴다.

환경변수는 루트 `.env`를 읽는다. 키 목록은 루트 `.env.example`을 본다.

## 엔드포인트와 인증 (Sprint 1A-2)

| 엔드포인트 | 토큰 없음 (guest) | 익명 세션 토큰 | 정식 로그인 토큰 | 잘못된·만료 토큰 | 본문 제한 |
|---|---|---|---|---|---|
| `GET /` | 허용 | 허용 | 허용 | 허용 | — |
| `POST /analyze-clothing` | 임시 호환 모드에서만 허용(`ALLOW_TOKENLESS_GUEST`, 기본 켜짐), 끄면 401 | 허용 + 익명 한도 | 허용 + 사용자 한도 | 401 `AUTH_INVALID` | 10mb |
| 이미지 처리 4종 (`/segment-garment-local`, `/apply-garment-mask`, `/remove-background`, `/segment-garment`) | 401 `AUTH_REQUIRED` | **403 `ANONYMOUS_NOT_ALLOWED`** | 허용 | 401 | 1mb |

### 이미지 처리 입력 (SSRF 차단)

- 요청 본문에는 URL이 아니라 **Storage 경로**를 보낸다: `{ "imagePath": "{userId}/originals/{파일}.jpg", ... }`
- 서버는 경로 형식(`originals`·`processing` 폴더, 이미지 확장자, `..` 금지)과 **첫 폴더 = 토큰의 사용자 ID**를 확인한다. 형식 오류 400 `INVALID_IMAGE_PATH`, 다른 사용자 폴더 403 `IMAGE_PATH_FORBIDDEN`, 파일 없음 404 `IMAGE_NOT_FOUND`.
- 서버가 **요청한 사용자의 토큰으로** 서명 URL을 만든다(관리자 키 불필요). 서명 URL이 설정된 Supabase 주소가 아니면 502. `imageUrl` 입력은 무시한다.

### AI 분석 한도 (`backend/quota.js`)

| 대상 | 기준 | 기본값(개발·QA 가설) | 저장 위치 |
|---|---|---|---|
| 정식 사용자 | 사용자 ID, 1시간 | 30 (`USER_ANALYZE_LIMIT_PER_HOUR`) | Supabase `ai_usage`(재시작해도 유지) |
| 익명 세션 | 사용자 ID, 1시간 | 30 (`ANON_ANALYZE_LIMIT_PER_HOUR`) | Supabase `ai_usage` |
| 익명·guest 공통 | IP, 1시간 | 30 (`IP_ANALYZE_LIMIT_PER_HOUR`) | 서버 메모리 |
| 토큰 없는 guest | IP, 1시간 | 10 (`GUEST_ANALYZE_LIMIT_PER_HOUR`) | 서버 메모리 |

- `consume_ai_quota` 함수를 사용자 본인 토큰으로 호출한다. 저장소에 닿지 못하면 분석을 막지 않고 메모리 한도로 대체한다(경고 로그).
- 운영 한도는 AI 비용과 남용 방지를 고려해 환경변수로 따로 정하고, 베타 전에 다시 검토한다.

- 토큰은 `Authorization: Bearer <Supabase access token>`으로 보낸다. 앱은 `src/lib/api.ts`가 자동으로 붙인다.
- 검증은 `supabase-js`의 `auth.getClaims`를 쓴다. Publishable key만 필요하고 Secret은 쓰지 않는다. Auth 서버에 닿지 못하면 503 `AUTH_UNAVAILABLE`.
- 익명 세션 토큰(`is_anonymous`)은 guest로 취급한다. 현재 Supabase 익명 로그인은 꺼져 있다(PRD FR-AUTH-07).

### IP 기준 한도 — 공통 원칙

- IP 기준 한도(익명·guest 공통 상한, 토큰 없는 guest 한도)는 서버 메모리에 저장하므로 재시작하면 초기화된다. 같은 Wi-Fi(NAT) 사용자는 한도를 함께 쓴다.
- 프록시 헤더(`X-Forwarded-For`)는 기본으로 **신뢰하지 않는다**. 리버스 프록시 뒤에 배포할 때만 `TRUST_PROXY`에 프록시 단계 수를 지정한다.
- 초과하면 429 `GUEST_RATE_LIMITED`(익명·guest) 또는 `USER_RATE_LIMITED`(정식) + `retryAfterSeconds`.

## 오류 코드

| HTTP | code | 의미 |
|---|---|---|
| 400 | `INVALID_JSON` | 본문이 JSON이 아님 |
| 400 | `INVALID_IMAGE_PATH` | 이미지 경로 형식 오류 |
| 401 | `AUTH_REQUIRED` / `AUTH_INVALID` | 로그인 필요 / 토큰 무효·만료 |
| 403 | `ANONYMOUS_NOT_ALLOWED` / `IMAGE_PATH_FORBIDDEN` | 익명 세션으로 이미지 처리 / 다른 사용자 폴더 |
| 404 | `IMAGE_NOT_FOUND` | 이미지 없음(또는 Storage 권한 없음) |
| 413 | `PAYLOAD_TOO_LARGE` | 본문 크기 초과 |
| 429 | `GUEST_RATE_LIMITED` / `USER_RATE_LIMITED` / `AI_RATE_LIMITED` | 익명·guest 한도 / 정식 사용자 한도 / Gemini 한도 |
| 502 | `UPSTREAM_FAILED` | BRIA 실패 |
| 503 | `AI_BUSY` / `AUTH_UNAVAILABLE` | Gemini 혼잡 / Auth 서버 연결 실패 |
| 504 | `AI_TIMEOUT` / `UPSTREAM_TIMEOUT` | Gemini / 이미지 처리 외부 호출 시간 초과 |
