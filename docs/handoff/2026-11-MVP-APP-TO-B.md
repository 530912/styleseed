# Claude A → Claude B: 앱 통합·실기기 준비 인계 (2026-11 MVP)

| 항목 | 내용 |
|---|---|
| 작성 | 2026-10-26, Claude A |
| 기준 | `audit/2026-11-mvp` (이 문서와 같은 커밋). 이전 요청: `2026-11-MVP-BACKEND-REQUEST.md`(R-1~R-9) |
| 원칙 | B 담당 파일(`app.json`, `eas.json`, `src/lib/aiConsent*`, `src/app/ai-consent.tsx`·`account.tsx`·`delete-account.tsx`, 배포 문서·런북)은 고치지 않았다. B 작업 트리·서버(3001·8081)도 건드리지 않았다 |

## 1. 이번에 A가 바꾼 것 (통합 시 알아야 할 것)

| 파일 | 변경 | B 브랜치와 겹침 |
|---|---|---|
| `src/lib/researchEvents.ts`, `researchEventsPolicy.ts`, `src/app/research.tsx`(새) | 기기 내 연구 이벤트 기록·진행자 화면 | 없음 |
| `src/lib/featureFlags.ts` | `RESEARCH_MODE`(`EXPO_PUBLIC_RESEARCH_MODE`) 추가 | 없음 |
| `src/app/upload.tsx` | 사진 선택 후 `register_started` 1줄 + import 1줄 | **B도 수정(동의 확인)** — 시험 병합 충돌 0, 두 코드 모두 남음 확인 |
| `src/app/_layout.tsx`, `index.tsx`, `analyze.tsx`, `styling.tsx`, `looks.tsx`, `missing.tsx`, `src/lib/clothes.ts`, `src/hooks/use-save-pending-clothing.ts` | 이벤트 기록 호출, 홈 로고 길게 누르기(연구 모드만) | 없음 |
| `data/round1/contract/research-events-v0.2.json`, `scripts/round1/*` | 이벤트 계약 v0.2, 분석 집계 | 없음 |
| `scripts/release/verify-all.sh`(새) | 테스트 5종 + tsc + 배정표 + (선택) 웹 내보내기, `expo-env.d.ts` 없으면 생성 | 없음 |
| (이전 회차) `backend/server.js`·`concurrencyLimiter.js` | SlimSAM 대기열, 이미지 처리 한도, 오류 문구 | 끝부분 `registerAccountRoutes`와 다른 위치 |

**시험 병합 결과(오늘, `git merge-tree` → scratchpad):** 충돌 0. `verify-all.sh` 전부 통과 — backend 86(+1 skip), client 47, engine 35, fkd 36, round1 16, tsc 0, 배정표 일치.

## 2. 요청 (R-10~)

| # | 요청 | 이유 | 완료 기준 |
|---|---|---|---|
| R-10 | **AI 동의가 기기 단위**(`styleseed-ai-consent`)라 진행자 기기를 여러 참가자가 쓰면 두 번째 참가자부터 동의 화면이 안 나온다. 둘 중 하나: (a) A가 통합 브랜치에서 진행자 화면 [세션 종료]에 `withdrawAiConsent()` 호출을 붙인다(B의 공개 함수만 사용, B 파일 수정 없음) (b) B가 동의 키를 사용자별로 바꾼다 | 참가자마다 동의를 받아야 함 | **A 권장 (a)** — B 동의 시 통합 후 A가 1줄 추가 + 실기기 E-8 확인 |
| R-11 | EAS 환경변수 표(`docs/launch/EAS_SETUP.md` 4장)에 `EXPO_PUBLIC_RESEARCH_MODE`(연구 빌드 `true`, 그 외 비움)와 `EXPO_PUBLIC_SHOW_PROTOTYPES`(항상 비움) 추가 | 연구 빌드 구분 | 표·`.env.example`에 두 줄 |
| R-12 | `.env.example`(공유 파일)에 `EXPO_PUBLIC_RESEARCH_MODE=`, `EXPO_PUBLIC_SHOW_PROTOTYPES=` 한 줄씩 + 주석 | 공유 파일이라 A가 직접 안 고침 | — |
| R-13 | 연구 빌드는 **`preview` 프로필 + 조사용 Supabase**(BUG-25 결정)로. `EXPO_PUBLIC_API_URL` 누락 시 앱은 localhost로 가서 실기기 분석이 모두 실패 → 빌드 전 `check-env`에서 필수로 검사 | 실기기 실패 방지 | `check-env`가 비어 있으면 오류 |
| R-14 | 카메라 촬영(DV-1) — PO가 추가를 고르면 `app.json`의 `cameraPermission`을 한국어 문구로 바꿔 달라. 그 뒤 A가 [사진 찍기] 버튼 추가 | 권한 문구 없이 촬영을 부르면 iOS에서 종료 | PO 결정 후 |
| R-15 | 이전 회차 새 서버 변수(선택, 기본값 있음): `IMAGE_TASK_LIMIT_PER_HOUR`(60), `SLIMSAM_CONCURRENCY`(1), `SLIMSAM_MAX_QUEUE`(4), `SLIMSAM_QUEUE_WAIT_MS`(45000) — 런북·`check-env`에 "선택"으로 | 배포 변수 목록 완전성 | — |

## 3. 통합 절차 (B 인계 완료 후, A·B 같이 확인)

1. 두 작업 트리 모두 `git status` 깨끗한지 확인(커밋되지 않은 파일은 각자 처리).
2. 새 브랜치: `git switch -c integration/mvp-2026-11 audit/2026-11-mvp` → `git merge --no-ff release/beta-prep`(B의 최신 커밋 기준).
3. 충돌 시: B 담당 파일은 B 쪽, A 담당 파일은 A 쪽 우선. 공유 파일(`backend/server.js`, `src/lib/api.ts`, `.env.example`, `src/app/upload.tsx`)은 두 변경 모두 살리고 해결 내용을 커밋 메시지에 적는다.
4. `bash scripts/release/verify-all.sh --export` → 전부 PASS.
5. `src/app/upload.tsx`에서 **`hasAiConsent()` 확인이 `handleAnalyze`에 남아 있는지** 눈으로 확인(R-1 완료 기준).
6. R-10(a) 적용 시 A가 `research.tsx` [세션 종료]에 동의 초기화 추가 → 4번 다시.
7. 로컬 웹 실행(백엔드 + `EXPO_PUBLIC_RESEARCH_MODE=true`) → `/healthz` 200, 분석 1회, 동의 화면 표시 확인.
8. PO 실기기 절차(`docs/release/2026-11-MVP-DEVICE-TEST-PLAN.md` 5장)를 **통합본**으로 실행.
9. Push·빌드·배포는 각 ⛔ 승인 후.

## 4. A가 아직 못 한 것 (B 작업 후 가능)

| 항목 | 필요한 B 작업 |
|---|---|
| 실기기에서 분석·저장 전 흐름 | 서버 배포 또는 M2(LAN) 준비, PO 실행 |
| 사진 AI 동의 화면 실행 확인 | 통합 |
| 내부 빌드 설치·권한 문구 확인 | ⛔ `eas init` + preview 빌드 |
| 조사용 DB에서 로그인 흐름 | BUG-25 조사 DB 확정 |

---

## 5. 4차 (2026-10-27) — 1차 범위 추가 기능 + EAS 초기화 전 점검

**브랜치:** A는 B 요청대로 `integration/mvp-2026-11` 기준 새 로컬 브랜치 **`app/mvp-2026-11`**에서 작업(B의 `ce5334d`까지 병합, 충돌 0). `integration/mvp-2026-11`에 병합해 주면 된다(A가 B 작업 트리를 건드리지 않음). `verify-all.sh --export` 전부 통과: backend 101(+1 skip), client 58, engine 35, fkd 36, round1 16, tsc 0, 웹 내보내기.

| B 요청(B→A 인계) | A 처리 |
|---|---|
| `INVALID_IMAGE` 문구 | `apiErrors.ts`에 "이 사진은 분석할 수 없어요. 다른 사진으로 다시 시도해주세요." + 테스트 |
| 타임아웃 협의 | 앱 `ANALYZE_TIMEOUT_MS` 30초 → **50초**. 서버 `GEMINI_TIMEOUT_MS` 40~45초로 올리는 것은 B·PO 결정대로(앱은 준비됨) |
| `.expo/types` 오래됨 | `verify-all.sh`가 tsc 실패 시 안내 출력 + 로컬 `.env`의 `GEMINI_MODEL`을 비우고 테스트(OG-12가 로컬 `.env` 값에 따라 실패하던 문제) |
| BUG-31 | B 방식 그대로 사용. A의 [세션 종료]는 `withdrawAiConsent()`를 **한 번 더** 부른다(로그아웃 실패 대비, B 공개 함수만 사용) — 중복이 불편하면 알려 달라 |

**A가 추가한 1차 범위 기능(PO 10/27 결정, 실기기 검증 후 최종 확정):** 카메라 촬영, 온보딩, 저장 후 정보 수정(`clothes` 기존 열 UPDATE), 코디 저장(기기). DB 스키마·`package.json`·`app.json`·`eas.json` 변경 없음.

**B에게 요청(R-16~, 상세는 `docs/release/2026-11-MVP-EAS-PREFLIGHT.md` 4장 B-1~B-7):**

| # | 요청 | 급함 |
|---|---|---|
| R-16 (B-1) | 카메라 권한: `cameraPermission` 한국어 문구, Android `CAMERA` 제거 해제, EAS `preview`에 `EXPO_PUBLIC_CAMERA_ENABLED=true`, `check-env --app` 항목 | 카메라를 빌드에 넣으려면 필수 |
| R-17 (B-2) | `.easignore`(사업 문서 업로드 방지) | **빌드 전 필수** |
| R-18 (B-6) | `yarn.lock` 삭제(npm 프로젝트) | **빌드 전 필수** |
| R-19 (B-7) | SDK 57 패치 16개 정렬(`npx expo install --check`) — A·B 중 한 명만, 별도 커밋 | 실기기 E2E 전 |
| R-20 (B-3·B-4) | PO 결정 후 `owner`, 앱 이름·아이콘 | eas init 전 |
| R-21 | (B 계정 삭제 흐름) 계정 삭제 성공 시 기기 저장 데이터도 정리: `useSavedLooksStore.getState().clearLooks()` 호출 권장. 지금도 다른 계정에는 보이지 않지만(옷 ID로 구분) 기기에 남는다 | 낮음 |

---

## 6. 5차 (2026-10-27 오후) — iOS TestFlight 우선 전환 (PO 지시)

PO가 첫 배포를 **iOS TestFlight 외부 테스터**로 바꾸고, A에게 EAS 설정·Bundle ID·앱 이름·아이콘·권한 문구 준비를 직접 지시했다. 그래서 **A가 B 담당 파일 `app.json`·`eas.json`을 고쳤다**(`app/mvp-2026-11`, 같은 커밋). 충돌을 피하려면 B는 아래 항목을 다시 하지 말고 병합만 해 달라.

| 파일 | 변경 |
|---|---|
| `app.json` | `name` → `STYLESEED`, `userInterfaceStyle` → `light`, `ios.icon` → `./assets/images/icon.png`(임시 아이콘), `ios.privacyManifests`(API 사유 4종, 추적 없음), Android 적응형 배경색 `#FEFCFA`, `expo-image-picker` `cameraPermission` 한국어 문구(Android `CAMERA` 다시 포함) |
| `eas.json` | `build.testflight`(store + `preview` 환경 + iOS 빌드 번호 자동 증가), `submit.testflight` |
| `assets/images/*.png` | 임시 STYLESEED 아이콘 세트 |
| `src/lib/camera.ts` | `EXPO_PUBLIC_CAMERA_ENABLED` **삭제** — 앞의 R-16 중 EAS 변수·`check-env` 항목은 필요 없음 |
| `src/lib/__tests__/appConfig.test.mjs`(새) | 권한 문구·이름·Bundle ID·매니페스트·`testflight` 프로필 검사 |

B에게 남은 요청(상세 `docs/release/2026-11-MVP-TESTFLIGHT-PLAN.md` 4·5장):
- R-17 `.easignore`, R-18 `yarn.lock` 삭제, R-19 SDK 패치 — 그대로(빌드 전 필수).
- **R-22** 서버 **HTTPS** 주소(iOS 출시 빌드는 http에 연결 안 함).
- **R-23** 개인정보처리방침 공개 URL(외부 테스트 입력값) — 참가자가 **본인 iPhone·본인 이메일**로 가입하게 되었으므로 처리방침·동의서에 이메일·옷 사진·조사 이벤트 반영.
- **R-24** Beta App Review용 **데모 계정**(조사 DB, 만료 없음, 옷 3~4벌) — 비밀번호는 App Store Connect에만.
- R-25 EAS `preview` 환경 = TestFlight 조사 빌드 값(`testflight` 프로필이 `preview` 환경을 씀).
- (결정 후) R-26 7일 사용 기록을 받으면 `research_events` 테이블(⛔, 계정 삭제 연쇄 포함) — A가 앱 전송 코드 작성.
