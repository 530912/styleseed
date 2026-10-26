# 2026-11 사용자 조사 배포 — 최종 준비와 PO 실행 순서

| 항목 | 내용 |
|---|---|
| 작성 | 2026-10-27, 출시 트랙 Claude B |
| 기준 브랜치 | `integration/mvp-2026-11` (로컬, Push 안 함) |
| 앞 문서 | `2026-11-MVP-DEPLOY-PREP.md`(호스팅·DB 선택 근거, 10장 결제 자료) |
| 하지 않은 것 | 결제, 배포, 유료 전환, Push, 운영 DB 변경(읽기 조회만) |

---

## 1. Railway — 설정값 확정

`railway.json`은 **새 서비스에 적용되지 않는다**(공식 문서: 새 서비스는 Config as Code 사용 불가, 기존 파일도 2026-12-01 이후 무시). 대체인 `railway.ts`는 메모리·리전 설정이 없고 공유 `package.json`에 의존성을 추가해야 해서, **서비스 1개는 대시보드에서 아래대로 설정**한다.

| 위치(서비스 Settings) | 값 |
|---|---|
| Source | GitHub 저장소, 브랜치 `integration/mvp-2026-11` (또는 `railway up`) |
| Build → Builder | Dockerfile(저장소 루트 `Dockerfile`, 자동 인식) |
| Deploy → Region | **Southeast Asia (Singapore)** |
| Deploy → Replicas | **1** |
| Deploy → Resource limits → Memory | **8 GB** |
| Deploy → Healthcheck path | `/healthz` (timeout 300) |
| Deploy → Restart policy | On Failure |
| Networking → Public domain | Generate Domain → `https://<이름>.up.railway.app` |
| (프로젝트) PR environments | 끔 |
| (워크스페이스) Usage → limits | **Soft $25 / Hard $40** |

### 변수 (Variables → Raw Editor)

비밀값 4개는 **PO가 직접 붙여넣는다**(🔒). 나머지는 그대로 복사.

```
SUPABASE_URL=https://<조사 프로젝트 ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_<조사 프로젝트>
SUPABASE_SECRET_KEY=🔒 조사 프로젝트 railway-research 키
GEMINI_API_KEY=🔒 조사용 Gemini 키(2장)
BRIA_API_TOKEN=🔒 기존 BRIA 토큰
OPS_METRICS_TOKEN=🔒 무작위 32자 이상(예: openssl rand -hex 24)
TRUST_PROXY=1
ALLOW_TOKENLESS_GUEST=false
GEMINI_MODEL=gemini-3.6-flash
GEMINI_THINKING_LEVEL=minimal
GEMINI_DAILY_LIMIT=300
```

넣지 않는 것: `FAL_KEY`(없으면 fal 경로 404), `GEMINI_REQUEST_MASK`, `PORT`(Railway가 넣음). 나머지 한도·SlimSAM 변수는 기본값.

### 비용 한도 요약

| 장치 | 값 | 넘으면 |
|---|---|---|
| Railway hard limit | $40/월 | 서비스 중지(조사 중 멈추지 않도록 예상 $24의 약 1.7배) |
| Railway soft limit | $25/월 | 이메일 알림만 |
| 메모리 상한 | 8GB | 컨테이너 재시작(SlimSAM 대기열로 동시 1건이라 예상 최대 약 3.5GB) |
| `GEMINI_DAILY_LIMIT` | 300회/일 | 그날 분석 429(앱 "한도" 안내), 자정(한국 시간) 초기화 |
| Gemini 선불 잔액 | $10 | 0이 되면 모든 키 정지(402) → 서버가 503 `AI_CREDIT_EXHAUSTED` + 로그 |
| 사용자별 | 분석 30/시, 이미지 처리 60/시 | 429 |

## 2. Gemini 유료 전환 — 설정과 상한

공식 문서(ai.google.dev/gemini-api/docs/billing, 10/27 확인) 기준.

| 단계 | 내용 |
|---|---|
| 1 | Google AI Studio → **새 프로젝트 `styleseed-research`**(개발 키와 분리. 개발 키는 무료 등급 그대로) |
| 2 | API keys(또는 Projects) 화면 → Billing Tier 열 **Set up billing** → Cloud Billing 계정 생성 → **Prepay(기본)** |
| 3 | **$10 선불 충전**(최소 $5, 12개월 후 만료, 환불 불가). **자동 충전(auto-reload) 끔** → 잔액이 사실상 하드 상한 |
| 4 | Spend 화면 → Monthly spend cap → **$10**(공식: "실험 기능, 초과될 수 있음" — 보조 장치) |
| 5 | 그 프로젝트에서 **API 키 생성** → Railway `GEMINI_API_KEY`에 붙여넣기 |
| 6 | 앱 빌드 변수 `EXPO_PUBLIC_GEMINI_PAID_TIER=true`(무료 등급 고지 문구 숨김) |

- 결제 수단: Google은 **선불카드 불가**(공식, 이전 확인). 해외결제 가능한 개인 신용카드.
- 한국 주소 계정은 Google Cloud Korea가 원화+VAT 10%로 청구(이전 확인, `docs/funding/TECH_COST_VERIFICATION.md`).
- 유료 등급은 입력·응답을 Google 제품 개선에 쓰지 않음(공식). 동의 문구의 "무료 등급" 고지는 6번 변수로 꺼진다.
- **비용 감**: 실측 1회 입력 1,449·출력 72토큰 × `gemini-3.6-flash` 단가(입력 $0.75·출력 $3.75 / 100만 토큰, 10/19 확인) ≈ **$0.0014(약 2원)/회**. 조사 전체 약 300회 ≈ $0.4. 일일 상한 300회를 매일 채워도 하루 약 $0.42. **$10이면 조사 기간 전체에 충분.** (2027-01-01부터 단가 2배 예정 — 조사 후 영향)

## 3. 조사 전용 DB — 확정

**새 Pro 조직 + `styleseed-research`(서울) 프로젝트 1개, 월 $25.** 만드는 절차: `supabase/research/README.md`.

### 기존 사용자 데이터 보호 장치

| 장치 | 내용 | 확인 |
|---|---|---|
| 다른 조직·다른 프로젝트 | 운영·QA와 키·DB·Storage가 완전히 분리. 데이터 이전 없음 | 설계 |
| 서버 대상 검사 | `check-env --target research`: 서버 변수가 운영·QA ref면 **오류** | 테스트 EV-03b |
| 앱 빌드 대상 검사 | `check-env --app --target research`: 앱 Supabase가 운영·QA면 **오류**, API 주소 누락·localhost 오류 | 테스트 EV-06 |
| 배포 검증 | `verify-deploy --suite full`은 운영 ref면 실행 거부. 만든 테스트 계정은 끝에 계정 삭제로 정리 | 기존 코드 |
| 조사 DB 정합성 | `supabase/research/verify-research-db.sql` 9항목(읽기 전용) | 빈 DB 재구성 9/9, 운영 DB 구조 7/7 일치 |
| 운영 DB | 이번 작업에서 **쓰기 0**(읽기 조회만) | — |

### 검증 순서 (배포 후)
1. `check-env --target research`(Railway 셸) → 오류 0
2. `verify-deploy --suite smoke` → 통과
3. `verify-deploy --suite full --analyze 3`(조사 프로젝트 값을 `QA_SUPABASE_*`로) → 통과, **테스트 계정 자동 삭제**
4. `verify-research-db.sql` → 9/9(사용자 0·사진 0 확인)
5. 진행자 기기 실기기 점검(Claude A `DEVICE-TEST-PLAN`) → 진행자 테스트 계정을 앱에서 삭제 → 4번 다시

## 4. BUG-31 사진 AI 동의 — 수정 완료

| 항목 | 내용 |
|---|---|
| 원인 | 동의를 기기 단위(`styleseed-ai-consent`)로 저장 → 진행자 기기에서 두 번째 참가자부터 동의 화면이 안 나옴 |
| 수정(커밋 `abb9a3e`) | ① 동의 기록에 **동의한 사용자(ownerId)** 저장(로그인 전·익명은 null) ② 다른 사용자의 동의는 무효 → 다시 동의 ③ 로그인 전 동의는 그 뒤 로그인한 사용자에게 귀속(같은 사람의 흐름) ④ **로그아웃(`SIGNED_OUT`)이면 기록 삭제** — 옷장 로그아웃·진행자 [세션 종료]·계정 삭제·세션 만료 모두 ⑤ 사용자 정보가 없는 예전 기록은 무효(한 번 다시 동의) |
| 파일 | `src/lib/aiConsentPolicy.ts`, `src/lib/aiConsent.ts`(B 소유), `src/app/_layout.tsx`(A 파일, 1줄 + import) |
| 확인 | 단위 테스트 CS-05~08(+기존 CS-01~03 갱신). **웹 실제 실행(가짜 Supabase 주소, 외부 요청 없음)**: 동의 → 기록에 `ownerId:null` → 진행자 [세션 종료] 2번 → **기록 삭제됨**. 다른 사용자 기록·예전 형식 기록 → 화면 "동의하지 않음" |
| 미확인 | 실제 로그인 계정에서의 귀속(adopt)·로그아웃 삭제 — 운영 DB에 계정을 만들 수 없어 실행 못 함. 실기기 점검 R-16·E-8에서 확인 |

## 5. 백엔드 브랜치 정리

| 브랜치 | 커밋 | 상태 |
|---|---|---|
| `integration/mvp-2026-11` | `9af0a65` 이후(이 문서 커밋 포함) | **조사 RC.** `release/beta-prep` + `audit/2026-11-mvp`(A 3차 `4a975f5`까지) + B 수정 |
| `audit/2026-11-mvp` (A) | `4a975f5` | 통합본에 전부 포함 |
| `release/beta-prep` (B) | `d3b8197` | 통합본에 전부 포함. 더 쓰지 않음 |

회귀(`scripts/release/verify-all.sh --export`, 10/27): backend **101(+1 skip)**, client **51**, engine 35, fkd 36, round1 16, tsc 0, 배정표 일치, 웹 내보내기 성공.

A와의 규칙: **A의 다음 작업은 `integration/mvp-2026-11`에서 분기하거나 그것을 병합한 뒤 시작.** 인계: `docs/handoff/2026-11-MVP-INTEGRATION-TO-CLAUDE-A.md`.

## 6. PO가 직접 할 일 (순서대로)

| # | 할 일 | 소요 | 끝나면 B에게 |
|---|---|---|---|
| 1 | 결제용 **해외결제 가능 개인 신용카드** 준비, 카드사 앱에서 **해외원화결제(DCC) 차단** | 5분 | — |
| 2 | **Supabase**: 새 조직 `STYLESEED Research`(Pro) → 프로젝트 `styleseed-research`(서울) → SQL 붙여넣기·Auth 3항목·Secret key 생성 → `verify-research-db.sql` 9/9 (`supabase/research/README.md`) | 20분 | 프로젝트 URL, Publishable key(공개 값) |
| 3 | **Gemini**: AI Studio 새 프로젝트 → 결제 설정(Prepay) → **$10 충전, 자동 충전 끔** → 지출 상한 $10 → API 키 생성(키는 4번에서 Railway에 직접) | 15분 | "완료"만 |
| 4 | **Railway**: 가입 → Hobby 업그레이드·카드 → Usage limits Soft $25·Hard $40 | 10분 | "완료"만 |
| 5 | **배포 방식 승인**: (a) `integration/mvp-2026-11` GitHub Push 승인 → Railway에서 저장소 연결, 또는 (b) 이 세션에서 `! npx @railway/cli login` 실행(로그인만) → B가 `railway up` | 5분 | 선택 |
| 6 | Railway 서비스 설정(1장 표) + **비밀값 4개 붙여넣기**(나머지 변수는 1장 블록 복사) | 15분 | 공개 도메인 주소 |
| 7 | 로컬 개발 `.env`를 QA 프로젝트로 전환할지 결정(A와) | — | 결정 |

**그다음 B가 한다:** check-env → smoke → full(테스트 계정 자동 정리) → 조사 DB 9/9 확인 → 앱 빌드 변수 표(`EAS_SETUP.md` 4장) 작성 → `check-env --app --target research`. EAS preview 빌드는 별도 승인(⛔).

**승인 시점:** 2~4번이 결제, 5번이 Push(또는 CLI 로그인), 6번 이후 B의 배포 작업이 "실제 외부 배포"다. 6번까지 끝났다고 알려 주시면 그것을 배포 승인으로 보고 진행한다(다르면 말씀해 주세요).
