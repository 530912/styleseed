# 색상 체계 전환 설계: color + value + saturation (D-F02)

- 작성: 2026-10-22 (Claude A) · 기준 커밋 `ccf84c4`(주색상 검토 포함)
- 입력: Claude C `KNOWLEDGE_LAB_COLOR_CONTRACT_REQUIREMENTS.md` r1
  - Lab 원본과 앱 사본이 같은 파일이다(sha256 `2035d9aebcb0`). Lab 커밋은 `efc7a31`이다.
  - 근거는 D-F02 담당자 결정안(논의중, 서명 0)이다.
- 이 문서는 **설계와 안전한 테스트**만 다룬다.
  - 하지 않은 것: 운영·QA DB 변경, 사용자 사진 재분석, Gemini 호출, Data Contract 변경, 앱·서버 코드 변경, 배포
  - 바꾼 것: 내 문서 `MATCH_SCORE_V0.1.md` 3.4의 colorTone 역산 5행에 폐기 표시(요구 V6)
- 검증 자료(`scripts/analysis/color-tone-2026-10-22/`):
  - `tone-rules.mjs`: 규칙 초안. 앱 코드가 아니다
  - `tone-rules.test.mjs`: 11개 테스트, 모두 통과
  - `measure.cjs`: 색상 공간 측정 시제품. 저장소 상품 사진 7장만 쓴다
- 표시: **[코드]** 코드로 확인 · **[실행]** 실행으로 확인 · **[제안]** 설계안, 공동창업자·PO 결정 필요

---

## 1. 현재 colorTone 추적 [코드]

| 항목 | 실제 상태 |
|---|---|
| 정의 | `COLOR_TONES = bright, light, muted, dark, vivid`(`src/constants/clothingOptions.ts:60`). **의미를 설명하는 문장이 코드·프롬프트 어디에도 없다.** 상품 CSV 가이드에만 한글 이름(밝은·연한·차분한·어두운·선명한)이 있다 |
| 생성 | Gemini `responseSchema.colorTone` 필수 enum(`backend/server.js:610`). 프롬프트에 기준이 없어 **모델이 마음대로 고른다** |
| 사람 확인 | **없다.** 분석 화면에 colorTone 카드도 수정 칩도 없다(`analyze.tsx`에 tone 관련 코드 0건). 사용자는 colorTone 값을 본 적이 없다 → 운영 DB의 colorTone은 **전부 사람 검토 없는 Gemini 값**이다 |
| 저장 | `clothes.color_tone text not null`, CHECK 제약 없음(`clothes.ts:417`). 조회는 그대로(`clothes.ts:508`) |
| 서버 검사 | 없다(Gemini JSON 통과). 백엔드 테스트 데이터에는 목록 밖 값(`warm`·`neutral`)이 쓰였는데도 통과한다(`backend/test/limits.test.js:66`) |
| 추천 엔진 | **쓰지 않는다.** 옷장 15벌의 colorTone을 5가지로 일괄 변경해도 Styling, Looks, Today, Core 결과가 같다(주색상 검토 C4) |
| 상품 | 상품 CSV `color_tone` 필수(브랜드 입력, `products.mjs:144`로 카탈로그에 전달). Core 교체 추천은 상품 colorTone을 `"muted"`로 고정한다(`prototypeCore.ts:124`) |
| 계약 0.2.0 | 의류 `color_tone` 필수(앱 colorTone). `value`·`saturation`은 선택이고 연구 전용(`research_only_fields`). 변환 규칙은 "D-F02 확정 전에는 color_tone을 그대로" |

**정리:**
- colorTone은 정의가 없는 Gemini 인상어다. 사람도 엔진도 쓰지 않는다.
- 그래서 전환의 **회귀 위험이 매우 작다.** 엔진 점수가 colorTone에 의존하지 않으므로, 요구 V4 "기존 데이터 같은 점수"는 구조적으로 보장된다.
- 반대로 기존 colorTone의 **정보 가치도 낮다.** 역산할 가치가 큰 원본이 아니다.

---

## 2. 권장 데이터 구조 [제안]

### 2.1 원칙

1. **추가만 한다.** `clothes.color`·`color_tone`은 그대로 둔다(필수, 덮어쓰지 않음).
2. **판정값과 원본을 분리한다.** 명도·채도는 "누가, 어떤 방법으로, 언제 판단했는가"와 함께 저장한다. 같은 옷에 판단이 여러 개(측정·Gemini·사람) 있어도 서로 덮어쓰지 않는다.
3. **상태는 값과 섞지 않는다.** `none`·`na` 같은 예약 값을 쓰지 않는다(요구 4장).
4. **칸별 상태를 둔다.** 무채색은 "명도는 평가됨, 채도는 해당 없음"이다. 의류 전체 상태(`tone_status`) 하나로는 이것을 표현할 수 없어서, 명도·채도 칸마다 상태를 둔다(Claude C 요구의 확장).

### 2.2 앱 DB: 판정 이력 표 추가(기존 행 변경 없음)

```sql
-- 제안. 운영 적용은 별도 승인
create table public.clothing_color_assessments (
  id bigint generated always as identity primary key,
  clothes_id bigint not null references public.clothes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,     -- RLS용(clothes와 같은 정책)
  value text check (value in ('light','medium','dark')),
  value_status text not null check (value_status in ('assessed','not_applicable','unknown')),
  saturation text check (saturation in ('low','medium','high')),
  saturation_status text not null check (saturation_status in ('assessed','not_applicable','unknown')),
  source text not null check (source in ('human','measured','gemini','derived_from_color_tone')),
  method_version text not null,           -- 예: 'measure-lab-v1', 'gemini-tone-v1', 'D-F02-draft-r1'
  color_at_assessment text not null,      -- 판단 당시 주색상(이후 색 수정 시 무효 판단에 사용)
  metrics jsonb,                          -- 측정값: L*, C*, h, IQR, 반사광 비율, 배경 보정 배수 / Gemini 신뢰도 등
  created_at timestamptz not null default now(),
  constraint value_cell check ((value is null) = (value_status <> 'assessed')),
  constraint saturation_cell check ((saturation is null) = (saturation_status <> 'assessed'))
);
-- 같은 방법으로 두 번 판정해도 중복되지 않게(재분석 멱등)
create unique index on public.clothing_color_assessments (clothes_id, source, method_version);
```

- 행이 없으면 **미기록**이다. 기존 사용자 옷은 모두 이 상태로 시작한다(요구 5.4).
- `delete cascade`이므로 기존 계정·옷 삭제 흐름(Claude B 영역)에 따로 손댈 필요가 없다. 개인정보 처리방침에 "색 판정값"을 적어야 하는지는 Claude B에게 확인한다.
- 대안은 `clothes`에 nullable 열 6개를 추가하는 방법이다. 단순하지만 출처가 여러 개일 때 덮어쓰게 되고 이력이 사라진다. 재분석 전략(3장)과 맞지 않아 권장하지 않는다.

### 2.3 앱 타입 (`src/types/index.ts`)

```ts
type ToneCell<T> = { value: T | null; status: "assessed" | "not_applicable" | "unknown" | "unrecorded"; source?: ToneSource };
type ToneSource = "human" | "measured" | "gemini" | "derived_from_color_tone";
type ColorAssessment = { value: ToneCell<"light"|"medium"|"dark">; saturation: ToneCell<"low"|"medium"|"high">; methodVersion: string };

interface Clothing {
  color: ClothingColor;     // 그대로
  colorTone: ColorTone;     // 그대로(필수, 하위 호환)
  tone?: { value: ToneCell<...>; saturation: ToneCell<...> };  // 해석된 값(없으면 미기록). 엔진은 이것만 읽는다
}
```

- 해석 규칙(`resolveTone`):
  - 출처 우선순위는 **human > measured > gemini > derived_from_color_tone** 이다. 측정과 Gemini가 일치하면 measured 신뢰도를 올린다.
  - 판정 당시 주색상(`color_at_assessment`)이 지금 주색상과 다르면 그 판정은 무시한다.

### 2.4 Data Contract 0.3 후보 (승인 필요)

| 필드 | 내용 |
|---|---|
| `value_status`, `saturation_status` | assessed · not_applicable · unknown · (빈 칸 = 미기록) |
| `value_source`, `saturation_source` | human · derived_from_color_tone (Lab). 앱 내보내기에는 measured·gemini도 허용 |
| `tone_rules_version` | 예: `D-F02 r1` |
| 검증 규칙 | (a) multi → 두 칸 not_applicable, 값 없음(오류) (b) assessed ↔ 값 있음(오류) (c) 무채색 + 채도 값 → 경고, 무채색 + 채도 빈 칸 → 경고 없음 |
| `derived_conversions.value/saturation` | "color_tone 그대로"를 유지하고, 4장 축약표는 **color_tone이 빈 경우에만** 사용 |

- Lab 요구의 `tone_status`(의류 전체 하나)는 칸별 상태로 대체할 것을 제안한다(Claude C 회신 문서 R-1).

---

## 3. 재분석 전략 [제안]

### 3.1 단계

| 단계 | 입력 | 출처 | 비용·위험 | 대상 |
|---|---|---|---|---|
| ① 부분 역산 | 주색상 + colorTone | `derived_from_color_tone` | 0원. 사진을 쓰지 않음 | 모든 옷. 단, **엔진에는 쓰지 않음**(5.1) |
| ② 색상 공간 측정 | 누끼 이미지(`cutout_image_path`, 알파 마스크) → 없으면 원본 + 배경 추정 | `measured` | 서버 CPU만. 외부 전송 없음 | 사진이 있는 옷 |
| ③ Gemini 시각 판단 | 원본 사진 | `gemini` | **API 호출.** 무료 등급은 입력이 Google 개선에 쓰일 수 있어서 **기존 사용자 사진에는 쓰지 않음**(유료 등급 승인과 개인정보 검토 전까지) | 새로 올리는 옷(분석 요청 한 번에 함께 출력, 추가 호출 없음) |
| ④ 사람 판단 | 연구 세트 | `human` | 공동창업자 시간 | 검증 표본만 |

- **기존 사용자 사진은 ②만 쓴다.** 이것도 실행 전에 PO 승인을 받는다. 새 목적으로 사진을 처리하는 것이므로 처리방침 확인이 필요하다(Claude B).
- **실행 방식:**
  - QA 프로젝트에서 테스트 계정으로 먼저 dry-run한다.
  - 운영은 옷 단위로 판정 표에 추가(insert)만 한다. 유일 인덱스로 멱등성을 보장한다.
  - 배치 크기와 속도 제한을 두고, 언제든 중단하고 다시 시작할 수 있게 한다.
- **판정 무효화:** 사용자가 주색상을 바꾸거나(현재는 저장 후 수정 기능 없음) 이미지를 교체하면(`replaceClothingImage`) 기존 판정은 `color_at_assessment`와 이미지 기준으로 무시하고 다시 측정한다.

### 3.2 사진이 없을 때

- `original_image_path`와 `cutout_image_path`가 모두 null이면 판정 행을 만들지 않는다. 그 옷은 **미기록**이다.
- ① 부분 역산 행은 남길 수 있다. 이 행은 연구용 표시이고, 엔진과 정답 비교에는 쓰지 않는다.
- 사진이 없다는 사유를 남기려면 `value_status = unknown`, `metrics = {"reason":"no_image"}`로 기록한다. 이렇게 해야 "아직 안 봄"과 "볼 수 없음"이 구분된다.
- 누끼가 `original`로 대체된 경우(배경 제거 실패, `cutoutVia = "original"`)에는 원본에서 배경을 추정한다. 측정 신뢰도를 낮게 표시한다(`metrics.mask = "estimated"`).

### 3.3 먼저 확인할 것(읽기 전용, 승인 후)

- 운영 `clothes`에서 `original_image_path`·`cutout_image_path` 보유 비율, `color_tone` 값 분포(목록 밖 값이 있는지), `color = multi` 비율을 확인한다. 집계 쿼리만 쓰고 개별 행은 보지 않는다.

---

## 4. 레거시 호환 규칙 [제안][실행]

### 4.1 colorTone → 명도·채도: 직접 확인 가능한 칸만 (요구 3.3)

| colorTone | 유채색 | 무채색(black·white·gray·silver) | multi |
|---|---|---|---|
| light | 명도 light | 명도 light, 채도 해당 없음 | 둘 다 해당 없음 |
| dark | 명도 dark | 명도 dark, 채도 해당 없음 | 〃 |
| muted | 채도 low | 채도 해당 없음(명도 미기록) | 〃 |
| vivid | 채도 high | 채도 해당 없음 | 〃 |
| bright | 없음 | 채도 해당 없음 | 〃 |

- 채운 칸의 출처는 `derived_from_color_tone`, 규칙 버전은 `D-F02-draft-r1`이다.
- **두 칸이 동시에 채워지는 경우는 없다.** colorTone 5개 × 9개 색을 전수 테스트로 확인했다.

### 4.2 명도·채도 9개 조합 → colorTone 5개 축약 후보

| 명도 \ 채도 | low | medium | high |
|---|---|---|---|
| **light** | light | strict: 미해결 / practical: **light** | **bright** |
| **medium** | muted | **미해결(두 안 모두)** | **vivid** |
| **dark** | strict: 미해결 / practical: **dark** | dark | strict: 미해결 / practical: **dark** |
| 무채색(채도 해당 없음) | light → bright, medium → muted, dark → dark (기존 앱이 흰 옷을 bright로 저장하는 관례에 맞춤) | | |

- **적용 범위:** 원래 colorTone이 있으면 **항상 원래 값을 쓴다**(요구 3.4). 축약은 colorTone이 없을 때만 쓴다. 예: 앞으로 Gemini가 colorTone을 내지 않게 되는 경우, Lab에서 명도·채도만 기록된 의류
- 커버리지는 strict 5/9, practical 8/9이다(테스트로 고정).
- **권장은 practical이다.** 단, (medium, medium)은 의미상 대응하는 colorTone이 없으므로 `unresolved`로 남긴다. 앱이 colorTone을 필수로 받는 동안 이 경우는 앱 입력에서 제외되지 않도록 "원래 값 우선" 규칙이 막는다.

### 4.3 bright · light · vivid 의미 충돌과 우선순위

| 쟁점 | 내용 | 결정안 |
|---|---|---|
| bright vs light | 둘 다 "밝다"이지만 bright는 맑고 선명한 밝음(고명도+고채도), light는 연한 밝음(고명도+저채도, 파스텔)이다. 앱은 흰 옷도 bright로 저장한다(mockClothes, Lab G001) | 채도로 나눈다: high → bright, low·medium → light. 무채색 흰색은 관례에 따라 bright |
| bright vs vivid | 둘 다 고채도다. vivid는 가장 강한 원색(중명도), bright는 밝은 고채도다. 형광 옐로처럼 명도가 높고 채도가 높은 색은 둘 다 맞다 | 명도로 나눈다: light → bright, medium → vivid. 우선순위는 **명도 dark > 채도 high > 채도 low**(dark를 먼저 결정해야 진한 버건디가 vivid가 되지 않음) |
| muted의 명도 | 차콜·더스티 네이비(어두움)도 muted로 불린다 | 명도 dark면 dark가 우선이다. muted는 medium+low만 대응 |
| colorTone 원래 값이 명도·채도 판정과 모순 | 예: 원래 vivid인데 측정 결과 dark·high | 앱 colorTone은 바꾸지 않는다. 판정 표에만 기록하고, 모순 비율을 Gemini 품질 지표로 쓴다 |

### 4.4 Lab 테스트 시나리오와 다른 점 (Claude C 확인 필요)

- **C2(차콜 코트 muted):** Lab 기대값은 "채도 low derived"이다. 그런데 같은 문서 3.3의 추가 제한은 "주색상이 무채색이면 채도는 채우지 않음"이다. 차콜은 Lab 기준으로 gray(무채색)이다.
  - 초안은 **무채색 제한을 우선**한다. 채도는 해당 없음이다.
  - 유채색 muted(더스티 네이비)는 채도 low가 된다.
- **무채색 목록:** black·white·gray·silver로 정했다. ivory(미세한 노란빛)와 navy·beige·brown(앱 엔진의 "무채색 계열"이지만 색조가 있음)은 **유채색으로 보고 채도를 평가한다.** 엔진의 `NEUTRAL_COLORS`(어울림용)와 명도·채도의 무채색(채도 개념 유무)은 다른 개념이므로 섞지 않는다.

---

## 5. multi와 무채색 별도 처리 [제안][실행]

### 5.1 처리 가능 여부

| 경우 | 처리 | 근거 |
|---|---|---|
| multi | 명도·채도 둘 다 `not_applicable`. colorTone은 원래 값을 유지하되 명도·채도로 해석하지 않는다. 측정·Gemini 출력이 있어도 저장하지 않는다(검증 오류 E_MULTI_HAS_TONE) | 결정 4. 테스트 C5·C7 |
| 무채색 | 명도는 평가하고, 채도는 `not_applicable`이다. 측정에서는 **C\* < 8이면 무채색 후보**다 | 요구 3.3, 측정 결과(흰 셔츠 C\*0) |
| 무채색 판정이 주색상과 어긋남 | 주색상은 navy인데 측정 C\*가 7.4(무채색 범위)인 경우(5.2의 스커트) | 주색상을 우선한다. 채도는 측정값대로 low로 하되, `metrics.near_achromatic = true`를 표시한다 |
| 보조색(결정 4 확장) | `secondary_colors`(목록)과 색상 구성(비율·패턴)을 연구 전용으로 먼저 수집한다. 측정의 색상각 군집으로 후보를 낼 수 있다 | 2라운드 |

### 5.2 측정 시제품 결과 [실행]

- 경계는 가설값이다: 명도 light ≥ L\*70 > medium ≥ 40 > dark, 무채색 C\* < 8, 채도 low < 18 ≤ medium < 40 ≤ high.
- 사진은 저장소 상품 사진이다. 원본 외 조명은 사진에 인위적으로 입혀서 만들었다.

| 사진(실제) | 원본 | 따뜻한 조명 | 따뜻한 조명 + 배경 보정 | 차가운 조명 + 보정 | 그림자 |
|---|---|---|---|---|---|
| 흰 셔츠 | L\*88 C\*0 → light/무채색 | C\*22 → **light/medium(아이보리처럼 보임)** | C\*6.5 → 무채색 복구 | C\*11.4 → low(**복구 실패**) | L\*54 → **medium** |
| 흰 운동화 | L\*82 C\*3 → light/무채색 | C\*23 → medium | C\*7 → 복구 | C\*8.5 → low | L\*51 → medium |
| 브라운 로퍼(유광 가죽) | L\*20 C\*10 → dark/low | C\*16 | C\*11 | C\*11 | L\*11 |
| 블랙 데님 | L\*20 C\*0 → dark/무채색 | 그대로 | 그대로 | 그대로 | 그대로 |
| 진한 네이비 스커트 | L\*23 C\*7.4 → dark/**무채색 경계** | C\*3.5 | C\*8 | C\*11.6 → low | L\*13 |

**확인된 점:**

1. **따뜻한 조명에서 흰 옷이 유채색(아이보리)으로 측정된다.** 배경을 기준으로 보정하면 복구된다. 흰 배경 상품 사진에서는 이 보정이 잘 듣는다.
2. **배경이 과노출(255로 잘림)이면 차가운 색조를 보정하지 못한다.** 배경 픽셀이 이미 최댓값이라 색 틀어짐을 읽을 수 없다. 사용자 사진(배경 없음, 혼합 조명)에서는 보정 기준이 더 약하다.
3. **명도는 노출에 크게 흔들린다.** 그림자 하나로 흰 셔츠가 light에서 medium이 됐다. 배경 기준 보정은 색조만 고치고 밝기는 고치지 못한다. 명도는 **사진 단독 측정으로 확정하지 않는다**(5.3).
4. **네이비와 블랙 경계는 측정으로도 불안정하다**(C\* 3.5~11.6). 주색상 검토의 black/navy 경계와 같은 문제다.
5. **광택:** 유광 로퍼의 반사광은 현재 기준(L\* > 92, C\* < 6)에 걸리지 않았다. 반사광 검출 기준을 실제 사진으로 다시 정해야 한다. 지금은 중앙값으로 영향을 줄이고 있다.

### 5.3 측정과 Gemini의 역할 구분

| 항목 | 색상 공간 측정 | Gemini 시각 판단 |
|---|---|---|
| 잘하는 것 | 같은 사진이면 항상 같은 값. 수치(L\*, C\*, h)와 근거 기록. 비용 0, 외부 전송 없음 | 조명·그림자를 감안한 "원래 색" 추정, 주색상 영역 선택, multi·패턴·광택 소재 인식, 무채색 여부 |
| 약한 것 | 노출·화이트밸런스·배경 혼입·반사광에 직접 흔들림. 주름 그림자, 워싱 | 매번 다를 수 있음(반복 일관성), 기준 문장이 없으면 임의 판단, 근거 수치 없음 |
| 담당 | **채도와 무채색 판정의 1차 근거**(상대값이라 노출 영향이 작음), 모든 판정의 수치 기록, Gemini 결과 검사 | **명도의 1차 근거**(노출 보정을 사람처럼 함), multi·광택 판단, 측정 신뢰도가 낮은 경우 |
| 둘이 다를 때 | 일치하면 신뢰도를 올린다. 다르면 두 값을 모두 기록하고 엔진에는 Gemini 값을 쓰며, 차이를 검토 대상으로 표시한다 | |

### 5.4 실사용 검증 방법

1. **기준 세트(공동창업자 촬영, 약 40벌):** 옷마다 자연광, 따뜻한 실내등, 그늘 3장씩 찍고, 회색 기준 카드(18% 그레이 카드)를 함께 넣는다. 주색상 검토의 경계 사례(아이보리, 차콜·네이비, 버건디, 유광 가죽, 워싱 데님, 다색 패턴)를 포함한다.
2. **정답:** 두 사람이 따로 명도·채도를 판단한다(Lab 절차). 둘의 일치도(가중 kappa)를 **상한선**으로 둔다.
3. **지표:**
   - 측정·Gemini 각각의 사람 일치율
   - 같은 옷의 조명 3장 간 일관성(조명 견고성)
   - 무채색 판정 정확도
   - multi 오판율
   - 기준 카드로 보정한 경우와 보정하지 않은 경우의 차이
4. **경계값 조정:** 사람 정답으로 L\*·C\* 경계를 맞춘다. 개발용 절반으로 맞추고 나머지 절반으로 확인한다.
5. **실사용 표본:** 승인 후 QA 테스트 계정 사진만 쓴다. 실제 사용자 사진은 처리방침을 확인하고 PO가 승인한 뒤 집계 지표만 본다.
6. **Gemini 호출:** 40벌 × 3장 × 반복 2회 ≈ 240회. 무료 등급이면 0원이지만, 우리 소유 사진만 쓴다. 실행 전에 승인받는다.

---

## 6. 영향 분석 [코드][제안]

| 영역 | 지금 | 전환 시 변경 | 위험 |
|---|---|---|---|
| Gemini 분석 | colorTone 필수 enum, 기준 문장 없음 | colorTone은 그대로 둔다(필수). 선택 필드 `value`·`saturation`(nullable enum)과 `toneApplicable`(multi·무채색 표시)를 추가하고 프롬프트에 기준 3~4줄을 넣는다. `server.js`는 Claude B에게 인계 | 출력 토큰이 조금 늘어난다. 스키마를 바꾸면 기존 앱이 모르는 필드가 들어오지만 무시되므로 오류는 없다 |
| Supabase | `clothes.color_tone` 필수 | 판정 표 추가(2.2). `clothes`는 변경 없음 | 마이그레이션은 추가만 한다. RLS 정책이 필요하다 |
| 저장(`saveClothingToSupabase`) | clothes insert | 분석에 명도·채도가 있으면 판정 행(source = gemini)을 추가한다. 실패해도 옷 저장은 성공시킨다 | 저장 흐름에 실패 지점이 하나 늘어난다 → 비차단으로 처리 |
| 수정 화면 | colorTone 표시·수정 없음 | 1단계는 표시하지 않는다. 2단계에서 "밝기·선명도" 칩을 추가하고, 사람이 고치면 source = human. 주색상을 바꾸면 기존 판정을 무효로 표시 | 사용자에게 개념이 어렵다. 2라운드 UX 검토 필요 |
| Styling·Looks·Today | colorTone 미사용 | 1단계는 **변경 없음.** 2단계 톤 조화 규칙(명도 대비, 채도 균형)은 해석된 톤이 있는 옷끼리만 적용하고, 미평가는 중립으로 둔다(가점·감점 없음, 제외 금지, V5) | 규칙 자체가 새 기능이다. 엔진 스냅샷 갱신과 평가 데이터 검증이 필요하다 |
| 상품 매칭 | colorTone 미사용, Core 상품은 muted 고정 | 상품 CSV에 `value`·`saturation`을 선택 열로 둔다(상품 계약 변경 = 승인). 고정 muted를 제거한다 | 브랜드 입력 부담 → 선택 열로 시작 |
| 점프수트·베스트 호환 | `taxonomyCompat.ts`(category·subCategory) | **영향 없음.** 다른 필드다. 판정 표도 `clothes_id`만 참조한다 | — |
| 주색상 신규 6색 | 설계 단계(검토 6장) | 무채색 목록에 silver를 포함하고, ivory는 유채색(저채도)으로 본다. 두 설계는 같은 "원래 값 보존, 엔진은 해석" 원칙을 따른다 | 주색상 결정(C-8)과 함께 정해야 한다 |

---

## 7. 단계별 전환 계획

### P0: 전환 전에 반드시 지킬 안전장치 (지금, 일부 완료)

| # | 내용 | 상태 |
|---|---|---|
| P0-1 | colorTone → 명도·채도 일대일 역산 금지. MATCH_SCORE 3.4 역산 5행 폐기 표시 | **완료**(문서) |
| P0-2 | `clothes.color`·`color_tone`·기존 행은 바꾸지 않는다. 새 정보는 추가 표에만 넣는다 | 설계 확정(2.2) |
| P0-3 | 엔진은 1단계에서 colorTone·명도·채도를 읽지 않는다 → 기존 점수 불변(V4). 점프수트·베스트 호환은 손대지 않는다 | 현재 구조로 보장(C4) |
| P0-4 | multi·무채색 규칙과 칸별 상태를 규칙 초안과 테스트로 고정 | **완료**(초안 11개 테스트) |
| P0-5 | 기존 사용자 사진을 외부(Gemini)로 다시 보내지 않는다 | 원칙 |

### P1: 1라운드 안에서 가능한 것 (모두 승인 필요)

| # | 내용 | 코드 변경 |
|---|---|---|
| P1-1 | 계약 0.3: 칸별 상태·출처·규칙 버전, multi 검증 | `data/fkd/contract`, `scripts/fkd/validate.mjs`, 예시와 테스트 |
| P1-2 | 규칙 모듈을 앱으로 옮김(`src/utils/colorTone.ts`, 엔진에는 연결하지 않음) + 타입 | `src/types`, 단위 테스트 |
| P1-3 | 5.4 기준 세트 촬영과 사람 판정, 측정 경계값 조정 | `scripts/analysis/color-tone-*`(측정 시제품 확장) |
| P1-4 | Gemini 기준 세트 실측(약 240회, 우리 소유 사진) | 기존 A/B 스크립트 방식 |

### P2: 2라운드 이후

| # | 내용 |
|---|---|
| P2-1 | 판정 표 마이그레이션(QA → 운영), 새 업로드에 측정과 Gemini 판정 기록(엔진 미사용 상태로 시작) |
| P2-2 | Gemini 스키마에 명도·채도 추가(Claude B 인계) |
| P2-3 | 기존 사용자 사진 측정 재분석(② 방식, 처리방침 확인 + PO 승인) |
| P2-4 | 엔진 톤 조화 규칙(평가 데이터로 검증 후), 수정 화면의 밝기·선명도 칩 |
| P2-5 | 상품 CSV 명도·채도 열, Core 상품 muted 고정 제거 |
| P2-6 | 보조색·색상 구성 속성 |

---

## 8. 예상 정보 손실

| 경우 | 손실 | 보존 방법 |
|---|---|---|
| colorTone → 명도·채도 | 손실은 없다. 다만 **대부분 채워지지 않는다**. bright는 0칸, 나머지는 1칸만 채운다 | 원래 colorTone 유지, 미기록 상태 표시 |
| 명도·채도 → colorTone(축약) | 9 → 5. dark 행의 채도(진한 버건디 vs 블랙 계열 dark), light 행의 low/medium 구분이 사라진다. (medium, medium)은 대응값이 없다 | 원래 값 우선, 판정 표에 원래 명도·채도 보존, 미해결 보고 |
| 사진이 없는 옷 | 명도·채도를 영구히 알 수 없다(사용자가 다시 찍기 전까지) | 미기록 / unknown(no_image) |
| 누끼 실패 옷 | 배경이 섞여 측정 신뢰도가 낮다 | `metrics.mask = estimated`, 신뢰도 낮음 표시 |
| multi | 단일 명도·채도 없음(의도된 결정) | 보조색 확장(P2-6) |
| 측정만 쓰는 경우 | 조명이 강하면 명도가 왜곡된다 | 명도는 Gemini 또는 사람 우선, 측정은 수치 근거로 남김 |

## 9. 검증 테스트

| 테스트 | 위치 | 상태 |
|---|---|---|
| 규칙 초안: Lab C1~C8, 축약표 커버리지, 왕복, 우선순위 | `scripts/analysis/color-tone-2026-10-22/tone-rules.test.mjs` | **11/11 통과** |
| 측정 시제품: 7장 × 조명 4가지 | `measure.cjs` | 실행 완료(5.2) |
| 기존 엔진 회귀(colorTone 무관) | 주색상 검토 C4 + `test:engine` | 통과 |
| 이후: 계약 0.3 검증 예시, 판정 표 RLS(교차 사용자), 저장 비차단, 엔진 미평가 중립 | P1·P2에서 작성 | 미작성 |
