# 2026-11 사용자 조사 — 조사용 DB·Gemini 연동 준비 (카페24 서버 가동 이후)

| 항목 | 내용 |
|---|---|
| 작성 | 2026-10-27, 출시 트랙 Claude B |
| 서버 | `https://styleseed.mycafe24.com` — 인프라 우선 배포(비밀값 없음) 가동 중 |
| 하지 않은 것 | 조사 DB 생성, 결제, 운영 DB 변경, 비밀값 등록 |

## 1. 현재 서버 상태 (10/27 확인)

| 항목 | 결과 | 확인 |
|---|---|---|
| HTTPS | 인증서 정상(브라우저 경고 없음, secure context) | Chrome 접속 |
| `/api/healthz` | 200 `{"status":"ok", "gemini":{"model":"gemini-3.6-flash"}}` | Chrome·PO 터미널 |
| 토큰 없는 분석 | 401 `AUTH_REQUIRED` | Chrome |
| 없는 API | 404 JSON | Chrome |
| 웹 루트 `/` | 404(웹 파일 미배포 — 정상) | Chrome |
| 서버 비밀값 | 없음(`api.env` = 설정 3개, 이름만 확인) | `diagnose.sh` |
| Supabase 연결 | 없음 → 로그인·분석·저장 미동작(예상) | — |

## 2. 조사용 DB — 결제 없는 방법 우선

| 안 | 비용 | 방법 | 위험 |
|---|---|---|---|
| **A. 무료(권장, 승인 필요)** | **0원** | 무료 프로젝트 2개 제한이 꽉 차 있으므로 **QA 프로젝트를 일시정지**해 자리를 비우고, 같은 조직에 **새 무료 프로젝트 `styleseed-research`(서울)** 생성 | 무료 플랜: 7일 비활성 시 자동 정지(조사 기간엔 매일 사용 → 세션 전날 접속 확인), 저장 1GB·DB 0.5GB(20명 × 옷 10벌 × 2MB ≈ 0.4GB로 충분), 자동 백업 없음. QA는 90일 안에 다시 켤 수 있음(그동안 E2E 불가) |
| B. Pro 조직 | $25/월(자부담, 선불카드 불가) | 새 Pro 조직 + 프로젝트 | 정지 없음, 백업. 필요하면 A에서 Pro로 그대로 업그레이드 가능 |

어느 안이든 **운영 프로젝트(`zkgsxa…`)는 손대지 않는다.**

만드는 절차: `supabase/research/README.md`(SQL 붙여넣기 → Auth 5항목 → Secret key → 확인 SQL 9/9).

## 3. 운영 DB와 완전 분리 검증

| 장치 | 내용 |
|---|---|
| 기준 스냅샷(운영, 읽기 전용, 10/26 17:51 UTC) | 사용자 6(익명 3), 옷 9, 사진 18, AI 사용 8, 정책 10 |
| 서버 변수 검사 | `check-env --target research`: 운영·QA ref면 **오류로 업로드 중단**(`deploy.sh`, `verify-research.sh`가 자동 실행) |
| 웹 빌드 검사 | `check-env --app --target research`: 앱이 운영·QA를 가리키면 오류 |
| 검증 스크립트 | `verify-deploy full`은 운영 ref면 실행 거부 |
| 조사 DB 확인 | `verify-research-db.sql` 9항목 |
| 사후 확인 | 조사 DB 연결·검증 후 **운영 스냅샷을 다시 찍어 위 수치와 비교**(조사 쪽 작업으로 운영 수치가 변하지 않았는지) |

참고: 운영 사용자 수가 10/26에 늘었다(마지막 생성 16:59 UTC) — 개발 환경이 운영 DB를 쓰기 때문(BUG-25). 조사 DB 분리 후 개발 `.env`를 QA로 옮기는 것도 함께 정할 것.

## 4. 조사용 DB 점검 항목

| 영역 | 내용 | 확인 방법 |
|---|---|---|
| 스키마 | `clothes`, `ai_usage`, `consume_ai_quota` | 마이그레이션 5개(빈 DB 2회 재적용 성공) |
| RLS | 본인 행만, 익명 차단, `anon` 권한 없음 | 확인 SQL + full 검증의 교차 접근 403 |
| Storage | `clothing-images` 비공개·10MB·이미지 5종, 본인 폴더만 | 확인 SQL |
| Auth | 이메일 가입·이메일 인증 끔·익명 로그인 켬·Site URL·Redirect URL | 대시보드(README 3장) |
| 키 | Publishable(웹·서버), Secret(서버 `api.env`만) | — |

## 5. Gemini 유료 키 — 비용 상한

`2026-11-MVP-GO-LIVE-STEPS.md` 2장 그대로(공식 문서 10/27 확인):

1. AI Studio에서 **새 프로젝트**(개발 키와 분리) → Set up billing → **Prepay $10, 자동 충전 끔** → Monthly spend cap $10 → API 키 생성
2. (선택) Google Cloud 콘솔에서 키 제한: API 제한 = Generative Language API
3. 서버: `GEMINI_API_KEY`(비밀), `GEMINI_MODEL=gemini-3.6-flash`, `GEMINI_DAILY_LIMIT=300`
4. 결제 수단: Google은 선불카드 불가(공식) → 개인 카드 자부담 $10

| 상한 | 값 |
|---|---|
| 선불 잔액 | $10 — 소진 시 모든 키 정지 → 서버 503 `AI_CREDIT_EXHAUSTED` |
| 서버 일일 상한 | 300회 → 429 |
| 사용자별 | 시간당 30회, IP 시간당 120회(익명) |
| 예상 | 1회 약 2원, 조사 전체 약 300회 ≈ $0.4 |

## 6. 실제 사진 1장 검증 계획

| 단계 | 누가 | 명령·방법 | 통과 기준 |
|---|---|---|---|
| T0 | PO | 로컬 `deploy/vm/api.env`에 조사 DB 3개 값 + Gemini 키 + BRIA 토큰 + `OPS_METRICS_TOKEN` 입력(편집기, 대화창 금지) | — |
| T1 | PO(`!`) | `SERVER=root@172.104.120.148 bash deploy/vm/deploy.sh` | `check-env` 오류 0 → 업로드 → 재시작 |
| T2 | PO(`!`) | `bash deploy/vm/verify-research.sh` | smoke 전부 pass |
| T3 | PO(`!`) | `bash deploy/vm/verify-research.sh full` | 테스트 계정 생성 → **실제 상품 사진 업로드 → Gemini 분석 1회 200** → SlimSAM 3회 → 동시 2건 → 다른 사용자 사진 접근 403 → **계정 삭제로 정리** |
| T4 | PO(SQL Editor) | 조사 DB에서 `verify-research-db.sql` | 9/9(사용자 0·사진 0 = 정리 확인) |
| T5 | B | 운영 스냅샷 재조회 | 3장 기준과 동일 |
| T6 | PO(iPhone Safari) | 웹 배포 후 **실제 옷 사진 1장**: 업로드 → 동의 → 분석 → 수정 → 가입·저장 → 옷장 표시 → 삭제 | `2026-11-MOBILE-WEB-BACKEND.md` W-1~W-11 |

T3의 Gemini 1회와 SlimSAM 몇 회가 이번 검증의 비용 전부(약 2원).

## 7. Claude A 인계 — 모바일 웹 연결 정보(확정)

| 항목 | 값 |
|---|---|
| API 주소 | **`https://styleseed.mycafe24.com/api`** — 가동 중(`/api/healthz` 200) |
| 웹 화면 위치 | 같은 도메인 `/`(Caddy 정적 파일). `deploy/vm/deploy-web.sh dist`로 업로드 |
| CORS | 같은 도메인이라 설정 불필요. 다른 도메인에 웹을 둘 때만 서버 `ALLOWED_ORIGINS=https://<웹 주소>` |
| 인증 | Supabase 이메일·비밀번호 + 익명 세션. API는 `Authorization: Bearer <access_token>`(쿠키 없음). 토큰 없는 분석은 401 |
| 웹 빌드 변수 | `EXPO_PUBLIC_API_URL=https://styleseed.mycafe24.com/api`, `EXPO_PUBLIC_SUPABASE_URL`·`…PUBLISHABLE_KEY`(조사 DB, **2장 완료 후 전달**), `EXPO_PUBLIC_RESEARCH_MODE=true` |
| 빌드 전 점검 | `node backend/scripts/check-env.mjs --app --target research` |

---

## 8. 갱신 (10/27) — 무료 조사 DB 위치, Gemini 최소 비용, 원화 AI 경로

### 8-1. Supabase 프로젝트 현황과 의존성

| 계정(로그인 위치) | 조직 | 프로젝트 | 용도 | 의존하는 것 | 중지 시 영향 |
|---|---|---|---|---|---|
| 계정 1 (운영·QA 소유, MCP 읽기 연결) | 기존 조직(Free) | `zkgsxa…` "운영" | 기존 앱 데이터(사용자 6·옷 9·사진 18), **로컬 개발 `.env`(A·B)** | A 개발·웹 점검, 운영 문서 | **중지 금지** — 개발 환경 전체가 멈춤 |
| 계정 1 | 같은 조직 | `xcwlga…` QA | E2E(`npm run test:e2e`), 배포 검증용 | 테스트만 | E2E 불가(조사 기간엔 거의 안 씀) |
| **계정 2 (현재 Chrome 로그인)** | 별도 조직(Free, 프로젝트 1개) | **`styleseed-knowledge-lab`**(시드니, NANO, DB 30MB/500MB) | **Knowledge Lab(Claude C) DB** — 패션 규칙 데이터, 백업 `lab-backup-…json` | Claude C·공동창업자 Lab 화면 | **중지 금지** — Lab 작업 중단 |

무료 플랜 제한은 **계정당 활성 프로젝트 2개**(공식 가격표). 계정 1은 2/2, **계정 2는 1/2 → 빈자리 1개**.

### 8-2. 결제·중지 없이 조사 DB 만들기 (권장)

**계정 2에 새 조직 `STYLESEED Research`(Free) → 프로젝트 `styleseed-research`(서울)**
- 기존 프로젝트 **중지·삭제 없음**. Lab과는 조직이 달라 권한·청구가 섞이지 않음(같은 계정의 무료 자리만 공유).
- 조건: 계정 2가 PO가 관리할 수 있는 계정이어야 한다(공동창업자 계정이면 동의 필요). 조사 종료 후 프로젝트를 지우면 자리가 돌아온다.
- 대안: 계정 1에서 QA를 일시정지하고 같은 조직에 생성(E2E 일시 불가, 승인 필요).

### 8-3. Gemini — 최소 비용과 선불카드

| 경로 | 최소 비용 | 선불카드 | 판단 |
|---|---|---|---|
| **Gemini API Prepay(직접)** | **$5 선불**(공식 최소). 한국 계정은 Google Cloud Korea가 원화+VAT 10% 청구 → 약 7,700원 | **불가**(Google 공식) → 개인 카드 자부담 | **권장.** 조사 전체 예상 $0.4 → $5로 충분. 코드 변경 없음 |
| Gemini 무료 등급 | 0원 | — | 하루 모델당 약 20회 한도(KI-6 실측)로 20명 조사 불가, 입력이 Google 개선에 쓰임(현재 동의 문구에 고지 있음). **리허설용만** |
| 국내 리셀러(메가존·베스핀) | 계약 | 불가(세금계산서·계좌이체) | 비추천 |
| **카페24 LLM Router** | 무료 1,000 크레딧(원화 가치 미표기), 이후 원화 크레딧 | 미확정(자동충전은 카드 등록) | OpenAI 호환 API → **서버 분석 요청 재작성 필요**(이미지·응답 스키마·상자 좌표 형식), 구조화 출력 지원 미표기, 중개사(수탁자) 추가 → 처리방침·동의 문구 변경. 11월 일정엔 **비추천**, 무료 크레딧 시험은 가능 |
| BizRouter(국내) | Net-30 후불 | 법인카드·계약 | 비추천 |

### 8-4. `verify-research.sh` 실제 분석·저장 검증 (조사 DB·키 준비 후)

1. `deploy/vm/api.env`에 값 입력(편집기) → `! SERVER=root@172.104.120.148 bash deploy/vm/deploy.sh`(check-env research 통과 후 업로드)
2. `! bash deploy/vm/verify-research.sh` — smoke(계정·사진·Gemini 없음)
3. `! bash deploy/vm/verify-research.sh full` — 테스트 계정 1개 생성 → 저장소 상품 사진(1600px JPEG)을 **조사 DB Storage에 업로드** → **Gemini 분석 1회** → SlimSAM 배경 제거 3회 + 동시 2건(대기열) → 다른 사용자 사진 403 → **계정 삭제로 계정·옷·사진 정리**(실패 시 Secret key로 정리) → 보고서 JSON
4. 조사 DB SQL Editor: `verify-research-db.sql` 9/9(사용자·사진 0)
5. B: 운영 스냅샷 재조회 → 3장 기준(사용자 6·옷 9·사진 18·AI 8)과 비교. 단 A의 로컬 개발이 운영을 쓰는 동안은 사용자 수가 늘 수 있음 → 비교는 "조사 작업 시간대에 새 행이 없는지"(생성 시각)로 판정
