# 현재 추천엔진 Audit

- 작성: 2026-10-19 · 기준 커밋 `942a11c`(브랜치 `sprint/1a-3`) · 읽기 전용 분석(코드 변경 없음)
- 대상: `src/utils/recommendation.ts`, `outfitScore.ts`, `weatherRecommendation.ts`, `prototypeCore.ts`, `src/data/*`, 추천 화면(`src/app/*`), `STYLESEED_Fashion_Knowledge_Dataset_V0.1.numbers`
- 수치 근거: 엔진 기준 스냅샷 `src/utils/__tests__/fixtures/engine-baseline.json`(고정 옷장 15벌, 날씨 5종, Sprint 1A-3에서 생성)

## 0. 요약

| 질문 | 답 |
|---|---|
| 엔진이 몇 개인가 | 점수 체계 **4개**: A 1:1 궁합, B MATCH SCORE, C 날씨(Today), D Core 데모 |
| 화면별 엔진 | Styling = **A로 고르고 B로 표시**, Looks = **B(후보는 A로 고름)**, Today/홈 = **C(B + 날씨 혼합)**, Missing·Demo = A, Core = D |
| 같은 코디에 다른 점수가 나오나 | **예.** 같은 코디 [티셔츠·반바지·스니커즈]: Looks·Styling 77점, Today(31℃) **83점**, Today(17℃) 76점. 모두 “MATCH”라는 같은 이름으로 표시 |
| 원인 | ① Today가 `0.7×MATCH + 0.3×날씨`를 MATCH로 표시 ② 아이템은 A(이분법 점수)로 고르고 점수는 B로 매김 ③ Core 화면은 별도 점수(D)를 %로 표시 |
| Mock vs 실제 | 옷장은 **실제 데이터**(Supabase `clothes`). 상품(`mockProducts`)과 Core 규칙(`POETCORE_DEMO_RULE`)은 **Mock** |
| Dataset 사용 여부 | **코드에서 전혀 쓰지 않음.** 파일은 작업 틀(9개 시트) + 예시 행 수준. 속성 체계가 앱과 다름(6장) |

---

## 1. 화면별 엔진 지도

| 화면 | 파일 | 후보 생성 | 표시 점수 | 표시 이름 | 데이터 |
|---|---|---|---|---|---|
| Styling(옷 하나 선택) | `src/app/styling.tsx:72,75,156` | A `getRecommendedOutfit` | B `evaluateOutfit(...).total` | MATCH | 실제 옷장 |
| Looks(전체 / 옷 하나 기준 Top 3) | `src/app/looks.tsx:57-58,125,170` | B `getRankedLooks`/`getRankedLooksForItem`(내부에서 A `findBestMatch`로 짝 고름) | B `total` | MATCH | 실제 옷장 |
| Today / 홈 | `src/app/today.tsx:45,155`, `src/app/index.tsx:57`, `components/styleseed/today-look-card.tsx:72` | C `getTodaysLooks`(내부에서 A로 코디 구성) | C `score` = 0.7×B + 0.3×날씨 | **MATCH**(날씨 혼합인데 같은 이름) | 실제 옷장 + Open-Meteo |
| Missing | `src/app/missing.tsx:64,70` | A + `getMissingItemSuggestion`(고정 템플릿) | 없음 | — | 실제 옷장 |
| Demo(직접 URL만) | `src/app/demo.tsx:42,46` | A, A 점수로 정렬 | — | — | 실제 옷장 |
| Core Look / Core Match | `src/app/core-look.tsx:83`, `core-match.tsx:112` | D(고정 POETCORE 규칙) | D 정렬도 / 아이템 % | Core 정렬도 | 실제 옷장 + **데모 규칙** |
| Shop / Core Shop | `src/app/shop.tsx:63`, `core-shop.tsx:52` | 속성 일치·D | — | — | **Mock 상품** |

옷장 로딩: 모든 추천 화면이 `useClosetLoader` → `fetchClothesFromSupabase`(`src/lib/clothes.ts:475`)로 로그인 사용자의 `clothes`를 불러와 `useClosetStore`에 넣는다. 저장소는 Mock 옷을 기본값으로 넣지 않는다(`src/store/useClosetStore.ts:26`). `src/data/mockClothes.ts`, `mockOutfits.ts`는 현재 어떤 화면에서도 쓰지 않는다.

---

## 2. 엔진 A — 1:1 궁합 (`src/utils/recommendation.ts`)

| 항목 | 내용 |
|---|---|
| 함수 | `getCompatibilityScore(a, b)` `:102`, `findBestMatch` `:204`, `getRecommendedOutfit` `:232` |
| 후보 생성 | 선택한 옷의 카테고리로 채울 칸을 정한다(`OUTFIT_CATEGORY_PLAN` `:186`: top → bottom·shoes, dress → shoes, outer → top·bottom·shoes 등). 칸마다 **선택한 옷과의 1:1 점수가 가장 높은 옷 1개**를 고른다. 고른 옷끼리는 비교하지 않는다(별 모양) |
| 점수식 | 계절 겹침 25 / 0 + 스타일 겹침 25 / 0 + TPO 겹침 20 / 0 + 색 10~20 + 카테고리 0~10 = 최대 100 |
| 색 | 같은 색 18, 둘 다 중립(black·white·gray·beige·brown·navy) 20, multi 12, 하나만 중립 16, 그 외 10 |
| 코디 점수 | 짝마다 점수의 평균(`:264`) — 화면에 표시하지 않고 Demo 정렬에만 씀 |
| 이유 | 점수가 0보다 큰 항목마다 고정 문장 |
| 안 쓰는 속성 | fit, material, colorTone |
| 죽은 코드 | `getLookInsights` `:460` — 어디서도 호출하지 않음 |

## 3. 엔진 B — MATCH SCORE (`src/utils/outfitScore.ts`)

| 항목 | 내용 |
|---|---|
| 함수 | `evaluateOutfit(items, closet)` `:434`, `getRankedLooksForItem` `:507`, `getRankedLooks` `:597` |
| 후보 생성(Looks 전체) | 상의·하의·원피스를 각각 기준 옷으로 잡고 → 칸(`OUTFIT_PLAN`: top → bottom·shoes, bottom → top·shoes, dress → shoes)을 **A의 `findBestMatch`로** 채움 → 아우터 없는 조합과 아우터 추가 조합을 둘 다 후보로 → 중복 제거 → B 점수로 정렬 → Top 3 |
| 후보 생성(옷 하나 기준) | 상의면 **모든 하의**와 짝 + 신발(A로 고름) + 아우터 추가판. 하의도 같은 방식. 그 외는 상의마다 A로 하의를 붙임 |
| 가중치 | Color 0.22 · Fit 0.16 · Material 0.14 · Season 0.20 · TPO 0.18 · Preference 0.10 (`:51`) |
| Color | 모든 쌍 평균: 둘 다 중립 86, 하나 중립 80, 같은 색 74, multi 70, 강한 색끼리 52 |
| Fit | 상의·아우터 vs 하의·원피스의 볼륨 차이(slim 1 · regular/straight 2 · relaxed/wide 3 · oversized 4): 차이 1 → 92, 2 → 84, 0 → 74, 3 → 58. 신발 제외 |
| Material | 14개 쌍 표(예: knit+wool 92, cotton+denim 88, linen+wool 56), 나머지 전부 72 |
| Season · TPO | `30 + 70 × (공통 값 수 / 전체 값 수)` |
| Preference | 사용자 취향이 아니라 **옷장 안 스타일·색 빈도**(`:310`). 취향 입력 기능 없음 |
| 총점 | `가중합 × (0.82 + 0.18 × 완성도) × 약점 보정(최저 지표 < 40 → 0.88, < 55 → 0.94)`. 완성도 = 상의(또는 원피스)·하의(또는 원피스)·신발 3칸 중 채운 비율. 실제 최고점 약 94 |
| 이유 | 상위 3개 지표의 메모 |

## 4. 엔진 C — Today (`src/utils/weatherRecommendation.ts`)

| 항목 | 내용 |
|---|---|
| 온도 구간 | cold ≤ 5℃ · cool ≤ 15 · mild ≤ 22 · warm ≤ 27 · hot (`:175`) |
| 구간 규칙 | 구간마다 계절, 선호·회피 세부 품목, 선호·회피 소재, 아우터 필요 여부(`BAND_RULES` `:42`). 비·눈이면 실크·리넨, 샌들·힐(눈은 플랫 추가) 회피 |
| 옷 하나의 날씨 점수 | 계절 맞음 50(계절 정보 없음 25) + 소재 선호 25 / 보통 15 / 회피 0 + 품목 같은 방식 |
| 거르기 | 날씨 점수 40 미만은 제외(`MIN_WEATHER_FIT` `:173`). **단, 그 카테고리에 통과한 옷이 하나도 없으면 전부 다시 허용** |
| 후보 생성 | 날씨 통과 옷 중 상의·원피스를 기준으로 A의 `getRecommendedOutfit`으로 코디 구성 |
| 표시 점수 | `0.7 × B + 0.3 × 날씨 점수 평균`(`WEATHER_WEIGHT` `:171`) → **MATCH로 표시** |
| 이유 | 날씨 라벨 한 줄(아이템별 이유 없음) |

## 5. 엔진 D — Core 데모 (`src/utils/prototypeCore.ts`, `src/data/coreDemo.ts`)

| 항목 | 내용 |
|---|---|
| 규칙 | `POETCORE_DEMO_RULE` 하나(고정). 색·품목·소재 1순위/2순위, 계절, 스타일 가중치. `patterns: ["check"]`는 정의만 있고 옷에 패턴 속성이 없어 미사용 |
| 점수 | 옷 하나씩: 색 30/12 + 품목 25/12 + 소재 20/10 + 스타일 최대 15 + 계절 10, 최대 100 |
| 코디 | 칸마다 Core 점수가 가장 높은 옷. 궁합 확인은 A 점수 평균 60 이상이면 통과 |
| 표시 | Core 정렬도, 아이템별 % |
| 테스트 | 엔진 스냅샷 테스트에 **포함되지 않음** |

---

## 6. 서로 다른 Match Score가 생기는 원인 (스냅샷 실측)

| # | 원인 | 실측 예 |
|---|---|---|
| R1 | **Today는 날씨를 섞은 점수를 MATCH로 표시** | [티셔츠·반바지·스니커즈] Looks 77 → Today 31℃ **83**, 17℃ **76** / [셔츠·슬랙스·로퍼] Looks 72 → Today 17℃ **78** |
| R2 | **고르는 기준(A)과 점수 기준(B)이 다름** | A는 이분법(겹치면 만점)이라 B 기준으로 더 좋은 짝을 놓칠 수 있다. 고정 옷장에서는 Styling 선택 = Looks(옷 기준) 1위였지만, 이는 우연이며 보장되지 않는다(A는 fit·material을 보지 않음) |
| R3 | 아이템끼리 비교 안 함 | 하의와 신발을 각각 상의 기준으로만 고름 → 하의-신발 궁합은 B 점수에서야 반영 |
| R4 | 날씨 부적합 옷이 “되돌아옴” | −3℃ 눈: [실크 원피스·로퍼·가죽 재킷] Today 2순위(날씨 48점, 표시 54점) — 원피스 중 날씨 통과 옷이 없어 전부 다시 허용됨 |
| R5 | 같은 개념, 다른 계산 | 계절: A 이분법 / B 비율 / C 구간 규칙. 중립색 목록이 두 파일에 중복. 같은 색: A 18/20 vs B 74/86 |
| R6 | Core는 별개 체계 | Core 화면 % 는 MATCH와 무관한 0~100 |

참고: 이전 보고(Sprint 1A-3 결과)의 “Styling 100점 vs Looks 77점”은 **화면에 보이는 숫자가 아니라** A의 내부 점수(100)와 B 점수(77)의 차이였다. Styling 화면은 B 점수를 표시하므로 같은 코디라면 Looks와 같은 숫자다. 사용자가 실제로 보는 불일치는 R1(Today)이다.

---

## 7. Fashion Knowledge Dataset V0.1 — 실제 구축 범위

파일: `STYLESEED_Fashion_Knowledge_Dataset_V0.1.numbers`(저장소 루트, Git 미추적, 수정 2026-09-11). Numbers 내보내기가 실패해 파일 내부 표 데이터를 직접 해독했다(원본 변경 없음). **글자 셀은 모두 읽었고, 숫자 셀(점수)은 읽지 않았다.**

| 시트 | 내용 | 구축 상태(추정) |
|---|---|---|
| 00_작업지시서 | 역할(동업자: 속성·규칙·라벨·평가·예외 / 개발: DB·알고리즘), 작성 원칙 RULE 01~05, 권장량(규칙 60~100, 라벨 150~300, 고정 세트 60~100, 예외 20), 일정 | 완성 |
| 01_의류속성사전 | 12개 속성: category, subcategory, main_color, value(명도), saturation(채도), fit, silhouette, material_feel(소재감), thickness, season, tpo, mood. 정의·허용값·판단 기준·예시·검토 상태 | **정의 완료**, 상태는 확정/초안/검토중 혼재(셀 위치는 미확인) |
| 02_스타일링룰북 | 열: Rule ID, 평가 차원, 조건 A/B, TPO·무드 조건, 기본 판정(권장/조건부 권장/주의/비권장), 강도 1~5, 판단 이유, 예외 조건, Confidence, 검토자 | **예시 약 6행**(fitted top+wide bottom 권장, oversized top+wide 주의, navy+white, 고채도+고채도 주의, glossy+glossy 주의, blazer+denim). Rule ID 값은 비어 있는 것으로 보임 |
| 03_코디라벨링 | 상의·하의·아우터·TPO·Mood + 5개 차원 1~5점 + Overall(자동) + 라벨 | **예시 2행**(white fitted tee+black wide slacks, oversized hoodie+wide cargo) |
| 04_평가기준 | 5개 차원(Color, Silhouette & Fit, Material, TPO, Mood) × 1~5점 기준 문장 | **완성** |
| 05_예외사례 | 기본 규칙 / 일반 판정 / 예외 상황 / 성립 조건 / 최종 판정 | **예시 3행**(oversized+wide @street, 고채도 컬러블로킹, formal+casual @smart casual) |
| 06_검수세트 | 전문가 Overall·라벨 / 알고리즘 점수·라벨 / 일치 여부 | **0행** |
| 07_진행현황 | 목표 대비 COUNTA 수식 | 틀만 있음 |
| 99_메모 | 버전·원칙(“목표 수치를 완료 수치처럼 표현하지 않기”) | 완성 |

**결론:** 설계(속성 사전·평가 기준·작업 원칙)는 탄탄하다. 실제 데이터(규칙·라벨·검수 세트)는 예시 수준이고 승인 상태·버전·평가자 분리 구조가 없다. 코드와는 연결되어 있지 않다.

### 7.1 Dataset 속성 체계 vs 앱 속성 체계

| 속성 | 앱(Gemini 출력·DB 열) | Dataset | 차이 |
|---|---|---|---|
| 카테고리 | top·bottom·outer·dress·shoes·bag·accessory | 같음 | 없음 |
| 세부 품목 | 품목별 목록(tshirt, slacks …) | tee, denim 등 예시 | 이름 맞추기 필요(tee↔tshirt, denim↔jeans) |
| 색 | 14색(+ multi) | 13색 | multi 처리 정의 필요 |
| 톤 | colorTone: bright·light·muted·dark·vivid | **value(명도) + saturation(채도)** 2축 | 변환표 필요 |
| 핏 | slim·regular·relaxed·oversized·**straight·wide** | slim·**fitted**·regular·relaxed·oversized | 앱의 straight·wide는 실루엣에 가까움 |
| 실루엣 | **없음** | I·H·A·X·volume·straight·flared | AI 분석에 추가해야 사용 가능 |
| 소재 | 섬유명(cotton, wool …) | **소재감**(crisp, soft, fluid, sheer, glossy, matte, fuzzy, heavy) + **두께**(thin·medium·thick) | 섬유명 → 소재감 변환표 또는 AI 분석 추가 |
| 계절 | spring·summer·fall·winter | autumn, **all-season** | 이름 맞추기 |
| TPO | casual·office·date·formal·travel·party | + **school·active** | 앱에 추가 여부 결정 |
| 무드/스타일 | style: minimal·classic·casual·street·sporty·feminine·**vintage** | mood: + **romantic·edgy**, vintage 없음 | 통합 목록 결정 |
| 패턴 | 없음 | 없음(Core 데모에만 check) | 둘 다 없음 |

**의미:** Dataset 규칙 중 실루엣·소재감·두께·명도/채도를 쓰는 규칙은 지금 앱 데이터로는 **판정할 수 없다.** Phase 1B에서 ① 변환표로 근사하거나 ② AI 분석 항목을 늘려야 한다(9장 결정).

---

## 8. 점검 결과 요약 (Phase 1B 입력)

| # | 문제 | 영향 | Phase 1B 대응 |
|---|---|---|---|
| F1 | Today가 날씨 혼합 점수를 MATCH로 표시 | 같은 코디 점수가 화면마다 다름(AC-G5 미충족) | Match Score와 Weather Fit 분리 표시 |
| F2 | A(이분법)로 아이템 선택 | 선택 품질 저하, fit·소재 무시 | 하나의 점수로 후보 평가 |
| F3 | 아이템끼리 비교 안 함 | 하의-신발 부조화 | 모든 쌍 비교 |
| F4 | 날씨 부적합 옷 재허용 | 혹한기 실크 원피스 | 승인된 날씨 규칙으로 제외 + Missing 안내 |
| F5 | 근거 없는 상수(가중치·소재표 14쌍·볼륨표) | 설명 불가 | 사람이 승인한 규칙 데이터로 교체 |
| F6 | Preference가 옷장 빈도 | “취향”이라는 이름과 실제가 다름 | 취향 데이터 없을 때 처리 규칙 명시(설계 문서) |
| F7 | Dataset 미연결, 속성 체계 불일치 | 동업자 작업이 엔진에 못 들어감 | 속성 사전 정렬 + 승인 데이터만 로드 |
| F8 | Core·Shop은 Mock | 실사용 판단 불가 | Phase 2 범위(1B는 표시만 분리) |
| F9 | Core 엔진·`getLookInsights` 검증 공백 | 회귀 위험 | 스냅샷 추가, 죽은 코드 삭제 |

## 9. 결정이 필요한 사항 (공동창업자)

1. **속성 체계 확정:** 핏/실루엣 분리, 톤 2축(명도·채도), 소재감·두께, TPO(school·active), 무드 목록 — `garment_schema.csv`에서 “확정” 처리
2. **AI 분석 확장 여부:** 실루엣·소재감·두께를 Gemini가 추출하게 할지(분석 정확도 실험 필요), 아니면 변환표로 근사할지
3. **기존 Numbers 예시 행 처리:** 새 템플릿으로 옮겨 **사람이 다시 검토·승인**할지(옮길 때 `data_origin=human`, 상태 `초안`)
