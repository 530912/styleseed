# STYLESEED MVP Product Audit

- 작성일: 2026-10-16
- 분석 대상: `main` 브랜치(최신 커밋 `437e11d`) + 커밋되지 않은 작업 트리 전체
- 분석 방법: `pm-ai-shipping:intended-vs-implemented` 절차 (문서화된 의도 ↔ 실제 코드 비교)
- 분석 범위: `src/`, `backend/server.js`, `package.json`, `app.json`, `.gitignore`, `STYLESEED_Expo_MVP_개발_작업내용_2026-09-10.md`
- 실행한 검증: 소스 정독, `tsc --noEmit` 타입 검사(오류 없음). 앱·백엔드 실행, 실기기 테스트, Supabase 콘솔 확인은 하지 않았다.
- **갱신(2026-10-17, 작업 1A-02):** 실제 Supabase 프로젝트(`zkgsxavpyvxhrivzmqsp`)의 RLS·Storage 정책을 읽기 전용으로 점검한 결과를 반영했다. 방법: 공식 Supabase MCP(`read_only=true`, 실행 역할 `supabase_read_only_user`)로 시스템 카탈로그·`pg_policies`·`storage.buckets`를 조회하고, Dashboard Auth 설정 화면을 읽었다. 사용자 데이터는 조회하지 않았다. 확인한 정책 정의는 `supabase/migrations/20261017000000_baseline_clothes_rls_storage.sql`에 기록했다. 갱신된 항목에는 **[1A-02 확인]** 표시를 붙였다.
- **[1A-02 확인]** 표기: 실제 DB 정책 정의로 확인한 사항. 실제 토큰을 이용한 동작 테스트(교차 계정 접근)는 아직 하지 않았으며, 따로 **[동작 테스트 미완료]**로 표시한다.

> **표기 규칙**
> - 근거는 `파일경로:줄번호` 형식으로 적는다. 줄번호는 작성일 기준 작업 트리 기준이며, 이후 수정으로 달라질 수 있다.
> - **[미검증]** 이번 Audit에서 코드나 실행으로 확인하지 못한 사항
> - **[추정]** 코드 근거는 있으나 실제 동작을 실행으로 확인하지 않은 판단

---

## 목차

1. [Audit 목적 및 분석 기준](#1-audit-목적-및-분석-기준)
2. [현재 기술 아키텍처](#2-현재-기술-아키텍처)
3. [전체 사용자 흐름](#3-전체-사용자-흐름)
4. [기능별 구현 상태](#4-기능별-구현-상태)
5. [기능별 코드 근거 및 파일 경로](#5-기능별-코드-근거-및-파일-경로)
6. [기획과 구현 간 차이](#6-기획과-구현-간-차이)
7. [기술적 문제 및 보안 위험](#7-기술적-문제-및-보안-위험)
8. [사용자 경험상 주요 개선 사항](#8-사용자-경험상-주요-개선-사항)
9. [추천엔진 구조 및 점수 체계의 문제](#9-추천엔진-구조-및-점수-체계의-문제)
10. [PRD 작성 전에 결정할 사항](#10-prd-작성-전에-결정할-사항)
11. [향후 검증이 필요한 항목](#11-향후-검증이-필요한-항목)

---

## 1. Audit 목적 및 분석 기준

### 목적
- 실제로 구현된 MVP의 완성도를 기능 단위로 평가한다.
- 향후 PRD 작성과 제품 고도화를 위한 기준선(baseline)을 만든다.

### 분석 기준
- **의도(Intent):** 기존 개발 문서 `STYLESEED_Expo_MVP_개발_작업내용_2026-09-10.md`(이하 "개발 문서")와 코드 주석. 이것들은 검증할 주장으로 다루고, 증거로 쓰지 않는다.
- **구현 증거(Evidence):** 실제 호출되는 코드 경로. 문서나 주석에 "구현됨"이라고 적혀 있어도 코드에서 확인되지 않으면 구현 완료로 판단하지 않는다.

### 상태 정의

| 상태 | 정의 |
|---|---|
| **Implemented** | 실제 데이터로 끝까지 동작하는 코드 경로가 확인됨 |
| **Partial** | 핵심 경로는 있으나 기능 일부가 빠졌거나 알려진 결함이 있음 |
| **Mock** | 고정 데이터나 데모 규칙으로 동작함(실제 연동 없음) |
| **Planned** | 문서에 계획만 있고 코드가 없음 |
| **Unknown** | 저장소 안에서 확인할 수 없음(외부 설정·실행 환경에 의존) |

---

## 2. 현재 기술 아키텍처

| 계층 | 구성 | 근거 |
|---|---|---|
| 클라이언트 | Expo SDK 57, React Native 0.86, expo-router(Stack, 헤더 숨김) | `package.json`, `src/app/_layout.tsx` |
| 상태 관리 | Zustand. 옷장, 보류 중인 옷, 이미지 표시 설정은 AsyncStorage에 영속화 | `src/store/useClosetStore.ts`, `usePendingClothingStore.ts`, `useImagePreferenceStore.ts` |
| 백엔드 | Node.js Express, 포트 3001 고정, 인증 없음, `cors()` 전체 허용, JSON 본문 최대 50MB | `backend/server.js:12,14,22-26` |
| AI 분석 | Google Gemini `generateContent` REST 호출. 모델·thinking level은 환경변수로 설정 | `backend/server.js:113-118` |
| 이미지 분리 | ① 로컬 SlimSAM(`@huggingface/transformers` + `sharp`) ② BRIA 배경 제거 API ③ fal.ai SAM2(엔드포인트만 있고 앱에서 미호출) | `backend/server.js:84-109,597-726,826-885,552-595` |
| 인증·DB·스토리지 | Supabase Auth(이메일/비밀번호), `clothes` 테이블, `clothing-images` 버킷(서명 URL로 조회) | `src/lib/supabase.ts`, `src/lib/clothes.ts:7` |
| 날씨 | Open-Meteo Forecast API + `expo-location` | `src/lib/weather.ts:11,184` |
| 비밀값 | 서버 키(Gemini, BRIA, FAL)는 `.env`(gitignore 처리됨)에서 백엔드만 사용. 클라이언트는 `EXPO_PUBLIC_SUPABASE_URL`과 `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`만 사용 | `.gitignore:34`, `src/lib/supabase.ts:9-12` |

### 확인된 구조적 특징
- 클라이언트가 백엔드를 `http://localhost:3001`로 직접 호출한다(`src/lib/clothes.ts:11`, `src/app/analyze.tsx:151`). 배포용 환경 설정이 없다.
- 자동화 테스트가 없다(`*.test.*`, `*.spec.*` 파일 0개).
- `src/components/app-tabs.tsx`와 `app-tabs.web.tsx`는 Expo 템플릿 잔재다. 존재하지 않는 `explore` 탭을 참조하며, 루트 레이아웃(Stack)에서 쓰이지 않는다.

---

## 3. 전체 사용자 흐름

### 3.1 메인 흐름 (Implemented)

```text
Splash(SplashIntro, 앱 실행 후 1회)
  → Home(index.tsx): 날씨 기반 오늘의 룩 카드 + [옷 등록하기] / [내 옷장 보기]
  → Upload(upload.tsx): 갤러리에서 사진 선택
  → Analyze(analyze.tsx): Gemini 분석 → 결과 확인·일부 수정 → [저장]
      ├─ 로그인 상태: Supabase 저장 → Closet
      └─ 비로그인: pendingClothing 보관 → Signup / Login → 자동 저장 → Closet
  → Closet(closet.tsx): 옷 목록, 삭제, 로그아웃
      ├─ Item(item.tsx): 상세, 사진 교체, 배경제거본/원본 표시 전환
      └─ Styling(styling.tsx): 선택한 옷 기준 베스트 코디 + MATCH 점수
            ├─ Looks(looks.tsx): TOP 3 코디
            └─ Missing(missing.tsx): 부족한 아이템 제안
                  → Shop(shop.tsx): 목업 상품 추천
```

### 3.2 보조 흐름

| 흐름 | 상태 | 근거 |
|---|---|---|
| Home 오늘의 룩 → Today(`today.tsx`) → Styling | Implemented | `src/app/index.tsx:53-60,93`, `src/app/today.tsx:118` |
| Styling의 "IDEAL STYLE · BETA" → Ideal Style → Core Match → Core Look → Core Shop | Mock | `src/data/coreDemo.ts:8-14`에 "영상 촬영용 UI prototype을 위한 고정 규칙, 실제 ML 모델 아님"이라고 명시. POETCORE만 선택 가능 |
| `/demo` | Mock(내부용) | `src/app/demo.tsx:25-30`, 앱 내비게이션에서 링크되지 않음 |

---

## 4. 기능별 구현 상태

| # | 기능 영역 | 상태 | 요약 |
|---|---|---|---|
| 1 | 기술 아키텍처 | Implemented | Expo + Express + Supabase + Gemini 구성이 동작하는 코드로 존재. 배포 구성은 없음 |
| 2 | 화면·사용자 흐름 | Implemented | 메인 흐름이 실제 데이터로 끝까지 연결됨. Core·demo 흐름은 Mock |
| 3 | 회원가입·로그인 | Partial | 이메일/비밀번호, 세션 유지, 로그아웃, 저장 시점 로그인 유도는 구현. 비밀번호 재설정·탈퇴·입력 검증 없음 |
| 4 | 사진 등록·이미지 처리 | Partial | 갤러리 선택 + 3단계 대체 경로 구현. 처리가 저장 요청 안에서 동기로 실행되고, 쓰이지 않는 코드가 있으며, 분리 좌표를 저장하지 않음 |
| 5 | Gemini 이미지 분석 | Implemented | 응답 형식 강제, 재시도, 한도 초과 안내, 결과 수정 가능. 분류 간 일관성 검증 없음 |
| 6 | Supabase 저장·조회 | Implemented | CRUD 동작. 사용자 간 데이터 분리는 RLS에 의존하며, RLS 정책은 **[1A-02 확인]** 올바르게 설정됨(14번 참조) |
| 7 | Digital Closet | Implemented | 조회, 캐시, 삭제, 상세, 로그아웃. 저장 후 속성 수정·필터·검색 없음 |
| 8 | 코디 추천엔진·점수 | Partial | 규칙 기반 엔진 동작. 점수 체계 4개가 섞여 있음 |
| 9 | Missing Item 탐지 | Partial | 빠진 카테고리 탐지 + 고정 템플릿 제안. 아우터·가방·액세서리는 탐지 대상 아님 |
| 10 | 상품 추천·외부 연동 | Mock(추천) / Planned(연동) | 하드코딩된 상품 16개. 구매 링크·제휴 API 없음 |
| 11 | 예외 처리·오류 대응 | Partial | 분석·날씨 오류는 원인별 안내. 그 외는 원래 오류 메시지 노출, 타임아웃·모니터링 없음 |
| 12 | 날씨 기반 오늘의 룩 | Implemented | Open-Meteo 실제 호출 + 위치 권한 처리 |
| 13 | Core Engine(POETCORE 등) | Mock | 고정 데모 규칙 |
| 14 | RLS·Storage 정책 | Implemented **[1A-02 확인]** / 동작 테스트 미완료 | `clothes` RLS 켜짐, 조회·추가·수정·삭제 정책 모두 `authenticated` + `auth.uid() = user_id`. 버킷 비공개, Storage 정책 4종이 첫 폴더 = `auth.uid()` 조건. 정의는 `supabase/migrations/20261017000000_baseline_clothes_rls_storage.sql`에 기록. 교차 계정 동작 테스트(V-3)는 남아 있음 |
| 15 | 실기기·배포 환경 동작 | Unknown | localhost 고정. 실행으로 확인하지 않음 |
| 16 | 카메라 촬영 | 미구현 | `launchCameraAsync` 호출이 `src` 전체에 없음. 갤러리 선택만 지원 |
| 17 | Fashion Knowledge Dataset 연동 | Planned | `.numbers` 파일만 있고 코드와 연결 없음 |
| 18 | 계정 관리·개인화 | Planned | 개발 문서 §32, §36 |

---

## 5. 기능별 코드 근거 및 파일 경로

### 5.1 회원가입·로그인

| 항목 | 근거 |
|---|---|
| 회원가입 `supabase.auth.signUp` | `src/app/signup.tsx:53-56` |
| 이메일 인증이 필요하면 로그인 화면으로 이동 | `src/app/signup.tsx:63-69` |
| 로그인 `signInWithPassword` | `src/app/login.tsx:81-84` |
| 세션 유지(네이티브는 AsyncStorage), 자동 토큰 갱신 | `src/lib/supabase.ts:14-26` |
| 로그아웃 + 옷장 캐시 초기화 | `src/app/closet.tsx:61-74` |
| 비로그인 상태에서 저장하면 pendingClothing 보관 → Signup 이동 | `src/app/analyze.tsx:282-286` |
| 로그인·가입 직후 보류 중인 옷 자동 저장 | `src/app/login.tsx:92-107`, `src/app/signup.tsx:74-89` |
| 입력 검증은 빈 값 확인만 | `src/app/login.tsx:72-76`, `src/app/signup.tsx:44-48` |

### 5.2 사진 등록·이미지 처리

| 항목 | 근거 |
|---|---|
| 갤러리 선택(편집 허용, 품질 0.7, base64 포함) | `src/app/upload.tsx:37-42` |
| 원본을 `{userId}/originals/`에 업로드 | `src/lib/clothes.ts:115-144` |
| 1차: 로컬 SlimSAM 분리(서명 URL 전달) → `{userId}/cutouts/` 저장 | `src/lib/clothes.ts:358-377`, `backend/server.js:597-726` |
| 2차: box 기준 Crop(여백 8%) → 임시 업로드 → BRIA 배경 제거 → 임시 파일 삭제 | `src/lib/clothes.ts:13-85,383-417`, `backend/server.js:826-885` |
| 3차: 모두 실패하면 원본만 저장(`cutout_image_path = null`) | `src/lib/clothes.ts:404-406,427-453` |
| 사진 교체(배경 제거 재실행 없음, 이전 파일 정리) | `src/lib/clothes.ts:557-617`, `src/app/item.tsx:105-145` |
| 배경제거본/원본 표시 전환(기기에만 저장) | `src/store/useImagePreferenceStore.ts`, `src/app/item.tsx:180,188` |
| 쓰이지 않는 코드: `USE_GEMINI_SEGMENTATION`, `segmentGarment`(fal), `createGarmentCutout`(Gemini mask), `getImageDimensions` | `src/lib/clothes.ts:9,193-219,221-230,232-264` |
| SAM 모델을 첫 요청 때 내려받아 로딩 | `backend/server.js:84-109` |

### 5.3 Gemini 이미지 분석

| 항목 | 근거 |
|---|---|
| 옷 한 벌만 분석하도록 지시하는 프롬프트, box_2d·mask 요청 | `backend/server.js:208-262` |
| 응답 형식(enum) 강제: category 7, subCategory 41, color 14, colorTone 5, fit 6, material 10, season, tpo, style | `backend/server.js:276-476` |
| 500·503·504는 2초·4초 대기 후 최대 2회 재시도, 429는 재시도 없이 `retryAfterSeconds` 전달 | `backend/server.js:127-174,485-498` |
| box·mask 좌표를 0~1000으로 보정 | `backend/server.js:515-530` |
| 앱에서 원인별 오류 문구 표시 | `src/app/analyze.tsx:63-85,169-176,182-190` |
| 같은 이미지는 다시 분석하지 않음 | `src/store/useAnalysisStore.ts:9-10`, `src/app/analyze.tsx:206-212` |
| 수정 가능 항목은 category·color·fit·material·style. season·tpo·colorTone은 수정 불가 | `src/app/analyze.tsx:55,447-527` |
| 요청 MIME 타입이 `image/jpeg`로 고정 | `backend/server.js:267` |
| 무료 등급 하루 20회 한도(주석) | `backend/server.js:111-112` |

### 5.4 Supabase 저장·조회

| 항목 | 근거 |
|---|---|
| `clothes` insert(user_id, 속성, 이미지 경로) | `src/lib/clothes.ts:427-455` |
| 조회 `select("*")`, `user_id` 필터 없음, 최신순 | `src/lib/clothes.ts:494-500` |
| 이미지마다 1시간 서명 URL 생성 | `src/lib/clothes.ts:473-489,506-546` |
| 삭제: Storage 파일 먼저 삭제 → DB 행 삭제 | `src/lib/clothes.ts:622-657` |
| 사진 교체·삭제 시 `id`로만 조회·수정 | `src/lib/clothes.ts:564-568,576-583,623-627,649-652` |
| box2d·mask는 DB에 저장하지 않음 | `src/lib/clothes.ts:429-453` |
| RLS·Storage 정책 정의 | **[1A-02 확인]** 실제 DB에 존재(V-1·V-2 참조). 2026-10-17에 `supabase/migrations/20261017000000_baseline_clothes_rls_storage.sql`로 기록(적용하지 않은 기록용 파일) |
| `clothes` 스키마 | **[1A-02 확인]** `id bigint` 자동 증가(identity), `user_id uuid NOT NULL`이 `auth.users(id)`를 참조하는 FK(`ON DELETE CASCADE`), 기본 키 외 인덱스·트리거 없음 |

### 5.5 Digital Closet

| 항목 | 근거 |
|---|---|
| 화면 포커스 시 로딩, 같은 사용자는 5분 캐시, 상태 4종(loading/ready/signed-out/error) | `src/hooks/use-closet-loader.ts:10-95` |
| 비로그인 시 로컬 옷장 비우기 | `src/hooks/use-closet-loader.ts:44-52` |
| 상태별 화면 | `src/app/closet.tsx:145-170` |
| 삭제 확인 창 + 중복 실행 방지 | `src/app/closet.tsx:76-113` |
| 로컬 영속화 키 `styleseed-closet-v2` | `src/store/useClosetStore.ts:57-63` |

### 5.6 추천엔진·점수

| 엔진 | 근거 |
|---|---|
| A. 두 옷 간 궁합 점수 + 카테고리 조합 계획 | `src/utils/recommendation.ts:102-169,186-280` |
| B. 6개 지표 코디 평가 + TOP N 순위 | `src/utils/outfitScore.ts:51-58,434-491,507-657` |
| C. 날씨 반영 오늘의 룩(코디 점수 70% + 날씨 30%) | `src/utils/weatherRecommendation.ts:16-22,171-173,320-415` |
| D. Core 데모 점수 | `src/utils/prototypeCore.ts:28,86,146,179-183`, `src/data/coreDemo.ts` |
| Styling: A로 코디를 고르고 B로 점수를 표시 | `src/app/styling.tsx:70-76,152-160` |

### 5.7 Missing Item

| 항목 | 근거 |
|---|---|
| 조합 계획상 필요한 카테고리가 옷장에 없으면 부족으로 판단 | `src/utils/recommendation.ts:186-202,247-253` |
| 부족 카테고리별 고정 템플릿 제안 | `src/utils/recommendation.ts:308-415` |
| 첫 번째 부족 카테고리만 제안 | `src/app/styling.tsx:78-82`, `src/app/missing.tsx:63-68` |
| Shop으로 category·subCategory·color·style 전달 | `src/app/missing.tsx:99-117` |

### 5.8 상품 추천

| 항목 | 근거 |
|---|---|
| 하드코딩 상품 16개, "제휴사 상품 연동 전 목업 데이터" 주석, 브랜드명 "Partner Brand C" 등 | `src/data/mockProducts.ts:3-5` |
| 상품 점수: subCategory 40 + color 35 + style 25 | `src/app/shop.tsx:64-90` |
| 화면에 "샘플 상품" 배지 | `src/app/shop.tsx:105` |
| 구매 링크·외부 이동 | 없음. `src/app` 안에 `Linking`, `openURL`, `WebBrowser` 사용이 없고, `Product` 타입에 URL 필드가 없음(`src/types/index.ts:77-102`) |

### 5.9 날씨

| 항목 | 근거 |
|---|---|
| 위치 권한 요청, 권한 거부·위치 오류·날씨 오류 구분 | `src/lib/weather.ts:182-228` |
| Open-Meteo 호출 | `src/lib/weather.ts:115-127` |
| 날씨 10분 메모리 캐시 | `src/store/useWeatherStore.ts:5-6` |
| 비·눈 오는 날 피할 아이템, 날씨 적합도 40 미만인 옷 제외 | `src/utils/weatherRecommendation.ts:167-173` |

---

## 6. 기획과 구현 간 차이

기준 문서: `STYLESEED_Expo_MVP_개발_작업내용_2026-09-10.md`

### 6.1 문서에는 완료로 적혀 있으나 코드로 검증되지 않은 것

| 문서 주장 | 코드 실제 | 판단 |
|---|---|---|
| §18 "clothes 테이블에 RLS를 적용했다", §33 "[x] RLS", "[x] 사용자별 데이터 분리" | 정책 정의가 저장소에 없음. 클라이언트 조회·삭제는 `user_id` 조건 없이 동작(`src/lib/clothes.ts:495-500,622-652`) | ~~Unknown~~ → **[1A-02 확인] 문서 주장이 맞음.** 실제 DB에 RLS와 4종 정책이 적용돼 있음. 교차 계정 동작 테스트는 미완료 |
| §19 "Private Bucket으로 운영" | 서명 URL을 사용하는 코드는 있음(`src/lib/clothes.ts:150-165,473-489`). 버킷 공개 여부와 Storage 정책은 확인 불가 | ~~Unknown~~ → **[1A-02 확인] 문서 주장이 맞음.** `public = false`, 사용자 폴더 기준 Storage 정책 4종 |
| §33 "[x] Shop 추천 점수 1차" | 점수 로직은 있으나 대상 상품이 목업 | **Mock** 위에서만 동작 |
| §22.3 fal.ai SAM2, §22.4 Gemini Polygon Mask(실험으로 기술) | 백엔드 엔드포인트와 클라이언트 함수는 있으나 호출되지 않음 | 쓰이지 않는 코드로 남아 있음 |

### 6.2 코드에는 구현되어 있으나 문서가 미완료·보류로 적은 것 (문서가 뒤처짐)

| 문서 기술 | 코드 실제 |
|---|---|
| §33 "[ ] Top N Outfit" | `getRankedLooks`, `getRankedLooksForItem`(`src/utils/outfitScore.ts:507-657`) + `src/app/looks.tsx` |
| §35 보류 목록 "옷 상세페이지", "Closet Empty State" | `src/app/item.tsx`, `src/app/closet.tsx:145-191` |
| §36 향후 기능 "로그아웃" | `src/app/closet.tsx:61-74` |
| §29 추천 엔진은 `recommendation.ts` 1개로 기술 | 실제로는 `outfitScore.ts`, `weatherRecommendation.ts`, `prototypeCore.ts`까지 4개 |
| 날씨 기반 오늘의 룩, Core Engine 데모 | 개발 문서에 해당 섹션 없음(작성일 이후 추가된 기능으로 보임) |

### 6.3 문서와 코드가 모두 미구현으로 일치하는 것 (Planned)
- 저장 후 옷 정보 수정, Closet 필터·검색·정렬·카테고리 탭(§35)
- 비밀번호 변경, 회원 탈퇴, 취향 설정(§36)
- 추천 규칙 세분화, 자체 Fashion Dataset 연동, 행동 기반 개인화(§32, §33)
- segmentation 고정밀화, 여러 옷 일괄 등록, 백그라운드 처리 큐(§34)

---

## 7. 기술적 문제 및 보안 위험

> 개발 문서는 백엔드 접근 제어에 대해 언급이 없다. 아래 S-1~S-3은 "문서 위반"이 아니라, 비용·데이터·인프라 경계를 넘는 것으로 코드에서 확인된 사실이다.

### 7.1 보안 위험

| ID | 위험 | 근거 | 영향 | 권장 조치 |
|---|---|---|---|---|
| **S-1** | **백엔드 인증 부재** | 모든 엔드포인트에 인증 미들웨어가 없음. `cors()` 전체 허용(`backend/server.js:14,182,552,597,728,826`) | 서버에 닿을 수 있는 누구나 Gemini·BRIA·fal 유료 키를 소모 가능. 로그인하지 않은 사용자도 분석 호출 가능 | Supabase JWT 검증, 사용자별 rate limit, 허용 Origin 제한. **[Sprint 1A-1 부분 해소, 2026-10-17]** 이미지 처리 4종은 로그인 필수, 무효 토큰 401, CORS 허용 목록 적용. 분석은 guest 허용 + IP당 시간당 10회(임시). 사용자별 영구 한도(1A-08)는 남음 |
| **S-2** | **SSRF(서버 측 임의 URL 요청)** | 요청 본문의 `imageUrl`을 검증 없이 서버가 요청(`backend/server.js:615,680,744`). BRIA에도 그대로 전달(`:847`) | **[추정]** 공개 배포 시 내부망이나 메타데이터 엔드포인트 요청에 악용될 수 있음 | Supabase Storage 도메인만 허용 |
| **S-3** | **사용자 데이터 분리가 RLS에만 의존** | 조회·수정·삭제 쿼리에 `user_id` 조건 없음(`src/lib/clothes.ts:495-500,564-583,622-652`) | **[1A-02 확인]** RLS가 올바르게 설정돼 있어 현재 정책상 다른 사용자 데이터에 접근할 수 없음. 남은 위험: RLS 하나에만 의존(앱 쿼리 조건이 없어 이중 방어가 아님), 익명 로그인을 켜면 익명 사용자도 `authenticated`로 쓰기 가능(S-6) | ~~정책 확인·기록~~ 완료(2026-10-17). 교차 계정 동작 테스트(V-3) 남음 |
| S-4 | 대용량 본문 + 무거운 동기 처리 | `express.json({ limit: "50mb" })`(`backend/server.js:22-26`), SAM 추론을 요청 처리 중 실행(`:613-648`) | 요청 몇 건으로 서버 자원 고갈 가능 | 크기 제한 축소, 처리 큐 도입. **[Sprint 1A-1]** 크기 제한은 분석 10mb·이미지 처리 1mb로 축소, Gemini·BRIA·이미지 다운로드에 타임아웃 적용. 처리 큐는 남음 |
| S-5 | Storage 경로를 클라이언트가 결정 | `${userId}/...` 경로를 앱이 만듦(`src/lib/clothes.ts:96,130,310,327`) | **[1A-02 확인]** Storage 정책이 조회·추가·수정·삭제 모두 첫 폴더 = `auth.uid()`를 대조함. 다른 사용자 경로에 쓰거나 읽을 수 없음 | ~~Storage 정책 확인~~ 완료(2026-10-17) |
| S-6 | 익명 로그인 활성화 시 익명 사용자의 쓰기 허용 **[1A-02 확인]** | 정책 대상이 `authenticated` 역할 전체이고 익명 여부(`is_anonymous`)를 구분하지 않음. 현재 Dashboard 설정상 익명 로그인은 **꺼져 있음** | 익명 로그인을 켜는 순간(PRD FR-AUTH-07) 가입하지 않은 사용자도 `clothes` 저장과 이미지 업로드 가능 | 익명 로그인을 켜기 전에 restrictive 정책 추가(보류 중, 승인 필요) |
| S-7 | 버킷 업로드 크기·형식 제한 없음 **[1A-02 확인]** | `storage.buckets`의 `file_size_limit`, `allowed_mime_types`가 모두 `null` | 로그인한 사용자가 자기 폴더에 이미지가 아닌 파일이나 큰 파일을 올릴 수 있음(저장 공간·비용 남용) | 버킷 제한 설정(보류 중, 승인 필요) |
| S-8 | 계정 삭제 시 Storage 파일이 남음 **[1A-02 확인]** | `clothes`는 `auth.users` 삭제 시 CASCADE로 지워지지만 Storage 객체는 함께 지워지지 않음 | 탈퇴 후 착용 사진이 남음 | 계정 삭제 서버 작업에서 사용자 폴더 삭제(PRD SEC-09) |
| S-9 | anon 역할이 `clothes` 테이블 권한을 가짐 **[1A-02 확인]** | `has_table_privilege` 결과 anon·authenticated 모두 SELECT·INSERT·UPDATE·DELETE 가능(Supabase 기본값). anon용 정책이 없어 실제 접근은 0건 | 지금은 영향 없음. RLS가 실수로 꺼지면 바로 노출 | 선택: anon 권한 회수(보류 중) |

비밀값 관리는 양호: `.env`는 gitignore 처리돼 있고 서버 키는 클라이언트 번들에 포함되지 않는다.

### 7.2 기술적 문제

| ID | 문제 | 근거 |
|---|---|---|
| T-1 | 백엔드 주소 localhost 고정 → **[추정]** 실기기·Android 에뮬레이터·배포 환경에서 분석·이미지 처리 실패 | `src/lib/clothes.ts:11`, `src/app/analyze.tsx:151` |
| T-2 | 이미지 처리가 저장 요청 안에서 동기로 실행됨(SAM → 실패 시 BRIA) → 저장 대기가 길고 불규칙 | `src/lib/clothes.ts:355-418` |
| T-3 | SAM 모델을 첫 요청 때 내려받음 → 서버 시작 직후 첫 저장이 특히 느림 | `backend/server.js:84-109` |
| T-4 | box2d·mask를 저장하지 않아 나중에 원본을 다시 처리하기 어려움 | `src/lib/clothes.ts:429-453` |
| T-5 | Gemini 요청에 타임아웃 없음 | `backend/server.js:152-174` |
| T-6 | Gemini 무료 등급 모델당 하루 20회 한도 | `backend/server.js:111-112` |
| T-7 | category와 subCategory 간 일관성을 검증하지 않음(예: `top` + `sneakers` 통과) | `backend/server.js:283-476` |
| T-8 | 삭제 순서: Storage 먼저 → DB 삭제가 실패하면 이미지 없는 행이 남음 | `src/lib/clothes.ts:638-656` |
| T-9 | 쓰이지 않는 코드(fal SAM2, Gemini mask 경로, 템플릿 탭) | `src/lib/clothes.ts:9,193-264`, `backend/server.js:552-595,728-824`, `src/components/app-tabs*.tsx` |
| T-10 | 자동화 테스트 0개 | 저장소 전체 |
| T-11 | Gemini 요청 MIME 타입 `image/jpeg` 고정 | `backend/server.js:267` |
| T-12 | 오류 모니터링·로깅 수집 없음(`console`만 사용) | 저장소 전체 |
| T-13 | Supabase Free 플랜 자동 일시정지 **[1A-02 확인]**: 2026-10-17 점검 시 프로젝트가 Paused 상태였고, 그동안 DB·Auth·Storage가 모두 멈춰 있었음. 승인 후 Resume으로 복구 | Supabase Dashboard(조직 플랜 Free) |

---

## 8. 사용자 경험상 주요 개선 사항

| ID | 현상 | 근거 | 개선 방향 |
|---|---|---|---|
| U-1 | 로그인은 성공했는데 그 뒤 옷 저장이 실패하면 "로그인 실패"로 안내됨 | `src/app/login.tsx:92-121` | 로그인 실패와 저장 실패 메시지 분리 |
| U-2 | 저장이 끝나기 전에 "로그인 완료" 알림이 먼저 뜸 | `src/app/login.tsx:90` | 저장 완료 후 한 번만 안내 |
| U-3 | `savingClothing` 단계 문구가 선언만 되고 쓰이지 않음 → 이미지 처리와 저장 단계가 구분되지 않음 | `src/app/login.tsx:33,48,93` | 처리 단계별 진행 표시 |
| U-4 | 회원가입 경로에는 처리 단계 문구가 없음("가입 중..."만 표시) | `src/app/signup.tsx:134-136` | 로그인과 같은 단계 표시 |
| U-5 | **[추정]** 보류 중인 옷이 로컬 사진 경로를 영속 저장 → 이메일 인증 후 나중에 로그인하면 사진 파일이 사라져 있을 수 있음 | `src/store/usePendingClothingStore.ts`, `src/app/analyze.tsx:270,283` | 보류 시점에 사진을 영구 위치로 복사하거나 사진이 없을 때 안내 |
| U-6 | 오류 Alert에 Supabase·서버의 원래 메시지가 그대로 노출됨(영문 기술 메시지 가능) | `src/app/login.tsx:117-121`, `src/app/signup.tsx:93-98`, `src/app/analyze.tsx:303-307` | 사용자용 문구로 변환 |
| U-7 | 분석 결과 중 season·tpo·colorTone은 수정할 수 없음 | `src/app/analyze.tsx:55` | 추천에 쓰이는 속성은 모두 수정 가능하게 |
| U-8 | 저장 후에는 속성을 수정할 수 없음(상세 화면은 사진 교체만) | `src/app/item.tsx` | 상세 화면에 속성 수정 추가 |
| U-9 | 화면마다 점수가 다름(Styling 점수 ≠ Today 점수 ≠ Core 점수) | 9장 참고 | 점수 체계 통일 |
| U-10 | 부족한 아이템을 하나만 보여줌. 나머지는 개수만 표시 | `src/app/styling.tsx:78-84` | 여러 개 제안 또는 우선순위 설명 |
| U-11 | Shop에서 구매로 이어지지 않음(링크 없음) | `src/app/shop.tsx` | 외부 링크 또는 저장(위시리스트) 동선 |
| U-12 | 카메라 촬영 불가(갤러리 선택만 지원, `launchCameraAsync` 없음) | `src/app/upload.tsx:37` | 촬영 지원 여부 결정 |
| U-13 | Closet 필터·검색·정렬 없음 | `src/app/closet.tsx` | 옷이 많아질 때를 대비해 추가 |

---

## 9. 추천엔진 구조 및 점수 체계의 문제

### 9.1 현재 구조

| 엔진 | 파일 | 점수 방식 | 쓰이는 화면 |
|---|---|---|---|
| **A. 두 옷 궁합** | `src/utils/recommendation.ts:102-169` | 계절 겹침 25 + 스타일 겹침 25 + TPO 겹침 20 + 색상 10~20 + 카테고리 0~10 (합계 최대 100) | Styling 코디 구성, Missing 탐지, Demo |
| **B. 코디 평가** | `src/utils/outfitScore.ts:434-491` | Color 0.22, Fit 0.16, Material 0.14, Season 0.20, TPO 0.18, Preference 0.10 가중합 × 완성도 계수(0.82~1.0) × 약점 감점(0.88/0.94/1) | Styling 점수 표시, Looks TOP 3 |
| **C. 날씨 반영** | `src/utils/weatherRecommendation.ts:320-415` | 코디 점수 × 0.7 + 날씨 적합도 평균 × 0.3. 적합도 40 미만인 옷은 제외 | Home, Today |
| **D. Core 데모** | `src/utils/prototypeCore.ts` | 고정 POETCORE 규칙과 옷 속성 비교(합격 기준 60/70) | Core Match·Look·Shop |
| **E. 상품 점수** | `src/app/shop.tsx:64-90` | subCategory 40 + color 35 + style 25 | Shop |

### 9.2 확인된 문제

1. **선택과 표시의 기준 불일치.** Styling은 엔진 A로 "최고 궁합" 아이템을 고른 뒤, 화면에는 엔진 B의 `evaluation.total`을 MATCH 점수로 보여준다(`src/app/styling.tsx:70-76,152-155`). A에서 최고인 조합이 B에서도 최고라는 보장이 없다.
2. **같은 옷이라도 화면마다 순위와 점수가 다름.** Styling은 A로 단일 코디를, Looks는 B로 TOP 3를 만든다(`src/utils/outfitScore.ts:507-591`). 사용자에게 "베스트 코디"와 "TOP 3 1위"가 다르게 보일 수 있다 **[추정, 실행 미확인]**.
3. **두 옷만 비교하는 탐욕적 선택.** 엔진 A는 기준 옷과 각 후보를 1:1로만 비교한다(`findBestMatch`, `recommendation.ts:204-230`). 고른 하의와 신발끼리 어울리는지는 보지 않는다.
4. **이분법 점수.** 계절·스타일·TPO는 하나라도 겹치면 만점, 아니면 0점이다(`recommendation.ts:122-142`). 세밀하게 구분하지 못한다.
5. **"Preference"는 실제 취향이 아님.** 사용자 입력이 아니라 옷장 안 스타일·색 분포와 얼마나 가까운지로 계산한다(`src/utils/outfitScore.ts:306-367`).
6. **가중치·점수표 근거 없음.** `WEIGHTS`, `MATERIAL_PAIRS`, `FIT_VOLUME`, 색상 점수가 모두 직접 정한 상수이고(`outfitScore.ts:51-97`), 데이터 근거가 코드에 없다. `STYLESEED_Fashion_Knowledge_Dataset_V0.1.numbers`는 코드와 연결돼 있지 않다.
7. **fit·material은 A에서 무시됨.** 엔진 A는 fit·material을 쓰지 않아, 아이템 선택 단계에서 실루엣·소재 궁합이 반영되지 않는다(`recommendation.ts:102-169`).
8. **Missing Item 한계.**
   - 조합 계획에 아우터·가방·액세서리가 없어서 이들은 부족하다고 판단되지 않는다(`recommendation.ts:186-202`).
   - 해당 카테고리 옷이 하나라도 있으면 궁합 점수가 낮아도 "충분하다"고 본다.
   - 제안은 고정 템플릿이다(예: 신발 → 갈색 로퍼 또는 흰 스니커즈, `recommendation.ts:316-336`).
9. **상품 점수가 다른 점수와 별개.** 엔진 E는 Missing 제안과 단순 일치 여부만 본다. 사용자 옷장과의 궁합(A·B)을 쓰지 않는다.

---

## 10. PRD 작성 전에 결정할 사항

| # | 결정 사항 | 관련 장 |
|---|---|---|
| D-1 | 목표 플랫폼(웹·iOS·Android)과 백엔드 배포 위치·방식 | 7.2 T-1 |
| D-2 | 백엔드 인증 방식(Supabase JWT 검증 등)과 사용자별 AI 호출 한도 | 7.1 S-1 |
| D-3 | 로그인 전 AI 분석을 허용할지(전환율 vs 비용) | 7.1 S-1, 8 |
| D-4 | 공식 "MATCH SCORE"를 하나로 정의할지, 4개 엔진을 통합할지 | 9 |
| D-5 | 점수 가중치를 Fashion Knowledge Dataset과 어떻게 연결할지 | 9.2-6 |
| D-6 | Missing Item 정의: "카테고리 부재"만 볼지 "궁합이 맞는 아이템 부재"까지 볼지, 아우터·가방 포함 여부, 제안 개수 | 9.2-8 |
| D-7 | 상품 연동 방식(제휴 API, 어필리에이트 링크 등)과 측정 지표(클릭, 전환) | 4 #10 |
| D-8 | 이미지 처리 방식: 동기 vs 비동기 큐, SlimSAM·BRIA 중 기본 경로, 처리 품질 기준 | 7.2 T-2~T-4 |
| D-9 | 분석 결과 수정 범위(season·tpo·colorTone 포함), 저장 후 수정 허용 여부 | 8 U-7, U-8 |
| D-10 | Core Engine(POETCORE 등)을 영상용 데모로 둘지 실제 기능으로 만들지 | 3.2 |
| D-11 | 카메라 촬영 지원 여부 | 8 U-12 |
| D-12 | 계정 기능 범위(비밀번호 재설정, 탈퇴, 취향 설정) | 6.3 |

---

## 11. 향후 검증이 필요한 항목

이번 Audit은 정적 코드 분석이다. 아래 항목은 저장소만으로 판단할 수 없어 별도 확인이 필요하다.

| # | 항목 | 확인 방법 | 상태 |
|---|---|---|---|
| V-1 | `clothes` 테이블 RLS 활성화 여부와 SELECT·INSERT·UPDATE·DELETE 정책이 `auth.uid() = user_id`로 제한되는지 | 읽기 전용 `pg_policies` 조회(Supabase MCP) | **[1A-02 확인] 충족** (2026-10-17) |
| V-2 | `clothing-images` 버킷의 비공개 여부와, Storage 정책이 경로 첫 폴더를 `auth.uid()`와 대조하는지 | 읽기 전용 `storage.buckets`·`pg_policies` 조회 | **[1A-02 확인] 충족** (2026-10-17) |
| V-3 | 다른 계정으로 상대방 옷 `id`를 조회·삭제할 수 없는지 | 테스트 계정 2개로 교차 시도 | [미검증] 정책 정의상으로는 차단됨. 동작 테스트는 테스트 환경 결정 후 진행 |
| V-4 | 실기기(iOS·Android)에서 분석·저장 흐름이 동작하는지 | 실기기 실행 | [미검증] |
| V-5 | 로컬 SlimSAM의 첫 로딩 시간과 1건당 처리 시간, BRIA로 넘어가는 비율 | 백엔드 로그 계측 | [미검증] |
| V-6 | 착용샷·제품샷별 Gemini 분석 정확도(category, color 등) | 샘플 이미지셋으로 평가 | [미검증] |
| V-7 | 이미지 분리 품질(얼굴·피부·다른 옷이 섞여 들어가는 비율) | 샘플 이미지셋으로 육안 평가 | [미검증] |
| V-8 | Styling 베스트 코디와 Looks 1위가 실제로 다르게 나오는 빈도 | 테스트 옷장 데이터로 비교 | [미검증] |
| V-9 | 보류 중인 옷의 로컬 사진 경로가 앱 재시작·장시간 경과 후에도 유효한지 | 실기기에서 이메일 인증 경로 재현 | [미검증] |
| V-10 | 백엔드 SSRF 경로가 배포 환경에서 실제로 노출되는지 | 배포 구성 확정 후 점검 | [미검증] |
| V-11 | Gemini 모델 기본값(`gemini-3.6-flash`)과 `.env` 설정 모델의 한도·비용 | Google AI Studio 콘솔 | [미검증] |

---

*이 문서는 2026-10-16 시점 작업 트리를 정적으로 분석한 결과다. 코드 변경 후에는 근거 줄번호와 상태를 다시 확인해야 한다.*
