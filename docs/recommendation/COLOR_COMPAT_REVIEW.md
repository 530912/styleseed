# 주색상 사전(Knowledge Lab r1) 앱 호환성·추천 엔진 영향 검토

- 작성: 2026-10-22 (Claude A) · 기준 커밋 `af5aeb7`(점프수트·베스트 호환 계층 포함)
- 입력: Claude C `KNOWLEDGE_LAB_COLOR_HANDOFF.md` r1
  - Lab 작업 폴더 원본과 앱 저장소의 읽기 전용 사본(`docs/handoff/from-knowledge-lab/2026-10-22-color/`)이 같은 파일이다(sha1 `691b618c`). Lab 커밋은 `49c92ff`다.
  - 기준 스냅샷은 `lab-backup-2026-10-22T04-36-24.json`이다. 20개 모두 제안 상태이고, 서명은 0건이다.
- 비파괴 검증: `bash scripts/analysis/color-review-2026-10-22/run.sh`
  - 엔진 사본과 모의 옷장, 계약·상품 검증기만 사용한다.
  - Gemini 호출, DB 접근, 파일 변경은 없다.
- 바꾸지 않은 것: 앱 코드, Gemini 스키마·프롬프트(`backend/server.js`), Supabase(운영·QA), Data Contract 0.2.0, 상품 계약, Lab DB·파일
- 표시: **[코드]** 코드를 읽어 확인 · **[실행]** 하네스로 확인 · **[추론]** 판단, 확인 필요 · **[미검증]** 실행하지 못함

---

## 1. 현재 앱의 색상 처리 구조

### 1.1 허용 값 [코드][실행]

| 위치 | 값 |
|---|---|
| 앱 `CLOTHING_COLORS` (`src/constants/clothingOptions.ts:43`) | 14개: black, white, gray, beige, brown, navy, blue, red, pink, orange, yellow, green, purple, multi |
| Gemini `responseSchema.color.enum` (`backend/server.js:590`) | 앱과 **같은 14개** |
| Data Contract 0.2.0 `app_compat.app_values.color` | 앱과 같은 14개 |
| 1라운드 상품 계약 `product-catalog-v0.1.json` color | 앱과 같은 14개 |
| `COLOR_TONES` (앱·Gemini·계약) | bright, light, muted, dark, vivid |

네 목록이 서로 같다는 것은 하네스 실행 전에 스크립트로 비교해 확인했다.

### 1.2 Gemini가 color·colorTone을 만드는 방식 [코드]

- **색 판단 문장이 프롬프트에 없다.** 프롬프트는 의류 하나를 고르는 규칙과 상자 좌표만 설명하고, 끝에 "스키마의 허용 값만 쓰라"는 한 줄뿐이다.
  - 그래서 다음이 모두 정해져 있지 않다: 주색상 판단 원칙(가장 넓은 면적, 조명·배경 제외), multi 기준, colorTone 기준, 목록에 없는 색을 어디로 근사할지.
- `color`와 `colorTone`은 필수 enum이다. 구조화 출력이라 **목록 밖 값(ivory 등)은 나올 수 없다.** 신규 6색은 항상 14개 중 하나로 근사되어 나오는데, 어떤 값을 고를지는 모델에 맡겨져 있다.
- 서버는 Gemini JSON을 값 검사 없이 그대로 돌려준다(`JSON.parse` 후 통과). 앱도 color 값을 정리하지 않는다. `normalizeAnalysisTaxonomy`는 대분류·세부분류만 다룬다.

### 1.3 저장·조회·수정 [코드]

| 단계 | 처리 |
|---|---|
| Supabase `clothes.color` / `color_tone` | `text not null`이고 CHECK 제약이 없다. 목록 밖 문자열도 저장된다 |
| 저장 (`src/lib/clothes.ts:415`) | 화면에서 고른 값을 그대로 저장한다 |
| 조회 (`clothes.ts:506`) | 그대로 읽는다. 값 검사도, 대체값도 없다 |
| 수정 화면 (`src/app/analyze.tsx:550`) | 14개 칩만 보인다. 현재 값이 목록 밖이면 선택된 칩이 없지만 값은 그대로 유지되어 저장된다. 오류는 없다 |
| 저장 후 수정 | 속성 수정 기능이 없다(이미지 교체만 있음) |

### 1.4 목록 밖 값의 대체 처리와 오류 [코드][실행]

- 앱과 엔진 어디에도 색 대체 규칙이 없다. 목록 밖 값은 **그대로 흘러간다.**
- 오류는 나지 않는다(C1). 하지만 엔진은 그 값을 **"무채색이 아닌 일반 유채색"** 으로 취급한다(1.6, C2).
- 색이 빈 값이면 `toTitle(undefined)`에서 앱이 멈출 수 있다(`src/utils/format.ts`). 하지만 DB의 not null 제약과 Gemini 필수 필드 때문에 지금은 그런 값이 들어올 수 없다.

### 1.5 화면 표시 [코드]

- 이름은 `toTitle(color)`로 영문 첫 글자만 대문자로 바꿔 보여 준다(Black, Multi, Ivory). 한글 색 이름 표시는 없다.
- 옷 이름은 `getClothingName`이 "Color + 세부분류"로 만든다(13개 화면에서 사용). 목록 밖 값도 그대로 보인다(예: Burgundy Knit).

### 1.6 엔진에서 색이 쓰이는 곳 (4장에서 자세히)

`recommendation.ts getColorScore`, `outfitScore.ts scoreColor`·`scorePreference`, `prototypeCore.ts getPrototypeCoreScore`, `app/shop.tsx`의 상품 색 일치, `getMissingItemSuggestion`의 고정 색

---

## 2. 신규 6색 호환성

공통 사항:

- 신규 6색 모두 **현재 앱이 직접 지원하지 않는다**(앱 목록, Gemini enum, 계약 모두 14개).
- 저장값으로 들어와도 오류는 없다(C1).
- 원본을 보존하는 가장 단순한 방법은 이미 갖춰져 있다. `clothes.color`가 자유 텍스트라서 **원래 값을 그대로 저장할 수 있다.** 점프수트·베스트 호환과 같은 방식(세부분류 원래 값 유지)이다.

| 신규 | 앱 근사값(후보) | 근사하면 사라지는 정보 | 원본 보존 방법 | 직접 지원 시 필요한 변경 |
|---|---|---|---|---|
| ivory | white(또는 beige) | 따뜻한 흰색과 순백의 구분. 엔진에서는 무채색이라는 성질을 잃지 않으려면 반드시 white·beige로 근사해야 함(C2: ivory 그대로면 무채색 아님 → 점수 하락) | 저장값 ivory 유지 + 엔진에서 "white 계열 무채색"으로 해석 | 목록·enum·계약에 추가, 무채색 목록에 포함, 프롬프트 기준 |
| burgundy | red(또는 purple·brown) | 짙은 와인색과 선명한 레드의 구분. 클래식·포엣코어 분위기 신호 | 저장값 유지 + "red 계열" | 목록·enum·계약, Core 규칙의 red 근사 제거 |
| olive | green(또는 brown·beige) | 어스톤·밀리터리 계열. 스타일링에서는 흔히 중간 무채색처럼 쓰임 | 저장값 유지 + "green 계열" | 같음. 무채색 여부를 공동창업자가 결정 |
| teal | blue 또는 green | 어느 쪽으로 바꿔도 반대쪽 정보를 잃음 | 저장값 유지 + "blue·green 사이" | 같음 |
| gold | yellow(또는 beige·brown) | **금속감.** 노란 옷과 같아짐. 주얼리의 금·은 구분이 사라짐 | 저장값 유지 + 금속색 표시 | 같음 + 금속성 처리 결정(2.1) |
| silver | gray | **금속감.** 일반 회색 옷과 같아짐. 주얼리의 은색 구분이 사라짐 | 저장값 유지 + 금속색 표시 | 같음 + 2.1 |

**조용한 근사를 피하려면:** 저장값은 원래 값으로 두고, 엔진이 해석할 때만 "색 계열·무채색 여부·금속색 여부"를 표에서 찾는다. 앱 목록이 필요한 곳(수정 칩, 상품 매칭)에서는 대응값을 따로 둔다. 설계는 6장에 있다.

### 2.1 골드·실버와 금속성 [추론]

- **엔진 영향이 크다:** 지금 근사 규칙으로 gold → yellow로 바꾸면, 금 귀걸이와 빨간 원피스 조합이 "유채색끼리 충돌"(Looks 색 52)로 계산된다. silver → gray는 무채색으로 계산되어 안전하다. 같은 금속 액세서리인데 한쪽만 감점된다.
  - 실제 스타일링에서 금·은 금속색은 대부분 **무채색처럼 어디에나 어울리는 포인트**로 쓰인다.
- **1라운드 주얼리 상품과 바로 연결된다:**
  - 상품 CSV 검증기는 silver·gold를 `E_ENUM` 오류로 거부한다(P1 실행 결과).
  - 가이드는 "gray + 메모 '실버'"로 안내한다(`PRODUCT_CSV_GUIDE.md:62`). 그래서 주얼리 상품의 금·은 정보는 메모에만 남는다.
- **Lab 정의의 모순(인계서 3장 마지막 행)은 그대로 확인된다.** 실버를 gray와 구분하는 유일한 근거가 금속감이다. 그런데 공통 원칙은 광택을 주색상과 분리하라고 한다.
- **권장안(공동창업자 결정):** 인계서 (가)안에 가깝게 간다.
  - gold·silver는 "금속색"이라는 독립된 주색상 값으로 인정한다. 공통 원칙에는 "금속색은 색조와 금속감을 함께 본다"는 예외를 한 줄 넣는다.
  - 금속감이 없는 회색·노랑 의류는 gray·yellow로 둔다.
  - 엔진은 금속색을 무채색처럼(어디에나 어울리게) 다룬다.
  - (나)안(색조만 보고 금속성은 별도 속성)은 앱에 금속성 속성이 생기기 전까지 정보가 사라진다. 이유는 위의 엔진 점수 왜곡이다.

---

## 3. Gemini 의류 색상 분석 검증

### 3.1 이번에 확인한 것

| 확인 | 결과 |
|---|---|
| 신규 6색이 분석 결과로 나올 수 있는가 [코드] | **나올 수 없다**(enum 14개). 항상 근사되고, 근사 방향을 정하는 문장이 없다 |
| multi 기준이 Lab과 같은가 [코드] | 프롬프트에 multi 정의가 없다. Lab 기준("대표색이 정말 불명확할 때만", 50% 규칙 아님)이 적용된다는 보장이 없다 → **[미검증]** |
| 조명·그림자·배경·워싱 [코드] | 프롬프트에는 "배경·사람을 무시하라"는 대상 선택 규칙만 있고, **색 판단에서 조명·반사광을 빼라는 지시가 없다.** 워싱·그라데이션 데님이 multi로 나올 위험을 막는 문장도 없다 |
| 기존 실측 기록 [코드] | Sprint 1A-3 A/B 기록(`docs/sprints/sprint-1a-3-result.md:77`)은 "6개 속성 중 5개 이상 일치"라는 요약만 있다. 색만 따로 본 정확도 기록이 없다 |
| 기존 테스트 이미지 | `assets/images/products/` 7장(흰 셔츠, 흰 운동화 3장, 브라운 로퍼, 데님, 스커트). **신규 6색과 경계 사례(아이보리, 버건디, 올리브, 틸, 금·은, 차콜·네이비, 다색 패턴)에 해당하는 사진이 없다** |

**결론:** 아래 7개 경계와 multi 구분은 실제 사진으로 Gemini를 호출해야만 검증할 수 있다. 이번에는 호출하지 않았다.

### 3.2 위험 판단 [추론]

| 경계 | 예상 근사 | 위험 |
|---|---|---|
| white / ivory / beige | ivory는 white와 beige로 갈림. 따뜻한 조명에서는 흰 옷도 beige로 나올 수 있음 | 중간. 엔진에서는 둘 다 무채색이라 점수 영향은 작음 |
| red / burgundy | burgundy는 red가 많고, 어두운 사진에서는 brown이나 purple이 나올 수 있음 | 중간. red와 brown은 무채색 여부가 달라서 점수가 바뀜 |
| green / olive | olive는 green 또는 brown·beige로 나옴(카키) | **높음.** brown·beige로 나오면 무채색으로 계산됨. 같은 옷이 사진마다 점수가 다를 수 있음 |
| blue / teal | 둘 중 하나로 갈림 | 낮음. 둘 다 유채색 |
| gray / silver | silver는 gray 또는 white(반사광)로 나옴 | 낮음. 둘 다 무채색 |
| yellow / gold | gold는 yellow·beige·brown으로 나옴 | **높음.** yellow면 유채색, beige·brown이면 무채색 |
| black / navy | 어두운 사진에서는 navy가 black으로 나옴 | 낮음. 둘 다 무채색 |
| 단색 / multi | 스트라이프 70:30, 그라데이션 데님이 multi로 나올 위험 | **높음.** multi 점수 규칙이 단색과 크게 달라서 영향이 큼(4.2) |

### 3.3 실측 계획 (실행 전 승인 필요)

- **사진:** 인계서 T1~T8 기준으로 경계마다 2~3장씩 약 30장. 이 중 10장은 자연광과 따뜻한 조명을 한 쌍씩 찍는다.
  - 출처는 직접 촬영한 사진, 또는 이용 허가를 받은 상품 사진만 쓴다. **실제 사용자 사진은 쓰지 않는다.**
- **정답:** 공동창업자가 Lab 기준으로 정한 주색상(ivory 등 원래 값)과, 앱 목록 기준 기대 근사값을 함께 기록한다.
- **호출 수:** 약 30장 × 3회 반복 = **약 90회**. 기존 스크립트(`gemini-mask-ab.js`) 방식을 쓰고, 모델과 설정은 바꾸지 않는다.
- **비용:**
  - 현재 키가 무료 등급이면 금액은 0원이고 무료 한도만 쓴다. 다만 무료 등급은 입력 사진이 Google 서비스 개선에 쓰일 수 있어서, 우리 소유 사진만 쓴다.
  - 유료 등급 전환은 이번 범위가 아니다.
- **측정:** 경계별 앱 값 분포, 반복 일관성, multi 오판율(70:30·그라데이션 사진)
- **프롬프트 비교:** 색 기준 문장(5장 P1-1)을 넣은 서버와 넣지 않은 서버를 같은 사진으로 비교하면 호출 수가 2배(약 180회)가 된다.

---

## 4. 추천 엔진에서 색의 역할

### 4.1 경로별 실제 사용 [코드][실행]

| 경로 | 색 사용 | 신규 6색이 들어오면 |
|---|---|---|
| Styling (`recommendation.ts getColorScore`, 20점 만점) | 같은 색 18, 무채색끼리 20, multi 포함 12, 무채색 하나 16, 유채색끼리 10. 근거 문구와 Looks 인사이트 "COLOR"에도 쓰임 | 오류 없음. 모두 유채색으로 계산되어 ivory·silver+black이 16(white·gray는 20), ivory·silver+유채색이 10(white·gray는 16) |
| Looks·PLUS (`outfitScore.ts scoreColor`, 가중치 0.18) | multi 포함 70, 같은 색 74, 무채색끼리 86, 무채색 하나 80, 유채색끼리 52 | ivory+black 80(white 86), **ivory+red 52(white+red 80)**, silver+pink 52(gray+pink 80) |
| Today (`weatherRecommendation.ts`) | 색을 직접 쓰지 않음. 코디 점수(Looks 규칙)를 통해 간접 반영 | 시험한 사례에서는 순위 변화 없음(C7). 유채색끼리 조합에서는 같은 감점이 적용됨 |
| 취향 점수 (`scorePreference`) | 옷장 안 색 빈도를 **문자열 그대로** 셈 | red 옷장에서 burgundy 코트 = 90 = blue 코트(red 코트 96). 비슷한 계열로 인정되지 않음(C5) |
| Core 데모 (`prototypeCore.ts`, 색 30점) | `POETCORE.colors.primary = brown·red·green`, 화면 라벨은 Brown·Burgundy·Olive | **실제 burgundy·olive 옷이 54점으로, red·green(84)보다 낮음**(C6). 라벨과 반대 |
| Missing Item (`getMissingItemSuggestion`) | 카테고리별 고정 색(black·white·brown·blue)만 제안 | 영향 없음 |
| 상품 매칭 (`app/shop.tsx:75`) | 제안 색과 상품 색이 **완전히 같을 때만** 35점 | 상품이 burgundy면 red 제안과 맞지 않음. 다만 지금은 상품 CSV가 신규 색 자체를 거부함 |
| Core 상품 교체 (`toScorableClothing`) | 상품 색 그대로 사용, colorTone은 `"muted"` 고정 | 위 Core와 같음 |
| 날씨 규칙 | 색 사용 없음 | — |

### 4.2 multi 처리 [실행]

| 조합 | Styling(/20) | Looks(/100) |
|---|---|---|
| multi + multi | **18** (같은 색 규칙이 먼저 적용됨) | 70 |
| multi + black | **12** | 70 |
| multi + red | 12 | 70 |
| red + black | 16 | 80 |
| red + blue | 10 | 52 |
| black + white | 20 | 86 |

- **두 엔진의 판단이 다르다.**
  - Styling은 무늬 옷 두 벌(multi+multi)을 "같은 색, 조화로움"(18)으로 높게 본다. Looks는 70으로 본다.
  - 실제로는 패턴끼리 겹치는 조합이 가장 부딪히기 쉽다.
- **무늬 옷 + 무채색**(가장 안전한 조합)이 Styling에서 12점이다. 빨간 옷 + 검정(16)보다 낮다. Looks에서는 multi가 들어가면 상대 색과 관계없이 70으로 고정된다.
- 정리하면 multi를 단색과 똑같이 취급하지는 않는다. 그런데 **같은 색 규칙이 multi에도 적용되고, 무채색과 함께 입어도 이득이 없다.**

### 4.3 colorTone·명도·채도 [실행]

- **colorTone은 추천에 쓰이지 않는다.** 옷장 15벌의 colorTone을 5가지로 일괄 변경해도 Styling, Looks, Today, Core 결과가 모두 같다(C4).
- colorTone은 분석, 저장, 상품 CSV에만 있는 **데이터 전용 값**이다. 상품을 점수로 바꿀 때는 `"muted"`로 고정된다.
- 명도와 채도는 앱에 독립 속성이 없다. Lab의 명도·채도 ↔ colorTone 변환표(D-F02)도 정해지지 않았다.

---

## 5. 개선 우선순위

### P0: 앱 충돌·저장 오류·엔진 치명적 오작동 → **해당 없음**

- 신규 6색이 저장값으로 들어와도 Styling, Looks, Today, Missing, Core 모두 오류가 없다(C1).
- DB는 어떤 문자열이든 저장한다. 수정 화면도 멈추지 않는다.
- 남은 잠재 위험: 빈 색 값이면 `toTitle`에서 오류가 날 수 있다(P2-6). 지금은 들어올 수 없다.

### P1: 1라운드 의류 분석·추천 품질·사용자 테스트에 영향

| # | 문제 | 코드 | 재현 | 해결안 | 테스트 |
|---|---|---|---|---|---|
| P1-1 | Gemini 프롬프트에 색 판단 기준이 없음. multi·조명·배경·워싱 기준이 없고 신규 색 근사 방향도 정하지 않아, 같은 옷이 사진마다 다른 색(특히 olive·gold → 무채색 또는 유채색)으로 나올 수 있음 | `backend/server.js:450` 프롬프트 | 3.3 실측(미실행) | Lab 공통 원칙(부록 B)을 영어 5~6줄로 옮기고, multi 기준과 근사 규칙을 추가. **스키마는 그대로 둠.** server.js는 Claude B 영역이므로 인계 문서로 전달 | 3.3 A/B(색 기준 유무), multi 오판율, 반복 일관성 |
| P1-2 | multi 점수 규칙 불일치: Styling multi+multi = 18(같은 색 취급), multi+무채색 12 < 유채색+무채색 16. Looks는 70으로 고정 | `recommendation.ts:47-71`, `outfitScore.ts:152-185` | C3 | multi 확인을 같은 색 확인보다 먼저 하고, 점수 순서를 multi+무채색 ≥ 유채색+무채색 > multi+유채색 > multi+multi로 정함. 기존 사용자 결과가 바뀌므로 **엔진 스냅샷 갱신 승인 필요** | 조합별 점수 표 테스트, 스냅샷에서 바뀐 항목 목록 검토 |
| P1-3 | 계약 0.2.0: 주색상이 필수라서 신규 6색 의류는 **통째로 제외**됨(S1 기준선에서 빠짐) | `scripts/fkd/app-compat.mjs:75-87` | K1: 6개 모두 unsupported | 색마다 converted(근사, 원본은 보고서에 남음) 또는 0.3에서 "원래 값 보존(preserved)" 도입. 공동창업자·Claude C 결정 | K1·K2 시나리오를 계약 테스트로 고정 |
| P1-4 | 주얼리 상품의 금·은을 표현할 수 없음. 검증기가 silver·gold를 `E_ENUM`으로 거부하고, 가이드는 gray + 메모를 안내. gold는 근사값이 정해져 있지 않음 | `product-catalog-v0.1.json`, `PRODUCT_CSV_GUIDE.md:62` | 상품 검증기 실행 결과 | 1라운드: 금·은 근사 규칙을 가이드에 명시(silver → gray, gold → 공동창업자 결정, 메모 필수). 원래 값을 따로 담는 열(P1-8 "원래 유형" 열과 같은 승인 건)을 함께 검토. 주얼리 노출 경로(PC-1)가 결정될 때만 해당 | 예시 CSV로 검증기 실행 |

### P2: 2라운드 이후 고도화

| # | 문제 | 코드 | 재현 | 해결안 | 테스트 |
|---|---|---|---|---|---|
| P2-1 | 목록 밖 색은 모두 "유채색"으로 계산됨(ivory·silver가 무채색으로 인정되지 않음) | `NEUTRAL_COLORS` 두 곳 | C2 | 6장 색 성질 표로 대체(기존 14개 결과는 그대로) | 14개 결과 불변 스냅샷 + 신규 색 조합 표 |
| P2-2 | Core 데모: 라벨은 Burgundy·Olive인데 점수는 red·green 기준이라, 실제 burgundy·olive 옷이 더 낮게 나옴 | `src/data/coreDemo.ts:98` | C6 | primary에 burgundy·olive를 추가(근사값 red·green도 유지). 1라운드에는 Core가 콘셉트 시연 전용이라 P2 | Core 점수 테스트 |
| P2-3 | colorTone이 추천에 쓰이지 않음(데이터 전용). 상품은 muted로 고정 | `outfitScore.ts`, `prototypeCore.ts:124` | C4 | D-F02(명도·채도 ↔ colorTone)를 정한 뒤 톤 조화 규칙 추가 | 톤만 바꿨을 때 점수가 바뀌는지 |
| P2-4 | 취향 점수가 색을 문자열 그대로 셈(burgundy를 red 계열로 인정하지 않음) | `outfitScore.ts:333` | C5 | 색 계열(family) 단위로 세기 | C5 |
| P2-5 | 수정 화면에 목록 밖 현재 색 칩이 없음(값은 유지되지만 보이지 않음) | `analyze.tsx:550` | 6색을 지원하기 전에는 재현 불가 | 세부분류처럼 `getColorOptions(current)`로 현재 값을 칩에 남김 | 단위 테스트 |
| P2-6 | 서버·앱이 분석 결과의 색 값을 검사하지 않고, 빈 값이면 `toTitle`이 멈출 수 있음 | `server.js` 응답 통과, `format.ts` | 지금은 재현 불가(필수 enum) | 앱에서 값 정리(목록 밖 값은 원래 값을 유지하고 표시) | 모의 응답 테스트 |
| P2-7 | multi는 패턴과 보조색 정보를 잃음(Lab 메모와 같은 문제) | — | — | 보조색·패턴 속성(Lab 개선안) | — |
| P2-8 | 색 이름이 영문으로만 표시됨(Burgundy, Olive) | `format.ts toTitle` | — | 한글 라벨 표(Lab `value_ko`) | — |
| P2-9 | 상품 매칭이 색 완전 일치만 봄 | `app/shop.tsx:75` | — | 색 계열 일치 부분 점수 | — |

---

## 6. 주색상 확장 설계안 (구현하지 않음, 승인 후 진행)

점프수트·베스트 호환 계층(`taxonomyCompat.ts`)과 같은 원칙을 따른다. **저장값은 원래 값으로 두고, 엔진은 해석만 한다.** 두 계층은 서로 다른 필드(category·subCategory ↔ color)만 다루므로 충돌하지 않는다.

### 6.1 1단계: 앱 내부만 변경 (서버·DB·계약 변경 없음)

| 파일 | 변경 |
|---|---|
| 신규 `src/utils/colorCompat.ts` | `COLOR_TRAITS` 표(14 + 6): `family`(white·red·green·blue·yellow·gray 등), `neutral`, `metallic`, `appListColor`(앱 14개 대응값, 없으면 null). `resolveColor(raw)` → `{ color: raw, appListColor, status: exact·preserved·unsupported, traits }`. 모르는 값은 지금과 같이 유채색으로 취급(기존 결과 불변) |
| `recommendation.ts`·`outfitScore.ts` | `NEUTRAL_COLORS.includes` → `isNeutralColor(color)`. **기존 14개의 결과는 바뀌지 않음**(스냅샷으로 확인) |
| `analyze.tsx` | 색 칩을 `getColorOptions(current)`로 표시(목록 밖 현재 값 유지) |
| `coreDemo.ts` | POETCORE primary에 burgundy·olive 추가 |
| 테스트 | `color.compat.test.mjs`: 14개 결과 불변, 신규 6색 조합 표, 중복 해석 안전, 모르는 값 |

- **공동창업자가 정할 것:** 각 신규 색의 무채색·금속색 여부.
- 권장안: ivory = 무채색(white 계열), silver·gold = 금속색(무채색처럼 처리), burgundy·olive·teal = 유채색.
  - olive를 무채색처럼 볼지는 스타일링 관점의 선택이다.
- multi 점수 규칙 수정(P1-2)은 기존 결과를 바꾸므로 **따로 승인받는다.**

### 6.2 2단계: 2라운드 (서버·계약 변경과 실측 필요)

1. `CLOTHING_COLORS`, Gemini enum, 상품 계약, Data Contract `app_values.color`에 6색 추가(계약 0.3)
2. 프롬프트 색 기준(P1-1)과 3.3 실측
3. **배포 순서:** 앱(1단계 호환 계층)을 먼저 배포하고, 그다음 서버 enum을 넓힌다.
   - 반대 순서로 하면 구버전 앱에 ivory가 들어온다. 그래도 오류는 없지만(C1) 유채색으로 계산된다.

---

## 7. 이번 작업 범위 확인

- 추가한 파일:
  - `scripts/analysis/color-review-2026-10-22/`(하네스 3개 파일)
  - 이 문서
  - `docs/handoff/knowledge-lab-color-mapping.md`(Claude C 전달용)
- 앱 코드·서버·DB·계약·Lab은 변경하지 않았다. Gemini도 호출하지 않았다.
- 하네스 출력 전문은 `run.sh`를 실행하면 다시 얻을 수 있다(결정적).
