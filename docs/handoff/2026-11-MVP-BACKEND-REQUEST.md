# Claude A → Claude B: 2026-11 사용자 조사 MVP 백엔드·배포 점검 요청

| 항목 | 내용 |
|---|---|
| 작성 | 2026-10-26, Claude A |
| 기준 | `audit/2026-11-mvp`(이 문서와 같은 커밋), 비교 대상 `release/beta-prep` `8703008`, `integration/beta-rc1.1` `b24b33c` |
| 근거 | `docs/release/2026-11-MVP-FUNCTION-AUDIT.md`, `docs/release/2026-11-MVP-BUG-LIST.md` |
| 원칙 | Claude A는 Claude B 담당 파일(계정 삭제, 처리방침·약관, `eas.json`·`app.json` 스토어 필드, Dockerfile, Railway)을 고치지 않았다. Claude B 작업 트리(`~/orca/workspaces/styleseed/STYLESEED-Beta-Launch`)와 그 서버(포트 3001·8081)도 건드리지 않았다 |

## 1. 이번에 Claude A가 바꾼 것 (통합 시 알아야 할 것)

| 파일 | 변경 | B 브랜치와 겹침 |
|---|---|---|
| `src/lib/featureFlags.ts`(새 파일) | `EXPO_PUBLIC_SHOW_PROTOTYPES === "true"`일 때만 프로토타입 화면 표시 | 없음 |
| `src/components/styleseed/prototype-gate.tsx`(새 파일) | 꺼져 있으면 `<Redirect href="/" />` | 없음 |
| `src/app/demo.tsx`, `ideal-style.tsx`, `core-match.tsx`, `core-look.tsx`, `core-shop.tsx` | 기본 내보내기를 `PrototypeGate`로 감쌈 → **R1-02-01 H-4(운영 빌드 `/demo` 숨김) 충족** | 없음 |
| `src/app/styling.tsx` | IDEAL STYLE 배지를 같은 설정으로 숨김 | 없음 |
| `src/lib/userErrors.ts`(새 파일), `src/app/analyze.tsx`, `src/app/item.tsx` | 저장·사진 교체 실패 시 영어 원문 대신 한국어 안내, 분석 연결 실패 문구 변경 | `analyze.tsx`는 B 브랜치가 고치지 않음 |

**새 환경변수 1개:** `EXPO_PUBLIC_SHOW_PROTOTYPES` — 연구·배포 빌드에는 **넣지 않는다**(기본 숨김). 영상 촬영용 빌드에만 `true`. `.env.example`(공유 파일)에는 추가하지 않았으니 통합 때 한 줄 추가를 부탁한다.

## 2. 요청 사항 (우선순위 순)

| # | 요청 | 이유(BUG) | 완료 기준 | 승인 |
|---|---|---|---|---|
| R-1 | **새 통합 브랜치** `integration/mvp-2026-11` = `audit/2026-11-mvp` + `release/beta-prep`. 기존 `integration/beta-rc1.1`은 `sprint/1a-3` `120ecf4` 기준이라 이후 개발 커밋(이미지 준비 KI-9, taxonomy 호환, 엔진 회귀 테스트, 이번 수정)이 빠져 있다 | BUG-02 | 충돌 해결 기록, `test:backend`·`test:client`·`test:engine`·`test:fkd`·`test:round1`·`tsc` 통과, 웹 내보내기 성공. 특히 `src/app/upload.tsx`(양쪽 수정)에서 **AI 동의 확인이 `prepareClothingImage` 흐름 뒤 `handleAnalyze`에 그대로 남는지** | 로컬 작업(Push는 ⛔) |
| R-2 | **백엔드 배포**(Railway, QA 변수 → smoke → full) + `/healthz` | BUG-01 | 실기기에서 분석 200, `/healthz` 200 | ⛔ 승인 1 |
| R-3 | 배포 변수 고정: `GEMINI_MODEL`(현재 로컬 `.env`는 `gemini-3.5-flash`, 서버 기본값은 `gemini-3.6-flash`, 응답 `modelVersion`은 `gemini-3.6-flash`로 기록됨) → PO와 하나로 정하고 시작 로그·`/healthz`에 노출 | BUG-13 | 조사 기간 모델 1개, 문서 기록 | — |
| R-4 | 배포 환경에 `FAL_KEY`를 넣지 않음(앱이 `/segment-garment` fal 경로를 쓰지 않음). 가능하면 운영에서 해당 경로 비활성 | 노출 면 축소 | 배포 변수 목록에 없음 | — |
| R-5 | `ALLOW_TOKENLESS_GUEST` 배포값 결정(KI-3). 오늘 운영 Supabase 설정에서 **익명 로그인이 켜져 있음**을 확인(`/auth/v1/settings`의 `external.anonymous_users=true`). 앱의 익명 세션 경로가 동작함도 웹에서 확인 → `false`로 돌려도 되는 조건이 갖춰졌는지 PO와 결정 | KI-3 | 결정 기록 | PO |
| R-6 | EAS preview 빌드(Android APK 우선) + `EXPO_PUBLIC_API_URL` 등록, 실기기 QA 체크리스트(`2026-11-MVP-RELEASE-PLAN.md` 4장) 함께 실행 | BUG-15 | D-1~D-12 결과 | ⛔ 승인 3 |
| R-7 | 사진 AI 동의 문구 ↔ 연구 동의서(`docs/round1/SURVEY_AND_CONSENT.md` 2장 5항) ↔ 처리방침 초안 대조(수탁자·국외 이전·Gemini 무료 등급 데이터 활용) | BUG-09, 개인정보 | 세 문서 문구 일치 | PO 확정 |
| R-8 | 잘못된 이미지 데이터 사전 검사: `imageBase64`가 base64 디코딩 불가이거나 JPEG/PNG 시그니처가 아니면 Gemini를 부르지 않고 400 `INVALID_IMAGE` | BUG-10 | 단위 테스트 | — |
| R-9 | 오류 수집 최소안: 서버 오류 응답(5xx, 422 `LOW_QUALITY_CUTOUT`, Gemini 429)을 한 줄 JSON 로그로 남기고, 조사 기간 매일 집계할 수 있게 | BUG-11 | Railway 로그에서 `grep`으로 집계 가능 | — |

## 3. Claude A가 할 일 (공유 파일을 건드리는 것은 끝나면 인계)

| # | 작업 | 공유 파일 | 인계 |
|---|---|---|---|
| A-1 | BUG-16 SlimSAM 동시 1건 제한 + 대기열(R1-02-01 H-1) | `backend/cutout.js`, `backend/server.js` | 변경 줄·메모리 측정값을 이 폴더에 추가 문서로 |
| A-2 | 옷이 아닌 사진 판별(BUG-06): 응답에 판별 필드 추가 → 422 `NOT_CLOTHING` | `backend/server.js` 응답 계약, `src/lib/apiErrors.ts` 오류 코드 | **API 계약 변경이라 착수 전 B와 합의.** 11월 첫 세션 이후로 미루는 것을 제안 |
| A-3 | 연구 이벤트 기록기(R1-02-03), 1차는 기기 기록 + 내보내기 | 없음(DB 변경 없음). DB 저장으로 가면 `research_events` 마이그레이션 ⛔ + **계정 삭제 연쇄 삭제에 포함 요청** | 결정 후 |
| A-4 | 상품 카탈로그·상세·공식몰 이동(R1-02-07·08) | 없음(앱 내장 JSON) | — |

## 4. 확인해 둔 사실 (B 작업 판단용)

- 이 브랜치 백엔드에는 `/healthz`가 없다(404). Claude B 작업 트리의 백엔드(포트 3001)는 `/healthz` 200, 가동 약 3일(10/23 시작).
- 웹 번들에 서버 키(Gemini·BRIA·fal) 없음. 번들 환경변수는 공개용 3개뿐.
- 운영 DB: `public.clothes`, `public.ai_usage` 두 테이블, 모두 RLS 켜짐. `clothes`에는 값 제약(CHECK)이 없다(속성 값은 앱·서버가 결정).
- 운영 Supabase 가입 설정: 가입 허용, 이메일 인증 자동 완료(`mailer_autoconfirm=true`) → 가입 직후 세션이 생긴다(앱의 가입 후 자동 저장 경로가 이 설정에 의존).
- 이번 감사의 웹 테스트가 운영에 익명 Auth 사용자 1명을 만들었다(KI-4 정리 설계 때 포함).
