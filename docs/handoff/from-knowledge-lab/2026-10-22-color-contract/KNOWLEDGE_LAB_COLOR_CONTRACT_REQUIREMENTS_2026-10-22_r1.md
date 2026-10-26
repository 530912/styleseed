# Knowledge Lab 색상 데이터 계약 요구사항 (D-F02 담당자 결정안 기준)

- 보낸 쪽: Claude C (Knowledge Lab) · 받는 쪽: Claude A · 작성: 2026-10-22 (r1)
- 근거: Lab `/decisions`의 **D-F02 담당자 분류 결정안**.
  - 2026-10-22 '논의중'으로 기록했고, **서명 0, 공동창업자 최종 승인 전**입니다.
  - 아래 2장은 원문을 그대로 옮긴 것입니다.
- 이 문서는 **요구사항**입니다.
  - Data Contract, Lab DB 스키마, Lab 데이터, 앱 코드는 바꾸지 않았습니다.
  - 계약 변경과 운영 반영은 Claude A가 검증한 뒤 별도로 진행합니다(결정 5).
- 함께 볼 문서: `KNOWLEDGE_LAB_COLOR_HANDOFF.md`(주색상 20개 검증·경계·테스트, 2026-10-22-color 폴더)
- 출처 표시:
  - **[DB]**: 실제 Lab DB 조회
  - **[앱]**: styleseed `af5aeb7` 코드·문서와 계약 0.2.0(`78311d5bc310`)을 읽기 전용으로 확인
  - **[요구]**: 이번 결정에서 나온 요구사항
  - **[제안]**: Claude C의 구현 제안

## 1. 현행 Lab 데이터가 결정과 맞는지 [DB 2026-10-22 04:46]

| 결정 항목 | 현행 Lab | 판정 |
|---|---|---|
| 주색상 20개 | `main_color` 20개(기존 14 + ivory·burgundy·olive·teal·gold·silver). 모두 제안 상태 | **일치** |
| 명도 3단계 | `value` = light · medium · dark | **일치** |
| 채도 3단계 | `saturation` = low · medium · high | **일치** |
| 세 속성은 독립 | 속성 사전에서 서로 다른 속성 키로 관리 중. 의류 표에도 `main_color`·`value`·`saturation`·`color_tone` 칸이 따로 있음 | **일치** |
| 앱 colorTone 유지 | 명도·채도 6개 값의 앱 매핑이 모두 `colorTone / (빈 값) / converted`. 계약의 규칙형 변환 "D-F02 미확정 전에는 의류의 color_tone을 그대로 앱 colorTone으로" 적용 | **일치**(강제 통합 없음) |
| colorTone으로 역산하지 않음 | Lab 의류 15벌은 명도·채도가 모두 **빈 칸**이고 `color_tone`만 있음(Claude 초안 예시 데이터). 역산해서 채운 값은 없음 | **일치** |
| 명도 메모의 참조 | 명도 3개 메모: "변환표는 MATCH_SCORE_V0.1 문서 참고". 그 문서(앱 저장소 3.4장)는 **colorTone → 명도·채도 역산표** | **불일치**(결정 3과 반대). 메모 수정안은 7장 |
| multi에 명도·채도를 주지 않음 | multi 정의는 결정과 같음. 하지만 Lab에는 "명도·채도 미평가(multi)"를 **표시할 방법이 없음**(빈 칸 하나뿐). multi 의류는 아직 없음 | **표현 수단 없음** → 4장 |
| 무채색의 채도 | 채도 판단 기준: "회색기가 많으면 low, 원색에 가까우면 high". 흰색·검정·회색처럼 채도 개념이 없는 색의 처리가 없음 | **보완 필요**(7장) |

## 2. D-F02 담당자 분류 결정안 (원문)

> **[결정 1. 색상 체계]** STYLESEED의 연구용 색상 분류는 주색상(Color), 명도(Value), 채도(Saturation)를 독립적인 속성으로 관리한다. 주색상은 20개 값, 명도와 채도는 각각 3단계를 기준으로 한다.
>
> **[결정 2. 기존 앱과의 관계]** 기존 앱의 colorTone 5단계(bright/light/muted/dark/vivid)는 하위 호환을 위해 유지하되, 새로운 색상 분류의 기준으로 사용하지 않는다. 신규 명도·채도 정보를 기존 colorTone으로 강제 통합하지 않는다.
>
> **[결정 3. 변환 원칙]** 기존 colorTone 값만으로 명도와 채도를 모두 확정하지 않는다. 직접 확인할 수 있는 정보만 변환하고, 불확실하거나 정보가 부족한 속성은 미평가 상태로 유지한다. 원본 값은 삭제하거나 덮어쓰지 않는다.
>
> **[결정 4. 다색 의류]** multi는 단일 대표 주색상을 선정하기 어려운 경우에만 사용한다. multi 제품의 명도·채도를 임의로 부여하지 않으며, 필요 시 보조색과 색상 구성 정보를 추가 수집하는 방향으로 확장한다.
>
> **[결정 5. 실제 앱 적용]** 본 결정은 연구용 분류 원칙의 담당자 결정이다. 실제 앱 적용 전 Claude A가 Gemini 분석, 데이터 저장, 기존 데이터 호환성, 추천 엔진 영향을 검증하도록 한다. 앱 Data Contract 변경과 운영 반영은 검증 결과를 확인한 후 별도 진행한다.

## 3. colorTone ↔ 명도·채도 변환 불가 사례 [요구·제안]

### 3.1 구조적 이유

- 명도 3 × 채도 3 = **9가지 조합**이 나옵니다. colorTone은 **5개**뿐입니다. 그래서 어느 방향으로도 일대일로 바꿀 수 없습니다.
- colorTone은 명도와 채도가 섞인 인상어입니다. 예: `bright`와 `vivid`의 차이, `muted`의 명도 범위가 정해져 있지 않습니다.

### 3.2 기존 역산표의 문제

앱 저장소 `docs/recommendation/MATCH_SCORE_V0.1.md` 3.4장의 표입니다.

| colorTone | V0.1 역산(제안) | 결정 3에 따른 판정 | 실제로 틀리는 예 |
|---|---|---|---|
| bright | value light + saturation high | **채도 확정 불가** | 흰 셔츠는 bright지만 채도가 없음. Lab 예시 의류 G001(white·bright)을 이 표로 바꾸면 saturation high라는 틀린 값이 생김 |
| light | value light + saturation low | 명도 light만 직접 확인 가능, 채도는 미평가 | 연한 하늘색(채도 중간)도 light |
| muted | value medium + saturation low | 채도 low만 가능, 명도는 미평가 | 차콜·더스티 네이비(명도 dark)도 muted로 분류됨(Lab G009 gray·muted) |
| dark | value dark + saturation medium | 명도 dark만 가능, 채도는 미평가 | 블랙(채도 없음)과 진한 버건디(채도 높음)가 모두 dark |
| vivid | value medium + saturation high | 채도 high만 가능, 명도는 미평가 | 형광 옐로(명도 light)도 vivid |

- **요구:** 이 역산표를 Lab 데이터나 앱 데이터에 적용해 명도·채도를 **채우지 않습니다**.

### 3.3 colorTone에서 '직접 확인 가능한' 부분만 쓰는 제안 (결정 3, 공동창업자 확인 필요)

| colorTone | 채울 수 있는 칸 | 나머지 | 단서 |
|---|---|---|---|
| light | 명도 = light | 채도 미평가 | 출처를 `derived_from_color_tone`으로 표시 |
| dark | 명도 = dark | 채도 미평가 | 같음 |
| muted | 채도 = low | 명도 미평가 | 같음 |
| vivid | 채도 = high | 명도 미평가 | 같음 |
| bright | 없음 | 둘 다 미평가 | 무채색(white 등)과 유채색이 섞여 있어 판단 불가 |

- 추가 제한: 주색상이 black·white·gray·silver처럼 무채색이면 colorTone이 무엇이든 **채도는 채우지 않습니다**. multi이면 둘 다 채우지 않습니다(4장).
- 이 부분 변환도 '사람이 판단한 값'과 구분해서 저장해야 합니다(5장). 평가·정확도 비교에서는 사람이 판단한 값만 정답으로 씁니다.

### 3.4 반대 방향(명도·채도 → 앱 colorTone)

- 9가지 중 colorTone에 대응하지 않는 조합이 있습니다: (light, medium), (medium, medium), (dark, low), (dark, high) 등.
- **요구:**
  - 앱이 colorTone을 필수로 받는 동안, 앱 colorTone은 **의류의 원래 `color_tone`(Gemini 또는 사람이 입력한 값)을 우선** 씁니다. 현행 계약 규칙형 변환과 같습니다.
  - 명도·채도만 있고 color_tone이 없을 때만 변환표를 씁니다. 대응이 없는 조합은 가까운 값으로 바꾸지 않고, 변환 보고서에 `unresolved`(colorTone)로 남깁니다.
  - 변환표 자체는 공동창업자 확정 대상입니다.

## 4. multi의 '미평가' 표현 [요구·제안]

| 상태 | 뜻 | 지금 표현 | 제안 |
|---|---|---|---|
| 평가됨 | 사람이 명도·채도를 판단해 기록함 | 값 있음 | `tone_status = assessed` |
| 해당 없음 | multi라서 단일 명도·채도가 없음 | **빈 칸(구분 불가)** | `tone_status = not_applicable`, 명도·채도 빈 칸 |
| 판단 불가 | 사진·정보가 부족해 확인할 수 없음 | **빈 칸(구분 불가)** | `tone_status = unknown` |
| 미기록 | 아직 아무도 보지 않음 | 빈 칸 | `tone_status` 빈 칸(기본값) |
| 변환값 | colorTone에서 3.3에 따라 일부만 채움 | 구분 불가 | 칸별 출처 `value_source`·`saturation_source = human \| derived_from_color_tone` |

- **예약 값 키를 쓰지 않습니다.** 예: 명도 값에 `none`·`na`를 넣는 방식은 쓰지 않습니다. 속성 사전 값과 '상태'가 섞이기 때문입니다.
- **검증 규칙(제안):**
  - (a) `main_color = multi`이면 `tone_status = not_applicable`이고 명도·채도가 비어 있어야 합니다. 어기면 오류입니다.
  - (b) `tone_status = assessed`이면 명도·채도 둘 다 있어야 합니다.
  - (c) 무채색이면 채도가 비어 있어도 경고하지 않습니다.
- **앱 쪽:** colorTone은 지금처럼 필수입니다. multi 의류의 colorTone은 원래 값(Gemini)을 그대로 두고 연구 판단에는 쓰지 않습니다. 이 값을 multi의 명도·채도로 해석하면 안 됩니다.
- **확장(결정 4):** 보조색(`secondary_colors`, 목록)과 색상 구성(배색 비율·패턴 유형)을 따로 수집합니다. Lab의 multi 메모 `[독립 속성 개선 검토]`와 같은 방향입니다. 연구 전용 속성으로 시작하는 것을 제안합니다.

## 5. 기존 데이터 원본 보존 [요구]

1. **원본 칸은 덮어쓰지 않습니다.** 의류의 `color_tone`(앱 원본)은 그대로 둡니다. 명도·채도는 원본이 아니라 연구 판단값이므로 별도 칸에 둡니다(현행 구조와 같음).
2. **출처를 표시합니다.**
   - 칸별로 `human` 또는 `derived_from_color_tone`을 표시합니다. 변환 규칙의 버전(예: `D-F02 r1`)도 남깁니다.
   - 사람이 나중에 판단하면 `human`으로 바꿉니다. 변환값을 지우지 않고 이력에 남깁니다.
3. **앱으로 내보낼 때** 계약 0.2.0 변환 보고서의 `research`(원본), `app`(앱 값), `conversions`, `dropped`, `unresolved`를 함께 남깁니다. 가까운 값으로 임의 대체하지 않습니다(현행 `no_silent_loss`).
4. **기존 앱 사용자 데이터**(운영 DB의 color·colorTone)는 다시 분석하거나 일괄 변환하지 않습니다. 새 칸은 비어 있는 상태로 시작합니다.
5. **Lab 쪽 보존:** 변경 전후 백업(`npm run lab:backup`), 작업 이력, 확정은 2명 서명이라는 기존 절차를 그대로 둡니다. 지금 Lab 의류 15벌의 color_tone은 그대로 유지합니다(Claude 초안 예시).

## 6. Claude A 검증 항목 (결정 5)

| # | 영역 | 확인할 것 |
|---|---|---|
| V1 | 계약 | `tone_status`, 칸별 출처 필드, multi 검증 규칙(4장 a~c)을 부 버전에 넣을지 결정. 변환표(3.3·3.4) 확정 절차 |
| V2 | Gemini 분석 | colorTone은 그대로 두고 명도·채도를 따로 출력할지, 계속 출력하지 않을지. multi일 때 출력 규칙 |
| V3 | 데이터 저장 | 앱 DB에 명도·채도·상태 칸을 추가할지, 기존 사용자 행의 기본값(미기록) |
| V4 | 호환성 | 기존 colorTone만 있는 데이터가 새 엔진에서도 같은 점수가 나오는지(회귀) |
| V5 | 추천 엔진 | 색 점수가 colorTone 대신 명도·채도를 읽게 되면 미평가 값을 어떻게 다룰지(중립 처리, 제외 금지) |
| V6 | MATCH_SCORE_V0.1 3.4장 | colorTone → 명도·채도 역산표를 결정 3에 맞게 고치거나 폐기 |

### 테스트 시나리오

| # | 입력 | 기대 결과 |
|---|---|---|
| C1 | 흰 셔츠 · colorTone bright | 채도는 채우지 않음(무채색·bright). 앱 colorTone은 bright 그대로 |
| C2 | 차콜 코트 · colorTone muted | 채도 low만 `derived`. 명도는 미평가(medium으로 채우지 않음) |
| C3 | 블랙 니트 · dark / 버건디 코트 · dark | 둘 다 명도 dark(`derived`). 채도는 블랙은 비우고 버건디는 미평가 |
| C4 | 형광 옐로 티셔츠 · vivid | 채도 high만. 명도 미평가 |
| C5 | 3색 체크 셔츠 · multi | `tone_status = not_applicable`, 명도·채도 비어 있음. 앱 colorTone은 원래 값 유지 |
| C6 | 사람이 명도 dark·채도 high로 판단 | `human`. 앱 colorTone은 원래 값 우선. 원래 값이 없으면 대응 조합이 없어 `unresolved` |
| C7 | multi인데 명도·채도가 채워진 내보내기 | 검증 오류(4장 a) |
| C8 | Lab 예시 의류 15벌 변환 | color_tone 원본이 그대로이고, 명도·채도가 역산으로 채워지지 않음 |

## 7. Lab 쪽 후속 작업 (이번에는 하지 않음, 승인 필요)

| # | 대상 | 전 | 후(안) |
|---|---|---|---|
| L1 | 명도 3개 · 메모 | 앱은 colorTone 하나로 저장(bright/light/muted/dark/vivid). 변환표는 MATCH_SCORE_V0.1 문서 참고 | 앱은 colorTone 하나로 저장(bright/light/muted/dark/vivid). colorTone만으로 명도를 확정하지 않는다(D-F02 결정 3) |
| L2 | 채도 3개 · 판단 기준 | 회색기가 많으면 low, 원색에 가까우면 high | (같음) + "흰색·검정·회색처럼 채도가 없는 색은 채도를 기록하지 않는다" |
| L3 | multi · 메모 | [독립 속성 개선 검토] … | (같음) + "multi 의류에는 단일 명도·채도를 기록하지 않는다(D-F02 결정 4)" |
| L4 | Lab 의류 화면·DB | 명도·채도 빈 칸 하나 | `tone_status`와 칸별 출처를 추가(스키마 변경이라 승인 필요, 계약 V1 결정 후) |
| L5 | D-F02 기록 | 논의중, 서명 0 | 공동창업자 두 분이 /decisions에서 직접 서명하면 '결정됨' |
