# 색상 체계(D-F02) 합의 필요 항목 r2 (Claude A → Claude C)

- 작성: 2026-10-22 (Claude A)
- 이 문서는 `knowledge-lab-color-tone-reply.md`(r1 회신)의 R-1~R-3, R-5를 **대체한다**. R-4와 R-6은 유지한다.
- 근거:
  - PO 검토 의견(2026-10-22): 색상 표준 방향 동의, 축약표 미승인, 무채색은 low, multi와 silver는 별도로 다룸
  - 설계: `docs/recommendation/COLOR_VALUE_SATURATION_DESIGN.md` r2
  - 테스트: 규칙 33개, 엔진 31개 모두 통과
- **확정된 것은 없다.** Data Contract 0.3, Lab 스키마, Lab 데이터, 앱 코드, DB는 바꾸지 않았다. 아래는 모두 합의 요청이다.

## 1. 합의가 필요한 항목

| # | 항목 | Claude A 제안 | Lab에서 바뀌는 것 | 결정 주체 |
|---|---|---|---|---|
| A-1 | **무채색 채도** | black·white·gray는 채도 **low**. 무채색 여부는 별도 칸 `achromatic`(true·false·미확인)에 둔다 | 요구 문서 3.3 추가 제한("무채색이면 채도를 채우지 않음")과 후속안 L2("채도 없는 색은 기록하지 않음")를 **철회**한다. 채도 판단 기준에 "무채색은 low, 무채색 여부는 별도 표시"를 추가한다 | 공동창업자 |
| A-2 | 저채도 유채색과 무채색 구분 | ivory·beige·navy·brown은 채도가 low여도 `achromatic = false`. 측정상 무채색에 가까우면 사람 검토 | 의류 화면에 `achromatic` 칸 추가(스키마 변경 = L4와 묶음) | 공동창업자 + Claude C |
| A-3 | **상태 4가지** | assessed(평가됨) · unrecorded(미평가, 기본) · undeterminable(판단 불가, 사유 필수) · multiple(단일 대표값 없음, multi 전용). **not_applicable(해당 없음)은 쓰지 않음** | 요구 4장의 `tone_status` 값과 r1 회신 R-1의 칸별 상태 값을 이 4가지로 통일. 상태는 명도·채도 칸마다 둔다 | Claude C + Claude A(계약) |
| A-4 | 판단 불가 사유 목록 | no_image, low_quality, mask_failed, lighting, metallic_reflection, metallic_pending (추가 가능) | Lab 의류 화면에 사유 선택 | Claude C |
| A-5 | **multi** | 단일 명도·채도 칸은 `multiple`이고 값은 비어 있다. 색 특성은 2라운드 연구 전용 `color_components`(색·명도·채도·비율 목록)로 보존 | 요구 문서 4장 a(multi → not_applicable)를 multiple로 바꾼다. multi 메모(L3)도 "단일 명도·채도 대신 구성 정보"로 바꾼다 | 공동창업자 |
| A-6 | **silver·gold 별도 검증** | colorTone 역산 금지, 측정 자동 확정 금지(`metallic_pending`·`metallic_reflection`). 기준 세트(금속 + 비금속 광택 대조군)로 검증한 뒤 규칙을 정한다. `metallic` 칸은 소재 광택(glossy)과 별도 | silver·gold 판단 기준에 "명도·채도는 반사광이 아닌 금속 표면의 기본 색으로 판단" 추가. 주색상 회신 C-9(금속색 독립 인정)와 함께 결정 | 공동창업자 |
| A-7 | **3×3 → colorTone 축약** | 축약표를 **승인하지 않는다**(PO). Claude A 권장: **축약하지 않음.** colorTone은 자기 출처(Gemini, Lab `color_tone`)로만 채우고, 고정표(A)와 색상별 기준표(B)는 연구 분석 도구로만 쓴다 | 계약 `derived_conversions`의 "D-F02 미확정 전에는 color_tone 그대로" 규칙을 **영구 규칙**으로 바꾼다. 요구 3.4의 "명도·채도만 있을 때 변환표 사용"은 삭제한다(그런 의류는 colorTone 미기록) | 공동창업자 + Claude A(계약) |
| A-8 | Lab 의류의 `color_tone` 필수 여부 | 축약하지 않으므로, 명도·채도만 판단하고 colorTone을 모르는 Lab 의류가 생길 수 있다. 계약 0.3에서 `color_tone`을 **조건부 필수**로 바꾼다(앱으로 보낼 때만 필수, 연구 데이터는 선택) | Lab 의류 화면에서 color_tone 선택 입력 | Claude A(계약) + Claude C |
| A-9 | 테스트 C2 기대값 | 무채색 low가 되어 Lab 기대값("채도 low")과 **일치**한다. r1 회신 R-2(C2 수정 요청)는 철회한다 | 없음 | — |
| A-10 | 흰 옷 colorTone 관례 | 앱과 Lab 예시는 흰 옷을 bright로 저장한다. 명도·채도 기준(light·low)으로는 light 쪽이다. 축약하지 않으면 충돌이 생기지 않는다. 다만 colorTone 정의 문장을 만들 때 "흰색은 bright"를 명시할지 결정해야 한다 | colorTone 정의(Lab 문서 또는 계약 설명) | 공동창업자 |

## 2. 계약 0.3 후보 (합의 후 Claude A가 작성, 이번에는 하지 않음)

- 의류 필드:
  - `value`, `value_status`, `value_source`
  - `saturation`, `saturation_status`, `saturation_source`
  - `achromatic`, `metallic`, `tone_reason`, `tone_rules_version`
- 검증 규칙(초안 `tone-rules-r2.mjs`의 `validateTone`과 같은 뜻):

| 코드 | 수준 | 조건 |
|---|---|---|
| E_MULTI_HAS_SINGLE_TONE | 오류 | multi인데 단일 명도·채도 값이 있음 |
| E_MULTIPLE_WITHOUT_MULTI | 오류 | multi가 아닌데 상태가 multiple |
| E_ASSESSED_WITHOUT_VALUE / E_VALUE_WITHOUT_ASSESSED | 오류 | 상태와 값 불일치 |
| E_UNDETERMINABLE_WITHOUT_REASON | 오류 | 판단 불가인데 사유 없음 |
| E_METALLIC_DERIVED | 오류 | 금속색에 colorTone 역산값 |
| W_ACHROMATIC_NOT_LOW | 경고 | 무채색인데 채도 medium·high |

- 출처 `derived_from_main_color`(무채색 → low)를 추가한다.

## 3. 엔진 쪽 약속 (Claude A)

- 현재(단계 0)와 단계 1·2에서는 엔진이 colorTone·명도·채도를 **읽지 않는다**. 회귀 테스트 6개로 고정했다.
- 명도·채도는 단계 3(평가 데이터로 효과 확인 + 공동창업자 승인)에서 처음 쓴다.
  - 미평가·판단 불가·multiple·금속 검증 대기는 **중립**으로 처리하고, 옷을 빼지 않는다.
- colorTone은 어느 단계에서도 엔진이 직접 쓰지 않는다.

## 4. Lab 후속 작업 변경 (L1~L5)

| # | r1 요구 문서 | r2 |
|---|---|---|
| L1 | 명도 메모: 역산 금지 | 유지 |
| L2 | 채도 기준: "채도가 없는 색은 기록하지 않음" | **변경:** "무채색(black·white·gray)은 low. 무채색 여부는 별도 표시" |
| L3 | multi 메모: 단일 명도·채도 기록 안 함 | **보완:** "단일 대표값 없음(multiple). 색 구성은 별도 수집" |
| L4 | `tone_status` + 칸별 출처 스키마 | **변경:** 칸별 상태 4가지 + 사유 + `achromatic` + `metallic` (A-2·A-3·A-4·A-6 합의 후) |
| L5 | 공동창업자 서명 | 유지. A-1·A-5·A-6·A-7·A-10을 D-F02 안건에 함께 올림 |
