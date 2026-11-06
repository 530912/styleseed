# 2026-11 사용자 조사 MVP — 백엔드 점검 결과 (Claude B → Claude A)

| 항목 | 내용 |
|---|---|
| 작성 | 2026-10-26, 출시 트랙 Claude B |
| 대상 | 2026년 11월 초 사용자 조사용 MVP의 백엔드 영역(앱 전체 기능 점검은 Claude A 총괄) |
| 점검 코드 | `release/beta-prep` `8703008` (이 작업 트리) + 개발 트랙 `sprint/1a-3` `d9a4e7a` (`git archive`로 scratchpad에 복사해 실행. 개발 트랙 작업 트리는 건드리지 않음) |
| 점검 DB | Supabase 운영 프로젝트 `zkgsxa…` — **읽기 전용 MCP**(`supabase_read_only_user`) 조회만 |
| 하지 않은 것 | 운영 DB 쓰기, 유료 리소스 생성, 배포, Push, 커밋. Gemini 호출은 **1회**(약 1,521토큰) |
| 변경 파일 | 이 문서 1개(새 파일). 다른 파일은 고치지 않음 |

판정 표기: **PASS** / **PARTIAL** / **FAIL** / **NOT IMPLEMENTED** / **BLOCKED**(승인·결정 필요) / **NOT TESTED**

---

## 0. 요약

| # | 영역 | 판정 | 한 줄 결론 |
|---|---|---|---|
| 1 | Gemini 실연동·오류 처리 | **PARTIAL** (운영 등급은 **BLOCKED**) | 실제 호출 200 확인(Mock 아님). 오류 처리는 단위 테스트 통과. **무료 등급 일일 한도로는 다인원 조사 불가** |
| 2 | 의류 이미지 업로드·저장·조회 | **PARTIAL** | Storage RLS·버킷 제한·고아 파일 0건 확인. 실사용자 업로드는 이번에 NOT TESTED |
| 3 | Supabase Auth·RLS | **PASS** (구성) | RLS·정책·권한 카탈로그 확인. 사용자 간 교차 접근 실연동은 이번에 NOT TESTED(1A-2 QA E2E에서 검증된 바 있음) |
| 4 | 의류 등록·수정·삭제 | **PARTIAL** | 서버 API 없이 앱이 Supabase에 직접(RLS 보호). **저장 후 속성 수정 기능 없음**(사진 교체만) |
| 5 | 분석 결과 저장·조회 | **PARTIAL** | 최종 속성만 `clothes`에 저장. AI 원본 결과·사용자 수정 내역·조사 이벤트는 **저장하지 않음** |
| 6 | 코디 추천 데이터 전달 | **PASS** (기능) / **노출 있음** | 데이터 전달 정상, 엔진 테스트 통과. **추천 엔진 전체가 앱 번들에 포함**(클라이언트 노출) |
| 7 | 상품 데이터·Missing Item | **NOT IMPLEMENTED** (백엔드) | 앱 내장 목업 상품(`mockProducts.ts`)만 사용. 상품 DB·API 없음 |
| 8 | API 인증·요청 제한·비밀키 | **PARTIAL** | 인증·비밀키 비노출 PASS. **토큰 없는 분석 허용(기본 ON)**, **이미지 처리 경로 요청 제한 없음** |
| 9 | 환경 분리(개발/테스트/운영) | **FAIL** | 로컬 개발 `.env`가 **운영 Supabase**를 가리킴. 운영 백엔드 미배포 |
| 10 | 서버 오류·비용 위험 | **BLOCKED** | 미배포, Gemini 무료 등급, SlimSAM 동시 처리 제한 없음(OOM), Supabase Free 일시정지 |

**조사 전에 꼭 필요한 것(우선순위)**

1. ⛔ **백엔드 배포**(Railway 런북 준비 완료) — 없으면 실기기에서 분석·저장 불가. PO 승인 필요.
2. ⛔ **Gemini 유료 등급 전환**(+ `EXPO_PUBLIC_GEMINI_PAID_TIER=true`) — 무료 등급은 모델당 하루 약 20회. PO 승인 필요.
3. **두 브랜치 통합** — `sprint/1a-3`에는 `/healthz`, `/account/delete`, `/account-deletion`이 없음(실측 404). 출시 트랙 변경을 함께 묶은 RC가 필요.
4. **SlimSAM 동시 처리 1건 제한(H-1)** — 조사 현장에서 여러 명이 동시에 저장하면 메모리 초과 위험. `sprint/1a-3`에도 아직 없음.
5. **조사용 환경 분리** — 조사 데이터가 개발 테스트 데이터와 섞이지 않게 할 것(9번).
6. **분석 결과·수정 내역 기록 여부 결정** — 조사에서 "AI 정확도/수정률"을 보려면 지금 구조로는 측정 불가(5번).

---

## 1. 실행한 테스트와 근거

| ID | 실행 | 결과 |
|---|---|---|
| T-01 | `npm run test:backend` (release/beta-prep) | **70 pass / 0 fail / 1 skip**(DV-03: `DEPLOY_VERIFY_SELFTEST=1`일 때만 실행되는 종단 셀프테스트) |
| T-02 | `npm run test:client` (release/beta-prep) | **29 / 29 pass** |
| T-03 | `npm run test:backend` (sprint/1a-3 복사본) | **46 / 46 pass** |
| T-04 | `npm run test:client` (sprint/1a-3) | **25 / 25 pass** |
| T-05 | `npm run test:engine` (sprint/1a-3) | **35 / 35 pass** (추천엔진 스냅샷·색상·taxonomy 호환) |
| T-06 | 로컬 서버(sprint/1a-3, 개발 `.env`, 포트 3997) 오류 경로 13건 | 아래 표 |
| T-07 | **실제 Gemini 1회**: `assets/images/products/white-sneakers.jpg`(18KB) → `POST /analyze-clothing`(토큰 없음) | **200, 12.5초**. 서버 로그 `Gemini 사용량: {"model":"gemini-3.6-flash","prompt":1449,"output":72,"total":1521}` |
| T-08 | Supabase 읽기 전용 SQL: RLS·정책·권한·버킷·함수·건수 | 아래 3장 |
| T-09 | 정적 검사: 앱 코드의 비밀값 참조, git 전체 이력의 `AIza`·`sb_secret_` | 실제 키 0건(`sb_secret_`는 테스트용 가짜 값·형식 검사 코드뿐) |

**T-06 로컬 서버 오류 경로 (sprint/1a-3)**

| 요청 | 응답 | 판정 |
|---|---|---|
| `GET /` | 200 `STYLESEED API is running` | PASS |
| `GET /healthz` | **404** | 통합 필요(출시 트랙에만 있음) |
| 분석, `Bearer garbage` | 401 `AUTH_INVALID` (실제 Supabase Auth로 검증) | PASS |
| 분석, `Basic abc` | 401 `AUTH_INVALID` | PASS |
| 분석, 토큰 없음·이미지 없음 | 400 `이미지 데이터가 없습니다.` | PASS(단, 토큰 없는 요청이 분석 단계까지 들어감 → 8장) |
| 분석, 잘못된 JSON | 400 `INVALID_JSON` | PASS |
| 분석, 11MB 본문 | 413 `PAYLOAD_TOO_LARGE` | PASS |
| `/remove-background`·`/segment-garment-local`·`/segment-garment` 토큰 없음 | 401 `AUTH_REQUIRED` | PASS |
| `/apply-garment-mask` 무효 토큰 | 401 `AUTH_INVALID` | PASS |
| `POST /account/delete` | **404** | 통합 필요 |
| `Origin: https://evil.example` | `Access-Control-Allow-Origin` 없음 | PASS |

---

## 2. 영역별 상세

### 1) Gemini API 실연동·응답 오류 처리 — **PARTIAL** (운영 등급 BLOCKED)

**Mock이 아님을 확인한 근거**
- T-07 응답은 Google이 돌려준 `usageMetadata`(토큰 수)·`modelVersion`이 서버 로그에 남았다. 서버가 만든 값이 아니다.
- 분석 경로(`analyze.tsx` → `apiPost("/analyze-clothing")` → `server.js` → `generativelanguage.googleapis.com`)에는 **Mock·고정값 대체 경로가 없다.** 실패하면 화면에 오류 문구가 뜨고 "다시 시도" 버튼이 나온다.
- Mock/고정 데이터가 쓰이는 곳은 분석이 아니라 **상품(`mockProducts.ts`)·코어 데모(`coreDemo.ts`)·`/demo` 화면**이다(7번). 조사 참가자에게 이 화면들을 "실제 AI 결과"처럼 보여 주지 않도록 Claude A가 화면 단에서 확인 바람.
- 참고: E2E(`backend/test/e2e`)에는 429일 때 고정 결과(fixture)로 넘어가는 경로가 있다. **E2E 통과가 실제 Gemini 성공을 뜻하지 않는다.**

**오류 처리(코드 + 단위 테스트)**
| 상황 | 동작 |
|---|---|
| 500/503/504 | 2초·4초 대기 후 최대 2번 재시도, 전체 25초 안에서. 끝나면 503 `AI_BUSY` |
| 429 | 재시도 없이 429 `AI_RATE_LIMITED` + `retryAfterSeconds` |
| 시간 초과 | 504 `AI_TIMEOUT` (서버 25초, 앱 30초) |
| 그 밖의 4xx | 500 "Gemini 분석 요청에 실패했습니다." |
| 응답 텍스트 없음 / JSON 파싱 실패 | 500 (일반 오류 문구) |

**문제·위험**
- **[BLOCKED] 무료 등급 일일 한도**: 코드 주석·`COST_ESTIMATE.md` 실측 모두 무료 등급은 모델당 하루 약 20회. 2026-10-19 실측 10회 중 503 3회·429 2회. 참가자 10명 × 옷 5벌이면 첫날 소진. 유료 전환은 PO 승인 사항. (Gemini 약관상 18세 이상만 사용 가능하므로 조사 참가자 연령 조건도 확인 필요)
- **모델 불일치**: `.env`는 `GEMINI_MODEL=gemini-3.5-flash`인데 Google 응답의 `modelVersion`은 `gemini-3.6-flash`. 별칭이 다른 모델로 연결되는 것으로 보인다(원인 미확인). 비용·결과 재현성에 영향 → 조사 기간에는 고정 버전 이름 사용을 권장.
- 응답 시간: 작은 이미지(18KB)도 12.5초. 실제 휴대폰 사진은 더 걸릴 수 있다(앱 30초 제한). 1A-3의 앱 쪽 리사이즈(`imagePrep.ts`)가 들어가면 개선될 것으로 보이나 실기기 미측정.
- Gemini 4xx(예: 잘못된 이미지)는 모두 일반 500으로 바뀐다. 사용자 문구는 무난하나 원인 구분이 어렵다(로그에는 남음).

### 2) 의류 이미지 업로드·저장·조회 — **PARTIAL**

- 구조: 앱이 Supabase Storage `clothing-images/{userId}/originals|processing|cutouts/…`에 **직접 업로드**하고, 서버는 경로만 받아 **요청자 본인 토큰으로 서명 URL**을 만든다(`storagePaths.js`, 다른 사용자 폴더면 403). 단위 테스트 통과.
- DB 확인(T-08): 버킷 `public=false`, 10MB, MIME 5종(jpeg/png/webp/heic/heif). 객체 18개, **DB 행과 연결되지 않은 고아 파일 0**, 원본이 없는 행 0, `processing/` 잔여 0.
- 조회: 앱이 1시간짜리 서명 URL을 행마다 2개(원본·누끼) 만든다. 옷이 많으면 옷장 열 때 요청이 많아진다(성능 메모, 조사 규모에선 문제 적음).
- 문제
  - 저장 중 DB insert가 실패하면 이미 올린 원본·누끼 파일을 지우지 않는다 → 고아 파일(현재 0건).
  - 누끼 품질 미달·SlimSAM 실패 시 자동으로 BRIA(유료)로 넘어간다 → 10번 비용.
- **NOT TESTED**: 실제 로그인 사용자의 업로드→저장→재조회. 이유: 앱 로그인에 비밀번호 입력이 필요하고, 운영 DB 쓰기는 승인 대상. → QA 프로젝트 E2E(`npm run test:e2e`) 또는 배포 후 런북 R-단계로 확인 권장.

### 3) Supabase Auth·RLS — **PASS** (구성 확인)

T-08 결과(운영 프로젝트, 읽기 전용):
- `clothes`, `ai_usage` 둘 다 RLS 켜짐.
- `clothes`: 본인 행만 select/insert/update/delete(`auth.uid() = user_id`) + **익명 사용자 차단 RESTRICTIVE 정책**.
- `storage.objects`: 첫 폴더가 본인 uid인 객체만 4종 권한 + 익명 차단 RESTRICTIVE.
- `anon` 역할: `clothes` select/insert 권한 없음. `ai_usage`는 `authenticated`도 직접 조회·수정 불가. `consume_ai_quota`는 SECURITY DEFINER, 실행 권한 `authenticated`만.
- 사용자 4명(익명 1, 이메일 미인증 1), 옷 9벌.
- 참고(2026-10-19 기록, 이번에 재확인 안 함): 이메일 인증 OFF, 익명 로그인 ON. 조사 기간에 가짜 계정 대량 생성을 막을 장치는 시간당 한도뿐.
- 운영 프로젝트의 정책은 Dashboard SQL Editor로 적용되어 **마이그레이션 이력에는 없다**(저장소 `supabase/migrations/`와 내용은 일치). 새 환경을 만들 때 저장소 SQL을 순서대로 적용해야 한다.
- **NOT TESTED(이번 세션)**: 사용자 A 토큰으로 사용자 B 데이터 접근 시도. 1A-2 QA E2E에서 검증된 바 있음.

### 4) 의류 등록·수정·삭제 — **PARTIAL**

- 별도 서버 API가 없다. 앱(`src/lib/clothes.ts`)이 RLS 아래에서 Supabase에 직접 insert/update/delete한다. 소유권은 RLS가 보장(3번).
- 등록: 분석 → 사용자가 속성 수정 → 원본 업로드 → SlimSAM(실패 시 BRIA, 그것도 실패 시 원본) → `clothes` insert.
- 수정: **사진 교체(`replaceClothingImage`)만 있다. 저장한 옷의 속성(카테고리·색 등) 수정은 NOT IMPLEMENTED.** 조사에서 "AI가 틀린 속성을 나중에 고치기"를 보려면 필요.
- 삭제: Storage 파일 먼저 지우고 DB 행 삭제. DB 삭제가 실패하면 이미지가 없는 행이 남는다(드묾).
- 계정 삭제(출시 트랙 소유): `release/beta-prep`에 구현·단위 테스트 통과. `sprint/1a-3`에는 없음(통합 필요).

### 5) 분석 결과 저장·조회 — **PARTIAL**

- 저장되는 것: 사용자가 확인한 **최종 속성**만 `clothes` 행에.
- 저장되지 않는 것: Gemini 원본 결과, `box2d`, 사용한 모델 버전, **사용자가 AI 결과를 고쳤는지 여부**, 분석 실패 기록. 서버는 분석 사진을 저장하지 않는다(처리방침 고지와 일치, H-9 유지).
- `ai_usage`는 사용자별 시간당 분석 횟수만 기록.
- 조사 이벤트: `sprint/1a-3`의 `scripts/round1/events.mjs`는 분석 도구(설계)이고, 앱·서버에 이벤트 기록 경로는 **NOT IMPLEMENTED**.
- → 조사에서 AI 정확도·수정률·이탈 지점을 정량으로 보려면 저장 항목을 정하고 새 테이블이 필요하다. 새 사용자 데이터 테이블은 `user_id … on delete cascade` 규칙(H-6)과 처리방침 갱신이 함께 필요(출시 트랙에 알려 줄 것).

### 6) 코디 추천에 필요한 데이터 전달 — **PASS**(기능) / **클라이언트 노출 있음**

- 경로: `fetchClothesFromSupabase()` → zustand 저장소(`styleseed-closet-v2`, AsyncStorage) → `src/utils/recommendation.ts`·`outfitScore.ts`·`weatherRecommendation.ts`·`taxonomyCompat.ts`.
- 엔진 스냅샷 테스트 35/35 통과(T-05).
- **노출**: 추천엔진(`src/utils/*.ts`, 약 2,400줄)이 서버가 아니라 **앱 번들 안에서 실행**된다. 앱 JS 번들을 풀면 점수 규칙·가중치를 그대로 볼 수 있다. 11월 조사용 MVP에서는 기능상 문제없지만, 핵심 로직 보호가 목표라면 서버 이전이 필요(엔진은 Claude A 소유 — 이번에 고치지 않음).
- 옷장 데이터가 기기 AsyncStorage에 남는다. 로그아웃 시 `clearClothes` 호출 여부는 Claude A 앱 점검 범위에서 확인 바람(공용 기기로 조사하는 경우 중요).

### 7) 상품 데이터·Missing Item 연동 — **NOT IMPLEMENTED** (백엔드)

- `shop.tsx`, `core-shop.tsx`, `missing.tsx`(→ `recommendation.ts`의 Missing Item 계산)는 **앱에 내장된 목업 상품 `src/data/mockProducts.ts`**(이미지 `assets/images/products/*`, 브랜드명 "Partner Brand C" 등)를 쓴다.
- 상품 DB·API·제휴 링크·클릭 기록 없음. `sprint/1a-3`의 `scripts/round1/products.mjs`(상품 CSV 계약 검증)는 아직 앱에 연결되지 않음.
- 조사 진행 시 참가자에게 **"예시 상품"임을 알리거나 화면에 표시**하는 것을 권장(실제 판매 상품으로 오인 방지).

### 8) API 인증·요청 제한·비밀키 보호 — **PARTIAL**

PASS
- 토큰 검증: `getClaims`로 검증, 무효 토큰 401, Auth 장애 503 구분(T-06).
- 이미지 처리 4경로는 정식 로그인 사용자만(익명 403, 없음 401). 서버는 본문의 임의 URL을 쓰지 않는다(SSRF 차단).
- 비밀키: 앱 코드의 환경변수는 `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, 법적 URL·유료 등급 플래그뿐. `GEMINI_API_KEY`·`BRIA_API_TOKEN`·`FAL_KEY`·`SUPABASE_SECRET_KEY`는 서버에서만 읽음. git 전체 이력에 실제 키 없음(T-09). `.env`는 `.gitignore` 대상이며 이력에 없음. 2026-10-19 웹 번들 검사 기록에서도 서버 키 0건.
- CORS 허용 목록 동작(T-06).

문제
| # | 내용 | 영향 | 권장 |
|---|---|---|---|
| S-1 | `ALLOW_TOKENLESS_GUEST` **기본값 true** — 토큰 없이 분석 가능(T-07이 토큰 없이 성공). IP당 시간당 10회 | 앱 밖에서 서버 주소만 알면 Gemini 비용 사용 | 운영·조사 환경은 `false`(KI-3 PO 결정) |
| S-2 | **이미지 처리 경로(`/remove-background`, `/segment-garment-local` 등)에 요청 한도 없음** | 로그인 사용자 1명이 BRIA(유료) 무제한 호출·CPU 독점 가능 | 사용자별 시간당 한도 추가(개발 트랙) |
| S-3 | 앱이 쓰지 않는 `POST /segment-garment`(fal.ai)가 남아 있음(H-3) | `FAL_KEY`를 넣으면 과금 경로가 열림 | 운영에 `FAL_KEY` 넣지 않기(런북 반영됨), 경로 제거 검토 |
| S-4 | IP·guest·대체 카운터가 **서버 메모리** | 재시작하면 초기화, 인스턴스가 여러 개면 따로 셈 | 조사 규모에선 단일 인스턴스로 허용 가능 |
| S-5 | **전체(서비스 단위) 일일 상한 없음** | 계정을 많이 만들면 사용자별 30회/시간 × N | Google Cloud 예산 알림·Gemini 한도 설정 권장 |
| S-6 | `TRUST_PROXY` 미설정 시 모든 사용자가 프록시 IP 하나로 보여 IP 한도를 같이 씀 | 조사 현장에서 다 같이 429 | Railway에 `TRUST_PROXY=1`(런북·`check-env` 반영됨, 배포 후 BD-09 확인) |
| S-7 | `/segment-garment(-local)` 500 응답에 내부 `error.message`를 그대로 담음 | 내부 정보 일부 노출(경미) | 일반 문구로 교체 |

### 9) 환경변수·개발/테스트/운영 분리 — **FAIL**

- 로컬 개발 `.env`(개발 트랙 작업 트리) 하나에 `GEMINI_API_KEY`·`BRIA_API_TOKEN`·`FAL_KEY`·Supabase 공개 키가 있고, Supabase URL이 **운영 프로젝트(`zkgsxa…`)**다. 즉 지금의 개발 테스트 데이터가 운영 DB에 들어간다(현재 사용자 4명, 옷 9벌 — 모두 테스트 데이터로 보임).
- QA 프로젝트(`styleseed-qa`)는 E2E 전용으로만 있다. 앱 개발 환경이 쓰지 않는다.
- 운영 백엔드는 **미배포**. 런북(`RAILWAY_DEPLOY_RUNBOOK.md`)과 `check-env.mjs`에 검증/운영 변수 구분이 정리되어 있으나 실제로 나뉜 환경은 없다.
- Gemini 키도 개발·조사·운영 구분 없음(일일 한도·비용을 함께 씀).
- 권장(조사 전): 조사용 Supabase를 정하고(운영 프로젝트를 "조사 전용"으로 비우거나 새 프로젝트) 개발은 QA 프로젝트로 옮기기. Gemini는 조사·운영용 유료 키를 따로 발급. → 모두 PO 승인 사항.

### 10) 실제 사용자 테스트 시 서버 오류·비용 위험 — **BLOCKED**

| 위험 | 가능성 | 영향 | 상태·대응 |
|---|---|---|---|
| 백엔드 미배포 | 확정 | 실기기 분석·저장 불가 | ⛔ Railway 생성·배포 승인 |
| Gemini 무료 일일 한도(모델당 약 20회)·503 혼잡 | 높음 | 조사 중 분석 실패 | ⛔ 유료 전환 |
| **SlimSAM 동시 처리 제한 없음(H-1)** | 중~높음(현장 동시 저장) | 1600px 2건 동시 최대 RSS 3.59GB → 컨테이너 OOM 재시작, 진행 중 요청 모두 실패 | 개발 트랙 대기열 구현. 8GB 컨테이너면 위험 감소(런북 기준) |
| Supabase Free 자동 일시정지 | 중 | 조사 당일 전체 장애 | ⛔ Pro 전환 또는 조사 전날 접속 확인 |
| BRIA 대체 경로 비용·무제한 호출(S-2) | 중 | 비용 증가 | 한도 추가, BRIA 콘솔 사용량 알림 |
| 토큰 없는 분석(S-1) | 낮~중 | 비용 | `ALLOW_TOKENLESS_GUEST=false` |
| Gemini 모델 별칭 변경 | 중 | 비용·결과 변동 | 고정 버전 사용 |
| `/demo`에서 동의 없이 분석(H-4) | 낮음 | 동의 절차 우회 | 운영 빌드에서 숨김(개발 트랙) |
| 오류 감시·알림 없음 | 확정 | 조사 중 장애를 늦게 앎 | `backend/scripts/watch-health.mjs`(출시 트랙)로 `/healthz` 감시 |
| 브랜치 미통합 | 확정 | `/healthz`·계정 삭제 없음 | RC 통합 |

비용 감(유료 등급 전환 후, `COST_ESTIMATE.md` 기준): Gemini 1벌 분석 약 2~6원, BRIA 1회 약 $0.02, Railway 8GB 월 $24~29, Supabase Pro $25. 조사 규모(수십 명)에서 AI 비용은 작고 고정비가 대부분이다.

---

## 3. 이번 점검에서 실행하지 못한 것 (NOT TESTED)

| 항목 | 이유 | 다음 방법 |
|---|---|---|
| 로그인 사용자 업로드→SlimSAM/BRIA→저장→조회→삭제 실연동 | 운영 DB 쓰기·비밀번호 입력 필요 | QA 프로젝트 `npm run test:e2e`, 또는 배포 후 런북 R-단계 |
| BRIA 실호출 | 유료 호출 | 런북 R-6(`--with-bria`, 1회) |
| SlimSAM 실제 모델 품질·메모리(`test:quality`) | 무거운 로컬 실행. 결과는 개발 트랙 기록에 있음 | 개발 트랙 결과 참조 |
| 사용자 간 교차 접근 실연동 | 테스트 계정 2개 필요 | QA E2E |
| 배포 환경 HTTPS·`TRUST_PROXY`(BD-09) | 미배포 | 배포 후 |
| 실기기 사진 크기·응답 시간 | EAS 빌드 필요 | 배포 후 실기기 QA |

---

## 4. Claude A에게 넘기는 것

| # | 요청 | 담당 | 우선순위 |
|---|---|---|---|
| A-1 | `release/beta-prep` 출시 변경과 `sprint/1a-3`를 묶은 조사용 RC 만들기(`/healthz`, 계정 삭제, AI 동의 포함) | Claude A + Claude B | **조사 전** |
| A-2 | `/segment-garment-local` 동시 처리 1건 제한(H-1) | Claude A | **조사 전** |
| A-3 | 이미지 처리 경로 사용자별 요청 한도(S-2) | Claude A | 조사 전 권장 |
| A-4 | `/demo` 운영 빌드에서 숨김(H-4), 목업 상품 화면에 "예시 상품" 표시 | Claude A | 조사 전 |
| A-5 | 저장 후 속성 수정 기능 필요 여부 결정(4번) | PO / Claude A | 조사 설계에 따라 |
| A-6 | 조사에서 측정할 항목(AI 수정률·이벤트) 결정 → 테이블 설계 시 출시 트랙에 알려 줄 것(삭제·처리방침 반영) | PO / Claude A | 조사 설계에 따라 |
| A-7 | 추천엔진 서버 이전 여부(6번 노출) | PO | 조사 후 |
| A-8 | 오류 응답의 `error.message` 노출 정리(S-7) | Claude A | 낮음 |

PO 승인이 필요한 것: Railway 배포 · Gemini 유료 전환 · Supabase Pro(또는 조사 전용 프로젝트) · `ALLOW_TOKENLESS_GUEST` 값(KI-3) · 조사 참가자 연령 조건(Gemini 18세 이상).
