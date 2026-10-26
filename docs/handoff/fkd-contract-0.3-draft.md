# Data Contract 0.3 변경 초안 (핏·실루엣 분리 + 색상 r2 후보)

- 작성: 2026-10-23 (Claude A)
- 상태: **초안.**
  - `data/fkd/contract/fkd-contract-v0.1.json`(0.2.0, `78311d5bc310`)은 바꾸지 않았다.
  - 0.3 확정은 D-F01(핏·실루엣), 색상 합의 A-1~A-10, Lab 최종 인계가 모두 끝난 뒤에 한다.
- 근거:
  - `docs/recommendation/SILHOUETTE_FIT_DESIGN.md`
  - `docs/recommendation/COLOR_VALUE_SATURATION_DESIGN.md` r2
  - `docs/handoff/knowledge-lab-color-tone-agreements-r2.md`
- 검증 코드의 뜻은 초안 규칙과 같다:
  - `scripts/analysis/attribute-eval-2026-10-23/silhouette-compat.mjs`
  - `scripts/analysis/color-tone-2026-10-22/tone-rules-r2.mjs`

## 0. 먼저 맞출 것

- **Lab이 0.1.0 계약을 쓰고 있다**(`vendor/styleseed-fkd/fkd-contract-v0.1.json`, `0bf7b5cad9fa`).
- 0.3으로 가기 전에 Lab vendor를 0.2.0으로 맞추는 것이 먼저다. 그래야 0.2.0 → 0.3 차이만 검토할 수 있다.

## 1. 하위 호환

- 0.3에서 추가하는 필드는 모두 **선택(required: false)**이거나 **조건부 필수**다. 그래서 0.2.0 형식 번들도 0.3 검증기로 읽을 수 있다(새 칸은 미평가).
- 기존 필드의 값 목록에서 빼는 값은 없다. `fit`에서 straight·wide가 빠지는 것은 Lab 사전(taxonomy) 쪽 변화이고, 계약은 아래 3장의 변환 규칙으로 받는다.

## 2. garments 필드

| 필드 | 0.2.0 | 0.3 초안 |
|---|---|---|
| `fit` | 필수, taxonomy fit | **조건부 필수:** 대분류가 신발·가방·액세서리면 비워야 함(not_applicable), 나머지는 값 또는 상태 |
| `fit_status` | 없음 | assessed · unrecorded · undeterminable · not_applicable |
| `fit_source` | 없음 | human · gemini · legacy_app_fit |
| `silhouette` | 선택, 예시 `H`(폐기값) | 선택, **예시 `rectangular`** |
| `silhouette_status` | 없음 | assessed · unrecorded · undeterminable · not_applicable · unresolved |
| `silhouette_source` | 없음 | human · gemini · derived_from_legacy_fit |
| `attribute_reason` | 없음 | undeterminable 사유(no_image, not_worn, low_quality, text_required 등) |
| `attribute_rules_version` | 없음 | 예: `SIL-draft-r1` |
| `color_tone` | 필수 | **조건부 필수**(앱으로 보낼 때만, 색상 A-8) |
| `value`·`saturation` 상태·출처, `achromatic`, `metallic`, `tone_reason`, `tone_rules_version` | 없음 | 색상 r2 합의 후보(A-1~A-6) 그대로 |

## 3. app_compat

| 항목 | 0.3 초안 |
|---|---|
| `app_values.fit` | 지금 6개 그대로. 앱 엔진이 새 핏 값을 받기 전(설계 4.2 단계 3)까지 바꾸지 않는다 |
| `app_values.silhouette` | 앱 단계 2(DB 열 + Gemini 출력)가 끝나면 Lab 활성 17개. 그 전에는 넣지 않는다(`verified_support` 규칙) |
| `attribute_app_fields.silhouette` | `[]` → 앱 단계 2 이후 `["silhouette"]` |
| `derived_conversions` 추가 | ① 앱 fit straight·wide → 실루엣 같은 키, 핏 unrecorded(regular로 채우지 않음)<br>② 폐기 실루엣 I·H → rectangular(원본 보존, W 경고)<br>③ volume → unresolved(자동 변환 금지)<br>④ skater → circle(**r2 초안 B1 승인 후에만**) |
| 대분류별 실루엣 범위 | 계약에는 범위표를 넣지 않는다(Lab DB가 강제하지 않음). 검증기에서는 경고 `W_SILHOUETTE_SCOPE`만 낸다. 범위표는 Lab 최종본에서 받는다 |

## 4. 검증 코드 추가

| 코드 | 수준 | 조건 |
|---|---|---|
| E_FIT_HAS_SILHOUETTE_VALUE | 오류 | 핏 칸에 실루엣 전용 값(straight 등) |
| E_SILHOUETTE_HAS_FIT_VALUE | 오류 | 실루엣 칸에 핏 값(slim 등) |
| E_FIT_NOT_APPLICABLE / E_SILHOUETTE_NOT_APPLICABLE | 오류 | 신발·가방·액세서리에 값 |
| E_SILHOUETTE_CASE_MISMATCH | 오류 | 대소문자만 다른 값(`a`). 자동으로 합치지 않음 |
| E_*_ASSESSED_WITHOUT_VALUE / E_*_VALUE_WITHOUT_ASSESSED | 오류 | 상태와 값 불일치 |
| E_*_UNDETERMINABLE_WITHOUT_REASON | 오류 | 판단 불가인데 사유 없음 |
| W_SILHOUETTE_SCOPE | 경고 | 대분류·세부분류 범위 밖(예: 상의에 jogger) |
| W_SILHOUETTE_RETIRED_MAPPED | 경고 | 폐기값을 활성값으로 변환함 |
| W_SILHOUETTE_RETIRED_UNRESOLVED | 경고 | 폐기값이지만 변환 규칙 없음(volume) |
| W_SILHOUETTE_ALIAS | 경고 | 동의어를 변환함(skater) |
| 색상 r2 코드 | — | `knowledge-lab-color-tone-agreements-r2.md` 2장 그대로 |

## 5. 평가용 엔티티 후보 (300벌 검증)

| 엔티티 | 필드 | 이유 |
|---|---|---|
| `garment_attribute_labels.csv` | garment_id, labeler, field, value, status, reason, acceptable, labeled_at | 두 사람이 따로 라벨링한 것을 보존해 일치도를 계산한다. 지금 `garments`에는 최종값 하나와 `labeled_by` 목록만 있다 |
| `garments` 추가 | shot_type(product·worn), boundary_set, style_group_id | 착용 여부별·경계 세트별 정확도. 같은 디자인 다른 색 묶음(구성안 1장) |

- Gemini 결과는 계약에 넣지 않는다. 앱 평가 도구의 결과 파일(`prompt_sha`·`schema_sha` 포함)로만 남긴다.

## 6. pending_cofounder_decisions 변경

- D-F01: "앱의 핏 straight·wide를 실루엣으로 옮기고 Numbers의 fitted를 쓸지"를 다음 세 질문으로 바꾼다.
  - Lab 핏 7개·실루엣 17개 확정
  - 새 핏 값 → 엔진 볼륨 대응
  - 실루엣 한 칸 vs 두 칸
- D-F11(새 안건): Gemini 판단 기준 프롬프트 채택 기준(평가 계획 6장의 제안값)
