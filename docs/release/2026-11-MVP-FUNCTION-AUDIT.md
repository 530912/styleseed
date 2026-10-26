# 2026-11 사용자 조사 MVP — 기능 전수 조사·실제 동작 검증

| 항목 | 내용 |
|---|---|
| 작성 | 2026-10-26, Claude A (MVP 기술 점검·배포 준비) |
| 대상 | `audit/2026-11-mvp` 브랜치 = `sprint/1a-3`(`d9a4e7a`) + 이번 감사 수정 3건. `release/beta-prep`(Claude B, `8703008`)의 출시 기능은 **병합 전이라 별도 표기** |
| 관련 문서 | 버그 목록 `2026-11-MVP-BUG-LIST.md` · 범위 `2026-11-MVP-SCOPE.md` · 배포 계획 `2026-11-MVP-RELEASE-PLAN.md` · Claude B 요청 `../handoff/2026-11-MVP-BACKEND-REQUEST.md` |

## 0. 판정 기준과 테스트 환경

### 상태

| 상태 | 뜻 |
|---|---|
| **PASS** | 이번 감사에서 실제 실행해 정상 동작을 확인 |
| **PARTIAL** | 일부만 동작하거나 제한·오류가 있음 |
| **FAIL** | 구현됐지만 실행 테스트에서 실패 |
| **NOT IMPLEMENTED** | 코드 없음 |
| **BLOCKED** | 외부 환경·인증·권한 때문에 이번에 실행할 수 없음 |
| **NOT TESTED** | 실행하지 못함(코드만 읽음) |

> **코드가 있다는 이유만으로 PASS를 주지 않았다.** 이전 Sprint의 검증 결과는 "과거 근거"로 따로 적고, 이번 판정에는 이번 실행 결과만 쓴다.

### 테스트 환경 (이번에 실제로 쓴 것)

| 코드 | 환경 | 범위 |
|---|---|---|
| **WEB** | Chrome, Expo 웹 개발 빌드(`localhost:8181`), 백엔드 `localhost:3101`. **로그아웃 상태만** | 화면 이동·버튼·분석·오류 화면 |
| **SIM** | iOS 26.5 시뮬레이터(iPhone 17 Pro) + Expo Go(SDK 57) | **실행·첫 화면 렌더링만**(탭·입력 도구 없음) |
| **SRV** | 로컬 백엔드 `node backend/server.js`(포트 3101)에 `curl` | 실제 Gemini 호출, 인증 거절, 오류 응답 |
| **NODE** | Node 단위 테스트·엔진 실행(고정 옷장 15벌) | 추천 엔진, 오류 문구, 정책 함수 |
| **DB** | Supabase 운영 프로젝트 읽기 전용 SQL(집계만, 사용자 데이터 미조회) | 제약 조건, RLS 켜짐, 계정 수 |
| **CODE** | 코드 정독만 | 실행 근거 없음 |

**실기기 테스트: 0건.** iPhone·Android 실기기는 이번에 쓰지 않았다(EAS 빌드 없음, 실기기 미연결). Android 에뮬레이터도 실행하지 않았다.

### BLOCKED가 많은 이유 (중요)

로그인 이후 기능(옷장 저장·조회·삭제, 로그인 상태의 코디 화면)은 **이번에 화면으로 검증하지 못했다.**
- 운영 Supabase(원격)로 전송되는 비밀번호를 브라우저에 입력하는 것은 Claude의 안전 규칙상 할 수 없다.
- QA Supabase 프로젝트 접속값(`E2E_SUPABASE_URL`·`E2E_SUPABASE_PUBLISHABLE_KEY`)이 이 PC 환경에 없어 기존 QA E2E(`npm run test:e2e`)를 실행할 수 없었다.
- 해결: PO가 직접 로그인해 확인하는 15분 점검표(`2026-11-MVP-RELEASE-PLAN.md` 3장)를 실행하거나, QA 접속값을 셸에 넣어 QA E2E를 다시 돌린다.

### 이번 감사가 운영 환경에 남긴 것

- 실제 Gemini 호출 **5회**(정상 3, 일부러 잘못된 데이터 1, 옷이 아닌 사진 1). 대량 호출 없음.
- 웹 분석 테스트에서 앱이 로그인 전 분석용 **익명 Auth 사용자 1명**을 운영 Supabase에 만들었다(KI-4, 앱의 정상 동작). 운영 DB 쓰기·삭제는 하지 않았다.

---

## 1. 자동 테스트 결과 (2026-10-26, 이 브랜치)

| 명령 | 결과 |
|---|---|
| `npm run test:backend` | 46 pass / 0 fail |
| `npm run test:client` | **30 pass / 0 fail**(감사 전 25 → 이번 추가 5) |
| `npm run test:engine` | 35 pass / 0 fail |
| `npm run test:fkd` | 36 pass / 0 fail |
| `npm run test:round1` | 16 pass / 0 fail |
| `npx tsc --noEmit` | 오류 0 |
| `npm run test:e2e`(QA 실연동) | **BLOCKED** — QA 접속값 없음 |
| `npx expo lint` | 실행 안 함(KI-12: ESLint 설정 없음) |

---

## 2. 기능별 결과

표의 담당: **A** = Claude A(제품·엔진·앱 화면), **B** = Claude B(배포·삭제·개인정보·EAS), **C** = Claude C(Knowledge Lab), **PO** = 사람. 심각도 기준은 `2026-11-MVP-BUG-LIST.md` 0장. "조사 필수"는 11월 사용자 조사 세션 진행에 꼭 필요한지 여부.

### 2.1 시작·인증·계정

| # | 기능 | 구현 | 이번 테스트 결과 | 환경 | 오류·재현 | 코드 | 심각도 | 담당 | 수정 범위 | 조사 필수 |
|---|---|---|---|---|---|---|---|---|---|---|
| F-01 | 스플래시 인트로 | 있음 | **PASS** — 실행 직후 STYLE SEED 로고 → 홈 | WEB, SIM | — | `src/components/SplashIntro.tsx`, `src/app/index.tsx` | — | — | — | 예 |
| F-02 | 온보딩(서비스 소개·사용법) | 없음 | **NOT IMPLEMENTED** — 스플래시 뒤 바로 홈 | WEB | — | — | P3 | A | 소(소개 1~2장) | 아니오(진행자가 안내) |
| F-03 | 회원가입(이메일·비밀번호) | 있음 | **BLOCKED**(비밀번호 입력 불가). 화면 표시·분석 후 저장 시 가입 화면 이동은 **PASS**. Supabase 설정 읽기: 가입 허용, **이메일 인증 자동 완료(autoconfirm) 켜짐** | WEB, SRV | — | `src/app/signup.tsx` | P0(검증 필요) | PO 확인 → A | — | 예 |
| F-04 | 로그인·오류 안내 | 있음 | **BLOCKED**(화면 입력). 한국어 오류 문구 함수는 **PASS**(NODE) | NODE | — | `src/app/login.tsx`, `src/lib/authErrors.ts` | P0(검증 필요) | PO 확인 | — | 예 |
| F-05 | 로그아웃 | 있음 | **BLOCKED** | CODE | — | `src/app/closet.tsx` `handleLogout` | P1 | PO 확인 | — | 예 |
| F-06 | 세션 유지(재실행 후 로그인 유지) | 있음(네이티브 AsyncStorage) | **NOT TESTED** — 실기기·로그인 필요 | CODE | — | `src/lib/supabase.ts` | P0(검증 필요) | 실기기 QA | — | 예(시나리오 E) |
| F-07 | 로그인 전 분석용 익명 세션 | 있음 | **PASS** — 로그아웃 상태에서 분석 성공, 운영 DB 익명 사용자 수 증가 확인 | WEB, DB | 익명 사용자 누적(KI-4) | `src/lib/sessionPolicy.ts` | P3 | B | — | 예 |
| F-08 | 비밀번호 재설정 | 없음 | **NOT IMPLEMENTED** | — | — | — | P2 | A | 소~중 | 아니오(진행자 기기) |
| F-09 | 사용자 프로필·설정 화면 | 없음(이 브랜치) | **NOT IMPLEMENTED**. 계정 화면 `account.tsx`는 `release/beta-prep`에만 있음 | CODE | — | — | P2 | B | 병합 | 아니오 |
| F-10 | 계정 삭제(앱·웹) | `release/beta-prep`에만 | **NOT TESTED**(이 브랜치에 없음). Claude B 보고: 단위 테스트 통과, 실연동 미검증 | — | — | B 브랜치 `src/app/delete-account.tsx`, `backend/accountDeletion.js` | **P0(스토어 배포 시)** / P1(진행자 기기 조사) | B | 병합 + 실연동 | 외부 배포 시 예 |
| F-11 | 사진 AI 전송 동의 | `release/beta-prep`에만 | **NOT TESTED**(이 브랜치에 없음) | — | **현재 이 브랜치는 동의 없이 첫 분석부터 사진을 Gemini로 보낸다** | B 브랜치 `src/app/ai-consent.tsx` | **P0** | B | 병합 | **예** |
| F-12 | 약관·개인정보처리방침 동의(가입 시) | 없음 | **NOT IMPLEMENTED** | — | — | — | P0(외부 배포) / P1(연구 동의서로 대체 시) | B·PO | 중 | 연구 동의서로 대체 가능 |

### 2.2 홈·내비게이션

| # | 기능 | 구현 | 이번 테스트 결과 | 환경 | 오류·재현 | 코드 | 심각도 | 담당 | 수정 범위 | 조사 필수 |
|---|---|---|---|---|---|---|---|---|---|---|
| F-13 | 홈(로고, 오늘의 룩 카드, 옷 등록·옷장 버튼) | 있음 | **PASS**(로그아웃 상태). 로그인 상태는 BLOCKED | WEB, SIM | — | `src/app/index.tsx` | — | — | — | 예 |
| F-14 | 날씨(위치 → Open-Meteo) | 있음 | **PASS**(SIM: 13°C 샌프란시스코=시뮬레이터 위치). WEB은 위치 권한 대기로 "확인 중" 유지 | SIM, WEB | 웹 전용 현상 | `src/lib/weather.ts`, `src/hooks/use-weather.ts` | P3 | — | — | 아니오(있으면 좋음) |
| F-15 | 화면 이동(Stack, 헤더 없음, 뒤로가기) | 있음 | **PASS** — 홈→업로드→분석→가입, 직접 주소 이동 | WEB | — | `src/app/_layout.tsx` | — | — | — | 예 |
| F-16 | 내부 영상용 `/demo` | 있음 | 감사 전: 주소로 누구나 열림 → **수정 후 PASS**(홈으로 이동) | WEB | BUG-05 | `src/app/demo.tsx`, `src/lib/featureFlags.ts` | P1 → 해결 | A | 완료 | 숨김 대상 |
| F-17 | IDEAL STYLE · BETA(Core Engine 데모) | 고정 데모 규칙 | 감사 전: Styling 화면 배지에서 진입, POETCORE만 선택 가능("준비 중" 3개) → **수정 후 4개 주소 모두 홈으로 이동 PASS**, 배지는 코드·타입 검사로만 확인(로그인 필요) | WEB, CODE | BUG-05 | `src/app/ideal-style.tsx`, `core-*.tsx`, `src/app/styling.tsx` | P1 → 해결 | A | 완료 | 숨김 대상 |

### 2.3 사진 등록·AI 분석

| # | 기능 | 구현 | 이번 테스트 결과 | 환경 | 오류·재현 | 코드 | 심각도 | 담당 | 수정 범위 | 조사 필수 |
|---|---|---|---|---|---|---|---|---|---|---|
| F-18 | 카메라 촬영 | 없음 | **NOT IMPLEMENTED** — `launchCameraAsync` 없음, 앨범만 | CODE | — | `src/app/upload.tsx` | P2 | A(+B 권한 문구) | 소 | 아니오(카메라 앱으로 찍고 앨범 선택) |
| F-19 | 앨범에서 사진 선택 | 있음 | **PASS**(WEB: 파일 선택 결과 주입 방식, 선택 창 자체는 자동화 불가). 실기기 NOT TESTED | WEB | — | `src/app/upload.tsx` | P0(실기기 검증 필요) | 실기기 QA | — | 예 |
| F-20 | 사진 준비(긴 변 1600px JPEG) | 있음 | **PASS** — `[perf] image.prepare 18ms`, 23KB. HEIC·EXIF는 실기기 NOT TESTED(PQ-8) | WEB | — | `src/lib/imagePrep.ts` | P1(실기기) | 실기기 QA | — | 예 |
| F-21 | Gemini 의류 분석(실제 API) | 있음 | **PASS** — 실제 호출. 스니커즈 → shoes/sneakers/white, 데님 → bottom/jeans/black/wide. curl 6.5초, 앱 5.96초(첫 호출은 익명 세션 생성 포함 20.7초) | SRV, WEB | — | `backend/server.js` `/analyze-clothing`, `src/app/analyze.tsx` | — | — | — | 예 |
| F-22 | Mock 응답 여부 | — | **PASS(Mock 아님)** — 서버 로그에 Gemini 사용량(토큰 1,561) 기록, 앱에 Mock 분석 경로 없음 | SRV, CODE | — | — | — | — | — | — |
| F-23 | 옷이 아닌 사진 거르기 | 없음 | **FAIL** — 앱 아이콘(새싹 로고)을 "white tshirt, top"으로 분석. 응답 형식에 "옷 아님" 값이 없음 | SRV | BUG-06 | `backend/server.js` 응답 스키마 | P2 | A(프롬프트)+B(API 계약) | 중 | 아니오(진행자 안내) |
| F-24 | 잘못된 이미지 데이터 | 일부 | **PARTIAL** — 서버가 검사 없이 Gemini로 보내 400을 받고 앱에는 500 "Gemini 분석 요청에 실패했습니다." | SRV | BUG-10 | `backend/server.js` | P3 | B | 소 | 아니오 |
| F-25 | 분석 중 화면 | 있음 | **PASS** — COLOR·MATERIAL·FIT·STYLE·SEASON·TPO 순서 표시 | WEB | — | `src/app/analyze.tsx` | — | — | — | 예 |
| F-26 | 분석 실패 화면·다시 시도 | 있음 | **PASS** — 백엔드 중지 상태에서 실패 화면, [다시 시도]로 복구 성공. 감사 전 문구 "백엔드 실행 상태를 확인해주세요" → **수정 후 사용자 문구 확인** | WEB | BUG-08 | `src/app/analyze.tsx` | P2 → 해결 | A | 완료 | 예 |
| F-27 | 분석 결과 표시·수정 | 있음 | **PASS** — 카테고리 수정 시 7개 선택지 표시. 수정 가능: 카테고리·세부·색·핏·소재·스타일. 계절·TPO·색 톤은 수정 불가 | WEB | — | `src/app/analyze.tsx` | P3 | A | — | 예 |
| F-28 | 같은 사진 분석 결과 일관성 | — | **PARTIAL** — 같은 데님 사진 두 번: 계절이 "봄/가을/겨울" → "봄/가을"로 바뀜(나머지 동일) | WEB | BUG-12 | — | P3 | A | 기록만 | 아니오 |
| F-29 | 로그아웃 상태 저장 → 가입 화면 → 가입 후 자동 저장 | 있음 | 가입 화면 이동 **PASS**. 가입 후 자동 저장은 **BLOCKED** | WEB | — | `src/app/analyze.tsx`, `src/hooks/use-save-pending-clothing.ts` | P0(검증 필요) | PO 확인 | — | 예 |
| F-30 | 로그인 상태 저장(원본 업로드 → SlimSAM 배경 제거 → BRIA 대체 → DB) | 있음 | **BLOCKED**. 이미지 처리 API가 토큰 없는 요청을 401로 거절하는 것은 **PASS**. 과거 근거: 1A-2 QA E2E·1A-3 품질 평가 7장 | SRV | — | `src/lib/clothes.ts`, `backend/cutout.js` | P0(검증 필요) | PO 확인 → A | — | **예** |
| F-31 | 저장·사진 교체 실패 안내 | 있음 | 감사 전: Supabase 영어 원문이 그대로 보일 수 있음 → **수정 후 함수 단위 PASS**(NODE 4건). 화면 확인은 BLOCKED | NODE | BUG-07 | `src/lib/userErrors.ts`, `analyze.tsx`, `item.tsx` | P2 → 해결 | A | 완료 | 예 |

### 2.4 디지털 옷장

| # | 기능 | 구현 | 이번 테스트 결과 | 환경 | 오류·재현 | 코드 | 심각도 | 담당 | 수정 범위 | 조사 필수 |
|---|---|---|---|---|---|---|---|---|---|---|
| F-32 | 옷장 목록 | 있음 | 로그아웃 상태("로그인하고 내 옷장을 확인하세요") **PASS**. 목록은 **BLOCKED** | WEB | — | `src/app/closet.tsx`, `src/hooks/use-closet-loader.ts` | P0(검증 필요) | PO 확인 | — | 예 |
| F-33 | 옷 상세·배경제거본/원본 전환·사진 교체 | 있음 | **BLOCKED** | CODE | — | `src/app/item.tsx` | P1 | PO 확인 | — | 예(상세 보기) |
| F-34 | 저장 후 속성 수정 | 없음 | **NOT IMPLEMENTED** — 상세 화면은 사진만 교체 가능 | CODE | — | — | P2 | A | 중 | 아니오(삭제 후 재등록) |
| F-35 | 옷 삭제 | 있음 | **BLOCKED**(Storage 파일 → DB 행 순서, 코드 확인) | CODE | — | `src/lib/clothes.ts` | P1 | PO 확인 | — | 예 |
| F-36 | 저장 데이터 → 엔진 전달 | 있음 | **PASS(코드+DB)** — DB 열(`sub_category`, `color_tone`, `fit`, `season`, `tpo`, `style`)이 그대로 `Clothing` 객체로 바뀌어 엔진에 들어감. DB에 값 제약(CHECK) 없음 → 앱이 값을 정한다 | CODE, DB | — | `src/lib/clothes.ts` 조회 매핑 | — | — | — | 예 |

### 2.5 코디 추천

| # | 기능 | 구현 | 이번 테스트 결과 | 환경 | 오류·재현 | 코드 | 심각도 | 담당 | 수정 범위 | 조사 필수 |
|---|---|---|---|---|---|---|---|---|---|---|
| F-37 | Styling(선택한 옷 기준 베스트 코디 + 6개 지표 점수) | 있음 | 엔진 **PASS**(NODE: 고정 옷장 15벌, 결과 옷이 모두 옷장 안의 옷, 같은 입력 = 같은 결과). 화면 **BLOCKED**(로그인 필요) | NODE | — | `src/app/styling.tsx`, `src/utils/recommendation.ts`, `outfitScore.ts` | P0(화면 검증 필요) | PO 확인 | — | **예** |
| F-38 | Looks TOP 3 | 있음 | 엔진 **PASS**(스냅샷 테스트). 화면 BLOCKED | NODE | — | `src/app/looks.tsx` | P1 | PO 확인 | — | 예 |
| F-39 | Today's Look(날씨 + 옷장) | 있음 | 엔진 **PASS**(날씨 없음·빈 옷장 처리). 로그아웃 화면 **PASS**. 로그인 화면 BLOCKED | NODE, WEB | — | `src/app/today.tsx`, `src/utils/weatherRecommendation.ts` | P1 | PO 확인 | — | 예 |
| F-40 | 하드코딩·랜덤 추천 여부 | — | **PASS** — 추천 코드에 `Math.random` 없음, 고정 목업 옷 사용 없음, 같은 입력 두 번 결과 동일 | NODE, CODE | — | `src/utils/*` | — | — | — | — |
| F-41 | 옷 1벌만 있을 때 | 있음 | **PASS(엔진)** — 아이템 1개, 부족 카테고리 [하의, 신발], 점수 대신 안내 표시 분기 있음 | NODE, CODE | — | `src/app/styling.tsx` `hasMatches` | — | — | — | 예 |
| F-42 | 추천 결과 저장·다시 보기 | 없음 | **NOT IMPLEMENTED** — 매번 계산 | — | — | — | P3 | A | 중 | 아니오 |

### 2.6 Missing Item·상품

| # | 기능 | 구현 | 이번 테스트 결과 | 환경 | 오류·재현 | 코드 | 심각도 | 담당 | 수정 범위 | 조사 필수 |
|---|---|---|---|---|---|---|---|---|---|---|
| F-43 | Missing Item 판단·제안 | 있음 | 엔진 **PASS**(상의 1벌 → "black slacks, minimal" 제안). 가방·액세서리는 제안 대상 아님(OQ-27). 화면 BLOCKED | NODE | — | `src/app/missing.tsx`, `recommendation.ts` | P1(화면) | PO 확인 | — | 예 |
| F-44 | Shop 상품 추천 | **샘플 데이터** | **PARTIAL** — 부족 아이템 조건으로 거르고 정렬하는 것은 **PASS**. 상품은 `mockProducts` 16개("Partner Brand A~G", 가짜 상품명·가격), 화면에 "샘플 상품" 배지 있음 | WEB | BUG-03 | `src/app/shop.tsx`, `src/data/mockProducts.ts` | **P0**(시나리오 D) | A + PO(브랜드 데이터) | 중(R1-02-07) | **예** |
| F-45 | 상품 상세·외부 판매처 이동 | 없음 | **NOT IMPLEMENTED** — 상품 카드는 누를 수 없고 링크 없음 | WEB, CODE | BUG-03 | — | **P0**(시나리오 D) | A | 중(R1-02-08) | **예** |
| F-46 | 실제 상품 카탈로그 연결 | 양식·검증 도구만 | **NOT IMPLEMENTED(앱)** — `data/round1/contract/product-catalog-v0.1.json`, `scripts/round1/products.mjs`는 있으나 앱에서 읽지 않음 | CODE | — | — | P0 | A + PO | 중 | 예 |

### 2.7 연구·운영 기능

| # | 기능 | 구현 | 이번 테스트 결과 | 환경 | 오류·재현 | 코드 | 심각도 | 담당 | 수정 범위 | 조사 필수 |
|---|---|---|---|---|---|---|---|---|---|---|
| F-47 | 연구 이벤트 기록(행동 로그) | 계약·분석 스크립트만 | **NOT IMPLEMENTED(앱)** — 앱에서 이벤트를 남기지 않음. `research-events-v0.1.json`, `scripts/round1/events.mjs`는 테스트 통과 | NODE, CODE | BUG-04 | — | **P1** | A(+B DB 승인 시) | 중(R1-02-03) | 예(관찰지로 일부 대체 가능) |
| F-48 | 연구 모드·참가 코드·가격 실험 Paywall·PLUS | 없음 | **NOT IMPLEMENTED**(R1-02-02·05·06 계획만) | — | — | — | P1(PO 범위 결정) | A | 대 | PO 결정 |
| F-49 | 오류 로그·크래시 수집 | 없음 | **NOT IMPLEMENTED** — 앱은 `console`만, 서버는 표준 출력만 | CODE | BUG-11 | — | P2 | B | 소~중 | 아니오(진행자 관찰) |
| F-50 | AI 사용량 제한(사용자·IP별 시간당, DB 쿼터) | 있음 | **PASS(단위 테스트)**. 실제 한도 소진은 NOT TESTED | NODE | — | `backend/guestLimiter.js`, `quota.js` | — | — | — | 예 |
| F-51 | 비밀값의 클라이언트 노출 | — | **PASS** — 웹 번들(6.2MB)에 Gemini·BRIA·fal 키 없음, `AIza` 0건. 번들의 환경변수는 `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`(공개용)뿐. Gemini 프롬프트도 서버에만 있음 | WEB | — | — | — | — | — | — |
| F-52 | 추천 엔진의 위치 | 앱 안 | 엔진 규칙·점수는 앱 번들에 포함(서버 아님). MVP에서는 허용, 영업 비밀 보호가 필요하면 서버 이전 | CODE | — | `src/utils/*` | P3 | A | 대 | 아니오 |
| F-53 | 데이터 접근 제어(RLS) | 있음 | **PASS(DB 읽기)** — `clothes`, `ai_usage` 모두 RLS 켜짐. 과거 근거: 1A-02 정책 확인, 1A-2 QA 교차 계정 테스트 | DB | — | `supabase/migrations/*` | — | — | — | 예 |
| F-54 | 서버 헬스 체크 `/healthz` | `release/beta-prep`에만 | 이 브랜치 백엔드는 404 | SRV | — | B 브랜치 | P1(배포 시) | B | 병합 | 배포 시 |
| F-55 | Expo Go 실행 | — | **PASS(SIM)** — Expo Go SDK 57에서 번들 1,477개 모듈, 홈 렌더링. 네이티브 전용 모듈 없음 → 진행자 기기에서 Expo Go로 조사 가능 | SIM | — | `package.json` | — | — | — | 대안 경로 |
| F-56 | 실기기 동작(iOS·Android) | — | **NOT TESTED** | — | — | — | **P0** | B(빌드) + PO(기기) | — | **예** |

---

## 3. 핵심 시나리오별 진행 가능 지점

| 시나리오 | 이번에 실제로 진행된 지점 | 막힌 지점·이유 | 코드상 다음 단계 존재 여부 |
|---|---|---|---|
| **A 첫 사용** 실행 → 온보딩 → 가입/로그인 → 홈 | 실행 → 스플래시 → 홈 **PASS**(WEB·SIM). 가입 화면 표시 **PASS** | 온보딩 **없음**. 가입·로그인 입력은 **BLOCKED** | 가입 → 홈 이동 코드 있음 |
| **B 의류 등록** 촬영/앨범 → 업로드 → 분석 → 확인·수정 → 저장 | 앨범 선택 → 사진 준비 → **실제 Gemini 분석** → 결과 확인·수정 → 저장 버튼 → 가입 화면 **PASS**(WEB) | 촬영 **없음**. 로그인 상태 저장(배경 제거·DB 저장)은 **BLOCKED** | 저장 코드 있음, 과거 QA E2E 통과 |
| **C 개인화 추천** 옷장 등록 → 추천 요청 → 보유 옷 코디 → 결과 | 엔진을 고정 옷장으로 실행 **PASS**(NODE) | 로그인 상태 화면 **BLOCKED** | 화면 코드 있음 |
| **D 코디·상품 탐색** 코디 → Missing/상품 → 상세/외부 판매처 | Shop 화면(주소로 직접 진입) 샘플 상품 표시 **PASS** | **상품 상세·외부 이동 없음**, 상품이 전부 가짜 | **없음**(R1-02-07·08에서 구현 예정) |
| **E 재방문** 종료·재실행 → 로그인 유지 → 기존 옷·추천 | — | **NOT TESTED**(실기기·로그인 필요) | 세션 저장·옷장 캐시 코드 있음 |

**요약:** 지금 외부 사용자가 끝까지 갈 수 있는 길은 확인되지 않았다. 로그아웃 상태로 갈 수 있는 곳(홈 → 사진 선택 → AI 분석 → 결과 수정 → 가입 화면)까지는 실제로 동작한다. 로그인 이후는 코드와 과거 QA 근거만 있고, 시나리오 D의 상품 부분은 구현되어 있지 않다.

---

## 4. Gemini·추천 엔진 점검

### 4.1 운영 분석 방식과 연구용 속성 체계 구분

| 구분 | 운영 앱(현재 배포 대상) | Knowledge Lab 연구용(운영 미적용) |
|---|---|---|
| 정의 위치 | `backend/server.js` 응답 스키마(enum) + `src/constants/clothingOptions.ts` + `src/utils/taxonomyCompat.ts` | `data/fkd/contract/*`(V0.1·0.2), `docs/handoff/fkd-contract-0.3-draft.md`, `docs/recommendation/SILHOUETTE_FIT_DESIGN.md` |
| 핏 | `fit` 하나(oversized·regular·slim 등 6개) | `fit`(몸과의 여유)과 `silhouette`(전체 외곽선) 분리 설계 |
| 색 | `color` 14개 + `colorTone` 5개 | D-F02: 명도·채도·무채색·메탈릭 단계(설계 r2) |
| 상태 | 실제 사용 중 | **설계·실험 단계. 이번 감사에서 운영에 적용하지 않았다** |

### 4.2 항목별 결과

| 점검 | 결과 | 근거 |
|---|---|---|
| 실제 Gemini 호출 | **확인**(5회) | SRV 로그 "Gemini 사용량" |
| Mock과 실제 응답 구별 | 앱 분석 경로에는 Mock이 없다. Mock은 **상품(`mockProducts`)과 Core 데모(`coreDemo`)뿐** | CODE |
| 모델 | `.env`가 `GEMINI_MODEL=gemini-3.5-flash`로 지정(서버 기본값은 3.6-flash). 응답의 `modelVersion`은 `gemini-3.6-flash`로 기록됨 → **조사 기간 모델을 고정·기록해야 함**(BUG-13) | SRV 로그 |
| 분석 실패 처리 | 연결 실패·시간 초과·한도 초과·서버 오류를 원인별 문구로 안내, 다시 시도 가능 | WEB(연결 실패 실제 재현), NODE(`apiErrors` 테스트) |
| 응답 스키마·허용값 검사 | Gemini `responseSchema` enum으로 강제 + 앱의 `normalizeAnalysisTaxonomy`가 범주·세부 분류 쌍을 보정 | CODE, NODE(`taxonomy.compat` 테스트) |
| 옷이 아닌 사진 | **거르지 못함**(FAIL, BUG-06) | SRV |
| 기존 fit·colorTone과 새 fit/silhouette 호환 | 엔진은 지금 `fit`·`colorTone`만 읽는다. `silhouette`이 추가돼도 기존 점수는 변하지 않음을 `fit.silhouette.compat`·`color.tone.invariance` 테스트로 고정(통과). **새 필드를 저장하려면 DB 열 추가(승인 필요)** | NODE |
| 저장 속성이 엔진에 전달되는지 | 전달됨(F-36) | CODE |
| 엔진이 실제 사용자 옷장을 쓰는지 | 쓴다. 화면은 `useClosetStore`(Supabase에서 불러온 내 옷)만 넘긴다. 로그아웃 시 로컬 옷장을 비운다 | CODE, NODE |
| 하드코딩·랜덤 | 없음(F-40). 단 Missing Item 제안은 카테고리별 **고정 템플릿**(예: 하의 → black slacks) | CODE |
| 점수 계산 오류 가능성 | 스냅샷과 동일. 알려진 구조적 한계: 점수 체계가 여러 개 섞여 있음(PRODUCT_AUDIT 9장), 사람 평가 기준 미확정(Pilot 20 전) | NODE, 문서 |
| 키·핵심 로직의 클라이언트 노출 | 키·프롬프트 노출 없음. 추천 규칙은 앱 번들에 있음(F-52) | WEB |

---

## 5. 이번 감사에서 고친 것 (코드 변경 ≠ 실기기 검증)

| 버그 | 변경 | 확인 방법·결과 |
|---|---|---|
| BUG-05 | `/demo`, `/ideal-style`, `/core-match`, `/core-look`, `/core-shop`을 `EXPO_PUBLIC_SHOW_PROTOTYPES=true`일 때만 열리게 함(기본 숨김, 주소로 열면 홈으로 이동). Styling의 IDEAL STYLE 배지도 같은 설정으로 숨김 | WEB에서 5개 주소 모두 `/`로 이동, 콘솔 오류 0. 설정값 판정 단위 테스트. 배지 숨김은 타입 검사만(로그인 화면 BLOCKED) |
| BUG-07 | 저장·사진 교체 실패 시 영어·기술 원문 대신 한국어 안내(`src/lib/userErrors.ts`) | 단위 테스트 4건. 화면 확인은 BLOCKED |
| BUG-08 | 분석 서버 연결 실패 문구에서 "백엔드" 제거 | WEB에서 백엔드를 끄고 실제 재현 → 새 문구 표시, [다시 시도]로 복구 |

변경한 파일은 `release/beta-prep`이 고친 파일(`closet.tsx`, `upload.tsx` 등)과 겹치지 않는다.
