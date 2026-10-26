# 2026-11 사용자 조사 MVP — 백엔드 배포 준비 (Claude B)

> **10/27 최종 준비·PO 실행 순서는 `2026-11-MVP-GO-LIVE-STEPS.md`가 우선한다.**

| 항목 | 내용 |
|---|---|
| 작성 | 2026-10-26, 출시 트랙 Claude B |
| 목표 | 조사 참가자가 **외부 네트워크**에서 앱으로 사진 등록 → Gemini 분석 → 코디 추천을 쓸 수 있는 백엔드 |
| 기준 브랜치 | **`integration/mvp-2026-11`** (로컬, Push 안 함) = `release/beta-prep` + `audit/2026-11-mvp`(Claude A) + 이번 수정 |
| 참고 | `docs/handoff/2026-11-MVP-BACKEND-AUDIT.md`(B 1차 감사), Claude A `docs/release/2026-11-MVP-INTEGRATED-STATUS.md`·`2026-11-MVP-BUG-LIST.md`·`docs/handoff/2026-11-MVP-BACKEND-REQUEST.md`(R-1~R-9) |
| 하지 않은 것 | 결제·유료 전환, 운영 환경변수 변경, 외부 배포, Push, **기존 운영 DB 쓰기**(읽기 전용 조회만) |

표기: **실행** = 실제로 돌려 확인 · **코드** = 코드만 · **⛔** = PO 승인 필요

---

## 0. 결론 요약

| 질문 | 답 |
|---|---|
| 1. 추천 서버 호스팅 | **Railway Hobby, 싱가포르, 서비스 1개·복제 1개, 메모리 상한 8GB.** 백엔드만 월 **약 $24~29(약 3.4만~4.1만 원)**. 조사 기간 전체 고정비 합계(호스팅 + 조사 DB + Gemini) **월 약 $50~55** |
| 2. 조사 전용 DB | **새 Supabase 조직(Pro) + 새 프로젝트 `styleseed-research` 1개**(월 $25). 저장소 마이그레이션 5개로 스키마를 만들고(빈 Postgres에서 2회 재적용 성공 확인), Auth 설정 4가지를 수동 복제. **기존 운영·QA 프로젝트는 손대지 않음.** 개발 `.env`는 QA 프로젝트로 |
| 3. 수정한 오류 | 계정 삭제·`/healthz` 404(통합), 잘못된 이미지로 Gemini 호출(R-8), 모델 불일치 추적(R-3), 서버 전체 Gemini 일일 상한(비용), 오류 JSON 로그(R-9), fal 경로 비활성(R-4), JSON 404·500 — 5장 |
| 4. 통합 순서 | 7장 |
| 5. 승인 필요 | 8장 (6건) |

**새로 발견한 위험:** 오늘(10/26 22시경) Gemini가 매우 느렸다. 같은 사진 분석이 12.5초 → 다음 두 번은 **25초 초과로 504**, 8토큰짜리 텍스트 요청도 `gemini-3.6-flash` 19.8초, `gemini-3.5-flash`는 45초 무응답(**실행**). 서버 제한 25초·앱 제한 30초로는 혼잡 시간에 분석이 실패한다 → 6-3절.

---

## 1. 현재 서버 실행 구조

```
[앱(Expo)] ──HTTPS──▶ [Express 백엔드, 1 프로세스]
   │                     ├─ POST /analyze-clothing   → Gemini (사진 base64, 저장 안 함)
   │                     ├─ POST /segment-garment-local → SlimSAM(프로세스 안, 동시 1건 + 대기열 4)
   │                     ├─ POST /remove-background  → BRIA(유료)
   │                     ├─ POST /apply-garment-mask
   │                     ├─ POST /segment-garment    → fal(앱 미사용, FAL_KEY 없으면 404)
   │                     ├─ GET  /healthz · POST /account/delete · GET/POST /account-deletion
   │                     └─ 상태는 메모리(IP·guest·이미지 처리·Gemini 일일 카운터)
   └──직접──▶ [Supabase] Auth · Postgres(clothes, ai_usage, RLS) · Storage(clothing-images, 비공개)
```

- 앱은 사진을 Storage에 **직접** 올리고 서버에는 경로만 보낸다(서버에 `/upload` 경로는 원래 없음).
- 추천 엔진은 앱 안에서 실행된다(서버 이전은 조사 후, Claude A 7장 결정).
- 배포 이미지: `Dockerfile`이 `backend/`만 담고 `backend/package.json`만 설치. SlimSAM 모델은 빌드 때 받아 둔다.
- **배포 방식으로 상시 실행 컨테이너 1개를 고른 이유:** SlimSAM이 프로세스 메모리에 약 2.2GB 상주(첫 추론 후)하고, 요청 한도·대기열이 메모리 기반이라 복제가 1개여야 정확하다. 요청 기반(Cloud Run, 최소 인스턴스 0)은 매번 모델 로딩 콜드스타트가 생긴다.

## 2. 호스팅 후보와 비용

가격은 `COST_ESTIMATE.md`·`RAILWAY_DEPLOY_RUNBOOK.md`(2026-10-19 공식 가격표 조회) 기준. 가입 시 다시 확인한다.

| 후보 | 월 비용(조사 규모) | 장점 | 단점 | 판단 |
|---|---|---|---|---|
| **Railway Hobby(싱가포르, 8GB 상한)** | **$24~29** (RAM 상시 2.2GB가 대부분) | 상시 실행(콜드스타트 없음), Dockerfile 그대로, 런북·검증 스크립트 준비 완료, HTTPS 기본 도메인 | 서울 리전 없음(한국→싱가포르 왕복 수십 ms), 자동 확장 약함 | **권장** |
| Railway Pro | $24~29 (같음, $20 포함분) | 팀원 초대·지원 | 조사 규모에서 차이 없음 | 공개 출시 때 재검토 |
| Cloud Run(서울), 최소 인스턴스 0 | 약 $0 | 무료 구간 | **첫 요청마다 모델 로딩 콜드스타트**, 메모리 카운터가 인스턴스마다 따로 | 조사 UX에 부적합 |
| Cloud Run, 최소 인스턴스 1 | 약 $60~115 | 서울 리전, 자동 확장 | 비쌈, 배포 도구 새로 준비 | 비권장 |
| 진행자 PC + Expo Go(M2 대안) | $0 | 즉시 가능 | **외부 네트워크 불가**(같은 Wi-Fi만), PC가 꺼지면 중단 | 이번 목표와 맞지 않음. 비상용 |

**조사 기간 월 고정비 합계(권장안):** Railway $24~29 + Supabase 조사 프로젝트 $25 + Gemini 사용량(18명 × 10벌 × 재분석 포함 약 300회 × 2~6원 ≈ 1천~2천 원) + BRIA(SlimSAM 실패분만, 1회 약 $0.02) ≈ **월 $50~55(약 7만~7.7만 원)**.

### API 주소 구조

| 항목 | 값 |
|---|---|
| 기본 주소 | `https://<서비스명>.up.railway.app` (Railway 기본 HTTPS 도메인). 사용자 도메인(`api.<도메인>`)은 선택, 조사에는 불필요 |
| 경로 | 현재 그대로(`/analyze-clothing` 등). 버전 접두어(`/v1`)는 앱 변경이 필요해 넣지 않음 |
| 앱 설정 | `EXPO_PUBLIC_API_URL=https://<서비스명>.up.railway.app` (끝 `/` 없이. 있어도 앱이 지움) |
| 헬스 체크 | `GET /healthz` → `{"status":"ok","uptimeSeconds":…,"gemini":{"model":…,"lastServedModel":…}}`. Railway 헬스 체크 경로로 지정 |
| 운영 지표 | `X-Ops-Token` 헤더(= `OPS_METRICS_TOKEN`)일 때만 메모리·bootId·오늘 Gemini 호출 수 |

### 보안 점검(배포 설정 기준)

| 항목 | 상태 | 근거 |
|---|---|---|
| CORS | 허용 목록만(네이티브 앱은 Origin 없음) | **실행**: 외부 Origin에 ACAO 없음 |
| 인증 | 분석 = 로그인·익명 세션, 이미지 처리 = 로그인만, 무효 토큰 401 | **실행** 13건 |
| 토큰 없는 분석 | 배포값 `ALLOW_TOKENLESS_GUEST=false` → 401 | **실행**(로컬 서버) |
| 요청 제한 | 분석 사용자별 시간당 30·IP 30, 이미지 처리 사용자별 시간당 60(Claude A), **서버 전체 Gemini 일일 상한(이번 추가)** | 단위 테스트 |
| SlimSAM 메모리 | 동시 1건 + 대기열 4, 넘치면 503 `CUTOUT_BUSY` → 앱이 BRIA로 대체(Claude A) | 단위 테스트. **실모델 동시 메모리는 배포 후 측정(U-3)** |
| 오류 로그 | 400 이상 응답·Gemini 호출을 한 줄 JSON으로(이번 추가) | **실행**: 로컬 서버 로그 |
| Gemini 키 보호 | 서버 환경변수만. 앱 번들에 없음 | **실행**: 통합 브랜치 웹 내보내기 7.8MB 검색 0건, `check-env`가 `EXPO_PUBLIC_*` 비밀값 차단 |
| fal | `FAL_KEY`를 넣지 않으면 경로 404(이번 추가). 로컬 `FAL_KEY`는 잔액 소진 키(BUG-29) | 단위 테스트 |

## 3. 개발 DB와 조사 DB 분리

### 3-1. 현재 연결 관계 (**실행**: 읽기 전용 조회)

| 프로젝트 | ref | 플랜 | 누가 쓰나 | 데이터 |
|---|---|---|---|---|
| "운영" | `zkgsxa…` | Free | **로컬 개발 `.env`(앱·백엔드 모두)** | 사용자 5(익명 2), 옷 9, 파일 18 — 모두 테스트 데이터로 보임 |
| QA | `xcwlga…` | Free | E2E(`npm run test:e2e`)만 | 테스트 계정 |
| 조사 | 없음 | — | — | — |

Supabase Free는 **활성 무료 프로젝트 2개 제한**(공식 가격표, 10/26 확인) → 지금 두 자리를 다 써서 무료로 세 번째를 만들 수 없다.

### 3-2. 선택지

| 안 | 내용 | 월 비용 | 기존 데이터 영향 | 판단 |
|---|---|---|---|---|
| **A. 새 Pro 조직 + `styleseed-research` 1개** | 조사 전용 조직을 Pro로 만들고 프로젝트 1개. 운영·QA는 기존 무료 조직에 그대로 | **$25**(Pro에 Micro 1개분 크레딧 포함) | 없음 | **권장** — 완전 분리, 일시정지 없음, 조사 끝나면 내보내기·삭제가 쉬움 |
| B. 기존 "운영" 프로젝트를 Pro로 올려 조사에 사용 | 스키마 작업 없음 | $25 | 테스트 데이터와 조사 데이터가 한 DB에 섞임(참가자 계정 목록으로 구분) | 차선. "조사 전용" 요구와 어긋남 |
| C. 기존 무료 조직에 세 번째 프로젝트 | 무료 한도 초과 → 조직을 Pro로 올려야 하고, 그러면 운영·QA도 컴퓨트 과금 | 약 $45 | 없음 | 비쌈 |
| D. QA 프로젝트를 조사용으로 | 무료 | $0 | E2E 환경 상실, 무료 일시정지 위험 | 비권장 |

### 3-3. 권장안(A) 구축 순서와 의존성

| # | 작업 | 내용 | 의존성 검토 결과 |
|---|---|---|---|
| 1 | ⛔ 조직·프로젝트 생성 | 새 조직 `STYLESEED Research`(Pro), 프로젝트 `styleseed-research`. 리전은 **서울(ap-northeast-2) 권장**(앱이 Supabase에 직접 올리고 받으므로 참가자 체감 속도, 국내 보관) — 백엔드(싱가포르)↔DB 왕복은 서명 URL 발급 정도라 영향 적음. 싱가포르로 맞춰도 무방(PO 결정) | — |
| 2 | 스키마 | `supabase/migrations/` 5개를 순서대로 SQL Editor에 실행(또는 CLI `supabase link` + `db push`) | **실행**: 빈 Postgres(PGlite)+Supabase 대역 스키마에 5개를 **두 번** 적용 → 오류 0, 재실행 안전. RLS 동작 확인(본인 행만 조회, 남의 user_id로 insert 거절, 남의 행 삭제 0건, 익명 세션 조회 0건, 사용량 함수 1→2, Storage 본인 폴더만) |
| 3 | Auth 설정(수동) | ① 가입 허용 ② **이메일 확인 끔**(`mailer_autoconfirm=true` — 앱의 "가입 직후 저장"이 의존) ③ **익명 로그인 켬**(로그인 전 분석) ④ 비밀번호 정책은 운영과 같게 | 운영에서 확인된 값(Claude A 10/26, 메모 10/19). Site URL·리디렉션은 앱이 쓰지 않음(`detectSessionInUrl: false`) |
| 4 | 키 | Publishable key(앱·백엔드), **새 Secret key**(백엔드 계정 삭제 전용, 이름 예 `railway-research`) | Secret key는 앱·저장소에 넣지 않음 |
| 5 | 확인 | 운영 DB 쿼리와 같은 카탈로그 조회(RLS·정책 10개·버킷 10MB/MIME 5종·`anon` 권한 없음·함수 권한) | — |
| — | Edge Function | **없음** | 저장소에 `supabase/functions` 없음 |
| — | 트리거·확장·뷰·cron | **없음**(확장은 기본값뿐, 사용자 함수는 `consume_ai_quota` 1개) | **실행**: 운영 카탈로그 조회 |
| — | 데이터 이전 | **하지 않음**(조사는 새 계정으로 시작) | 기존 운영 데이터 무변경 |
| 6 | 개발 환경 | 로컬 개발 `.env`의 Supabase 값을 **QA 프로젝트로** 바꿈 | 로컬 파일이라 운영 변경은 아니지만, 개발 트랙이 쓰는 파일이라 Claude A·PO가 함께 결정 |

### 3-4. 전환 후 테스트 계획

| 단계 | 대상 | 방법 | 통과 기준 |
|---|---|---|---|
| T1 | 조사 프로젝트 스키마 | 3-3 #5 카탈로그 조회(읽기) | 운영과 같은 정책·버킷·권한 |
| T2 | 백엔드 → 조사 DB | `node backend/scripts/check-env.mjs --target research`(Railway 셸) | 오류 0. 운영·QA ref면 **오류로 막힘**(이번 추가, 테스트 EV-03b) |
| T3 | 배포 smoke | `node backend/scripts/verify-deploy.mjs --api <URL> --suite smoke` | `/healthz` 200, CORS·본문 한도·인증 |
| T4 | 기능 전체(full) | `--suite full` — **10/27 변경: 조사 DB에서 실행**(끝에 계정 삭제로 테스트 계정 자동 정리, 이어서 `verify-research-db.sql`로 사용자·사진 0 확인). QA 배포 회차 생략 | R-1~R-10 pass, 정리 확인 |
| T5 | 조사 DB 실사용 | 진행자 테스트 계정으로 S1~S8(7장 표) | 전부 통과 |
| T6 | 정리 | T5 계정을 **앱의 계정 삭제**로 지움 → 옷·사진·`ai_usage`가 함께 지워지는지 조회 | 조사 시작 전 조사 DB 사용자 0명 |

## 4. 백엔드 환경변수 (조사 배포값)

| 변수 | 조사 배포값 | 비밀 | 비고 |
|---|---|---|---|
| `SUPABASE_URL` · `SUPABASE_PUBLISHABLE_KEY` | 조사 프로젝트 | | `check-env --target research` |
| `SUPABASE_SECRET_KEY` | 조사 프로젝트 새 키 | 🔒 | 계정 삭제 |
| `GEMINI_API_KEY` | **유료 등급 프로젝트의 새 키**(개발 키와 분리) | 🔒 | ⛔ |
| `GEMINI_MODEL` | **`gemini-3.6-flash`**(고정) | | R-3. 아래 6-2 |
| `GEMINI_THINKING_LEVEL` | `minimal` | | |
| `GEMINI_DAILY_LIMIT` | **300**(제안) | | 새 변수. 18명 × 10벌 × 1.5배 여유. 넘으면 429 `AI_RATE_LIMITED`(앱 안내 있음) |
| `BRIA_API_TOKEN` | 기존 | 🔒 | SlimSAM 실패 시 대체 |
| `FAL_KEY` | **넣지 않음** | | 없으면 fal 경로 404 |
| `TRUST_PROXY` | `1` | | 없으면 모두가 IP 한도를 같이 씀 |
| `ALLOW_TOKENLESS_GUEST` | **`false`** | | ⛔ PO 결정(R-5). 익명 세션 경로가 있으므로 앱 동작 영향 없음 |
| `ANON_/USER_/IP_ANALYZE_LIMIT_PER_HOUR` | 기본(30) | | 조사 현장 Wi-Fi 하나에 여러 명이면 `IP_…`는 익명만 해당 |
| `IMAGE_TASK_LIMIT_PER_HOUR` | 기본(60) | | Claude A 추가 |
| `SLIMSAM_CONCURRENCY` / `SLIMSAM_MAX_QUEUE` / `SLIMSAM_QUEUE_WAIT_MS` | 기본(1 / 4 / 45000) | | Claude A 추가 |
| `OPS_METRICS_TOKEN` | 무작위 32자 | 🔒 | 조사 기간 메모리 확인용 |
| `SUPPORT_EMAIL` | 확정 시 | | 웹 삭제 페이지 |
| `GEMINI_REQUEST_MASK` | 비움 | | |

## 5. 이번에 수정한 오류 (브랜치 `integration/mvp-2026-11`, 커밋 `301d136`)

| # | 오류 | 원인 | 수정 | 확인 |
|---|---|---|---|---|
| F-B1 | `/account/delete`·`/healthz`·`/account-deletion` 404 | 개발 브랜치에 출시 트랙 라우트가 없음(브랜치 미통합) | R-1 통합 브랜치(충돌 0, 커밋 `6340713`) | **실행**: 로컬 서버 401·200·200, 배포용 설치(backend만)로도 동일 |
| F-B2 | 잘못된 이미지 데이터로 Gemini 호출 → 500(BUG-10/E-4) | 검사 없이 전달, mimeType 고정 `image/jpeg` | base64·시그니처(JPEG/PNG/WEBP/HEIC) 사전 검사 → 400 `INVALID_IMAGE`, 감지한 mimeType을 Gemini에 전달 | 단위 테스트 OG-01·02·05·06, **실행**: 로컬 400 |
| F-B3 | 모델 불일치 추적 불가(BUG-13/E-5) | `.env` 3.5-flash, 응답 3.6-flash. **두 모델은 별개**(모델 정보 API: 3.5-flash = `3.5-flash-05-2026`, 3.6-flash = `3.6-flash-07-2026`)인데 3.5 요청이 3.6으로 응답됨 | `/healthz`에 설정 모델·마지막 응답 모델, 호출마다 `gemini_call` 로그에 `model`·`servedModel`·`modelMismatch`. 배포값은 3.6-flash로 고정 | OG-08, **실행**: `/healthz` |
| F-B4 | 서버 전체 비용 상한 없음(S-5) | 사용자별 시간당 한도만 | `GEMINI_DAILY_LIMIT`(한국 시간 자정 초기화). 넘으면 Gemini 호출 없이 429 | OG-03·07 |
| F-B5 | 오류를 집계할 수단 없음(R-9/BUG-11) | 로그가 자유 문장 | 400 이상 응답마다 `{"evt":"http_error",…,"status","code","tier","ms"}`, Gemini 호출마다 `{"evt":"gemini_call",…}`(시간 초과 포함). 토큰·이미지·본문은 남기지 않음 | OG-04·08·09·12, **실행**: 로컬 로그 |
| F-B6 | 앱 미사용 fal 경로가 열림(R-4) | 항상 등록 | `FAL_KEY` 없으면 404 `FEATURE_DISABLED`(인증 검사 뒤) | OG-10 |
| F-B7 | 없는 주소·처리 못 한 오류가 HTML로 응답 | Express 기본 | JSON 404 `NOT_FOUND`, JSON 500 `SERVER_ERROR`(내부 문구는 로그만) | OG-11, **실행** |
| F-B8 | 조사 DB 설정 실수 방지 | `check-env`가 qa/production만 구분 | `--target research`: 운영·QA ref면 오류. 새 변수 6개 점검 | EV-03b |

**확인한 사항(수정 불필요)**
- 이미지 업로드·저장 경로: 앱 → Storage `{userId}/originals|processing|cutouts/…`, 서버는 `originals|processing`만 읽고 본인 폴더만 서명. 운영 DB 고아 파일 0(1차 감사).
- 무료·유료 사용량: 사용자별 시간당 30(분석)·60(이미지 처리) + 이번 일일 상한. Gemini 등급 자체는 Google 콘솔에서만 확인 가능 → PO.
- SlimSAM 동시 처리: Claude A의 `concurrencyLimiter`가 통합본에 그대로 있고 테스트 통과. 메모리 8GB 상한이면 대기열 4건 상태에서도 여유(1건 최대 약 2.3GB, macOS). 리눅스 실측은 배포 후.

**회귀 테스트(통합 브랜치, 수정 후 — 실행)**

| 묶음 | 결과 |
|---|---|
| `test:backend` | **99 pass / 1 skip**(DV-03 의도적) — 통합 직후 86 → 이번 추가 13(OG-01~12, EV-03b) |
| `test:client` | 38/38 |
| `test:engine` | 35/35 |
| `test:fkd` | 36/36 |
| `test:round1` | 16/16 |
| `tsc --noEmit` | 오류 0 |
| 웹 내보내기 | 성공(7.8MB), 서버 비밀값 문자열 0건 |
| 배포용 설치(`backend/package.json`만 `npm ci --omit=dev`) | 기동, `/healthz` 200, `/account/delete` 401, 잘못된 이미지 400 |
| 로컬 서버(개발 `.env` + 조사 배포값 흉내) | 16건 응답 확인, JSON 로그 확인 |

## 6. 남은 위험과 대응

### 6-1. 그대로 두는 것
| 항목 | 이유 |
|---|---|
| 앱이 `INVALID_IMAGE`를 일반 분석 실패 문구로 보여줌 | 앱 `apiErrors.ts`(Claude A). 문구 추가는 선택 |
| 메모리 카운터는 재시작 시 초기화 | 복제 1개, 조사 규모. 일일 상한도 재시작 시 0부터(보수적으로 낮게 잡아 대응) |

### 6-2. 모델
- `gemini-3.5-flash`를 요청해도 `gemini-3.6-flash`가 응답한 기록이 있다(10/26). 조사에는 **응답 모델과 같은 `gemini-3.6-flash`를 명시**하고, 매일 `gemini_call`의 `modelMismatch`가 0인지 본다.

### 6-3. Gemini 응답 지연 (오늘 실측)
| 시각(KST) | 요청 | 결과 |
|---|---|---|
| 10/26 저녁 | 상품 사진 18KB, 3.5-flash 요청 | 200, 12.5초 |
| 10/26 22:08 | 같은 사진, 3.6-flash | **504(25초 초과)** × 2 |
| 10/26 22:09 | 텍스트 8토큰, 3.6-flash / 3.5-flash | 19.8초 / **45초 무응답** |

- 무료 등급의 혼잡 영향일 가능성이 있으나 **유료 등급에서 나아지는지는 미확인**.
- 대응안(앱·서버 함께 바꿔야 함 → Claude A 협의): 서버 `GEMINI_TIMEOUT_MS`를 40000~45000으로, 앱 `ANALYZE_TIMEOUT_MS`(현재 30초)를 그보다 길게(50초). 서버 값만 올리면 앱이 먼저 끊는다.
- 조사 전날 `gemini_call`의 `ms`로 지연을 확인하고, 세션 중 504가 나면 진행자가 "다시 시도"로 안내.

## 7. Claude A와 통합하기 위한 작업 순서

### 7-1. 브랜치 상태 (10/26 기준)

| 브랜치 | 위치 | 상태 |
|---|---|---|
| `audit/2026-11-mvp` (A) | `~/Desktop/styleseed` 작업 트리 | `eedc531`. 통합본에 전부 포함 |
| `release/beta-prep` (B) | — | `d3b8197`(1차 감사 문서 커밋). 통합본에 전부 포함 |
| **`integration/mvp-2026-11`** | B 작업 트리 | `6340713` 병합 + `301d136` 백엔드 수정 + 이 문서 커밋. **조사 RC 기준** |

### 7-2. 충돌 가능 파일 (앞으로 A가 고치면 겹치는 곳)

| 파일 | 이번 B 변경 | 겹침 위험 |
|---|---|---|
| `backend/server.js` | import 1블록, CORS 앞 로거 1줄, fal 플래그 블록, 분석 경로(이미지 검사·일일 상한·`gemini_call` 로그, 기존 "Gemini 사용량:" 줄 **대체**), fal 경로 미들웨어 1개, 끝부분 JSON 404·500 | **높음** — 분석 경로를 고칠 때(예: BUG-06 `NOT_CLOTHING`) |
| `backend/test/limits.test.js` | 가짜 이미지 `"abc"` → `FAKE_JPEG` | 중간 — 새 분석 테스트는 `FAKE_JPEG` 사용 필요("abc"는 이제 400) |
| `backend/test/imageTasks.test.js` | S-7 테스트에서 `app.locals.falEnabled` 켜고 끔 | 낮음 |
| `backend/test/account.test.js` | `/healthz` 공개 키에 `gemini` 추가 | 낮음 |
| `.env.example` | `EXPO_PUBLIC_SHOW_PROTOTYPES`(A 요청), 새 서버 변수 5개 | 낮음 |
| `backend/accountRoutes.js`, `backend/scripts/check-env.mjs`, `backend/opsGuards.js`(새) | B 소유 | 없음 |

### 7-3. 순서

1. **(A) 다음 작업 전에 통합 브랜치를 기준으로 삼기**: `git merge integration/mvp-2026-11`을 `audit/2026-11-mvp`에 하거나, 새 작업 브랜치를 `integration/mvp-2026-11`에서 딴다. → 이후 `server.js` 충돌이 생기지 않는다.
2. **(A) 통합본 검토**(R-1 완료 기준 중 A 몫): `upload.tsx` 동의 흐름(정적 확인: `hasAiConsent`가 `handleAnalyze`에 남음, 79행), 웹 실행으로 동의 화면 → 분석 이동, 로그아웃 시 캐시 삭제.
3. **(A·B) 타임아웃 결정**(6-3): 바꾸기로 하면 A가 앱 값, B가 배포 변수.
4. **(PO) 8장 승인** → **(B)** 조사 Supabase 구축(3-3) → Railway 서비스 생성 → **QA 변수로 배포 → smoke → full** → **조사 변수로 교체 → smoke**.
5. **(B) 앱 빌드 변수 등록**(아래 7-4) → EAS preview(⛔, Claude A R-6).
6. **(PO·A·B) 실기기 S1~S8**(아래 7-5) → T6 정리 → 조사 시작.
7. 조사 기간 매일: `/healthz`, `gemini_call` 수·지연·`modelMismatch`, `http_error` 5xx·429·422 집계(아래 7-6).

### 7-4. 앱에서 바꿔야 할 주소·환경변수 (EAS `preview` 환경)

| 변수 | 값 | 비고 |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | `https://<서비스명>.up.railway.app` | 비우면 `localhost` → 실기기 실패(BUG-01) |
| `EXPO_PUBLIC_SUPABASE_URL` | 조사 프로젝트 URL | |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 조사 프로젝트 Publishable key | 공개 키만 |
| `EXPO_PUBLIC_GEMINI_PAID_TIER` | 유료 전환 후 `true` | 무료 등급 고지 문구 숨김 |
| `EXPO_PUBLIC_PRIVACY_POLICY_URL` · `EXPO_PUBLIC_TERMS_URL` | 게시되면 | 비우면 "준비 중" |
| `EXPO_PUBLIC_SHOW_PROTOTYPES` | **넣지 않음** | 프로토타입 숨김 |

앱 코드 변경은 없다(주소는 모두 환경변수).

### 7-5. 배포 후 E2E 검증 시나리오

| # | 시나리오 | 도구 | 기준 |
|---|---|---|---|
| E1 | 헬스·모델 | `curl https://…/healthz` | 200, `gemini.model = gemini-3.6-flash` |
| E2 | 보안 smoke | `verify-deploy --suite smoke` | 전부 pass(CORS, 413, 401, 운영 지표 숨김) |
| E3 | 기능 full(QA 변수일 때만) | `verify-deploy --suite full` | 분석 200·SlimSAM·BRIA 대체·교차 접근 403·계정 삭제 |
| E4 | 토큰 없는 분석 차단 | `POST /analyze-clothing`(헤더 없음) | 401 `AUTH_REQUIRED` |
| E5 | 잘못된 이미지 | `{"imageBase64":"notanimage"}` + 익명 토큰 | 400 `INVALID_IMAGE`, `gemini_call` 로그 없음 |
| E6 | 동시 저장 2건 | 진행자 기기 2대에서 동시에 저장 | 둘 다 저장(하나는 대기 후 SlimSAM 또는 BRIA), 메모리(`X-Ops-Token`) 8GB 미만, 재시작(bootId 변경) 없음 |
| S1~S8 | Claude A `INTEGRATED-STATUS` 5장 | 실기기 | 전부 통과 |
| E7 | 계정 삭제 | 진행자 테스트 계정을 앱에서 삭제 | 조사 DB에서 사용자·옷·파일·`ai_usage` 0 |

### 7-6. 조사 기간 일일 점검 명령 (Railway 로그를 내려받은 뒤)

```bash
grep '"evt":"gemini_call"' railway.log | wc -l                          # 오늘 Gemini 호출 수
grep '"evt":"gemini_call"' railway.log | grep -c '"status":"timeout"'     # 시간 초과
grep '"evt":"gemini_call"' railway.log | grep -c '"modelMismatch":true'   # 모델 불일치
grep '"evt":"http_error"' railway.log | grep -o '"code":"[A-Z_]*"' | sort | uniq -c   # 오류 코드별
grep '"evt":"http_error"' railway.log | grep -c '"status":5'              # 5xx
```

## 8. 승인 요청 (배포 전 PO가 결정할 것)

| # | 항목 | 비용 | 하는 일 | 되돌리기 |
|---|---|---|---|---|
| **AP-1** | Railway 가입·결제(Hobby) + 서비스 생성 + **외부 배포** | 월 $24~29 | 3장·4장 변수로 QA 검증 → 조사 변수로 운영 | 서비스 삭제로 과금 중단 |
| **AP-2** | Supabase **새 조직(Pro) + `styleseed-research` 프로젝트** 생성, 마이그레이션 5개·Auth 설정 적용, Secret key 발급 | 월 $25 | 3-3 | 프로젝트 삭제. **기존 운영·QA는 변경 없음** |
| **AP-3** | **Gemini 유료 등급 전환** + 조사용 새 API 키 | 사용량(월 수천 원 예상) + `GEMINI_DAILY_LIMIT=300` 상한 | 4장 | 키 폐기 |
| **AP-4** | 배포 환경변수 값 확정: `ALLOW_TOKENLESS_GUEST=false`, `GEMINI_MODEL=gemini-3.6-flash`, `GEMINI_DAILY_LIMIT=300`, 조사 DB 리전(서울 권장) | — | 4장 | 값 변경 |
| **AP-5** | `integration/mvp-2026-11` **GitHub Push**(Railway를 GitHub 연결로 배포할 경우). Push 없이 `railway up`(로컬 업로드)도 가능 | — | 7-3 | — |
| **AP-6** | 로컬 개발 `.env`를 QA 프로젝트로 전환(Claude A 작업 트리 파일) | — | 3-3 #6 | 값 되돌림 |

승인과 별도로 PO가 정할 것: 조사 참가자 **18세 이상** 조건(Gemini 약관), 타임아웃 조정 여부(6-3), EAS preview 빌드(Claude A R-6, 별도 ⛔).

## 9. 이번 작업에서 사용한 외부 자원

| 대상 | 횟수 | 내용 |
|---|---|---|
| Gemini 생성 호출 | 오늘 총 5회 | 1차 감사 이미지 1(성공) + 이번 이미지 2(시간 초과) + 지연 진단 텍스트 2(8토큰). 무료 등급 |
| Gemini 모델 정보 조회 | 4회 | 생성 아님(과금·한도 없음) |
| Supabase 운영 DB | 읽기 전용 조회 3회 | 쓰기 0 |
| 운영 Supabase Auth | 무효 토큰 검증 몇 건 | 부작용 없음(사용자 생성 0) |
| 기타 | PGlite(scratchpad 설치) | 프로젝트 의존성 변경 없음 |

## 10. AP-1 결제 결정 자료 (2026-10-26 추가 확인)

| 항목 | 내용 | 근거 |
|---|---|---|
| 상품 | **Railway Hobby 플랜**(워크스페이스 구독) — 서비스 1개, 리전 Southeast Asia Metal(싱가포르, `asia-southeast1-eqsg3a`), 복제 1, 메모리 상한 8GB | 공식: [pricing](https://railway.com/pricing), [plans](https://docs.railway.com/reference/pricing/plans), [regions](https://docs.railway.com/reference/deployment-regions) |
| 구독료·포함분 | $5/월, 사용량 $5 포함(사용량이 $5를 넘으면 사용량 전액 청구) | 공식 |
| 단가 | RAM $10/GB·월, CPU $20/vCPU·월, 송신 $0.05/GB | 공식 |
| Hobby 한도 | 서비스당 48GB·48vCPU, 복제 6, 사용자 도메인 2, 로그 7일 | 공식 |
| 결제 수단 | **"post-paid card" 필수, 선불 결제 더 이상 받지 않음** → 신한 선불카드 사용 불가 | 공식(plans) |
| 통화·VAT | 달러 표시. 청구 통화·한국 VAT 부과 여부는 **공식 문서에 없음(미확인)**. Tax ID·청구지 주소 입력란은 있음 | 공식(pricing) |
| 지출 상한 | 사용량 알림(soft)·**hard limit**(최소 $10, 도달 시 서비스 중지). 모든 플랜 | 공식: [usage limits](https://docs.railway.com/reference/usage-limits) |

**20명 조사 기준 월 예상:** RAM 상시 약 2.2GB(SlimSAM 상주) ≈ $22 + CPU·송신 ≈ $1~2 → 청구 **약 $23~24**. VAT 10%가 붙으면 약 $26, 카드 해외 이용 수수료(약 1~1.5%, 카드사별) 포함 **약 3.3만~3.8만 원/월**(환율 1,400원 가정).

**설정 권장:** soft limit $25, hard limit **$40**(조사 중 서비스가 멈추지 않을 만큼 여유). PR 환경 끔, 복제 1 유지, 조사 종료 즉시 서비스 삭제(삭제 전까지 RAM 과금 계속).
