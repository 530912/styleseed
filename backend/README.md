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

## 엔드포인트와 인증 (Sprint 1A-1)

| 엔드포인트 | 토큰 없음 (guest) | 로그인 토큰 | 잘못된·만료 토큰 | 본문 제한 |
|---|---|---|---|---|
| `GET /` | 허용 | 허용 | 허용 | — |
| `POST /analyze-clothing` | 허용 + guest 한도 | 허용 | 401 `AUTH_INVALID` | 10mb |
| `POST /segment-garment-local` | 401 `AUTH_REQUIRED` | 허용 | 401 | 1mb |
| `POST /apply-garment-mask` | 401 | 허용 | 401 | 1mb |
| `POST /remove-background` | 401 | 허용 | 401 | 1mb |
| `POST /segment-garment` (앱에서 호출하지 않음) | 401 | 허용 | 401 | 1mb |

- 토큰은 `Authorization: Bearer <Supabase access token>`으로 보낸다. 앱은 `src/lib/api.ts`가 자동으로 붙인다.
- 검증은 `supabase-js`의 `auth.getClaims`를 쓴다. Publishable key만 필요하고 Secret은 쓰지 않는다. Auth 서버에 닿지 못하면 503 `AUTH_UNAVAILABLE`.
- 익명 세션 토큰(`is_anonymous`)은 guest로 취급한다. 현재 Supabase 익명 로그인은 꺼져 있다(PRD FR-AUTH-07).

### Guest 분석 한도 — 임시 정책

- 로그인하지 않은 사용자의 분석은 **IP당 시간당 10회**(`GUEST_ANALYZE_LIMIT_PER_HOUR`). 초기 개발 가설이다.
- 서버 메모리에 저장하므로 재시작하면 초기화된다. 같은 Wi-Fi(NAT) 사용자는 한도를 함께 쓴다.
- 프록시 헤더(`X-Forwarded-For`)는 기본으로 **신뢰하지 않는다**. 리버스 프록시 뒤에 배포할 때만 `TRUST_PROXY`에 프록시 단계 수를 지정한다.
- 초과하면 429 `GUEST_RATE_LIMITED` + `retryAfterSeconds`. 앱은 "로그인하면 바로 계속 분석할 수 있어요"라고 안내한다.
- 영구·사용자별 한도는 PRD 1A-08(SEC-02), 익명 세션 전환은 1A-05(FR-AUTH-07)에서 대체한다.

## 오류 코드

| HTTP | code | 의미 |
|---|---|---|
| 400 | `INVALID_JSON` | 본문이 JSON이 아님 |
| 401 | `AUTH_REQUIRED` / `AUTH_INVALID` | 로그인 필요 / 토큰 무효·만료 |
| 413 | `PAYLOAD_TOO_LARGE` | 본문 크기 초과 |
| 429 | `GUEST_RATE_LIMITED` / `AI_RATE_LIMITED` | guest 한도 초과 / Gemini 한도 초과 |
| 502 | `UPSTREAM_FAILED` | BRIA 실패 |
| 503 | `AI_BUSY` / `AUTH_UNAVAILABLE` | Gemini 혼잡 / Auth 서버 연결 실패 |
| 504 | `AI_TIMEOUT` / `UPSTREAM_TIMEOUT` | Gemini / 이미지 처리 외부 호출 시간 초과 |
