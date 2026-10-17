# STYLESEED Product Requirements Document (PRD)

| 항목 | 내용 |
|---|---|
| 문서 버전 | v0.2.1 (Red Team 검토 반영 초안 + 1A-02 점검 결과) |
| 작성일 | 2026-10-16 (v0.1) / 2026-10-16 개정 (v0.2) / 2026-10-17 갱신 (v0.2.1) |
| 개정 근거 | `pm-execution:red-team-prd` 검토 결과 중 승인된 수정안 1·2·3·4·6·8, 지침에 따라 조정한 수정안 5·7. 변경 이력은 부록 C |
| 제품 | STYLESEED — AI 퍼스널 스타일링 서비스 |
| 작성 근거 | ① 소스코드(main `437e11d` + 미커밋 작업 트리) ② `docs/PRODUCT_AUDIT.md` ③ `docs/references/2기 지원서_스타일시드.pdf`(모두의 창업 2기 지원서, 2026-09-16 제출본) |
| 작성 방식 | `pm-execution:create-prd` 템플릿(Summary·Background·Objective·Segment·Value·Solution·Release)을 요청된 29개 섹션 구조에 맞춰 확장 |
| 상태 | 검토 대기 — 29장 Open Questions 해소 전까지 확정 아님 |

---

## 0. 문서 읽는 법

### 0.1 출처 표기

| 표기 | 의미 |
|---|---|
| **[CODE]** | 소스코드에서 직접 확인한 사실. 파일 경로와 줄번호를 함께 적는다 |
| **[AUDIT]** | `docs/PRODUCT_AUDIT.md`에서 확인된 사실 |
| **[BP]** | 사업계획서(2기 지원서)의 주장·계획·목표. **완료된 실적으로 해석하지 않는다** |
| **[BP-보고값]** | 사업계획서에 적힌 측정 결과. 원자료를 이번 작업에서 확인하지 못함 |
| **[가설]** | 아직 검증되지 않은 가정. 검증 방법을 함께 적는다 |
| **[제안]** | 이 PRD가 제안하는 초안 값. 팀 합의가 필요하다 |

### 0.2 구현 상태

| 상태 | 정의 |
|---|---|
| **Implemented** | 실제 데이터로 끝까지 동작하는 코드 경로가 확인됨 |
| **Partial** | 핵심 경로는 있으나 기능 일부가 빠졌거나 결함이 있음 |
| **Mock** | 고정 데이터·데모 규칙으로 동작함 |
| **Planned** | 사업계획서나 문서에 계획만 있고 코드가 없음 |
| **Unknown** | 저장소만으로 확인할 수 없음 |

### 0.3 우선순위
- **P0** 출시 차단(release blocker): 없으면 사용자를 받을 수 없음. 보안·개인정보 포함
- **P1** 해당 Phase의 핵심 가설 검증에 필요
- **P2** 있으면 좋음, 다음 Phase로 미룰 수 있음

### 0.4 충돌 처리 원칙
사업계획서와 코드가 다르면 **현재 상태는 코드 기준**으로 판단한다. 사업계획서 내용은 **목표 요구사항**으로 분류한다.

---

## 목차

1. [Executive Summary](#1-executive-summary)
2. [Product Vision](#2-product-vision)
3. [Problem Statement](#3-problem-statement)
4. [Target Users & Personas](#4-target-users--personas)
5. [Value Proposition](#5-value-proposition)
6. [Product Goals & Non-Goals](#6-product-goals--non-goals)
7. [Core User Journey](#7-core-user-journey)
8. [Current MVP Implementation](#8-current-mvp-implementation)
9. [Functional Requirements](#9-functional-requirements)
10. [AI Image Analysis](#10-ai-image-analysis)
11. [Fashion Knowledge Dataset](#11-fashion-knowledge-dataset)
12. [Styling Recommendation Engine](#12-styling-recommendation-engine)
13. [Match Score & Explainability](#13-match-score--explainability)
14. [Core / Aesthetic Recommendation](#14-core--aesthetic-recommendation)
15. [Today's Look](#15-todays-look)
16. [Missing Item Detection](#16-missing-item-detection)
17. [Wardrobe Decision Module](#17-wardrobe-decision-module)
18. [Product Catalog & Commerce Integration](#18-product-catalog--commerce-integration)
19. [STYLESEED PLUS & Monetization](#19-styleseed-plus--monetization)
20. [User Data & Personalization](#20-user-data--personalization)
21. [Technical Requirements](#21-technical-requirements)
22. [Security & Privacy Requirements](#22-security--privacy-requirements)
23. [Non-Functional Requirements](#23-non-functional-requirements)
24. [Analytics & Success Metrics](#24-analytics--success-metrics)
25. [Acceptance Criteria](#25-acceptance-criteria)
26. [MVP Stabilization Requirements](#26-mvp-stabilization-requirements)
27. [Beta Release Requirements](#27-beta-release-requirements)
28. [Future Development Requirements](#28-future-development-requirements)
29. [Open Questions & Risks](#29-open-questions--risks)
- [부록 A. 사업계획서 ↔ 코드 Gap 표](#부록-a-사업계획서--코드-gap-표)
- [부록 B. Requirement ID 색인](#부록-b-requirement-id-색인)
- [부록 C. 변경 이력](#부록-c-변경-이력)

---

## 1. Executive Summary

STYLESEED는 사용자의 **현재 옷장(Actual Closet)**과 **되고 싶은 스타일(Ideal Fashion Self)**을 잇는 AI 퍼스널 스타일링 서비스다. 핵심 약속은 이것이다.

> **"내 옷장 속 옷으로 되고 싶은 스타일을 먼저 완성하고, 정말 필요한 옷만 사게 돕는다."**

**현재 위치 [CODE][AUDIT]**
- 사진 등록 → AI 분석 → 사용자 수정 → 계정별 저장 → Digital Closet → Styling → Match Score와 이유 → Missing Item → Shop까지 흐름이 코드로 연결돼 있다.
- 날씨 기반 Today's Look과 TOP 3 Look도 동작한다.
- 그러나 다음 상태에서는 외부 사용자를 받을 수 없다.
  - 백엔드에 인증이 없다.
  - ~~Supabase RLS가 저장소에서 검증되지 않는다.~~ → 2026-10-17 점검(1A-02)에서 실제 DB의 RLS·Storage 정책이 올바르게 설정된 것을 확인했고, 정의를 저장소에 기록했다. 교차 계정 동작 테스트는 남아 있다.
  - 백엔드 주소가 `localhost`로 고정돼 있다.
  - 상품 데이터가 Mock이다.
  - 점수 체계 4개가 섞여 있다.
  - 행동 데이터를 수집하지 않는다.

**사업계획서 목표 [BP]**
- Core/Aesthetic 기반 추천, Dynamic Fashion Knowledge Dataset
- Wardrobe Decision Module(Wardrobe Compatibility, Outfit Unlock Score, Duplication Check)
- 행동 데이터 기반 개인화
- 브랜드 Product Catalog PoC → Feed/API → CPS
- STYLESEED PLUS 구독(월 5,900원 / 연 59,000원)

이 중 **코드로 구현된 것은 없거나 Mock 수준**이다(부록 A).

**이 PRD의 결론**
1. **Phase 1A(출시 안전성·데이터 보호)**에서 인증·RLS·서버 보호·AI 호출 제한 같은 출시 차단 요소를 먼저 해결한다.
2. **Phase 1B(핵심 MVP 품질·측정 체계)**에서 옷 등록 경험, 추천엔진 일관성, 추천 품질 평가 기준, 행동 데이터 측정을 정리한다.
3. **Phase 2(Closed Beta·가치 검증)**에서 사업계획서의 핵심 흐름 **Actual Closet → Ideal Fashion Self → 필요한 구매**를 각각 작은 단위로 검증한다.
   - Actual Closet: Today's Look·Styling의 반복 사용
   - Ideal Fashion Self: 대표 Core 2~3개를 실제 옷장과 연결한 제한적 PoC
   - 필요한 구매: Wardrobe Decision의 Concierge Test 또는 제한된 프로토타입, 가격·가치 테스트
4. 실제 결제·상거래 개발은 Phase 2 검증 결과를 진입 조건으로 삼는다(Phase 4 상품 데이터 연동, Phase 5 구독·CPS).

---

## 2. Product Vision

### 2.1 비전
> 사용자의 옷장 데이터가 쌓일수록 추천과 구매 판단의 가치가 높아지고, 반복 사용과 구독 매출이 함께 증가하는 AI 퍼스널 스타일링 서비스. [BP]

### 2.2 제품 원칙

모든 요구사항은 이 원칙을 따른다.

| # | 원칙 | 제품 규칙(이 PRD에서의 해석) |
|---|---|---|
| 1 | **보유 의류 활용 우선** (Closet-first) | 상품 추천은 "옷장으로 코디를 만들 수 없을 때"에만 노출한다 |
| 2 | **의상학 기반 추천** (Fashion-science based) | 점수 기준(Color, Fit·Silhouette, Material, Season, TPO)과 가중치는 Fashion Knowledge Dataset에 근거와 출처를 기록한다 |
| 3 | **설명 가능한 추천 점수** (Explainable score) | 모든 점수 옆에 "왜"를 문장으로 보여준다. 화면마다 점수 정의가 달라서는 안 된다 |
| 4 | **Core/Aesthetic 기반 지향 스타일** (Ideal Fashion Self) | 사용자가 고른 Core에 얼마나 가까운지를 별도 지표로 보여준다 |
| 5 | **실제 부족한 상품만 추천** (Need-based commerce) | 상품마다 "어떤 빈자리를 채우는지"와 "비슷한 옷이 이미 있는지"를 보여준다 |
| 6 | **반복 사용을 유도하는 Daily Styling** | Today's Look이 매일 다시 열 이유가 된다 |
| 7 | **개인화와 구매 의사결정 기반 수익화** | 옷장 저장 자체는 무료다. 더 나은 코디와 구매 판단에 과금한다 [BP] |
| 8 | **작게 검증한 뒤 만든다** (Validate before build) | 가치 가설은 수작업 Concierge Test, 제한된 프로토타입, 가격 테스트로 먼저 확인한다. 결제·상거래·전체 확장은 검증 결과가 나온 뒤에 개발한다 |

**핵심 가치 흐름 [BP]:** Actual Closet(내 옷장) → Ideal Fashion Self(되고 싶은 스타일) → 필요한 구매. 모든 Phase는 이 흐름의 어느 단계를 검증하거나 강화하는지 밝힌다(28장 Phase 요약).

---

## 3. Problem Statement

### 3.1 사용자 문제 [BP]
- **옷장 역설:** 옷장은 가득 찼는데 "입을 옷이 없다"고 느낀다.
- **휴면 의류:** 사업계획서가 인용한 연구에 따르면 보유 의류 중 22%(벨기에 플랑드르, 2024, n=156)와 약 26%(영국 WRAP)가 지난 1년간 입지 않은 옷이다. 소비자는 이 옷을 "앞으로 입을 것 같아서" 계속 가지고 있다.
- **이상과 현실의 간극:** 소비자는 '지금의 나'보다 '되고 싶은 나'에 맞춰 옷을 고른다(밀레니얼 751명 연구 인용). 최근에는 Poetcore, Minimal 같은 Core/Aesthetic으로 그 모습을 구체적으로 표현한다. Pinterest 2026 트렌드 인용: 'poet core' 검색 75% 증가.
- **기존 해결책의 한계:**
  - 익숙한 코디를 반복하면 옷장 활용 범위가 넓어지지 않는다.
  - SNS 검색 결과는 내 옷장을 반영하지 않는다.
  - 새로 구매하면 옷장을 다 활용하기 전에 옷만 늘어난다.

> 위 통계는 사업계획서가 인용한 외부 자료다. 이번 PRD 작성에서 원문을 다시 확인하지 않았다(29장 OQ-12).

### 3.2 문제 정의
> 20~34세 패션 고관여 여성은 이미 가진 옷으로 원하는 스타일을 만드는 방법을 모른다. 그래서 옷을 덜 입고, 판단 근거 없이 더 산다.

### 3.3 Why now [BP]
- 이미지 분석 AI(Gemini)로 옷 사진 한 장에서 구조화된 속성을 얻는 비용이 낮아졌다(사업계획서: 1벌당 약 2원, 미검증).
- Core/Aesthetic 문화가 '되고 싶은 스타일'을 구체적인 요소(색·소재·아이템)로 표현하게 만들었다.

---

## 4. Target Users & Personas

### 4.1 Market Segment
시장은 인구통계가 아니라 사용자가 해결하려는 일(Job)로 정의한다.

| Segment | 해결하려는 일 (Job) | 출처 |
|---|---|---|
| **S1. 옷장 활용형** | "가진 옷으로 오늘 뭘 입을지 빨리 정하고 싶다" | [BP] |
| **S2. 스타일 지향형** | "되고 싶은 스타일(예: Poetcore)을 가진 옷으로 먼저 시도해보고 싶다" | [BP] |
| **S3. 신중 구매형** | "이 옷을 사도 내 옷장과 잘 어울리는지, 비슷한 걸 이미 갖고 있지 않은지 알고 싶다" | [BP] |

**1차 타깃 [BP]:** 온라인 패션 구매가 일상화된 20~34세 여성 패션 소비자(Z세대 + 젊은 밀레니얼).

**제약**
- 사진을 등록하는 부담: 사업계획서가 유사 서비스의 시장 안착 한계로 직접 꼽은 요소다.
- 현재 지원 범위: 여성복 중심 분류 체계 [CODE `src/constants/clothingOptions.ts`], 한국어 UI.

### 4.2 Personas [가설]

아래 페르소나는 사업계획서의 타깃 설명을 바탕으로 만든 **가설**이다. Phase 2 인터뷰로 검증한다.

| 페르소나 | 상황 | 핵심 니즈 | 대응 기능 |
|---|---|---|---|
| **P1. 아침 5분 결정자** (S1) | 출근 전 날씨를 보고 급하게 옷을 고른다 | 오늘 날씨에 맞는 코디 하나 | Today's Look, First Look |
| **P2. 무드 탐색자** (S2) | Pinterest로 Poetcore를 저장하지만 따라 하려면 새 옷을 사야 할 것 같다 | 내 옷으로 그 무드 만들기 | Core/Aesthetic, Core Match Score |
| **P3. 장바구니 고민자** (S3) | 장바구니에 담아두고 결제를 망설인다 | 사도 될지에 대한 근거 | Wardrobe Decision Module, Duplication Check |

---

## 5. Value Proposition

| 고객 Job | 얻는 것 (Gain) | 피하는 고통 (Pain) | 차별점 [BP] |
|---|---|---|---|
| 오늘 뭘 입을지 정하기 | 날씨와 내 옷장 기준의 즉시 코디 | 매일 아침 고민, 같은 코디 반복 | 실제 보유 의류 + 날씨 결합 |
| 되고 싶은 스타일 시도 | 내 옷으로 만든 Core 코디 + Core 적합도 | "새로 사야만 가능하다"는 압박 | Core를 구성 요소로 분해한 Dataset |
| 옷 살지 말지 판단 | 조합 가능한 옷 수, 새로 생기는 코디 수, 중복 여부 | 충동구매, 비슷한 옷 중복 구매 | 옷장 기준 구매 판단(Wardrobe Decision) |
| 추천을 믿기 | 점수와 그 이유 | 근거 없는 "AI 추천" | 의상학 기준 점수 + 설명 |

### Value Curve [가설]

| 비교 축 | 일반 쇼핑앱 | 디지털 옷장 앱 | **STYLESEED 목표** |
|---|---|---|---|
| 내 옷장 반영 | 낮음 | 높음 | 높음 |
| 되고 싶은 스타일 반영 | 중간(트렌드) | 낮음 | **높음** |
| 추천 이유 설명 | 낮음 | 낮음~중간 | **높음** |
| 구매 판단 근거 | 낮음 | 낮음 | **높음** |
| 상품 다양성 | 높음 | 중간 | 낮음 → 중간(제휴 확대에 따라) |

> 경쟁 서비스 비교는 사업계획서의 서술("디지털 옷장과 AI 코디 서비스가 등장")에 근거한다. 특정 경쟁사 분석은 이번 범위에 포함하지 않았다(OQ-13).

---

## 6. Product Goals & Non-Goals

### 6.1 Goals (OKR 초안)

> 아래 KR은 **측정 가능 여부와 판정 방식**을 정한다. 목표 수치는 실측값이 없으므로 모두 **[가설]**이며, Phase 2 진입 전에 확정한다(OQ-01, OQ-24).

**Objective 1A. 외부 사용자를 안전하게 받을 수 있는 MVP를 만든다** (Phase 1A)
- KR1. 25.1 **AC-G1에 정의된 P0 보안 항목**을 100% 충족한다(SEC-07처럼 이미 충족한 항목은 유지 확인).
- KR2. 배포된 HTTPS 백엔드로 iOS·Android 실기기에서 등록→저장→Styling 수동 테스트 시나리오를 100% 통과한다.

**Objective 1B. 가치를 측정할 수 있는 MVP 품질을 갖춘다** (Phase 1B)
- KR1. 모든 화면이 하나의 Outfit Match Score 정의를 쓴다(점수 엔진 1개).
- KR2. 추천 품질 평가 세트(FR-DS-06)로 점수 순위와 전문가 순위의 일치도를 1회 측정해 기준선을 기록한다.
- KR3. 24.3의 Phase 2 필수 이벤트가 기록되고, 등록 시간·추천 가능한 옷장 도달률을 계산할 수 있다.

**Objective 2. Actual Closet → Ideal Fashion Self → 필요한 구매 흐름의 가치를 검증한다** (Phase 2)
- KR1. Actual Closet: 추천 가능한 옷장 도달률, 코디 저장률, 7일 재방문율을 앱 이벤트로 측정해 사전 Go/No-go 기준과 비교한다.
- KR2. Ideal Fashion Self: Core PoC 참여자의 Core 적합도 설명 이해도·만족도·"지향 스타일 구현" 응답을 측정한다.
- KR3. 필요한 구매: Wardrobe Decision 검증 참여자의 구매 의사 변화, 기능 이용 의사, 가격 제시 후 지불 의사를 측정한다.

**Objective 3. 구독·CPS 수익을 실제 결제로 검증한다** (Phase 5)
- KR1. 유료전환율 **5%** [BP 목표, 가설] 달성 여부를 실제 결제 데이터로 판정한다(분모: MAU, 24.2).

### 6.2 Non-Goals (이번 로드맵 범위 밖)
- 자체 쇼핑몰 운영, 재고 보유, 직접 판매
- 남성복·아동복 분류 체계 확장
- 가상 착용(Virtual Try-on), 3D 아바타
- 한 사진에서 여러 옷을 동시에 등록 [AUDIT §6.3 보류 항목]. 단, Phase 2에서 1벌 등록 시간이나 추천 가능한 옷장 도달률이 Go/No-go 기준에 못 미치면 다시 검토한다(24.4)
- Phase 2에서의 실제 인앱 결제 구현. Phase 2는 가격·가치 테스트까지만 한다(FR-SUB-08)
- Phase 2에서의 Core 전체 확장과 Dataset 고도화. Phase 2는 대표 Core 2~3개 PoC만 한다(FR-CORE-07)
- 소셜 피드·커뮤니티
- 브랜드용 파트너 관리 시스템. 사업계획서의 장기 비전이며 28장에 기록만 한다
- 승인되지 않은 크롤링으로 상품 데이터를 수집하는 것. 사업계획서는 "허가받은 Feed/API"를 전제로 한다

---

## 7. Core User Journey

### 7.1 목표 여정 (To-Be)

```text
[가입 전]
 앱 실행 → 익명 세션 발급(FR-AUTH-07) → (옷 1~3벌 등록) → AI 분석·수정
   → First Look 즉시 확인 → 저장 시점에 가입/로그인(익명 세션을 계정에 연결)
   → Digital Closet

[매일]
 Home → Today's Look(날씨 + 내 옷장) → 저장 / 스킵 / "오늘 입음"

[스타일 지향]
 Ideal Style에서 Core 선택 → 내 옷장의 Core 적합 아이템 → Core Look
   → 부족한 요소 확인(Missing Item)

[구매 판단]
 Missing Item 또는 구매 후보 사진·스크린샷(Phase 2) / Catalog 상품(Phase 4)
   → Wardrobe Decision (Compatibility · Outfit Unlock · Duplication)
   → BUY / CONSIDER / SKIP → (Phase 4 이후) 공식 판매처 Deep Link

[구독]
 (Phase 2) PLUS 가치·가격 테스트 → (검증 후 Phase 5) Paywall → 결제
   (가격 가설: 월 5,900원 / 연 59,000원 [BP])
```

### 7.2 현재 여정 (As-Is) [CODE][AUDIT §3]

```text
Splash → Home(Today's Look 카드)
 → Upload(갤러리) → Analyze(Gemini) → 저장(비로그인이면 Signup/Login 후 자동 저장)
 → Closet → Item(상세) / Styling(베스트 코디 + MATCH)
     → Looks(TOP 3) / Missing → Shop(Mock 상품, 구매 링크 없음)
 보조: Ideal Style → Core Match → Core Look → Core Shop (POETCORE 데모 고정, Mock)
```

### 7.3 여정 Gap

| 단계 | As-Is | To-Be | Gap |
|---|---|---|---|
| 첫 가치 | 저장 후 Home 카드 또는 Styling에서 확인 | 등록 직후 First Look | First Look 전용 진입·최소 등록 수 정의 없음 |
| 매일 사용 | Today's Look 조회만 가능 | 저장·스킵·착용 기록 | 행동 기록 기능 없음 |
| Core | 데모 고정 규칙 | Dataset 기반 Core 적합도 | Dataset 미연동 |
| 구매 | Mock 상품, 링크 없음 | 실제 상품 + 구매 판단 + Deep Link | 전부 Planned |
| 구독 | 없음 | Paywall + 결제 | 전부 Planned |

---

## 8. Current MVP Implementation

> 상세 근거는 `docs/PRODUCT_AUDIT.md` 4~5장. 여기서는 PRD 기준으로 요약한다.

| 영역 | 상태 | 핵심 근거 [CODE] |
|---|---|---|
| 회원가입·로그인 | Partial | `src/app/signup.tsx`, `src/app/login.tsx`, `src/lib/supabase.ts` |
| 사진 등록 | Partial(갤러리만) | `src/app/upload.tsx:37-42`. 카메라 `launchCameraAsync` 없음 |
| AI 이미지 분석 | Implemented | `backend/server.js:182-550`, `src/app/analyze.tsx` |
| 이미지 분리(배경 제거) | Partial | `src/lib/clothes.ts:343-418`, `backend/server.js:597-726,826-885` |
| Supabase 저장·조회 | Implemented / 정책 확인 [1A-02] | `src/lib/clothes.ts` |
| Digital Closet | Implemented | `src/app/closet.tsx`, `src/hooks/use-closet-loader.ts` |
| Styling(베스트 코디) | Partial | `src/app/styling.tsx`, `src/utils/recommendation.ts` |
| Match Score | Partial(체계 불일치) | `src/utils/outfitScore.ts` 외 3개 |
| TOP 3 Look | Implemented | `src/utils/outfitScore.ts:507-657`, `src/app/looks.tsx` |
| First Look | Partial | `src/app/index.tsx:53-60`(Home 카드가 1순위 룩 표시). 전용 정의 없음 |
| Today's Look(날씨) | Implemented | `src/lib/weather.ts`, `src/utils/weatherRecommendation.ts` |
| Core/Aesthetic | Mock | `src/data/coreDemo.ts:8-14`, `src/utils/prototypeCore.ts` |
| Missing Item | Partial | `src/utils/recommendation.ts:186-415`, `src/app/missing.tsx` |
| Shop | Mock | `src/data/mockProducts.ts:3-5`(16개), `src/app/shop.tsx:64-90` |
| Wardrobe Decision Module | Planned | 코드 없음 |
| Fashion Knowledge Dataset | Planned | `STYLESEED_Fashion_Knowledge_Dataset_V0.1.numbers` 파일만 있고 코드 연결 없음 |
| 코디 저장 / 스킵 / 착용 기록 | Planned | 해당 코드 없음 |
| 행동 이벤트 수집(Analytics) | Planned | 해당 코드 없음 |
| 구독·결제 | Planned | 결제 관련 의존성·코드 없음 (`package.json`) |
| 백엔드 인증 | **없음** | `backend/server.js:14`, 모든 라우트 |
| RLS·Storage 정책 | Implemented [1A-02 확인] / 동작 테스트 미완료 | `supabase/migrations/20261017000000_baseline_clothes_rls_storage.sql`(실제 DB 정의를 기록한 파일, 적용하지 않음) |
| 자동화 테스트 | 없음 | `*.test.*`, `*.spec.*` 0개 |

---

## 9. Functional Requirements

### 9.1 작성 형식
주요 기능은 아래 12개 필드로 기술한다(10~20장). 이 장에서는 공통 기반 기능(계정·등록·옷장)을 다룬다.

> 필드: Requirement ID · 기능 목적 · 사용자 가치 · 상세 요구사항 · 입력 · 처리 로직 · 출력 · Acceptance Criteria · 현재 상태 · 관련 코드 · 기술 의존성 · 우선순위

### FR-AUTH. 회원가입·로그인·계정

| 필드 | 내용 |
|---|---|
| **ID** | FR-AUTH-01 ~ 07 |
| **목적** | 사용자별 옷장 데이터를 안전하게 분리하고, 가입 부담을 저장 시점까지 미룬다 |
| **사용자 가치** | 가입 전에 분석 가치를 먼저 경험한다. 데이터가 내 계정에만 남는다 |
| **상세 요구사항** | **01** 이메일/비밀번호 가입·로그인(유지) · **02** 저장 시점 로그인 유도 + 보류 중인 옷 자동 저장(유지) · **03** 로그인 실패와 저장 실패 메시지 분리 · **04** 비밀번호 재설정 · **05** 회원 탈퇴(옷장 데이터·이미지·이벤트 삭제. 정의는 SEC-09) · **06** 입력 검증(이메일 형식, 비밀번호 규칙) · **07** 가입 전 익명 세션: 앱 첫 실행 시 Supabase 익명 로그인(anonymous sign-in)으로 토큰을 발급하고, 가입·로그인 시 익명 세션의 보류 데이터를 계정으로 옮긴다 [제안, Supabase 프로젝트 설정 확인 필요] |
| **입력** | 이메일, 비밀번호, `pendingClothing`, 익명 세션 토큰 |
| **처리 로직** | 첫 실행 → 익명 세션 → 분석(SEC-01·02 한도 적용) → 저장 시 가입/로그인 → 보류 중인 옷이 있으면 `saveClothingToSupabase` → Closet 이동 |
| **출력** | 세션, 저장된 옷, 단계별 상태 문구 |
| **AC** | ① 로그인 성공 후 저장이 실패하면 "로그인됨 / 저장 실패"로 구분 안내한다(현재 "로그인 실패"로 표시됨, `login.tsx:116-121`) ② 탈퇴 시 SEC-09 AC를 충족한다 ③ 재설정 메일 링크로 비밀번호를 바꿀 수 있다 ④ 보류 중인 옷의 사진 파일이 사라졌으면 사용자에게 재등록을 안내한다 ⑤ 가입하지 않은 사용자도 익명 세션으로 분석 한도까지 AI 분석을 쓸 수 있다 ⑥ 익명 세션 사용자는 `clothes`에 저장할 수 없고, 가입 후 저장된 행의 `user_id`는 정식 계정 ID다 |
| **현재 상태** | 01·02 Implemented / 03 결함 / 04·05·06·07 Planned |
| **관련 코드** | `src/app/login.tsx`, `src/app/signup.tsx`, `src/store/usePendingClothingStore.ts`, `src/lib/supabase.ts`, `src/app/analyze.tsx:282-286` |
| **기술 의존성** | Supabase Auth(익명 로그인 활성화 필요. 2026-10-17 현재 **꺼져 있음** [1A-02 확인]), **익명 사용자 쓰기 차단 restrictive 정책을 익명 로그인 활성화보다 먼저 적용**(현재 정책은 익명 사용자도 `authenticated`로 허용, AUDIT S-6),  딥링크(`scheme: styleseed`, `app.json`), 05는 서버 관리자 권한 엔드포인트(SEC-09) |
| **우선순위** | 03·05·07: **P0**(Phase 1A. 05는 개인정보 처리 요건, 07은 SEC-01과 가입 전 체험을 함께 지키는 전제) / 04·06: P1 |

### FR-UPL. 의류 사진 등록·이미지 처리

| 필드 | 내용 |
|---|---|
| **ID** | FR-UPL-01 ~ 06 |
| **목적** | 등록 부담을 줄이면서 옷장 화면에 쓸 깨끗한 의류 이미지를 확보한다 |
| **사용자 가치** | 사진 한 장으로 옷이 정리된다 |
| **상세 요구사항** | **01** 갤러리 선택(유지) · **02** 카메라 촬영 · **03** 원본 보존 + 배경 제거본 생성(유지, 3단계 대체 경로) · **04** 이미지 처리를 저장 요청에서 분리(비동기 처리 + 상태 표시) · **05** `box2d`·`mask`를 DB에 저장해 재처리 가능하게 · **06** 쓰이지 않는 코드 정리(TR-08로 통합) · **07** 등록 부담 측정: 1벌 등록 소요 시간(사진 선택 → 저장 완료)과 단계별 이탈을 이벤트로 기록 |
| **입력** | 이미지(URI, base64), `box2d` |
| **처리 로직** | 원본 업로드 → SlimSAM 분리 → 실패 시 Crop + BRIA → 실패 시 원본 유지 |
| **출력** | `original_image_path`, `cutout_image_path`, 처리 상태 |
| **AC** | ① 카메라로 촬영한 사진이 등록된다 ② 저장 버튼을 누르면 이미지 처리 완료를 기다리지 않고 옷장에 항목이 생기고, 처리 상태(처리 중/완료/실패)가 보인다 ③ 처리가 실패해도 원본으로 옷이 표시된다 ④ `box2d`가 DB에 저장된다 ⑤ 처리 경로별 성공률이 로그로 남는다 ⑥ `upload_started`와 `clothing_saved` 이벤트로 1벌 등록 시간의 p50·p90을 계산할 수 있다 |
| **현재 상태** | 01·03 Implemented / 02·04·05·07 Planned / 06 Dead code 존재 |
| **관련 코드** | `src/app/upload.tsx`, `src/lib/clothes.ts:9-418`, `backend/server.js:84-109,552-885` |
| **기술 의존성** | expo-image-picker, expo-image-manipulator, Supabase Storage, `@huggingface/transformers`, sharp, BRIA API |
| **우선순위** | 07: **P1(Phase 1B)** / 02: P1(Phase 2) / 04: P1(Phase 2 이후, 1B의 등록 시간 측정 결과를 보고 우선순위 확정) / 05: P1 / 06: TR-08 참조 |

### FR-CLO. Digital Closet

| 필드 | 내용 |
|---|---|
| **ID** | FR-CLO-01 ~ 05 |
| **목적** | 등록한 옷을 보고 관리하는 기반 화면 |
| **사용자 가치** | 내 옷장을 한눈에 보고 정리한다 |
| **상세 요구사항** | **01** 목록·상세·삭제(유지) · **02** 저장 후 속성 수정(category~style 전체) · **03** 카테고리 필터·검색·정렬 · **04** 착용 기록(마지막 착용일, 착용 횟수) · **05** 삭제 순서 보정(DB 행 → 파일, 또는 트랜잭션성 정리) |
| **입력** | `clothes` 행, 사용자 수정값 |
| **처리 로직** | `fetchClothesFromSupabase` → 5분 캐시 → 화면 |
| **출력** | 옷 목록, 상세, 수정 결과 |
| **AC** | ① 상세 화면에서 속성 7종을 수정하면 DB와 추천 결과에 즉시 반영된다 ② 카테고리 필터가 동작한다 ③ DB 삭제가 실패해도 이미지 없는 행이 남지 않는다 |
| **현재 상태** | 01 Implemented / 02·03·04 Planned / 05 결함 |
| **관련 코드** | `src/app/closet.tsx`, `src/app/item.tsx`, `src/hooks/use-closet-loader.ts`, `src/lib/clothes.ts:622-657` |
| **기술 의존성** | Supabase DB |
| **우선순위** | 02: P1(추천 정확도와 직결) / 04: P1(휴면 의류 지표의 기반) / 03·05: P2 |

---

## 10. AI Image Analysis

| 필드 | 내용 |
|---|---|
| **ID** | FR-AI-01 ~ 07 |
| **목적** | 옷 사진을 추천엔진이 쓸 수 있는 구조화 속성으로 바꾼다 |
| **사용자 가치** | 사용자는 잘못된 값만 고치면 된다 [BP] |
| **상세 요구사항** | **01** 대표 의류 1벌 선택 + 속성 9종 + box_2d(유지) · **02** 응답 형식 강제(유지) · **03** 일시 오류 재시도와 한도 초과 안내(유지) · **04** category ↔ subCategory 일관성 검증 · **05** 분석 요청 타임아웃 · **06** 저장 전 9개 속성 모두 수정 가능(season, tpo, colorTone 추가) · **07** 사용자 수정 이력 기록(정확도 측정용) |
| **입력** | 이미지 base64, (향후) MIME 타입 |
| **처리 로직** | 백엔드에서 Gemini 호출(responseSchema enum) → 좌표 보정 → 앱에 반환 → 사용자 수정 |
| **출력** | `ClothingAnalysis` {category, subCategory, color, colorTone, fit, material, season[], tpo[], style[], box2d, mask} (`src/types/index.ts:105-117`) |
| **AC** | ① `top` + `sneakers` 같은 불일치 응답은 저장 전에 보정되거나 사용자에게 확인을 요청한다 ② 정해진 시간 안에 응답이 없으면 재시도 안내를 표시한다(시간값 [제안] 30초, 합의 필요) ③ 9개 속성 모두 수정 UI가 있다 ④ 사용자가 바꾼 필드와 원래 AI 값이 이벤트로 기록된다 ⑤ 익명 세션 사용자의 분석 호출은 SEC-02의 익명 한도를 넘으면 429와 가입 안내를 받는다 |
| **현재 상태** | 01·02·03 Implemented / 04·05·06·07 Planned |
| **관련 코드** | `backend/server.js:113-174,182-550`, `src/app/analyze.tsx:55-210` |
| **기술 의존성** | Gemini API(모델은 환경변수 `GEMINI_MODEL`, 무료 등급 하루 20회 주석 `server.js:111`. 실제 모델·요금 등급은 미확인). Phase 2 진입 전 유료 등급 전환과 호출량 산정 필요(NFR-05, SEC-11, AC-G7) |
| **우선순위** | 05: P0(Phase 1A) / 07: P1(Phase 1B, 정확도 지표) / 04·06: P1(Phase 2) |

**정확도 지표 [제안]:** 속성별 사용자 수정률 = 수정된 필드 수 ÷ 분석된 필드 수. 현재 측정값 없음.

---

## 11. Fashion Knowledge Dataset

| 필드 | 내용 |
|---|---|
| **ID** | FR-DS-01 ~ 08 |
| **목적** | 추천 점수의 근거를 코드 상수가 아니라 관리 가능한 데이터로 옮긴다. Core를 구성 요소로 분해한다 [BP]. 점수가 **맞는지** 판정할 기준(평가 세트)을 만든다 |
| **사용자 가치** | 추천 이유가 의상학 근거를 가진다. 트렌드가 바뀌어도 추천이 따라간다 |
| **상세 요구사항** | **01** 조합 규칙 테이블: 색상 쌍, 소재 쌍, 핏 볼륨, 계절, TPO 규칙과 점수·출처 · **02** Core 정의 테이블: Core별 Color, Pattern, Material, Silhouette, Item, Detail 구성 요소와 가중치 [BP]. Phase 2는 대표 Core 2~3개만(FR-CORE-07), Phase 3에서 확장 · **03** 버전 관리(`dataset_version`)와 추천 결과에 버전 기록 · **04** 비개발자(대표자)가 수정 가능한 관리 방식 · **05** Dynamic 갱신: 트렌드 데이터로 Core 정의 업데이트 절차 [BP] · **06** **추천 품질 평가 세트(golden set)**: 실제 의류 속성으로 구성한 코디 N개(N은 [제안] 30개 내외, 확정 필요)에 대해 대표자(의상학 기준)가 순위·적합/부적합을 매긴 데이터 [BP Q8 "자체 평가 데이터셋"을 요구사항화] · **07** **최소 스키마**: 규칙 행은 `rule_id`, `target_attribute`, `value_a`, `value_b`(쌍 규칙일 때), `score`, `rationale`(근거), `source`(출처), `dataset_version` / Core 행은 `core_id`, `component`(Color·Pattern·Material·Silhouette·Item·Detail), `value`, `weight`, `rationale`, `dataset_version` · **08** **임계값 출처**: Missing Item·Wardrobe Decision이 쓰는 임계값(조합 가능, 궁합 부족, 중복)은 Dataset 항목으로 정의하고, 값은 06 평가 세트와 Phase 2 Concierge 판정 기록으로 정한다 |
| **입력** | 의상학 규칙(대표자 작성), 트렌드 자료, 평가 세트 판정 |
| **처리 로직** | Dataset → 앱/서버 로드 → 점수 엔진(12장)이 참조 / 평가 세트 → 점수 엔진 순위와 비교 → 일치도 보고 |
| **출력** | 규칙 값, Core 정의, 임계값, 버전, 평가 보고(일치도) |
| **AC** | ① `outfitScore.ts`의 `WEIGHTS`, `MATERIAL_PAIRS`, `FIT_VOLUME`, 색상 점수표가 Dataset에서 로드된다 ② 규칙 하나를 바꾸면 코드 배포 없이 점수가 바뀐다 ③ 모든 규칙·Core 행에 07의 필수 필드(`rationale`, `source` 포함)가 채워져 있다 ④ POETCORE 외 최소 1개 Core가 Dataset으로 정의되어 동작한다 ⑤ **품질 AC:** 평가 세트에서 점수 엔진 순위와 대표자 순위의 일치도(예: 순위 상관계수)를 계산하는 스크립트·절차가 있고, 결과가 `dataset_version`·`score_version`과 함께 기록된다 ⑥ 일치도 **기준값은 [가설]**이며 Phase 1B 첫 측정 결과(기준선)를 보고 Phase 2 진입 전에 확정한다 ⑦ FR-MISS·FR-WDM AC의 "임계값"은 모두 08의 Dataset 항목 ID로 참조된다 |
| **현재 상태** | **Planned**. 규칙은 코드 상수로 존재(`src/utils/outfitScore.ts:51-97`, `src/utils/recommendation.ts:22-100`). Core는 데모 고정값(`src/data/coreDemo.ts`). `.numbers` 파일은 코드와 연결 없음. 평가 세트 없음 |
| **관련 코드** | 위와 같음 |
| **기술 의존성** | 저장소(Supabase 테이블 또는 버전 관리 JSON). 결정 필요: OQ-06 |
| **우선순위** | 06·07: **P1(Phase 1B)** — 점수 통합과 품질 기준의 전제 / 02(Core 2~3개 범위): P1(Phase 2) / 08: P1(Phase 2, 값 확정은 Phase 2 결과로) / 01·03·04: P1(Phase 3) / 05: P2 |

> 사업계획서는 "Fashion Knowledge Dataset으로 구조화"하고 "자체 평가 데이터셋을 구축"했다고 서술한다(Q8). 코드에서는 연결이 확인되지 않으므로 **Planned**로 분류한다. `.numbers` 파일의 내용은 이번 작업에서 열어보지 않았다(OQ-07).
>
> 평가 세트(06)는 "추천 정확도"를 **측정하는 도구**다. 측정 전에는 어떤 정확도 수치도 성과로 적지 않는다.

---

## 12. Styling Recommendation Engine

| 필드 | 내용 |
|---|---|
| **ID** | FR-REC-01 ~ 06 |
| **목적** | 보유 의류로 입을 수 있는 코디를 만들고 순위를 매긴다 |
| **사용자 가치** | 내 옷으로 바로 입을 수 있는 코디를 받는다 |
| **상세 요구사항** | **01** 단일 추천 엔진: 후보 생성 → 하나의 점수 함수로 평가 → 정렬 · **02** First Look: 등록한 옷이 적어도 코디 1개를 보여준다 [BP] · **03** Top 3 Look: 서로 다른 코디 3개 [BP] · **04** 코디 전체의 상호 궁합 평가(기준 옷과의 1:1 비교만 하지 않음) · **05** 코디 저장 / 스킵 / "오늘 입음" 액션의 **노출 위치**(Styling·Looks). 기록 정의는 FR-DATA-03 · **06** 같은 입력이면 같은 결과(결정적, deterministic) |
| **입력** | Closet 전체, 선택한 옷(선택적), 날씨(선택적), Core(선택적), 사용자 가중치(Phase 3) |
| **처리 로직** | 카테고리 조합 계획으로 후보 생성 → 통합 Match Score(13장) → 완성도·약점 보정 → 상위 N개 |
| **출력** | `Look { items[], matchScore, subScores, reasons[], missingCategories[] }` |
| **AC** | ① Styling의 베스트 코디와 Looks의 1위가 같다 ② 옷 2벌(상의 1 + 하의 1)만 있어도 First Look이 표시된다 ③ Top 3는 아이템 조합이 서로 다르다 ④ 저장한 코디가 계정에 남고 다시 볼 수 있다 ⑤ 같은 옷장으로 두 번 호출하면 같은 순위가 나온다(단위 테스트) |
| **현재 상태** | **Partial**. 엔진 A(`recommendation.ts`)가 아이템을 고르고 엔진 B(`outfitScore.ts`)가 점수를 표시함(`src/app/styling.tsx:70-76`). Top 3 Implemented(`outfitScore.ts:507-657`). First Look Partial(`src/app/index.tsx:53-60`). 05 Planned |
| **관련 코드** | `src/utils/recommendation.ts`, `src/utils/outfitScore.ts`, `src/app/styling.tsx`, `src/app/looks.tsx`, `src/app/index.tsx` |
| **기술 의존성** | FR-DS(규칙 데이터), FR-DATA(저장·스킵 기록) |
| **우선순위** | 01·06: **P0(Phase 1B)**(신뢰성 문제) / 05: P1(Phase 1B, 핵심 지표 측정 전제) / 02·03: P1(Phase 2) / 04: P1(Phase 3) |

---

## 13. Match Score & Explainability

### 13.1 현재 점수 체계 [CODE][AUDIT §9]

| 엔진 | 위치 | 방식 | 쓰이는 곳 |
|---|---|---|---|
| A | `src/utils/recommendation.ts:102-169` | 계절 25 + 스타일 25 + TPO 20 + 색 10~20 + 카테고리 0~10 | Styling 아이템 선택, Missing, Today(기본 점수) |
| B | `src/utils/outfitScore.ts:434-491` | 6개 지표 가중합(Color .22, Fit .16, Material .14, Season .20, TPO .18, Preference .10) × 완성도 × 약점 감점 | Styling 점수 표시, Looks |
| C | `src/utils/weatherRecommendation.ts:320-415` | 엔진 A 점수 × 0.7 + 날씨 적합도 × 0.3 | Home, Today |
| D | `src/utils/prototypeCore.ts` | 데모 Core 규칙 비교 | Core 화면 |
| E | `src/app/shop.tsx:64-90` | subCategory 40 + color 35 + style 25 | Shop |

### 13.2 요구사항

| 필드 | 내용 |
|---|---|
| **ID** | FR-SCORE-01 ~ 06 |
| **목적** | 모든 화면이 같은 의미의 점수를 쓰고, 점수마다 이유를 보여준다 |
| **사용자 가치** | 점수를 믿을 수 있다. 왜 추천됐는지 이해한다 |
| **상세 요구사항** | **01** 점수 통합: **Outfit Match Score**(코디 자체의 조화) 하나로 정의 · **02** 맥락 점수는 별도 표시하고 합치는 규칙을 명시: **Weather Fit**(날씨), **Core Fit**(지향 스타일) · **03** 하위 지표 6종: Color, Fit·Silhouette, Material, Season, TPO, Preference를 0~100으로 표시 · **04** 이유 문장은 실제 계산된 하위 지표에서만 생성 · **05** Preference는 Phase 3 전까지 "옷장 분포 기반"임을 UI나 도움말에 명시 · **06** 점수 계산 버전(`score_version`)을 로그에 기록 |
| **입력** | Look의 items, Closet, 날씨(선택), Core(선택), Dataset 규칙 |
| **처리 로직** | `OutfitMatch = Σ(w_i × sub_i) × 완성도 × 약점보정`. **Phase 1B 최소 범위:** 엔진 B(`outfitScore.ts`) 정의를 모든 화면의 Outfit Match Score로 쓰고, Weather Fit·Core Fit은 합산하지 않고 **별도 표시**만 한다. **Phase 3:** 평가 세트(FR-DS-06) 근거가 생기면 `Final = OutfitMatch × (1-α-β) + WeatherFit × α + CoreFit × β`의 α·β를 Dataset에 정의 [제안] |
| **출력** | `{ matchScore, subScores[6], weatherFit?, coreFit?, reasons[], scoreVersion }` |
| **AC** | ① 같은 코디는 Styling·Looks·Today에서 같은 Outfit Match Score를 보인다 ② Today에서 날씨 반영 점수를 보일 때 "날씨 반영" 표시와 함께 Weather Fit 값이 따로 나온다 ③ 모든 이유 문장이 점수 기준 상위 하위 지표와 일치한다(단위 테스트) ④ 엔진 A의 1:1 이분법 점수(겹치면 25, 아니면 0)는 아이템 선택에 쓰이지 않는다 |
| **현재 상태** | **Partial**. 6개 지표와 이유 표시는 B에 Implemented(`outfitScore.ts:450-491`, `src/components/styleseed/score-bars.tsx`). 통합은 Planned |
| **관련 코드** | 13.1 표 |
| **기술 의존성** | FR-DS-01 |
| **우선순위** | 01·02(별도 표시)·04: **P0(Phase 1B)**(제품 원칙 3 "설명 가능한 점수" 위반 상태) / 03·05·06: P1(Phase 1B) / 02의 α·β 합산: P2(Phase 3) |

---

## 14. Core / Aesthetic Recommendation

| 필드 | 내용 |
|---|---|
| **ID** | FR-CORE-01 ~ 07 |
| **목적** | 사용자가 되고 싶은 스타일(Core)을 내 옷장으로 먼저 구현한다 [BP] |
| **사용자 가치** | 새 옷 없이 원하는 무드를 시도한다 |
| **상세 요구사항** | **01** Core 선택(복수 가능 여부는 OQ-08) · **02** 아이템별 Core Fit(0~100)과 근거(어떤 구성 요소가 맞는지) · **03** Core Look: Outfit Match와 Core Fit을 함께 고려한 코디 · **04** Core 기준 부족 요소를 Missing Item으로 연결(이 항목이 정의 원본이며 FR-MISS-06은 이 항목을 참조) · **05** Core 정의는 Dataset에서 로드(FR-DS-02) · **06** 사용자가 선택한 Core를 계정에 저장 · **07** **Phase 2 Core PoC** (아래 14.1) |
| **입력** | Core ID, Closet, Core 정의(Dataset) |
| **처리 로직** | 아이템 속성 ↔ Core 구성 요소 비교 → Core Fit → 후보 코디에 Final 점수(13.2) 적용 |
| **출력** | 아이템 순위, Core Look, Core 기준 Missing |
| **AC** | ① Dataset에 정의된 Core는 모두 선택 가능하다(현재는 POETCORE만 가능) ② 아이템마다 Core Fit과 일치 요소(예: "Wool · Brown")가 표시된다 ③ 선택한 Core가 재로그인 후에도 유지된다 ④ Core Look의 Missing Item이 Shop/Wardrobe Decision으로 이어진다 |
| **현재 상태** | **Mock**. "영상 촬영용 UI prototype 고정 규칙, ML 아님"(`src/data/coreDemo.ts:8-14`). 데모에서는 POETCORE만 `availableInDemo: true`. Core 점수는 저장하지 않음(`src/utils/prototypeCore.ts:16`) |
| **관련 코드** | `src/app/ideal-style.tsx`, `core-match.tsx`, `core-look.tsx`, `core-shop.tsx`, `src/utils/prototypeCore.ts`, `src/data/coreDemo.ts` |
| **기술 의존성** | FR-DS-02, FR-SCORE-02, FR-MISS |
| **우선순위** | 07: **P1(Phase 2)** / 01~06 전체 확장: P1(Phase 3) |

> **데모와 기능의 구분.** 현재 Core 화면(`coreDemo.ts`, `prototypeCore.ts`)은 영상 촬영용 고정 규칙이다. 사용자 옷장과 무관한 데모 추천이나 Core 소개 화면은 **개인화 기능으로 간주하지 않으며, Phase 2 Core 검증 결과로도 집계하지 않는다.** Beta에 노출하더라도 "데모" 표기를 유지하거나 PoC 화면으로 대체한다.

### 14.1 Phase 2 Core PoC (FR-CORE-07)

| 필드 | 내용 |
|---|---|
| **ID** | FR-CORE-07a ~ 07e |
| **목적** | Ideal Fashion Self 가치가 **실제 보유 의류**로 성립하는지 작은 범위에서 검증한다 |
| **사용자 가치** | 내가 가진 옷으로 원하는 Core 무드를 만들 수 있는지 확인한다 |
| **범위 제한** | 대표 Core **2~3개**(선정은 OQ-25). Core 선택은 1개 [제안]. 개인 가중치 학습·트렌드 갱신·전체 Core 목록은 제외 |
| **상세 요구사항** | **07a Core별 패션 속성 정의:** 선정한 Core마다 Color·Pattern·Material·Silhouette·Item·Detail 구성 요소와 가중치·근거를 FR-DS-07 스키마로 작성 · **07b 보유 의류 ↔ Core 속성 매칭:** 사용자 `clothes` 속성과 Core 구성 요소를 비교해 아이템별 Core Fit(0~100)과 일치 요소 산출 · **07c 실제 보유 의류 기반 코디 생성:** 사용자 옷장에서만 아이템을 골라 Core Look 1~3개 생성. Outfit Match Score(FR-SCORE-01)와 Core Fit을 **별도 표시** · **07d Core 적합도 설명:** "어떤 구성 요소가 맞고 무엇이 부족한지"를 계산된 값에서만 문장으로 생성 · **07e 만족도·지향 스타일 구현 측정:** Core Look 노출 후 만족도(5점 척도)와 "이 코디가 내가 원하는 Core에 가깝다"(5점 척도) 응답 수집, 저장·스킵 이벤트 기록 |
| **입력** | 선택한 Core ID, 사용자 Closet, Core 정의(07a) |
| **처리 로직** | Core 정의 로드 → 아이템별 Core Fit → Core Fit 상위 아이템으로 후보 코디 → Outfit Match로 정렬 → 상위 1~3개 + 설명 → 응답 수집 |
| **출력** | Core Fit 순위, Core Look, 일치·부족 요소 설명, 만족도 응답 |
| **AC** | ① 선정한 Core 2~3개 모두 07a 정의가 FR-DS-07 필수 필드를 채운다 ② Core Look의 모든 아이템이 해당 사용자의 `clothes` 행이다(데모·Mock 아이템 0개) ③ 같은 Core라도 옷장이 다른 두 테스트 계정은 서로 다른 Core Look을 받는다 ④ 설명 문장의 일치 요소가 실제 계산된 Core Fit 근거와 일치한다(단위 테스트) ⑤ 옷장이 Core를 구성하기에 부족하면 "부족한 요소"를 보여주고 코디를 억지로 만들지 않는다 ⑥ `core_selected`, `core_look_view`, `core_look_rating`, `look_saved`(source: core) 이벤트가 기록된다 |
| **측정 [가설]** | Core 선택률, Core Look 저장률, 만족도·지향 스타일 구현 응답 분포. 목표값은 Phase 2 진입 전 확정(OQ-24) |
| **현재 상태** | Planned(데모만 존재) |
| **관련 코드** | 재사용 후보: `src/utils/prototypeCore.ts`(비교 로직 구조), `src/utils/outfitScore.ts`(Outfit Match), `src/app/core-match.tsx`, `src/app/core-look.tsx`(화면 골격) |
| **기술 의존성** | FR-DS-02(2~3개 범위), FR-DS-07, FR-SCORE-01, FR-DATA-01 |
| **우선순위** | P1(Phase 2) |

---

## 15. Today's Look

| 필드 | 내용 |
|---|---|
| **ID** | FR-TODAY-01 ~ 07 |
| **목적** | 매일 앱을 열 이유를 만든다 [BP] |
| **사용자 가치** | 오늘 날씨에 맞는 내 옷 코디를 바로 받는다 |
| **상세 요구사항** | **01** 위치 기반 현재 날씨(유지) · **02** 날씨 부적합 아이템 제외 + Weather Fit 반영(유지) · **03** 권한 거부·위치 오류·날씨 오류 처리(유지) · **04** 저장 / 다른 코디 보기(셔플) / "오늘 입음" 액션의 노출(기록 정의는 FR-DATA-03) · **05** 같은 날 같은 1순위 유지 또는 "다른 코디" 요청 시에만 변경 · **06** (Planned, BP) '오늘의 시드', 안 입는 옷 살리기, 옷장 셔플, 주간 옷장 활용도. Phase 3에서 Phase 2 데이터를 보고 **1개만** 먼저 고른다 · **07** **재방문 트리거 결정:** Phase 2 진입 전에 (a) 운영자가 수동 메시지(예: 메신저)로 매일 Today's Look 링크를 보내는 방식 또는 (b) 로컬 알림 1종 중 하나를 정한다(OQ-23). 선택한 방식은 7일 재방문율 해석에 반드시 함께 기록한다 |
| **입력** | 위치, Open-Meteo 응답, Closet |
| **처리 로직** | 기온 구간과 날씨 종류로 규칙 결정 → 부적합 아이템 제외(적합도 < 40) → 코디 생성 → 최종 점수(현재 70:30) |
| **출력** | `TodayLook[]`(최대 3개), 날씨 요약 |
| **AC** | ① 위치 권한을 거부해도 날씨 없이 코디가 표시된다 ② 비 오는 날 샌들·힐이 1순위 코디에 없다(`weatherRecommendation.ts:167`) ③ "오늘 입음"을 누르면 각 아이템의 착용 기록이 생긴다 ④ 점수 표기가 FR-SCORE-02 규칙을 따른다 |
| **현재 상태** | 01·02·03 **Implemented** / 04·05·06 Planned |
| **관련 코드** | `src/lib/weather.ts`, `src/store/useWeatherStore.ts`, `src/utils/weatherRecommendation.ts`, `src/app/today.tsx`, `src/components/styleseed/today-look-card.tsx` |
| **기술 의존성** | Open-Meteo, expo-location, FR-DATA(착용 기록) |
| **우선순위** | 04·05·07: P1(Phase 2, 7일 재방문율 가설의 핵심) / 06: P2(Phase 3) |

> 재방문 트리거가 없으면 Beta의 7일 재방문율은 "Today's Look의 가치"가 아니라 "알림 없는 앱을 기억해 다시 여는지"를 측정하게 된다. 그래서 07은 새 기능 추가가 아니라 **측정 조건의 결정**으로 다룬다.

---

## 16. Missing Item Detection

| 필드 | 내용 |
|---|---|
| **ID** | FR-MISS-01 ~ 06 |
| **목적** | 옷장만으로 완성되지 않는 코디의 빈자리를 정확히 찾는다 |
| **사용자 가치** | "무엇이 부족한지"를 알고 필요한 것만 산다 |
| **상세 요구사항** | **01** 카테고리 부재 탐지(유지) · **02** 궁합 부재 탐지: 카테고리는 있으나 Outfit Match가 임계값(Dataset 항목 `threshold.missing_match`, FR-DS-08) 미만이면 부족으로 판정 · **03** 아우터·가방·액세서리를 탐지 대상에 포함할지 규칙화(OQ-09). 현재 코드에서 가방·액세서리는 조합 계획(`recommendation.ts:186-202`)과 Today's Look 후보에서 빠져 있어 Missing Item 경로로 노출되지 않는다 · **04** 부족 아이템 여러 개 + 우선순위 · **05** 제안 속성은 Dataset 규칙과 옷장 맥락으로 생성(고정 템플릿 대체) · **06** Core 기준 Missing — FR-CORE-04 참조(중복 정의하지 않음) |
| **입력** | Look, Closet, Dataset, (선택) Core |
| **처리 로직** | 조합 계획 대비 빈 카테고리 + 낮은 궁합 슬롯 → 슬롯별 이상적 속성 계산 → 우선순위 |
| **출력** | `MissingItem[] { category, subCategory, color, style, reason, expectedScoreGain }` |
| **AC** | ① 하의는 있으나 모두 궁합이 `threshold.missing_match` 미만이면 하의가 Missing으로 표시된다(임계값 값 자체는 FR-DS-08 절차로 확정) ② 부족 아이템이 2개 이상이면 모두 목록으로 보인다 ③ 각 Missing에 "추가하면 점수가 X → Y" 근거가 있다 ④ 옷장에 이미 같은 subCategory·color가 있으면 Missing으로 제안하지 않는다 |
| **현재 상태** | 01 **Implemented** / 나머지 Planned. 현재 제안은 고정 템플릿(`src/utils/recommendation.ts:308-415`), 첫 번째 부족 카테고리만 표시(`src/app/styling.tsx:78-82`) |
| **관련 코드** | `src/utils/recommendation.ts:186-280,308-415`, `src/app/missing.tsx` |
| **기술 의존성** | FR-SCORE-01, FR-DS-01, FR-DS-08 |
| **우선순위** | 02·04: P1(Phase 2) / 05: P1(Phase 3) / 03: P1(Phase 4 진입 조건과 연결, 28장) / 06: FR-CORE-04 참조 |

---

## 17. Wardrobe Decision Module

사업계획서가 **핵심 유료 기능**으로 정의한 모듈이다 [BP].

| 필드 | 내용 |
|---|---|
| **ID** | FR-WDM-01 ~ 07 |
| **목적** | 구매 직전에 "살 것인가, 말 것인가"를 판단할 근거를 제공한다 |
| **사용자 가치** | 충동구매와 중복 구매를 줄인다 |
| **상세 요구사항** | **01 Wardrobe Compatibility:** 후보 상품과 Outfit Match가 임계값(`threshold.compatible`, FR-DS-08) 이상인 보유 의류 수 · **02 Outfit Unlock Score:** 후보 상품을 추가했을 때 새로 생기는 유효 코디 수 · **03 Duplication Check:** 속성 유사도가 임계값(`threshold.duplicate`, FR-DS-08) 이상인 보유 의류 목록 · **04** 판정: BUY / CONSIDER / SKIP과 근거 문장 · **05** 입력 경로: ① 사용자가 올린 구매 후보 사진·스크린샷(Phase 2, 기존 AI 분석 재사용) ② Missing Item 상품 ③ Catalog 상품(Phase 4) · **06** PLUS 과금 경계(OQ-10, Phase 5) · **07** **Phase 2 가치 검증** (아래 17.1) |
| **입력** | 후보 상품 속성(Catalog 또는 AI 분석), Closet, Dataset |
| **처리 로직** | (01) 각 보유 의류와의 궁합 계산 → 임계값 이상 개수 / (02) 상품을 포함한 후보 코디 생성 → 유효 코디 중 기존에 없던 것 개수 / (03) category·subCategory·color·colorTone·fit·material 유사도 / (04) 세 지표의 규칙 기반 판정 |
| **출력** | 예: "현재 옷장 42벌 중 15벌과 조합 가능, 새로운 코디 12개, 유사 상품 1개 보유" [BP 예시] + 판정 |
| **AC** | ① 세 지표가 같은 Outfit Match 정의(FR-SCORE-01)를 쓴다 ② 옷장에 똑같은 속성의 옷이 있으면 Duplication Check가 해당 옷을 보여준다 ③ 같은 입력이면 같은 결과가 나온다 ④ 판정 규칙과 임계값이 Dataset에 기록되어 있다 ⑤ 판정마다 근거 문장이 1개 이상 있다 |
| **현재 상태** | **Planned**(코드 없음) |
| **관련 코드** | 없음. 재사용 후보: `findBestMatch`(`src/utils/recommendation.ts:204`), `getRankedLooks`(`src/utils/outfitScore.ts:597`) |
| **기술 의존성** | FR-SCORE-01, FR-DS-08, FR-AI(사진·스크린샷 입력), FR-CAT(Phase 4 상품 속성) |
| **우선순위** | 07: **P1(Phase 2)** / 01~05 앱 내 기능화: P1(Phase 3, Phase 2 결과가 Go일 때) / Catalog 상품 연결: P1(Phase 4) / 06: Phase 5 |

> 임계값(궁합 몇 점 이상이면 "조합 가능"인지, 유사도 몇 이상이면 "중복"인지)은 근거 데이터가 없다. Phase 2 Concierge 판정 기록과 평가 세트(FR-DS-06)로 초안을 정하고, Phase 3에서 확정한다(OQ-11).

### 17.1 Phase 2 Wardrobe Decision 가치 검증 (FR-WDM-07)

**원칙:** 결제·Paywall·Catalog를 먼저 만들지 않는다. "옷장 기준 구매 판단"이 사용자의 결정을 바꾸고 돈을 낼 만한지부터 확인한다.

| 필드 | 내용 |
|---|---|
| **ID** | FR-WDM-07a ~ 07d |
| **목적** | Wardrobe Compatibility, Outfit Unlock Score, Duplication Check가 실제 구매 결정에 쓸모 있는지, 지불할 가치가 있는지 검증한다 |
| **검증 방식** | **단계 1 — Concierge Test(개발 0):** Beta 참가자가 구매를 고민 중인 상품의 스크린샷·링크를 보내면, 운영자(대표자)가 참가자의 실제 Digital Closet을 기준으로 세 지표와 BUY/CONSIDER/SKIP 판정을 수작업으로 작성해 전달한다. 계산은 기존 점수 엔진을 내부적으로 돌리거나 스프레드시트로 한다. **단계 2 — 제한된 프로토타입(선택):** 단계 1에서 이용 의사가 확인되면, 사진·스크린샷 업로드 → 기존 AI 분석 → 세 지표 → 판정을 보여주는 단일 화면을 만든다. 결제·과금 경계·Catalog 연결은 포함하지 않는다 |
| **상세 요구사항** | **07a 적합성 산출:** 후보 상품과 보유 의류 간 Compatibility(조합 가능 의류 수와 목록), Outfit Unlock(새로 생기는 코디 수와 예시 1~3개), Duplication(유사 보유 의류 목록)을 계산한다 · **07b 판정 기록:** 판정과 근거 문장, 사용한 임계값 초안을 건별로 기록한다(OQ-11의 근거 데이터) · **07c 구매 의사결정 변화 측정:** 판정을 보기 **전**과 **후**에 "살 것이다 / 고민 중 / 안 산다"를 묻고, 1~2주 뒤 실제 구매 여부를 자기 보고로 확인한다 · **07d 이용 의사·지불 의사 측정:** "다음 구매 때 다시 쓰겠다"(5점 척도), 그리고 FR-SUB-08 가격·가치 테스트 문항을 같은 참가자에게 묻는다 |
| **입력** | 후보 상품 스크린샷·링크·사진, 참가자의 `clothes` 데이터(참가자 동의 하에 운영자 열람) |
| **출력** | 건별 판정 리포트, 판정 전후 구매 의사, 후속 구매 여부, 이용·지불 의사 응답 |
| **AC** | ① 모든 판정이 참가자의 실제 보유 의류만으로 계산된다 ② 세 지표가 같은 Outfit Match 정의(FR-SCORE-01)를 쓴다 ③ 판정마다 근거 문장이 1개 이상 있다 ④ 판정 전후 의사 응답과 후속 구매 여부가 건별로 짝지어 기록된다 ⑤ 운영자가 참가자 옷장 데이터를 열람하는 범위와 목적이 Beta 동의서에 명시된다(SEC-08) |
| **측정 [가설]** | 판정 후 구매 의사가 바뀐 비율, SKIP 판정 후 실제 미구매 비율, 재이용 의사, 가격 제시 후 지불 의사 비율. 목표값과 Go/No-go 기준은 Phase 2 진입 전 확정(OQ-24) |
| **제외** | 인앱 결제, Paywall 잠금, Catalog 상품 연결, 무료/유료 경계 |
| **현재 상태** | Planned |
| **관련 코드** | 재사용 후보: `/analyze-clothing`(후보 상품 속성 추출), `findBestMatch`(`src/utils/recommendation.ts:204`), `getRankedLooks`(`src/utils/outfitScore.ts:597`) |
| **우선순위** | 단계 1: **P1(Phase 2)** / 단계 2: P2(Phase 2, 단계 1 결과에 따라) |

> 다른 쇼핑몰 스크린샷을 AI 분석에 넣을 때 상품 이미지 저작권·보관 문제가 생길 수 있다. Concierge 단계에서는 분석 후 이미지를 저장하지 않는 것을 기본으로 한다 [제안](OQ-20 법률 검토 범위에 포함).

---

## 18. Product Catalog & Commerce Integration

### 18.1 단계별 확장 경로 [BP]

```text
① 협력 의향 확보 (여성복 브랜드 2곳 + 주얼리 브랜드 1곳)   ← [BP] 현재 단계로 서술됨
② CSV · Feed PoC: 허가받은 상품 일부로 Catalog 구축, 공식 판매처 링크
③ Product Feed / API 자동 연동: 가격·재고·상품정보 자동 갱신
④ CPS 제휴: 구매 성과 추적과 정산
⑤ (장기) 파트너 관리 시스템: 브랜드가 직접 등록·수정
```

> **주의:** 브랜드 3곳은 "상품 연동 협력 의향" 단계로 서술되어 있다. 계약이나 데이터 이용 허가 여부는 이번 작업에서 확인하지 못했다(OQ-14). 실적으로 간주하지 않는다.

### 18.2 요구사항

| 필드 | 내용 |
|---|---|
| **ID** | FR-CAT-01 ~ 08 |
| **목적** | Mock 상품을 허가받은 실제 상품으로 바꾸고, 추천이 구매로 이어지는지 측정한다 |
| **사용자 가치** | 부족한 아이템을 실제로 살 수 있는 상품으로 확인한다 |
| **상세 요구사항** | **01** Catalog 스키마: 상품 ID, 브랜드, 이름, 가격, 이미지 URL, 상품 URL, STYLESEED 속성 9종, 출처, 갱신일, 판매 상태 · **02** CSV 수입(import) 도구(Phase 4 PoC) · **03** 상품 속성 태깅: 브랜드 제공 값 + AI 분석 + 검수 · **04** 공식 판매처 링크 이동 + 클릭 추적 · **05** Mock 상품 제거 또는 "샘플" 표기 유지 · **06** Feed/API 연동 어댑터(Phase 4 후반) · **07** CPS 추적 링크·전환 수신(계약 후) · **08** 품절·가격 변동 처리 |
| **입력** | 브랜드 CSV/Feed, Missing Item, Wardrobe Decision 결과 |
| **처리 로직** | 상품 수입 → 속성 정규화 → Missing·Core·Decision과 매칭 → 순위 → Deep Link |
| **출력** | 추천 상품 목록, 클릭 이벤트, (CPS) 전환 이벤트 |
| **AC** | ① CSV 한 파일을 올리면 Catalog에 상품이 생기고 앱에 표시된다 ② 상품 클릭 시 공식 판매처로 이동하고 `product_click` 이벤트가 남는다 ③ 판매 종료 상품은 추천에서 빠진다 ④ 상품 순위는 FR-SCORE-01과 사용자 옷장 궁합을 반영한다(현재 단순 속성 일치) ⑤ 브랜드별 데이터 이용 허가 범위가 기록되어 있다 |
| **현재 상태** | **Mock**: 하드코딩 16개, "Partner Brand C" 등 가상 브랜드(`src/data/mockProducts.ts:3-5`). 점수 40/35/25(`src/app/shop.tsx:64-90`). 링크·URL 필드 없음(`src/types/index.ts:79-103`) / 01~08 Planned |
| **관련 코드** | `src/data/mockProducts.ts`, `src/app/shop.tsx`, `src/app/core-shop.tsx`, `src/types/index.ts` |
| **기술 의존성** | Supabase 테이블(신규), 이미지 사용권, 제휴 네트워크(미정) |
| **우선순위** | 01·02·04: P1(Phase 4) / 03·05: P1(Phase 4) / 06·08: P2(Phase 4 후반) / 07 CPS: Phase 5 |

> **액세서리(주얼리) 노출 경로:** 현재 엔진은 가방·액세서리를 코디 조합 계획과 Today's Look 후보에서 제외한다(`src/utils/recommendation.ts:186-202`, `src/utils/weatherRecommendation.ts`). 따라서 주얼리 상품은 Missing Item → Shop 경로로 노출될 수 없다. Phase 4 진입 전에 노출 경로를 정한다(OQ-27, 28장 Phase 4 진입 조건).

---

## 19. STYLESEED PLUS & Monetization

### 19.1 사업계획서의 수익 모델 [BP]

| 구분 | 무료 | STYLESEED PLUS |
|---|---|---|
| 기능 | 옷 등록, AI 분석, Digital Closet, 보유 의류 기반 기본 코디, Missing Item 탐지 | 행동 기반 개인화 추천, Ideal Style 분석, Wardrobe Decision Module, (트렌드 코디) |
| 가격 | 0원 | **월 5,900원 / 연 59,000원** (검증 대상 초기 가격) |
| 보조 수익 | — | CPS 제휴 수수료(구매 확정 시) |

**사업계획서의 단위 경제 가정** (모두 **[BP] 가정값, 미검증**)
- 앱마켓 수수료 15% 가정 → 구독자 1인당 월 매출 약 5,015원
- Gemini 분석비 1벌당 약 2원. Supabase Pro 월 $25(100GB Storage, 10만 MAU 포함)
- 월 인프라 비용: MAU 1,000명 약 20만 원, MAU 5,000명 약 53만 원(보수적 가정)
- 손익분기 구독자: 약 40명(4%), 105명(2.1%)
- **초기 유료전환율 목표 5%**

> 코드 기준 비용 구조와의 차이: 사업계획서는 "Local segmentation으로 AI 호출비가 급증하지 않는다"고 하지만, 현재 코드는 SlimSAM이 실패하면 유료 BRIA API로 넘어간다(`src/lib/clothes.ts:383-417`). 실제 BRIA 사용 비율을 측정하기 전까지 비용 가정은 미검증이다(OQ-15).

### 19.2 요구사항

| 필드 | 내용 |
|---|---|
| **ID** | FR-SUB-01 ~ 08 |
| **목적** | 개인화와 구매 판단에 대한 지불 의사를 먼저 가격·가치 테스트로 확인하고, 그 결과가 충분할 때 실제 결제로 검증한다 |
| **사용자 가치** | 더 정교한 추천과 구매 판단을 쓸 수 있다 |
| **상세 요구사항** | **01** 무료/PLUS 기능 경계 정의(entitlement) · **02** Paywall 화면(진입 지점별 이벤트 기록) · **03** 인앱 결제(App Store / Google Play) 월·연 상품 · **04** 구독 상태 서버 검증과 기능 잠금·해제(SEC-13은 이 항목을 참조) · **05** 구독 해지·복원 · **06** 가격 실험(A/B 또는 기간별) 가능 구조 · **07** 결제·환불 고지(약관) · **08** **Phase 2 가격·가치 테스트**(아래) |
| **입력** | 사용자 ID, 스토어 영수증 |
| **처리 로직** | 결제 → 스토어 검증 → 사용자 entitlement 저장 → 기능 플래그 |
| **출력** | 구독 상태, Paywall 이벤트, 결제 이벤트 |
| **AC** | ① 무료 사용자가 PLUS 기능에 들어가면 Paywall이 뜨고 `paywall_view` 이벤트가 남는다 ② 결제 성공 후 앱을 다시 시작해도 PLUS 기능이 열려 있다 ③ 해지 후 만료일이 지나면 기능이 잠긴다 ④ 구독 상태는 서버에서 검증된다(클라이언트 값 신뢰 금지) |
| **현재 상태** | **Planned**(결제·구독 관련 코드와 의존성 없음) |
| **관련 코드** | 없음 |
| **기술 의존성** | 스토어 결제 SDK(선택 필요, OQ-16), 백엔드 인증(SEC-01) |
| **우선순위** | 08: **P1(Phase 2)** / 01~07: Phase 5 P1. **실제 결제 구현 시점은 08 결과로 결정한다**(OQ-17) |

#### FR-SUB-08. Phase 2 가격·가치 테스트

| 필드 | 내용 |
|---|---|
| **목적** | 실제 결제를 만들기 전에 PLUS 후보 기능(Wardrobe Decision, Core 기반 추천)의 가치와 가격 수용도를 확인한다 |
| **방식** | ① **인터뷰·설문:** Wardrobe Decision Concierge(FR-WDM-07)와 Core PoC(FR-CORE-07)를 경험한 참가자에게 "이 기능이 유료라면 쓰겠는가", 월 5,900원 / 연 59,000원 [BP 가격 가설] 제시 후 수용 여부, 너무 비싸다고 느끼는 가격 등을 묻는다 · ② **(선택) 가치 제안 화면:** 앱 안에 PLUS 소개와 가격을 보여주는 화면을 두고 "출시 알림 받기" 같은 의사 표시만 받는다. 결제 정보를 받지 않으며, 테스트 화면임을 참가자에게 고지한다 |
| **측정 [가설]** | 유료 이용 의사 비율, 가격 수용 비율, 기능별(WDM vs Core vs 개인화) 선호, (선택 ②) 가치 제안 화면 진입률·의사 표시율. 목표값과 Go/No-go 기준은 Phase 2 진입 전 확정(OQ-24) |
| **AC** | ① 응답이 참가자 ID·경험한 기능과 함께 기록된다 ② 가격 제시 문항이 모든 참가자에게 같은 문구로 제공된다 ③ (선택 ②) 결제 정보 입력 요소가 없고, `pricing_view`, `plus_interest` 이벤트가 기록된다 |
| **제외** | 인앱 결제, 구독 상태 관리, 기능 잠금 |
| **판정 활용** | 결과가 사전 기준을 넘으면 Phase 5에서 실제 결제(FR-SUB-01~07)를 구현한다. 못 넘으면 PLUS 구성·가격을 다시 설계하고 08을 반복한다 |

> 의향 응답은 실제 결제 행동보다 높게 나오는 경향이 있다. 따라서 08의 결과는 **결제 구현 여부를 정하는 근거**로만 쓰고, 유료전환율 성과로 보고하지 않는다.

---

## 20. User Data & Personalization

| 필드 | 내용 |
|---|---|
| **ID** | FR-DATA-01 ~ 06 |
| **목적** | 사용자 행동을 기록해 지표를 측정하고, 추천 가중치를 개인화한다 [BP] |
| **사용자 가치** | 같은 Core를 좋아해도 나에게 맞는 다른 추천을 받는다 [BP] |
| **상세 요구사항** | **01** 이벤트 수집: 24장 이벤트 목록 · **02** 코디 저장 테이블(`saved_looks`) · **03** 피드백 기록의 **정의 원본**: 저장 / 선택 / 스킵 / "오늘 입음" / 상품 클릭 [BP]. FR-REC-05·FR-TODAY-04는 노출 위치만 정하고 이 항목을 참조한다 · **04** 명시적 취향 입력(선호 Style, Fit, Color, TPO — 개발 문서 §36) · **05** 개인 가중치: 명시적 취향 입력과 피드백으로 하위 지표 가중치를 **규칙 기반**으로 보정(Phase 3). 학습 기반 개인화는 사용자 수가 충분해진 뒤 재검토 · **06** 데이터 열람·삭제 — 정의는 SEC-09 참조 |
| **입력** | 앱 이벤트, 사용자 설정 |
| **처리 로직** | 이벤트 → 저장소 → 집계(지표) / 취향 입력 + 피드백 → 규칙 기반 가중치 보정(OQ-18 결정) → FR-SCORE 입력 |
| **출력** | 지표 대시보드, 사용자별 가중치 |
| **AC** | ① 24장 필수 이벤트가 사용자 ID·시각·화면과 함께 기록된다 ② 저장한 코디가 다른 기기에서도 보인다 ③ (Phase 3) 같은 옷장을 가진 두 테스트 계정이 다른 피드백을 주면 Top 3 순위가 달라진다 ④ 사용자가 계정을 삭제하면 이벤트도 삭제 또는 익명화된다 |
| **현재 상태** | **Planned**. 이벤트 수집·코디 저장·취향 입력 코드 없음. 현재 "Preference"는 옷장 분포로 계산(`src/utils/outfitScore.ts:306-367`) |
| **관련 코드** | (재사용) `src/utils/outfitScore.ts:51-58` `WEIGHTS` |
| **기술 의존성** | 이벤트 저장소(Supabase 테이블 또는 분석 도구, OQ-19), SEC-04 |
| **우선순위** | 01·02·03: **P0(Phase 1B)**(측정 없이는 Beta 검증 불가) / 04·05: P1(Phase 3) / 06: SEC-09 참조 |

---

## 21. Technical Requirements

| ID | 요구사항 | 현재 [CODE] | 우선순위 |
|---|---|---|---|
| TR-01 | 백엔드 주소를 환경변수로 설정(`EXPO_PUBLIC_API_URL` 등) | `localhost:3001` 고정(`src/lib/clothes.ts:11`, `src/app/analyze.tsx:151`) | **P0(1A)** |
| TR-02 | 백엔드 배포 환경(HTTPS) 구성 | 로컬 실행만 | **P0(1A)** |
| TR-03 | 이미지 처리 작업 큐(비동기) 또는 별도 워커 | 저장 요청 안에서 동기 실행 | P1(Phase 2 이후, FR-UPL-04와 함께) |
| TR-04 | SlimSAM 모델 사전 로딩(warm-up) | 첫 요청 때 로딩(`backend/server.js:84-109`) | P1(1B) |
| TR-05 | DB 스키마·RLS·Storage 정책을 SQL 마이그레이션으로 저장소에 기록 | **기록 완료(2026-10-17):** `supabase/migrations/20261017000000_baseline_clothes_rls_storage.sql`. 실제 DB 정의를 그대로 옮긴 기록용 파일이며 DB에 적용하지 않음. 마이그레이션 이력 등록(`migration repair`)은 미실행 | **P0(1A)** |
| TR-06 | 점수 엔진 단일화(`src/utils` 정리). 1B 최소 범위는 FR-SCORE-01 처리 로직 참조 | 4개 엔진 혼재 | **P0(1B)** |
| TR-07 | 자동화 테스트: 점수 엔진 단위 테스트(1B 필수), 핵심 흐름 E2E(이후) | 0개 | P1(1B) |
| TR-08 | 쓰이지 않는 코드 제거 또는 기능 플래그화(FR-UPL-06 포함, 이 항목이 정의 원본) | fal SAM2, Gemini mask, 템플릿 탭 | P2 |
| TR-09 | 오류 모니터링(크래시·API 오류 수집) | `console`만 | P1(1B) |
| TR-10 | 신규 테이블: `saved_looks`, `events`, `products`, `user_preferences`, `subscriptions`, `dataset_*` | 없음 | Phase별 |
| TR-11 | Expo SDK 57 공식 문서 기준 준수(`AGENTS.md`) | — | 상시 |
| TR-12 | **Beta 배포 채널:** iOS(TestFlight 등)·Android(Google Play 내부 테스트 등) 중 OQ-03에서 정한 플랫폼으로 참가자에게 앱을 배포하는 경로와 빌드 절차 | 없음 | **P0(Phase 2 진입 조건)** |
| TR-13 | **서버 관리자 권한 엔드포인트:** 계정 삭제(SEC-09) 등 Supabase 관리자 권한(service role)이 필요한 작업을 인증된 백엔드에서만 수행. 관리자 키는 서버에만 보관(SEC-07) | 없음 | **P0(1A)** |

---

## 22. Security & Privacy Requirements

> **출시 차단 요건(Release Blocker).** 이 장의 P0 항목은 기능의 매력도와 관계없이 **외부 사용자를 받기 전(Phase 2 진입 전)** 모두 충족해야 한다. 인증·RLS·서버 보호·AI 호출 제한은 **Phase 1A**, Beta 동의·제3자 고지는 늦어도 **Phase 2 진입 전**에 완료한다.

| ID | 요구사항 | 근거 [CODE/AUDIT] | AC | 상태 | 우선순위 |
|---|---|---|---|---|---|
| **SEC-01** | 백엔드 모든 엔드포인트에 Supabase JWT 인증. **정식 계정 토큰 또는 익명 세션 토큰(FR-AUTH-07)**을 요구한다. 가입 전 분석 체험은 익명 토큰으로 허용하되 SEC-02 익명 한도를 적용한다. 허용 Origin 외 요청 차단 | 인증 없음, `cors()` 전체 허용(`backend/server.js:14`). 가입 전 분석 흐름 존재(`src/app/analyze.tsx:282-286`) | ① 토큰 없는 요청은 401 ② 익명 토큰은 `/analyze-clothing`만 익명 한도까지 허용, 이미지 저장·분리 엔드포인트는 403 ③ 정식 계정 토큰은 사용자 한도까지 허용 | Planned | **P0(1A)** |
| **SEC-02** | 사용량 제한(rate limit)과 AI 호출 한도: 익명 세션별·기기/IP별·정식 사용자별로 하루 한도를 분리. 한도 값은 OQ-04 | 없음 | 한도 초과 시 429 + 안내(익명 사용자는 가입 안내 포함) | Planned | **P0(1A)** |
| **SEC-03** | SSRF 차단: `imageUrl`은 Supabase Storage 도메인만 허용 | 검증 없이 서버가 요청(`backend/server.js:615,680,744,847`) | 외부·내부 IP URL 요청은 400 | Planned | **P0(1A)** |
| **SEC-04** | `clothes` RLS: SELECT/INSERT/UPDATE/DELETE 모두 `auth.uid() = user_id` | **[1A-02 확인]** RLS 켜짐. 정책 4종 모두 `authenticated` 대상, `(select auth.uid()) = user_id`(추가·수정은 `with check` 포함). anon 정책 없음. 클라이언트 쿼리에는 `user_id` 조건 없음(`src/lib/clothes.ts:495-500,622-652`), 즉 RLS 단일 방어 | 테스트 계정 2개로 교차 조회·삭제 시 0건(**동작 테스트 미완료**). 익명 세션으로 `clothes` 쓰기 시 0건(**현재 정책으로는 미충족**: 익명 로그인 활성화 전 restrictive 정책 필요) | 정책 확인 / 동작 테스트 미완료 | **P0(1A)** |
| **SEC-05** | Storage 정책: 경로 첫 폴더 = `auth.uid()`, 버킷 비공개 | 경로를 클라이언트가 결정(`src/lib/clothes.ts:96,130,310,327`). **[1A-02 확인]** 버킷 `public = false`, Storage 정책 4종이 버킷 일치 + `(storage.foldername(name))[1] = auth.uid()` 조건. 버킷 크기·MIME 제한 없음(AUDIT S-7, 보류) | 다른 사용자 폴더로 업로드·조회 시 거부(**동작 테스트 미완료**) | 정책 확인 / 동작 테스트 미완료 | **P0(1A)** |
| **SEC-06** | 요청 본문 크기 축소(현재 50MB) | `backend/server.js:22-26` | 기준 초과 요청은 413 | Planned | **P0(1A)** |
| **SEC-07** | 비밀값 서버 보관 유지, 클라이언트에는 Publishable key만 | 현재 준수(`.gitignore:34`, `src/lib/supabase.ts`) | 앱 번들에서 서버 키 문자열 0건 | Implemented | P0(1A 유지 확인) |
| SEC-08 | 개인정보 처리방침·이용약관 화면과 동의. Beta 참가 동의서에는 운영자의 옷장 데이터 열람 범위(FR-WDM-07 Concierge)를 포함 | 없음 | 가입 시 동의 기록 | Planned | **P0**(Phase 2 진입 전) |
| SEC-09 | 계정 삭제 시 DB·Storage·이벤트 일괄 삭제(FR-AUTH-05·FR-DATA-06의 정의 원본) | 없음 | 삭제 후 해당 `user_id`의 `clothes`·Storage 파일·이벤트 0건(이벤트는 익명화 허용) | Planned | **P0(1A)**. 의존성: TR-13 서버 관리자 권한 엔드포인트(SEC-01 인증 필수) |
| SEC-10 | 위치정보: 좌표를 서버에 저장하지 않음(현재처럼 날씨 조회에만 사용) 또는 저장 시 고지·동의 | 기기에서 Open-Meteo로 직접 조회(`src/lib/weather.ts:115-127`) | 좌표가 DB에 저장되지 않음 | Implemented(현재 미저장) | P1 |
| SEC-11 | 이미지 제3자 전송과 AI 요금 등급: ① Gemini, BRIA(fal 사용 시 fal)로 이미지가 전송됨을 처리방침에 명시 ② **Phase 2 진입 전 Gemini 유료 등급으로 전환**한다. 전환하지 못하면 무료 등급 사용 사실과, 입력·출력이 제공자의 제품 개선에 쓰이고 사람이 검토할 수 있다는 점을 처리방침과 Beta 동의서에 명시하고 얼굴 포함 착용 사진 업로드를 제한한다 | `backend/server.js:192-480,836-855`. 무료 등급 주석(`server.js:111`). 실제 요금 등급은 미확인(OQ-26) | ① 처리방침에 수탁·제3자 항목 기재 ② 운영 환경의 Gemini 요금 등급이 문서로 기록됨(AC-G7) | Planned | **P0**(Phase 2 진입 전) |
| SEC-12 | 얼굴이 포함된 착용 사진 처리 정책(원본 보관 기간, 삭제 요청) | 원본을 영구 저장(`original_image_path`) | 정책 문서화 + 사용자 삭제 가능 | Planned | P1(Phase 2) |
| SEC-13 | 결제 상태 서버 검증 — **FR-SUB-04 참조**(정의 중복하지 않음) | — | FR-SUB-04 AC | Planned | Phase 5 P0 |

> 개인정보 보호 관련 법적 요건(국내 개인정보보호법, 위치정보법 등)의 구체적 적용 범위는 법률 검토가 필요하다(OQ-20). 이 PRD는 법률 자문이 아니다.
>
> SEC-11의 Gemini 약관 해석은 2026-10-16 웹 검색 결과 기준이다([Gemini API Additional Terms of Service](https://ai.google.dev/terms)). 무료(Unpaid) 서비스의 입력·출력은 제품 개선에 쓰이고 사람이 검토할 수 있으며, 유료 서비스는 그렇지 않다고 서술되어 있다. 적용 전에 최신 약관 원문을 다시 확인한다.

---

## 23. Non-Functional Requirements

현재 성능 측정값이 없다. 아래 수치는 **[제안]** 초안이다. **NFR-01·02의 기준선(baseline) 측정값 기록은 Phase 1B 완료 기준**이며, 목표값은 기준선을 보고 Phase 2 진입 전에 확정한다.

| ID | 범주 | 요구사항 | 현재 | 목표 |
|---|---|---|---|---|
| NFR-01 | 성능 | AI 분석 응답 시간(p50/p90) 측정 | 측정 없음 | [제안] 측정 후 확정 |
| NFR-02 | 성능 | 저장 버튼부터 옷장 표시까지 시간 | 측정 없음. 동기 이미지 처리로 길어질 수 있음 | [제안] 이미지 처리와 분리 후 측정 |
| NFR-03 | 성능 | 추천 계산은 기기에서 즉시 수행 | 클라이언트 계산(`src/utils`) | 옷장 크기별 계산 시간 측정 |
| NFR-04 | 가용성 | Gemini·BRIA 장애 시 앱이 멈추지 않음 | 재시도·대체 경로 일부 존재 | 타임아웃 + 사용자 안내 |
| NFR-05 | 확장성 | AI 호출량 산정과 유료 등급 전환 | 하루 20회 주석(`server.js:111`), 실제 등급 미확인 | Phase 2 진입 전: 예상 호출량(참가자 수 × 1인당 등록 수 × 재시도) 산정 + 유료 등급 전환(AC-G7) |
| NFR-06 | 호환성 | iOS·Android 실기기 지원 | 미검증 [AUDIT V-4] | 지원 OS 버전 정의 |
| NFR-07 | 접근성 | 주요 버튼 접근성 라벨 | 일부 존재(`upload.tsx:88-89`) | 핵심 흐름 전 화면 |
| NFR-08 | 품질 | 이미지 분리 품질 기준 | 없음 [AUDIT V-7] | 샘플셋 평가 기준 정의 |
| NFR-09 | 관측성 | 오류·처리 경로별 로그 집계 | `console`만 | TR-09 |
| NFR-10 | 현지화 | 한국어 UI + 영어 용어 병기 일관성 | 혼재 | 용어집 정의 |

---

## 24. Analytics & Success Metrics

### 24.1 현재 측정 상태

> **앱 내부 측정값: 없음.** 이벤트 수집 코드가 없다(FR-DATA-01 Planned). 아래 "보고값"은 사업계획서에 적힌 사용자 테스트 결과다.

**[BP-보고값] 1차 사용자 테스트** — 사업계획서 p.10 이미지 판독
- 기간: 2026-08-25 ~ 09-05
- 대상: 20~34세 여성 18명, 음성 인터뷰 + 설문

| 항목 | 보고값 |
|---|---|
| 옷 등록부터 첫 코디 생성까지 완료 | 13명, 87% |
| 추천 코디 저장 | 11명, 73% |
| 오늘의 코디 재사용 의향 | 10명, 67% |
| 서비스가 도움이 된다 | 12명, 80% |

> **확인 필요(OQ-02):**
> 1. 응답 인원 대비 비율이 대상자 18명이 아니라 15명 기준으로 계산된 것으로 보인다(예: 13/15 ≈ 87%).
> 2. 현재 코드에는 "코디 저장" 기능이 없다. 73%가 무엇을 측정한 것인지(설문 응답인지, 다른 수단인지) 확인이 필요하다.
> 3. 원자료를 이번 작업에서 확인하지 못했다.

### 24.2 North Star와 핵심 지표

> **표기 규칙.** "현재 실측값"은 앱 이벤트로 측정한 값만 적는다(현재 모두 **없음**). "목표"는 모두 **[가설]**이며, 실측 전에는 성과로 보고하지 않는다. 사업계획서의 1차 테스트 값(24.1)은 [BP-보고값]으로만 참고한다.

| 구분 | 지표 | 정의 [제안] | 현재 실측값 | 목표 [가설] | 출처 |
|---|---|---|---|---|---|
| **North Star** [가설] | 주간 활용 코디 수 | 주당 사용자 1명이 저장 또는 "오늘 입음"한 코디 수. "오늘 입음"은 자기 기록이라 과소 측정될 수 있으므로 Beta 동안 저장 수·착용 기록 수를 **분리해서도** 본다 | 없음 | 미정 | 팀 결정 필요 |
| 활성화 | **추천 가능한 옷장 도달률** | 가입 후 7일 안에 상의·하의·신발을 각 1벌 이상 등록한 사용자 비율(필수 슬롯 정의는 [제안], OQ-09와 함께 확정) | 없음 | 미정 | [BP] 등록 부담 문제 |
| 활성화 | **1인당 등록 의류 수** | 가입 후 7일 시점 사용자별 `clothes` 행 수의 중앙값 | 없음 | 미정 | [제안] |
| 활성화 | **1벌 등록 소요 시간** | `upload_started` → `clothing_saved` 시간의 p50·p90(FR-UPL-07) | 없음 | 미정 | [제안] |
| 활성화 | First Look 도달률 | 가입 후 24시간 안에 First Look을 본 사용자 비율 | 없음 | 미정 | [BP] First Look |
| 가치 | **코디 저장률** | 코디 노출 대비 저장 비율 | 없음 | 미정 | [BP] |
| 습관 | **주간 사용 빈도** | 사용자당 주간 활성 일수 | 없음 | 미정 | [BP] |
| 습관 | **7일 재방문율** | 가입 후 7일 안에 다시 방문한 사용자 비율. 재방문 트리거 방식(FR-TODAY-07)을 함께 기록 | 없음 | 미정 | [BP] 핵심 지표 |
| 습관 | 주간 코디 생성 횟수 | 사용자당 주간 코디 조회·생성 수 | 없음 | 미정 | [BP] |
| 습관 | Today's Look 이용률 | DAU 중 Today's Look을 본 비율 | 없음 | 미정 | [BP] |
| 옷장 활용 | 휴면 의류 재활용률 | 30일 이상 미착용 옷이 추천 후 착용 기록된 비율 | 없음 | 미정 | [BP] "안 입는 옷 살리기" |
| Ideal Self | Core Look 만족도 / 지향 스타일 구현 응답 | FR-CORE-07e 5점 척도 응답 분포 | 없음 | 미정 | [제안] |
| Ideal Self | Core Look 저장률 | Core Look 노출 대비 저장 | 없음 | 미정 | [제안] |
| 구매 판단 | 판정 후 구매 의사 변화율 | FR-WDM-07c 판정 전후 응답이 달라진 건 비율 | 없음 | 미정 | [제안] |
| 구매 판단 | WDM 재이용 의사 | FR-WDM-07d 응답 분포 | 없음 | 미정 | [제안] |
| 수익 | 유료 이용 의사 / 가격 수용 비율 | FR-SUB-08 응답. **의향값이며 전환율이 아님** | 없음 | 미정 | [제안] |
| 커머스 | 상품 클릭률 | 상품 노출 대비 클릭 | 없음 | 미정 | [BP] |
| 커머스 | 공식 판매처 이동률 / 구매 전환 | 클릭 대비 이동 / 확정 구매 | 없음 | 미정 | [BP] |
| 수익 | Paywall 진입률 | PLUS 기능 진입 사용자 비율(Phase 5) | 없음 | 미정 | [BP] |
| 수익 | **유료전환율** | **MAU 대비** 유료 구독자 비율(사업계획서 손익분기 계산과 같은 분모: 예 40명 ÷ MAU 1,000명 = 4%) | 없음 | **5%** [BP 목표, 가설] | [BP] 초기 목표 |
| 수익 | 구독 유지율 / 이탈률 | 월별 갱신 비율 | 없음 | 미정 | [BP] |
| 품질 | 추천 품질 일치도 | 평가 세트에서 점수 순위와 대표자 순위의 일치도(FR-DS-06) | 없음 | 미정(1B 기준선 후 확정) | [BP] 자체 평가 데이터셋 |
| 품질 | AI 속성 수정률 | FR-AI-07 | 없음 | 미정 | [제안] |
| 품질 | 이미지 처리 경로 비율 | SlimSAM / BRIA / 원본 비율 | 없음 | 미정 | [제안], 비용 가정 검증 |

> 유료전환율 5%를 제외한 목표값은 사업계획서에 없다. 임의로 정하지 않는다. Phase 2 시작 전에 확정한다(OQ-01, OQ-24). 유료전환율 5%는 **Phase 5 판정 지표**로만 쓴다. Beta 인원으로는 5%를 통계적으로 판정할 수 없기 때문이다(예: 20명 중 1명).

### 24.3 필수 이벤트 (FR-DATA-01)

**Phase 1B 필수 (Phase 2 지표의 전제)**
`app_open`, `anonymous_session_start`, `signup_complete`, `login_complete`, `upload_started`, `photo_selected`, `analysis_success`, `analysis_failed`(code 포함), `attribute_edited`(field, before, after), `clothing_saved`, `image_processing_result`(path: sam/bria/original), `closet_ready`(추천 가능한 옷장 첫 도달), `first_look_view`, `look_view`(source: styling/looks/today/core), `look_saved`, `look_skipped`, `look_worn`, `missing_item_view`

**Phase 2 추가**
`core_selected`, `core_look_view`, `core_look_rating`, `decision_requested`, `decision_view`(WDM 프로토타입 사용 시), `pricing_view`·`plus_interest`(FR-SUB-08 선택 ② 사용 시). Concierge·설문 응답은 앱 이벤트가 아니라 참가자 ID로 연결한 별도 기록으로 남긴다

**Phase 4~5**
`product_view`, `product_click`, `paywall_view`, `subscription_started`, `subscription_cancelled`

### 24.4 Beta 표본과 Go/No-go 판정 구조

목표 수치는 아직 없으므로 이 절은 **판정 구조**만 정한다. 수치는 Phase 2 진입 전에 확정한다(OQ-24).

| 항목 | 요구사항 |
|---|---|
| 목표 참가 인원 | Phase 2 진입 전에 확정. 1차 테스트(보고 18명) 이상을 [제안]으로 하되, 소수 표본에서는 비율 지표의 변동이 크다는 점을 판정에 반영 |
| 판정 단위 | 흐름 단계별로 따로 판정: ① Actual Closet(활성화·재방문) ② Ideal Fashion Self(Core PoC) ③ 필요한 구매(WDM 검증·가격 테스트) |
| 판정 방식 | 지표마다 Go / 재설계 / 중단 기준을 사전에 적는다. 정량 지표와 함께 정성 신호(인터뷰에서 반복되는 이탈 이유 등)를 판정 근거로 쓴다 |
| 등록 부담 재검토 조건 | 추천 가능한 옷장 도달률이나 1벌 등록 시간이 기준에 못 미치면, 다중 의류 등록(6.2 Non-Goal)과 비동기 처리(FR-UPL-04)의 우선순위를 다시 정한다 |
| 결과 보고 | 사전 기준 대비 결과, 표본 크기, 재방문 트리거 방식, 해석 한계를 함께 적는다 |

---

## 25. Acceptance Criteria

기능별 AC는 9~20장 표에 있다. 이 장은 **Phase 완료 판정용 통합 AC**다.

### 25.1 Release Gate AC

**Phase 1A Gate (출시 안전성·데이터 보호)**
- [ ] **AC-G1** P0 보안 항목 SEC-01 ~ SEC-06, SEC-09를 충족하고 SEC-07 준수를 다시 확인한다. (SEC-08·SEC-11은 늦어도 AC-G7과 함께 Phase 2 진입 전에 충족한다.)
- [ ] **AC-G2** 테스트 계정 A로 로그인한 상태에서 계정 B의 `clothes.id`로 조회·수정·삭제하면 모두 실패한다. 익명 세션으로 `clothes`를 조회·쓰기하면 0건이다(SEC-04). *(2026-10-17: 정책 정의는 교차 계정 차단을 충족함을 확인. 동작 테스트와 익명 세션 조건은 미완료)*
- [ ] **AC-G3** ① 토큰 없이 백엔드 엔드포인트 5개(`/analyze-clothing`, `/segment-garment`, `/segment-garment-local`, `/apply-garment-mask`, `/remove-background`)를 호출하면 모두 401이다. ② 익명 세션 토큰은 `/analyze-clothing`만 익명 한도까지 성공하고, 한도를 넘으면 429, 나머지 4개 엔드포인트는 403이다. ③ 정식 계정 토큰은 사용자 한도까지 5개 모두 성공한다.
- [ ] **AC-G4** 백엔드가 배포된 HTTPS 주소로 iOS·Android 실기기에서 (가입 전) 분석 → 가입 → 저장 → Closet → Styling이 성공한다.

**Phase 1B Gate (핵심 MVP 품질·측정 체계)**
- [ ] **AC-G5** Styling·Looks·Today의 같은 코디가 같은 Outfit Match Score를 표시한다(Weather Fit은 별도 표시).
- [ ] **AC-G6** 24.3의 Phase 1B 필수 이벤트가 기록되고, 추천 가능한 옷장 도달률·1벌 등록 시간·코디 저장률을 계산할 수 있다.
- [ ] **AC-G9** 추천 품질 평가 세트(FR-DS-06)와 일치도 측정 절차가 있고, 첫 측정 결과(기준선)가 기록되어 있다.
- [ ] **AC-G10** NFR-01·02 기준선 측정값이 기록되어 있다.

**Phase 2 진입 Gate (Beta 운영 준비)**
- [ ] **AC-G7** 운영 환경 Gemini가 유료 등급이고, 예상 호출량 산정이 문서로 있다. 유료 전환을 못 했다면 SEC-11 ②의 대체 조치를 모두 이행했다.
- [ ] **AC-G8** Beta 배포 채널(TR-12)로 참가자 기기에 앱을 설치할 수 있다.
- [ ] **AC-G11** SEC-08(동의서에 Concierge 열람 범위 포함)과 SEC-11 ①이 충족된다.

### 25.2 기능 AC 요약

| 기능 | 핵심 AC (상세는 해당 장) |
|---|---|
| FR-AUTH | 로그인 성공 + 저장 실패를 구분 안내. 계정 삭제 시 데이터 완전 삭제. 익명 세션으로 가입 전 분석 |
| FR-UPL | 등록 시간 측정(1B). 카메라 등록(2). 이미지 처리를 기다리지 않고 저장(2 이후) |
| FR-AI | 분류 불일치 보정. 타임아웃. 9개 속성 수정 |
| FR-DS | 평가 세트와 일치도 측정(1B). 규칙·Core 행 필수 필드. 임계값은 Dataset 항목으로 참조 |
| FR-REC | 베스트 코디 = Top 3 1위. 옷 2벌로 First Look |
| FR-SCORE | 화면 간 점수 일치. 이유 = 상위 하위 지표 |
| FR-CORE | (Phase 2 PoC) Core Look 아이템이 모두 사용자 실제 옷. 설명 = 계산 근거. 만족도 수집 / (Phase 3) Dataset 정의 Core 확장 |
| FR-TODAY | 권한 거부 시에도 코디 표시. "오늘 입음" 기록. 재방문 트리거 방식 기록 |
| FR-MISS | 궁합 부재 탐지. 복수 Missing과 점수 상승 근거 |
| FR-WDM | (Phase 2) 실제 옷장 기준 판정 + 판정 전후 구매 의사 기록 / (Phase 3~4) 세 지표가 같은 점수 정의 사용 |
| FR-CAT | CSV 수입 → 표시 → 클릭 추적 |
| FR-SUB | (Phase 2) 가격·가치 테스트 응답 기록, 결제 요소 없음 / (Phase 5) Paywall 이벤트, 서버 검증 구독 상태 |
| FR-DATA | 필수 이벤트 기록. 저장 코디 기기 간 동기화 |

---

## 26. MVP Stabilization Requirements

기존 Phase 1(MVP Stabilization)을 두 단계로 나눈다. 출시 차단 요소를 먼저 끝내야 그 위에서 측정한 값을 믿을 수 있기 때문이다.

### Phase 1A. 출시 안전성 및 데이터 보호

| 구분 | 내용 |
|---|---|
| **목표** | 외부 사용자를 받아도 데이터 유출·비용 남용·무단 접근이 일어나지 않는 상태를 만든다 |
| **흐름상 역할** | 모든 흐름(Actual Closet → Ideal Fashion Self → 필요한 구매)의 전제 |
| **진입 조건** | ① 이 PRD v0.2와 `docs/PRODUCT_AUDIT.md` 검토 완료 ② 미커밋 변경사항 정리·커밋 ③ **OQ-04 결정**: 익명 세션 하루 분석 한도와 정식 사용자 한도 값 ④ OQ-26 확인: Supabase 익명 로그인 사용 가능 여부 |
| **범위** | **인증:** SEC-01, FR-AUTH-07(익명 세션), FR-AUTH-03 / **RLS·Storage:** SEC-04, SEC-05, TR-05 / **서버 보호:** SEC-03(SSRF), SEC-06(본문 크기), SEC-07(유지 확인), TR-13(관리자 권한 엔드포인트) / **AI 호출 제한:** SEC-02, FR-AI-05(타임아웃) / **데이터 삭제:** SEC-09, FR-AUTH-05 / **배포:** TR-01, TR-02 |
| **제외** | 점수 통합, 이벤트 수집, 등록 경험 개선, 이미지 비동기 처리, Core, WDM, 상거래, 결제 |
| **완료 기준** | ① 25.1 Phase 1A Gate(AC-G1~G4) 전부 통과 ② RLS·Storage 정책 SQL이 저장소에 있음 ③ 교차 계정·익명 세션 접근 테스트 기록 ④ 배포 HTTPS 백엔드로 실기기 핵심 흐름 수동 테스트 통과 기록 |

**Phase 1A 작업 순서**

| 순서 | 항목 | 이유 |
|---|---|---|
| 1 | SEC-04·05 RLS·Storage 정책 확인과 SQL화(TR-05) | 데이터 유출 위험. 확인 비용이 가장 낮음. **2026-10-17 정책 확인·기록 완료.** 남은 일: 교차 계정 동작 테스트 |
| 2 | SEC-01 + FR-AUTH-07 인증과 익명 세션 | 서버 보호와 가입 전 체험을 동시에 지키는 전제 |
| 3 | SEC-02·03·06, FR-AI-05 한도·SSRF·본문 크기·타임아웃 | 비용과 인프라 위험 |
| 4 | TR-01·02 배포와 주소 설정 | 실기기 Beta의 전제 |
| 5 | SEC-09 + TR-13 계정 삭제 | 개인정보 처리 요건. 서버 관리자 권한이 필요 |
| 6 | FR-AUTH-03 오류 메시지 분리 | 가입 직후 신뢰 |

### Phase 1B. 핵심 MVP 품질 및 측정 체계

| 구분 | 내용 |
|---|---|
| **목표** | Beta에서 "가치가 있는지"를 측정할 수 있도록 옷 등록 경험, 추천엔진 일관성, 추천 품질 평가 기준, 행동 데이터 측정을 정리한다 |
| **흐름상 역할** | Actual Closet 검증의 측정 기반. Ideal Fashion Self·필요한 구매 검증이 쓸 점수 정의 |
| **진입 조건** | Phase 1A 완료 기준 충족. OQ-06(Dataset 저장 방식), OQ-19(이벤트 저장소) 결정 |
| **범위** | **옷 등록 경험:** FR-UPL-07(등록 시간 측정), TR-04(모델 warm-up) / **추천엔진 일관성:** FR-SCORE-01·02(별도 표시)·03·04·05·06, FR-REC-01·06, TR-06, TR-07(점수 단위 테스트) / **추천 품질 평가 기준:** FR-DS-06(평가 세트), FR-DS-07(최소 스키마) / **행동 데이터:** FR-DATA-01·02·03, 24.3 Phase 1B 이벤트, FR-AI-07(수정 이력), TR-09(오류 모니터링) / **기준선:** NFR-01·02 측정 |
| **제외** | α·β 점수 합산, Dataset 런타임 로드(FR-DS-01·03·04), 이미지 비동기 처리(FR-UPL-04), Core PoC, WDM, 결제 |
| **완료 기준** | ① 25.1 Phase 1B Gate(AC-G5·G6·G9·G10) 통과 ② 평가 세트 첫 일치도 측정값(기준선) 기록 — **성과가 아닌 기준선**으로 표기 ③ 추천 가능한 옷장 도달률·1벌 등록 시간을 내부 테스트 계정으로 계산해 본 기록 ④ 점수 엔진 단위 테스트 존재 |

**Phase 1B 작업 순서**

| 순서 | 항목 | 이유 |
|---|---|---|
| 1 | FR-SCORE-01 / FR-REC-01 / TR-06 점수 통합(엔진 B 기준) | 원칙 3 "설명 가능한 점수"의 신뢰성. 이후 모든 측정의 기준 |
| 2 | FR-DATA-01~03 이벤트와 코디 저장 | Phase 2 지표 측정의 전제 |
| 3 | FR-DS-06·07 평가 세트와 최소 스키마 | 추천 품질을 판정할 기준. 대표자 작업과 병행 가능 |
| 4 | FR-UPL-07, NFR-01·02 기준선 | 등록 부담 가설의 측정 기반 |
| 5 | FR-AI-07, TR-09, TR-04 | 정확도·관측성·첫 요청 지연 |

---

## 27. Beta Release Requirements

**Phase 2. Closed Beta 및 가치 검증**

| 구분 | 내용 |
|---|---|
| **목표** | 사업계획서의 핵심 흐름 **Actual Closet → Ideal Fashion Self → 필요한 구매**가 실제 타깃 사용자에게 가치가 있는지 단계별로 작게 검증한다 |
| **진입 조건** | ① Phase 1B 완료 기준 충족 ② **AC-G7** Gemini 유료 등급 전환 + 예상 호출량 산정 ③ **AC-G8** Beta 배포 채널(TR-12) ④ **AC-G11** 동의서·처리방침(SEC-08, SEC-11 ①) ⑤ 24.4 표본·Go/No-go 기준 확정(OQ-01, OQ-24) ⑥ 재방문 트리거 방식 결정(FR-TODAY-07, OQ-23) ⑦ 대표 Core 2~3개 선정과 속성 정의 초안(OQ-25, FR-CORE-07a) |
| **범위 — Actual Closet** | FR-REC-02(First Look 정의), FR-REC-05·FR-DATA-03(저장·스킵·착용), FR-TODAY-04·05·07, FR-AI-06, FR-CLO-02, FR-UPL-02(카메라), FR-MISS-02·04, SEC-12 |
| **범위 — Ideal Fashion Self** | **FR-CORE-07 Core PoC**: 대표 Core 2~3개를 사용자 실제 Digital Closet과 연결(속성 정의, 보유 의류 매칭, 실제 의류 기반 코디, 적합도 설명, 만족도 측정). 기존 데모 화면은 PoC로 대체하거나 "데모" 표기 유지 |
| **범위 — 필요한 구매** | **FR-WDM-07** Concierge Test(필수) → 제한된 프로토타입(선택) / **FR-SUB-08** 가격·가치 테스트(필수). 실제 결제·Paywall 잠금은 만들지 않음 |
| **제외** | 인앱 결제, Catalog·Feed 연동, Core 전체 확장, Dataset 런타임 로드, 학습 기반 개인화, 참여 기능 4종(FR-TODAY-06) |
| **측정** | 24.2의 활성화·가치·습관 지표, Core PoC 지표, 구매 판단 지표, 가격 수용 지표, AI 속성 수정률, 이미지 처리 경로 비율. 모든 목표값은 [가설] |
| **정성 검증** | 인터뷰: 코디 만족, 휴면 의류 활용 체감, 이탈 지점, Core 구현 체감, 구매 판단이 결정에 준 영향 [BP의 1차 테스트 방식 계승] |
| **완료 기준** | ① 24.4 구조에 따른 흐름 단계별 결과 보고서(사전 기준 대비, 표본 크기·해석 한계 포함) ② 단계별 Go / 재설계 / 중단 결정 ③ WDM Concierge 판정 기록으로 임계값 초안 작성(OQ-11 근거) ④ 가격·가치 테스트 결과로 **실제 결제 구현 여부와 시점 결정**(OQ-17) ⑤ 이미지 처리 비용 실측(OQ-15 해소) |

---

## 28. Future Development Requirements

### Phase 3. 개인화 추천 고도화

| 구분 | 내용 |
|---|---|
| **목표** | Phase 2에서 가치가 확인된 흐름을 Dataset 기반 추천과 규칙 기반 개인화로 강화한다 |
| **흐름상 역할** | Ideal Fashion Self 확장, Actual Closet 추천 품질 향상 |
| **진입 조건** | ① Phase 2에서 Actual Closet 또는 Ideal Fashion Self 단계가 Go ② 행동 이벤트 누적 ③ Phase 2 Core PoC 결과 보고(어떤 Core 속성이 만족도와 연결됐는지) |
| **범위** | **Dataset 고도화:** FR-DS-01·03·04(런타임 로드, 버전, 관리 방식), FR-DS-08 임계값 확정, FR-SCORE-02 α·β(평가 세트 근거가 있을 때) / **Core 전체 확장:** FR-CORE-01~06(PoC에서 검증된 구조로 Core 목록 확대, Core 저장) / **규칙 기반 개인화:** FR-DATA-04(명시적 취향 입력), FR-DATA-05(규칙 기반 가중치 보정) / **추천 품질:** FR-REC-04, FR-MISS-05·06 / **WDM 앱 내 기능화:** FR-WDM-01~05(Phase 2 필요한 구매 단계가 Go일 때, 사진·스크린샷 입력) / **참여 기능:** FR-TODAY-06 중 Phase 2 데이터로 고른 **1개** |
| **제외** | 학습 기반 개인화, Dynamic 트렌드 자동 갱신(FR-DS-05), 결제 |
| **완료 기준** | ① 점수 규칙이 Dataset에서 로드됨 ② POETCORE 외 Core가 Dataset으로 동작 ③ 평가 세트 일치도가 Phase 1B 기준선 대비 보고됨 ④ 개인화 적용 전후 코디 저장률 비교 결과 보고(전후 비교, 소수 표본 한계 명시) |

### Phase 4. 실제 상품 데이터 연동

| 구분 | 내용 |
|---|---|
| **목표** | Mock 상품을 허가받은 실제 상품으로 바꾸고, Missing Item·Wardrobe Decision이 실제 상품과 연결되는지 측정한다 |
| **흐름상 역할** | 필요한 구매 단계를 실제 상품으로 연결 |
| **진입 조건** | ① 브랜드별 데이터 이용 허가 확보(OQ-14) ② Missing Item 품질 기준 충족(FR-MISS AC) ③ Wardrobe Decision 임계값 근거 확보(OQ-11) ④ **액세서리(주얼리) 노출 경로 결정**(OQ-27): Core 기반 액세서리 제안 / 코디 완성 단계 '포인트 아이템' 슬롯 / PoC를 여성복 2곳으로 한정 중 택일 |
| **범위** | FR-CAT-01~05(CSV PoC: 여성복 2 + 주얼리 1 [BP], 단 ④ 결정에 따라 조정), FR-CAT-08, **FR-WDM Catalog 상품 연결**(입력 경로 ③), 클릭 추적 → (성과 확인 후) FR-CAT-06 Feed/API |
| **제외** | CPS 정산(Phase 5), 파트너 관리 시스템 |
| **완료 기준** | ① 허가받은 실제 상품이 Mock을 대체 ② 상품 클릭률·판매처 이동률 측정 결과 ③ Feed/API 확대 대상 파트너 선정 근거 보고 ④ 주얼리 PoC를 진행했다면 노출 경로별 노출·클릭 수 보고 |
| **주의** | 주얼리는 현재 분류 체계에 `necklace`, `bracelet`, `earrings`만 있다(`src/constants/clothingOptions.ts`, `backend/server.js:360-366`). 주얼리 상품의 코디 궁합 규칙이 Dataset에 필요하다(OQ-21) |

### Phase 5. 구독 및 CPS 수익화 검증

| 구분 | 내용 |
|---|---|
| **목표** | 구독과 CPS 수익을 실제 결제·구매 데이터로 검증한다 |
| **흐름상 역할** | 필요한 구매 단계의 사업화 |
| **진입 조건** | ① Phase 2 가격·가치 테스트(FR-SUB-08) 결과가 사전 기준 충족 → 실제 결제 구현 결정 ② PLUS 핵심 기능(WDM 앱 내 기능, Core 기반 추천 또는 개인화) 동작 ③ SEC-13(FR-SUB-04) 준비 ④ CPS는 Phase 4 클릭 데이터와 제휴 계약이 있을 때만 |
| **범위** | FR-SUB-01~07, FR-WDM-06(과금 경계, OQ-10), 가격 검증(월 5,900원 / 연 59,000원 [BP 가설]), FR-CAT-07 CPS 추적·전환 수신 |
| **완료 기준** | ① 실제 결제 발생 ② 유료전환율(MAU 분모)을 5% [BP 목표, 가설] 대비 판정 ③ 구독 유지율 측정 ④ 실측 인프라 비용으로 손익분기 가정 재계산 ⑤ (CPS 진행 시) 전환 수신과 정산 데이터 대사 |

### 장기 (로드맵 외, 기록용) [BP]
- 브랜드 파트너 관리 시스템(직접 등록·수정·관리)
- 트렌드 데이터 자동 반영(Dynamic Dataset 자동화)
- 한 사진에서 여러 옷 탐지, 수동 마스크 편집 [AUDIT]

### Phase 요약

```text
Phase 1A 출시 안전성·데이터 보호  ── 인증(익명 세션 포함)·RLS·서버 보호·AI 한도·삭제·배포
   ↓ 진입: 1A Gate(AC-G1~G4)
Phase 1B 핵심 MVP 품질·측정 체계 ── 점수 통합·평가 세트·이벤트·등록 시간 기준선
   ↓ 진입: 1B Gate + 유료 AI 등급·배포 채널·동의서 + 표본·Go/No-go 기준
Phase 2  Closed Beta·가치 검증   ── Actual Closet   : Today/Styling 반복 사용
                                    Ideal Self      : Core 2~3개 PoC(실제 옷장)
                                    필요한 구매      : WDM Concierge + 가격·가치 테스트
   ↓ 진입: 단계별 Go 결정
Phase 3  개인화 추천 고도화       ── Dataset 고도화·Core 확장·규칙 기반 개인화·WDM 앱 기능화
   ↓ 진입: 데이터 이용 허가 + Missing·Decision 품질 + 액세서리 노출 경로
Phase 4  실제 상품 데이터 연동    ── CSV PoC → Feed/API, WDM-Catalog 연결
   ↓ 진입: 가격 테스트 기준 충족 + PLUS 기능 동작 (+ CPS 계약)
Phase 5  구독·CPS 수익화 검증     ── 실제 결제, 5% 전환[가설] 판정, CPS
```

> 일정은 정하지 않았다. 각 Phase는 진입 조건 충족을 기준으로 시작한다.

---

## 29. Open Questions & Risks

### 29.1 Open Questions

| ID | 질문 | 영향 영역 | 결정 주체 [제안] |
|---|---|---|---|
| OQ-01 | 코디 저장률, 주간 사용 빈도, 7일 재방문율의 Beta 목표값은? | 24, 27 | 대표자 + 멘토 |
| OQ-02 | 1차 사용자 테스트(18명)의 비율 계산 기준(15명?)과 "코디 저장 73%"의 측정 방법은? | 24.1 | 대표자 |
| OQ-03 | 목표 플랫폼(iOS / Android / Web)과 백엔드 호스팅은? | TR-01·02 | 개발 |
| OQ-04 | ~~로그인 전 AI 분석 허용 여부~~ → **v0.2 결정:** 익명 세션 토큰으로 허용(SEC-01, FR-AUTH-07). **남은 결정:** 익명 세션·정식 사용자별 하루 분석 한도 값. **Phase 1A 진입 전** 결정. 유료 등급 전환은 AC-G7로 이동 | FR-AI, SEC-01·02 | 대표자 |
| OQ-05 | Outfit Match에 Weather Fit·Core Fit을 합치는 비율(α, β)은? | FR-SCORE-02 | 대표자(의상학 기준) |
| OQ-06 | Fashion Knowledge Dataset 저장 방식: Supabase 테이블 vs 버전 관리 JSON vs 스프레드시트 동기화 | FR-DS | 개발 + 대표자 |
| OQ-07 | `STYLESEED_Fashion_Knowledge_Dataset_V0.1.numbers`의 현재 범위와 완성도는? | FR-DS | 대표자 |
| OQ-08 | Core를 하나만 고르는지 여러 개를 고르는지, Core 목록은 누가 관리하는지 | FR-CORE | 대표자 |
| OQ-09 | Missing Item에서 아우터·가방·액세서리를 필수 슬롯으로 볼 조건은? | FR-MISS | 대표자 |
| OQ-10 | Wardrobe Decision의 무료/유료 경계(무료 횟수 제공 여부) | FR-WDM, FR-SUB | 대표자 |
| OQ-11 | "조합 가능"과 "중복"의 임계값 근거를 어떻게 정하는지 | FR-WDM | 대표자 + 데이터 |
| OQ-12 | 3장에 인용된 외부 연구(플랑드르, WRAP, 밀레니얼 751명, Pinterest)의 원문 출처 링크 | 3 | 대표자 |
| OQ-13 | 직접 경쟁 서비스 목록과 기능 비교 | 5 | 대표자 |
| OQ-14 | 브랜드 3곳(여성복 2, 주얼리 1)의 협력 형태: 구두 의향 / MOU / 데이터 이용 허가 범위(이미지, 가격, 재고) | 18 | 대표자 |
| OQ-15 | 실제 이미지 처리 비용: SlimSAM 성공률, BRIA 대체 비율, 1벌당 실비 | 19 | 개발 |
| OQ-16 | 인앱 결제 구현 방식(스토어 SDK 또는 결제 대행 서비스) | FR-SUB | 개발 |
| OQ-17 | ~~Phase 2에서 fake door Paywall로 지불 의사를 먼저 측정할지~~ → **v0.2 결정:** Phase 2는 가격·가치 테스트(FR-SUB-08)를 필수로 하고, 실제 결제 구현 여부와 시점은 그 결과로 정한다. **남은 결정:** 가치 제안 화면(선택 ②)을 쓸지 | FR-SUB, 27 | 대표자 |
| OQ-18 | ~~개인 가중치 조정 방식~~ → **v0.2 결정:** Phase 3는 규칙 기반. 학습 기반은 사용자 수 확보 후 재검토 | FR-DATA-05 | — |
| OQ-19 | 이벤트 저장소: Supabase 자체 테이블 vs 외부 분석 도구 | FR-DATA-01 | 개발 |
| OQ-20 | 개인정보·위치정보·얼굴 포함 사진 처리에 대한 법률 검토 범위 | 22 | 대표자(외부 자문) |
| OQ-21 | 주얼리 상품의 코디 궁합 규칙과 분류 체계 확장 범위 | Phase 4 | 대표자 |
| OQ-22 | ~~Core 기능을 Beta에 노출할지~~ → **v0.2 결정:** 대표 Core 2~3개 PoC를 Beta에서 검증(FR-CORE-07). 기존 데모는 대체 또는 "데모" 표기 | 14, 27 | — |
| OQ-23 | Beta 재방문 트리거: 운영자 수동 메시지 vs 로컬 알림 1종(FR-TODAY-07) | 15, 24, 27 | 대표자 |
| OQ-24 | Beta 목표 참가 인원, 흐름 단계별 Go / 재설계 / 중단 기준값(24.4) | 24, 27 | 대표자 + 멘토 |
| OQ-25 | Phase 2 Core PoC의 대표 Core 2~3개 선정과 선정 근거 | 14.1 | 대표자 |
| OQ-26 | 운영 환경의 실제 Gemini 모델·요금 등급, Supabase 익명 로그인 사용 가능 여부 | SEC-01·11, AC-G7 | 개발 |
| OQ-27 | 주얼리 등 액세서리 상품의 노출 경로(Core 기반 제안 / 포인트 아이템 슬롯 / PoC 범위 축소) | 18, Phase 4 | 대표자 |

### 29.2 Risks

| ID | 위험 | 가능성 | 영향 | 완화 |
|---|---|---|---|---|
| R-01 | RLS 미설정으로 사용자 데이터 노출 | **낮음**(2026-10-17 정책 확인, 동작 테스트 미완료) | 매우 높음 | SEC-04·05 정책 확인 완료. 남은 조치: 교차 계정 동작 테스트, 익명 로그인 활성화 전 restrictive 정책 |
| R-02 | 공개 백엔드에서 AI 키 남용으로 비용 폭증 | 배포 시 높음 | 높음 | SEC-01·02 |
| R-03 | 점수 불일치로 추천 신뢰도 하락 | 현재 발생 | 높음(원칙 3) | FR-SCORE-01 |
| R-04 | 사진 등록 부담으로 옷장이 쌓이지 않음(First Look 미도달) | 중간 [BP 자체 인식] | 높음 | First Look, 카메라, 비동기 처리 |
| R-05 | 무료 AI 한도(하루 20회)로 Beta 중 분석 중단 | 높음 | 높음(가설 1 측정 불가) | Phase 2 진입 조건 AC-G7(유료 등급 + 호출량 산정) |
| R-06 | 이미지 처리 품질이 낮아 옷장이 지저분해 보임 | 미측정 | 중간 | 품질 기준(NFR-08), 원본 전환 기능(현재 존재) |
| R-07 | 브랜드 데이터 이용 허가 지연으로 Phase 4 지연 | 미확인 | 중간 | Mock 표기 유지, Core·Today로 가치 검증 우선 |
| R-08 | 개인화 데이터가 부족해 PLUS 가치가 약함 | 중간 | 높음(수익) | Phase 1B에서 이벤트 수집 시작, Phase 2에서 WDM·Core 가치 직접 검증 |
| R-09 | 사업계획서의 "구현 완료" 서술과 실제 코드 차이로 외부 신뢰 문제 | 중간 | 중간 | 부록 A를 기준으로 외부 커뮤니케이션 정리 |
| R-10 | 비용 가정(1벌 2원, MAU별 인프라비)이 실제와 다름 | 미확인 | 중간 | OQ-15 실측 |
| R-11 | 1인 대표 중심 Dataset 작성의 확장 한계 | 중간 | 중간 | 관리 도구(FR-DS-04), 규칙 출처 기록 |
| R-12 | 재방문 트리거가 없어 7일 재방문율이 과소 측정되고 잘못된 No-go 결정 | 높음 | 높음 | FR-TODAY-07 결정과 지표 해석에 방식 기록 |
| R-13 | 지불 의사를 늦게 확인해 수익 가설이 틀린 채 상거래·결제 개발에 자원 투입 | 중간 | 높음 | Phase 2 WDM Concierge + 가격·가치 테스트 |
| R-14 | 의향 응답(가격 테스트)이 실제 결제보다 높게 나와 과대 해석 | 높음 | 중간 | FR-SUB-08 결과를 전환율 성과로 보고하지 않음. Phase 5 실결제로 판정 |
| R-15 | Concierge Test에서 운영자의 옷장 데이터 열람이 동의 범위를 벗어남 | 낮음~중간 | 높음 | SEC-08 동의서에 열람 범위 명시, AC-G11 |
| R-16 | 소수 Beta 표본으로 비율 지표가 크게 흔들림 | 높음 | 중간 | 24.4 표본·판정 구조, 정성 신호 병행 |
| R-17 | Supabase Free 플랜 자동 일시정지로 앱 전체 중단 | **발생함**(2026-10-17 점검 시 Paused, 승인 후 Resume) | 높음(Beta 중 발생 시) | 플랜 결정 보류 중. Phase 2 진입 전 결정 필요 |

---

## 부록 A. 사업계획서 ↔ 코드 Gap 표

| 사업계획서 서술 [BP] | 코드 현재 상태 [CODE] | 상태 | PRD 요구사항 |
|---|---|---|---|
| "사진 등록 → AI 분석 → 사용자 수정 → 계정별 저장 → Digital Closet → Styling → Match Score·추천 이유 → Missing Item → Shop 추천까지 구현" | 흐름은 연결됨. Shop은 Mock 상품 16개, 구매 링크 없음 | Implemented ~ Mock | FR-CAT |
| "계정별 저장"(사용자 데이터 분리) | 클라이언트 쿼리에 `user_id` 조건 없음. 실제 DB에 RLS·Storage 정책 적용됨 [1A-02 확인, 2026-10-17] | Implemented (동작 테스트 미완료) | SEC-04·05 |
| First Look: 소수 의류로 첫 코디 | Home 카드가 1순위 룩 표시. 전용 정의·최소 수량 없음 | Partial | FR-REC-02 |
| Top 3 Look (예: 79·77·75) | `getRankedLooks`, `looks.tsx` | Implemented | FR-REC-03 |
| Color, Fit·Silhouette, Material, Season, TPO 의상학 점수 + 이유 | 6개 지표 엔진(B)은 있으나 아이템 선택은 다른 엔진(A) | Partial | FR-SCORE-01 |
| Fashion Knowledge Dataset으로 구조화, 자체 평가 데이터셋 구축 | 코드 상수. `.numbers` 파일 미연동 | Planned | FR-DS |
| Dynamic Fashion Knowledge Dataset(Core를 구성 요소로 분해) | 데모 고정 규칙(POETCORE) | Mock | FR-DS-02, FR-CORE |
| Core/Aesthetic: Core 선택 → 옷장 요소 찾기 → 코디 → 없을 때만 상품 | 데모 화면 흐름 존재, 고정 규칙 | Mock | FR-CORE |
| 날씨 기반 오늘의 코디 | Open-Meteo + 규칙 기반 | Implemented | FR-TODAY |
| '오늘의 시드', 안 입는 옷 살리기, 옷장 셔플, 주간 활용도 | 없음 | Planned | FR-TODAY-06 |
| 저장·선택·스킵·착용·상품 클릭 데이터로 개인화 | 이벤트·저장 기능 없음. Preference는 옷장 분포 | Planned | FR-DATA |
| Wardrobe Compatibility / Outfit Unlock Score / Duplication Check | 없음 | Planned | FR-WDM |
| 여성복 2 + 주얼리 1 협력 의향 기반 CSV·Feed PoC | Mock 상품(가상 브랜드명) | Planned | FR-CAT, OQ-14 |
| Product Feed/API → CPS → 파트너 관리 시스템 | 없음 | Planned | FR-CAT-06·07, 28장 |
| STYLESEED PLUS 월 5,900원 / 연 59,000원 | 결제 코드 없음 | Planned | FR-SUB |
| Local segmentation으로 AI 비용 증가 억제 | SlimSAM 구현됨. 실패 시 유료 BRIA로 대체 | Partial | OQ-15 |
| 7일 재방문율, 주간 코디 생성, 코디 저장률, 유료전환율 측정 | 측정 코드 없음 | Planned | FR-DATA-01, 24장 |
| 1차 사용자 테스트 결과(87/73/67/80%) | 앱 내부 기록 없음(외부 인터뷰·설문으로 보임) | [BP-보고값] | OQ-02 |

## 부록 B. Requirement ID 색인

| 접두어 | 영역 | 장 |
|---|---|---|
| FR-AUTH | 회원가입·로그인·계정 | 9 |
| FR-UPL | 사진 등록·이미지 처리 | 9 |
| FR-CLO | Digital Closet | 9 |
| FR-AI | AI 이미지 분석 | 10 |
| FR-DS | Fashion Knowledge Dataset | 11 |
| FR-REC | 추천엔진 | 12 |
| FR-SCORE | Match Score·설명 | 13 |
| FR-CORE | Core/Aesthetic | 14 |
| FR-TODAY | Today's Look | 15 |
| FR-MISS | Missing Item | 16 |
| FR-WDM | Wardrobe Decision Module | 17 |
| FR-CAT | Product Catalog·Commerce | 18 |
| FR-SUB | 구독·수익화 | 19 |
| FR-DATA | 사용자 데이터·개인화 | 20 |
| TR | 기술 요구사항 | 21 |
| SEC | 보안·개인정보 | 22 |
| NFR | 비기능 요구사항 | 23 |
| AC-G | Release Gate AC | 25 |
| OQ / R | Open Questions / Risks | 29 |

**정의 원본(중복 통합, v0.2)**

| 주제 | 정의 원본 | 참조만 하는 ID |
|---|---|---|
| 쓰이지 않는 코드 정리 | TR-08 | FR-UPL-06 |
| 구독 상태 서버 검증 | FR-SUB-04 | SEC-13 |
| 계정·데이터 삭제 | SEC-09 | FR-AUTH-05, FR-DATA-06 |
| Core 기준 Missing | FR-CORE-04 | FR-MISS-06 |
| 저장·스킵·착용 기록 | FR-DATA-03 | FR-REC-05, FR-TODAY-04 |

## 부록 C. 변경 이력

### v0.2.1 (2026-10-17) — 1A-02 RLS·Storage 점검 결과 반영

| 구분 | 내용 | 위치 |
|---|---|---|
| 확인됨 | 실제 DB의 `clothes` RLS와 정책 4종, 비공개 버킷, Storage 정책 4종을 읽기 전용으로 확인. 정의를 `supabase/migrations/20261017000000_baseline_clothes_rls_storage.sql`에 기록(DB에 적용하지 않음) | 1, 8, 21 TR-05, 22 SEC-04·05, 26, 29 R-01, 부록 A |
| 남은 검증 | 교차 계정 동작 테스트(AC-G2), 익명 세션 조건(익명 로그인 활성화 전 restrictive 정책 필요) | 9 FR-AUTH 기술 의존성, 22 SEC-04, 25.1 AC-G2 |
| 신규 위험 | R-17 Supabase Free 플랜 자동 일시정지(점검 시 실제로 발생) | 29.2 |
| 보류 | restrictive 정책 추가, 버킷 크기·MIME 제한, anon 권한 회수, 플랜 결정(모두 승인 대기) | `docs/PRODUCT_AUDIT.md` S-6~S-9, T-13 |

### v0.2 (2026-10-16) — Red Team 검토 반영

| 수정안 | 반영 내용 | 주요 위치 |
|---|---|---|
| 1 (승인) | SEC-01·AC-G3를 "토큰 필수 + 익명 세션 토큰 허용 + 익명 한도"로 수정. FR-AUTH-07 신설. OQ-04는 한도 값만 남기고 Phase 1A 진입 전 결정으로 이동 | 7.1, 9 FR-AUTH, 22, 25.1, 29 |
| 2 (승인) | Phase 2 진입 조건에 유료 AI 등급·호출량 산정(AC-G7), Beta 배포 채널(TR-12, AC-G8) 추가. SEC-11 구체화 | 10, 21, 22, 23, 25.1, 27 |
| 3 (승인) | Phase 1을 1A(출시 안전성·데이터 보호)와 1B(핵심 MVP 품질·측정 체계)로 분리. FR-UPL-04를 Phase 2 이후로 이동. NFR-01·02 기준선을 1B 완료 기준에 추가 | 1, 6.1, 23, 25.1, 26 |
| 4 (승인) | 활성화 지표(추천 가능한 옷장 도달률, 1인당 등록 수, 1벌 등록 시간), 재방문 트리거 결정(FR-TODAY-07), Beta 표본·Go/No-go 구조(24.4) 추가 | 6.2, 9 FR-UPL, 15, 24 |
| 5 (지침에 따라 수정) | WDM 가치 검증을 Phase 2로 이동하되 Concierge Test → 제한된 프로토타입 순서로 정의(FR-WDM-07). 결제·Paywall 조기 구현 대신 가격·가치 테스트(FR-SUB-08)를 먼저 하고 결제 시점은 결과로 결정. Phase 4 WDM은 Catalog 연결로 축소 | 7.1, 17, 17.1, 19.2, 27, 28 |
| 6 (승인) | FR-DS에 평가 세트(06), 최소 스키마(07), 임계값 출처(08), 품질 AC 추가. FR-MISS·FR-WDM 임계값을 Dataset 항목으로 참조 | 11, 16, 17 |
| 7 (지침에 따라 수정) | Core 데모와 기능을 구분. 대표 Core 2~3개를 실제 Digital Closet과 연결하는 Phase 2 PoC(FR-CORE-07) 신설. Core 전체 확장·Dataset 고도화는 Phase 3. 액세서리 노출 경로를 Phase 4 진입 조건으로 추가 | 14, 14.1, 18, 28 |
| 8 (승인) | OKR KR1을 AC-G1 기준으로 통일, 유료전환율 분모를 MAU로 명시, North Star 가설 표기, Phase 3 범위 축소(규칙 기반 개인화, 참여 기능 1개), 계정 삭제의 서버 권한 의존성(TR-13), 중복 ID 정의 원본 지정 | 6.1, 20, 21, 22, 24.2, 28, 부록 B |
| 공통 | Phase 체계를 1A / 1B / 2 / 3 / 4 / 5로 재구성하고 Phase별 진입 조건·완료 기준 명시. 핵심 흐름(Actual Closet → Ideal Fashion Self → 필요한 구매)과 원칙 8(작게 검증한 뒤 만든다) 추가. 24.2에 "현재 실측값" 열을 두어 실측과 가설을 분리 | 2.2, 24.2, 26~28 |

---

*이 PRD는 2026-10-16 시점의 코드와 사업계획서를 근거로 작성한 초안이다. 코드 근거의 줄번호는 작성 시점 작업 트리 기준이다. 사업계획서의 계획·목표는 실적으로 해석하지 않았다.*
