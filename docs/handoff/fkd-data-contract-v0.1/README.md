# STYLESEED Fashion Knowledge Data Contract V0.1

**Knowledge Lab(Claude C) ↔ 추천엔진(Claude A) 공식 공유 명세** · 계약 버전 `0.2.0` · 상태 **draft(Claude C 검토 후 확정)** · 작성 2026-10-19 · 0.2.0 앱 호환 규칙 2026-10-21(9장)

> 파일·폴더 이름의 `v0.1`은 경로 고정용이다(Lab의 계약 사본 갱신 스크립트가 이 경로를 쓴다). 실제 버전은 계약 JSON의 `contract_version`.

이 폴더 하나만 있으면 Lab을 개발할 수 있도록 만든 독립 패키지다. 다른 저장소 문서를 읽지 않아도 된다.

| 파일 | 내용 |
|---|---|
| `README.md` | 이 명세(사람용). 5장의 표는 계약 JSON에서 자동 생성 |
| `contract/fkd-contract-v0.1.json` | **계약 원본(기계 판독).** 필드·타입·허용값·조건부 필수·오류 코드·점수 차원·rubric·미결정 항목 |
| `contract/fkd-bundle.schema.json` | JSON 내보내기용 JSON Schema(필드 형식만. 교차 검증은 8장) |
| `examples/csv/` | **올바른 예시 묶음(CSV)** + `manifest.json`(파일 해시) — 모든 상태·승인 경로 포함 |
| `examples/json/bundle.json` | 같은 예시의 **JSON 묶음** |
| `examples/invalid/*.json` + `expected-errors.json` | 잘못된 묶음 17가지와 **반드시 나와야 하는 오류 코드** — Lab 검증 구현의 테스트 데이터 |

> 예시 데이터는 모두 **가짜**다(`manifest.purpose = "example"`, 메모 “예시 데이터 — 실제 패션 판단 아님”). 엔진용 빌드는 `purpose = example` 묶음을 거부한다.

---

## 1. 역할과 원칙

| 역할 | 맡는 것 |
|---|---|
| **공동창업자 2명(E1·E2)** | 패션 지식 내용과 추천 기준의 **최종 승인자**: 속성 허용값 확정, 규칙 작성·승인, 코디 독립 평가, 불일치 합의, 가중치·평가 기준 결정 |
| **Claude C** | Knowledge Lab: 연구 가이드 웹사이트, 데이터 입력 UI, 코디 평가 UI, 관리자, DB·CRUD, **이 계약 형식의 내보내기** |
| **Claude A** | 이 계약의 관리, 가져오기 검증·빌드, 추천엔진, 기준선 측정, 앱 통합 |

원칙
1. **승인되지 않은 데이터는 추천엔진에 들어가지 않는다.** (6장 승인 조건)
2. **확정되지 않은 패션 판단은 데이터로만 제안하고, 공동창업자가 승인한다.** (5장 마지막 표 D-F01~D-F10)
3. **두 평가자의 평가는 서로 독립이다.** (7장)
4. 이 계약은 **형식과 규칙**을 정한다. 패션 내용(어떤 조합이 좋은가)은 정하지 않는다.

## 2. 데이터 흐름

```
Knowledge Lab DB ──내보내기──▶ 묶음(CSV 폴더 또는 bundle.json) ──▶ [Claude A] 검증 ──▶ 빌드(승인 규칙만) ──▶ 추천엔진
                                       │                                   │
                                       └── 평가(evaluations) ─────────────▶ 두 평가자 비교 ──▶ disagreement_review ──▶ Lab에서 합의 입력
```

## 3. 엔티티와 ID

| 엔티티 | 뜻 | 기본 키 | ID 형식 |
|---|---|---|---|
| `evaluators` | 평가자·승인자 | `evaluator_id` | `E1`, `E2` … (이름·이메일 금지) |
| `attribute_values` | 의류 속성 사전(허용값) | `attribute_key + value_key` | `value_key`: 영문·숫자·`-`(예: `oversized`, `A`) |
| `garments` | 평가용 의류 | `garment_id` | `G001` … (예시 `EX-G01`) |
| `outfits` | 평가용 코디 | `outfit_id` | Pilot `P01`, 본 평가 `M001`, 예시 `EX-01` |
| `outfit_evaluations` | 코디 평가(평가자별) | `outfit_id + evaluator_id + round` | — |
| `styling_rules` | 스타일링 규칙 | `rule_id + rule_version` | `COL-001`·`FIT-`·`MAT-`·`TPO-`·`MOOD-` + 세 자리(차원 약자, 예시는 `EX-` 접두) |
| `disagreement_reviews` | 불일치 검토 | `outfit_id + dimension + round` | — |

```
evaluators ─┬─< attribute_values.decided_by   ├─< garments.labeled_by   ├─< styling_rules.author / reviewer
            ├─< outfit_evaluations.evaluator_id                          └─< disagreement_reviews.evaluator_1/2
attribute_values ──(허용값)──▶ garments 속성, styling_rules 조건·상황, outfits 상황
garments ─< outfits.garment_ids ─< outfit_evaluations.outfit_id ─< disagreement_reviews.outfit_id
styling_rules ─< styling_rules.exception_of (예외 → 기본 규칙)
```

## 4. 내보내기 형식

### 4.1 공통

| 항목 | 규칙 |
|---|---|
| 고정 목록 값 | **정식 값은 영어 키**(`approved`). CSV에서만 한국어 라벨(`승인`)도 허용, JSON은 영어 키만 |
| 속성값 | `attribute_values.value_key`. 폐기(`retired`) 값은 사용 불가 |
| 날짜 | `YYYY-MM-DD` / 시각(manifest) ISO 8601 |
| 모르는 필드 | `x_` 접두어는 Lab 전용으로 조용히 무시, 그 밖에는 경고 후 무시 |
| 예시 레코드 | `data_origin = example` 또는 ID가 `EX-`로 시작 → 검증·집계·빌드 제외(단 예시를 승인하면 오류) |
| 개인정보 | 평가자는 ID만 |

### 4.2 CSV 묶음

```
<묶음>/
  manifest.json                     (Lab 내보내기 필수)
  evaluators.csv  garment_schema.csv  garments.csv  outfits.csv  styling_rules.csv   (필수)
  disagreement_review.csv           (선택)
  evaluations/outfit_evaluation_<평가자ID>.csv   (선택, 평가자 1명 = 파일 1개)
```

- CSV RFC 4180, UTF-8(BOM 허용), 1행 헤더 = 필드 키(예: `rule_id`). `한국어 이름 [rule_id]`처럼 대괄호 안에 키를 둔 헤더도 허용(Google Sheets용). 열 순서 자유
- 여러 값은 한 칸에 `|`로: `office|date`
- `garment_schema.csv`가 `attribute_values` 엔티티 파일이다(이름은 기존 도구 호환)

### 4.3 JSON 묶음

`bundle.json` 한 파일:

```json
{
  "manifest": { "contract_version": "0.2.0", "source": "knowledge-lab", "purpose": "production", "format": "json",
                "exported_at": "2026-10-24T10:00:00+09:00", "exported_by": "E1", "counts": { "styling_rules": 12 } },
  "evaluators": [ { "evaluator_id": "E1", "role": "cofounder", "can_approve": "yes", "active": "yes" } ],
  "attribute_values": [ ... ], "garments": [ ... ], "outfits": [ ... ], "styling_rules": [ ... ],
  "outfit_evaluations": [ ... ], "disagreement_reviews": [ ... ]
}
```

- 타입: `int` → number, 목록형(`enum_list`·`ref_list`·`taxonomy_values`) → 문자열 배열, 나머지 → 문자열. 빈 값은 생략
- 평가는 `outfit_evaluations` 배열 하나(평가자는 `evaluator_id`로 구분, 독립 평가 검사는 평가자별로 수행)
- 필드 형식은 `contract/fkd-bundle.schema.json`으로 먼저 검사할 수 있다

### 4.4 manifest

| 필드 | 필수 | 설명 |
|---|---|---|
| `contract_version` | ✔ | `0.2.0` |
| `source` | ✔ | `knowledge-lab` 또는 `sheets` |
| `purpose` | ✔(Lab) | `production` 또는 `example`(예시는 빌드 거부) |
| `format` | ✔(Lab) | `csv` 또는 `json` |
| `exported_at`, `exported_by` | 권장 | 시각, 평가자 ID 또는 시스템 이름 |
| `files` | CSV 필수 | `{ "evaluators.csv": "<sha256 hex>", ... }` — 가져올 때 내용 확인 |
| `counts` | 권장 | 엔티티별 레코드 수 |

## 5. 필드·점수 차원·rubric·고정 목록·오류 코드·미결정 항목 (계약 JSON에서 생성)

<!-- BEGIN GENERATED: scripts/fkd/gen-contract-doc.mjs -->

계약 버전 `0.2.0` (상태: draft)

### 평가자·승인자 — `evaluators`

파일 `evaluators.csv` · 기본 키 `evaluator_id`

| 필드 | 이름 | 타입·허용값 | 필수 | 검증 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `evaluator_id` | 평가자 ID | id | 필수 | 형식 `^E[0-9]{1,2}$` | `E1` | 이름 대신 쓰는 ID. 개인정보(이름·이메일)는 넣지 않는다 |
| `role` | 역할 | enum · 목록 `evaluator_role` | 필수 |  | `cofounder` |  |
| `can_approve` | 승인 권한 | enum · 목록 `yes_no` | 필수 |  | `yes` | 규칙 승인·속성 확정 권한. V0.1은 공동창업자만 yes |
| `active` | 활성 | enum · 목록 `yes_no` | 필수 |  | `yes` |  |
| `note` | 메모 | text | 선택 |  |  |  |

### 의류 속성 사전(허용값) — `attribute_values`

파일 `garment_schema.csv` · 기본 키 `attribute_key + value_key`

| 필드 | 이름 | 타입·허용값 | 필수 | 검증 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `attribute_key` | 속성 키 | enum · 목록 `attribute_key` | 필수 |  | `fit` |  |
| `attribute_ko` | 속성 이름 | text | 필수 |  | `핏` |  |
| `value_key` | 값 키 | id | 필수 | 형식 `^[A-Za-z][A-Za-z0-9-]*$` | `oversized` | 규칙·의류에서 쓰는 값. 확정 후 바꾸지 않는다(바꾸려면 폐기 후 새 값) |
| `value_ko` | 값 이름 | text | 필수 |  | `오버사이즈` |  |
| `parent_value` | 상위 값 | string | 조건부: attribute_key=subcategory |  | `top` | 세부분류가 속한 대분류 값 키 |
| `definition` | 정의 | text | 선택 |  |  |  |
| `guide` | 판단 기준 | text | 선택 |  |  |  |
| `example` | 예시 | text | 선택 |  |  |  |
| `app_field` | 앱 필드 | enum · 목록 `app_field` | 필수 |  | `fit` | 현재 앱 Clothing 타입의 필드. 대응 없음은 none. 속성별로 쓸 수 있는 앱 필드는 app_compat.attribute_app_fields |
| `app_value` | 현재 앱 값 | string | 선택 |  | `oversized` | converted일 때 바꿀 앱 값(app_compat.app_values의 값, 목록 필드는 \| 로 여러 개). yes면 비우거나 value_key와 같게, no면 비움 |
| `app_supported` | 앱 지원 | enum · 목록 `app_supported` | 필수 |  | `yes` | yes=앱이 그대로 저장 / converted=앱 값으로 변환(app_value 또는 계약의 규칙형 변환) / no=앱이 모름. 지원 표시는 앱 지원이 검증된 값(app_compat.app_values)만 |
| `status` | 상태 | enum · 목록 `taxonomy_status` | 필수 |  | `confirmed` |  |
| `decided_by` | 결정자 | ref_list → `evaluators` | 조건부: status=confirmed |  | `E1\|E2` |  |
| `decided_at` | 결정일 | date | 조건부: status=confirmed |  | `2026-10-22` |  |
| `data_origin` | 데이터 출처 | enum · 목록 `data_origin` | 필수 |  | `human` |  |
| `version` | 버전 | int | 필수 | 최소 1 | `1` |  |
| `note` | 메모 | text | 선택 |  |  |  |

### 평가용 의류 — `garments`

파일 `garments.csv` · 기본 키 `garment_id`

| 필드 | 이름 | 타입·허용값 | 필수 | 검증 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `garment_id` | 의류 ID | id | 필수 | 형식 `^(G[0-9]{3,5}\|EX-G[0-9]{2,3})$` | `G001` |  |
| `name_ko` | 이름 | text | 필수 |  | `화이트 오버핏 면 셔츠` |  |
| `image_url` | 이미지 링크 | url | 선택 |  |  | 팀이 접근 가능한 https 링크 |
| `source` | 출처 | enum · 목록 `garment_source` | 필수 |  | `fixture` |  |
| `source_ref` | 출처 참조 | string | 선택 |  | `engine-closet#1` | 엔진 기준선 측정용 원본 참조 |
| `category` | 대분류 | enum · 속성 사전 `category` | 필수 |  | `top` |  |
| `subcategory` | 세부분류 | enum · 속성 사전 `subcategory` | 필수 |  | `shirt` |  |
| `main_color` | 주색상 | enum · 속성 사전 `main_color` | 필수 |  | `white` |  |
| `color_tone` | 색 톤(앱) | enum · 목록 `color_tone` | 필수 |  | `bright` | 현재 앱 colorTone. 명도·채도가 없을 때 변환에 쓴다 |
| `value` | 명도 | enum · 속성 사전 `value` | 선택 |  | `light` |  |
| `saturation` | 채도 | enum · 속성 사전 `saturation` | 선택 |  | `low` |  |
| `fit` | 핏 | enum · 속성 사전 `fit` | 필수 |  | `oversized` |  |
| `silhouette` | 실루엣 | enum · 속성 사전 `silhouette` | 선택 |  | `H` |  |
| `material` | 소재(섬유) | enum · 속성 사전 `material` | 필수 |  | `cotton` |  |
| `material_feel` | 소재감 | enum_list · 속성 사전 `material_feel` | 선택 |  | `crisp\|matte` |  |
| `thickness` | 두께감 | enum · 속성 사전 `thickness` | 선택 |  | `medium` |  |
| `season` | 계절 | enum_list · 속성 사전 `season` | 필수 |  | `spring\|fall` |  |
| `tpo` | TPO | enum_list · 속성 사전 `tpo` | 필수 |  | `casual\|office` |  |
| `mood` | 무드 | enum_list · 속성 사전 `mood` | 필수 |  | `minimal\|classic` |  |
| `attribute_status` | 속성 확인 상태 | enum · 목록 `taxonomy_status` | 필수 |  | `proposed` | 속성 태깅을 사람이 확인했는지 |
| `labeled_by` | 태깅한 사람 | ref_list → `evaluators` | 조건부: attribute_status=confirmed |  | `E1` |  |
| `data_origin` | 데이터 출처 | enum · 목록 `data_origin` | 필수 |  | `claude_draft` |  |
| `note` | 메모 | text | 선택 |  |  |  |

### 평가용 코디 — `outfits`

파일 `outfits.csv` · 기본 키 `outfit_id`

| 필드 | 이름 | 타입·허용값 | 필수 | 검증 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `outfit_id` | 코디 ID | id | 필수 | 형식 `^(P[0-9]{2,3}\|M[0-9]{3,4}\|EX-[0-9]{2})$` | `P01` | P=Pilot, M=본 평가, EX-=예시 |
| `set` | 세트 | enum · 목록 `outfit_set` | 필수 |  | `pilot` |  |
| `split` | 용도 | enum · 목록 `split` | 필수 |  | `unassigned` | 가중치 조정용(dev) / 최종 확인용(holdout). 확정 후 바꾸지 않는다 |
| `context_label` | 평가 상황 | text | 필수 |  | `가을 · 출근` |  |
| `context_tpo` | 상황 TPO | enum · 속성 사전 `tpo` | 필수 |  | `office` |  |
| `context_season` | 상황 계절 | enum · 속성 사전 `season` | 필수 |  | `fall` |  |
| `context_weather` | 상황 날씨 | enum · 목록 `weather` | 선택 |  | `snow` |  |
| `garment_ids` | 의류 ID 목록 | ref_list → `garments` | 필수 | 2~6개 | `G001\|G005\|G013` |  |
| `image_url` | 코디 이미지 링크 | url | 선택 |  |  |  |
| `status` | 상태 | enum · 목록 `outfit_status` | 필수 |  | `active` |  |
| `data_origin` | 데이터 출처 | enum · 목록 `data_origin` | 필수 |  | `claude_draft` | 코디 구성을 누가 만들었는지(평가 점수의 출처와 별개) |
| `note` | 메모 | text | 선택 |  |  |  |

### 코디 평가(평가자별 독립) — `outfit_evaluations`

파일 `evaluations/*.csv` · 기본 키 `outfit_id + evaluator_id + round`

| 필드 | 이름 | 타입·허용값 | 필수 | 검증 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `outfit_id` | 코디 ID | ref → `outfits` | 필수 |  | `P01` |  |
| `evaluator_id` | 평가자 ID | ref → `evaluators` | 조건부: submission_status=submitted |  | `E1` |  |
| `round` | 평가 회차 | int | 필수 | 최소 1 | `1` | 같은 코디를 다시 평가할 때 2, 3 …(이전 회차는 고치지 않음) |
| `outfit_summary` | 코디 내용(표시용) | text | 선택 | 표시용(가져올 때 무시) |  | 시트에서 보기 편하게 둔 열. 가져올 때 무시 |
| `score_color` | 색 1~5 | int | 조건부: submission_status=submitted | 최소 1 · 최대 5 | `4` |  |
| `score_silhouette_fit` | 핏·실루엣 1~5 | int | 조건부: submission_status=submitted | 최소 1 · 최대 5 | `3` |  |
| `score_material_season` | 소재·계절 1~5 | int | 조건부: submission_status=submitted | 최소 1 · 최대 5 | `4` |  |
| `score_tpo` | TPO 1~5 | int | 조건부: submission_status=submitted | 최소 1 · 최대 5 | `2` |  |
| `score_mood` | 무드 1~5 | int | 조건부: submission_status=submitted | 최소 1 · 최대 5 | `4` |  |
| `score_overall` | 종합 1~5 | int | 조건부: submission_status=submitted | 최소 1 · 최대 5 | `3` | 다른 점수의 평균이 아니라 직접 판단 |
| `label` | 판정 | enum · 목록 `label` | 조건부: submission_status=submitted |  | `conditional` |  |
| `recommendable` | 추천해도 되나 | enum · 목록 `recommendable` | 조건부: submission_status=submitted |  | `no` |  |
| `reason` | 핵심 이유 | text | 조건부: submission_status=submitted | 10자 이상 | `출근 상황인데 민소매 탑은 노출이 많아 격식이 부족함` |  |
| `improvement` | 바꾸면 좋을 아이템 | text | 선택 |  | `민소매 탑 → 흰 셔츠` |  |
| `confidence` | 확신도 | enum · 목록 `confidence` | 조건부: submission_status=submitted |  | `medium` |  |
| `rated_at` | 평가일 | date | 조건부: submission_status=submitted |  | `2026-10-21` |  |
| `submission_status` | 제출 상태 | enum · 목록 `submission_status` | 필수 |  | `submitted` | 제출한 평가만 비교·집계에 쓴다 |
| `data_origin` | 데이터 출처 | enum · 목록 `data_origin` | 필수 |  | `human` |  |
| `note` | 메모 | text | 선택 |  |  |  |

### 스타일링 규칙 — `styling_rules`

파일 `styling_rules.csv` · 기본 키 `rule_id + rule_version`

| 필드 | 이름 | 타입·허용값 | 필수 | 검증 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `rule_id` | 규칙 ID | id | 필수 | 형식 `^(EX-)?(COL\|FIT\|MAT\|TPO\|MOOD)-[0-9]{3}$` | `FIT-001` | 평가 차원 약자 + 세 자리. EX-는 예시 |
| `rule_version` | 버전 | int | 필수 | 최소 1 | `1` | 승인된 규칙을 바꿀 때는 새 행 + 버전 증가(기존 행 수정 금지) |
| `rule_type` | 규칙 종류 | enum · 목록 `rule_type` | 필수 |  | `base` |  |
| `exception_of` | 대상 기본 규칙 | string | 조건부: rule_type=exception |  | `FIT-002` |  |
| `dimension` | 평가 차원 | enum · 목록 `dimension` | 필수 |  | `silhouette_fit` |  |
| `a_category` | 조건 A 대분류 | enum · 속성 사전 `category` (+any) | 필수 |  | `top` |  |
| `a_attribute` | 조건 A 속성 | enum · 목록 `attribute_key` | 필수 |  | `fit` |  |
| `a_values` | 조건 A 값 | taxonomy_values · `a_attribute`의 값 | 필수 |  | `oversized` |  |
| `b_category` | 조건 B 대분류 | enum · 속성 사전 `category` (+any) | 선택 |  | `bottom` |  |
| `b_attribute` | 조건 B 속성 | enum · 목록 `attribute_key` | 선택 |  | `silhouette` |  |
| `b_values` | 조건 B 값 | taxonomy_values · `b_attribute`의 값 | 선택 |  | `wide` |  |
| `context_tpo` | 적용 TPO | enum_list · 속성 사전 `tpo` | 선택 |  | `office\|date` |  |
| `context_mood` | 적용 무드 | enum_list · 속성 사전 `mood` | 선택 |  | `street` |  |
| `context_season` | 적용 계절 | enum_list · 속성 사전 `season` | 선택 |  | `winter` |  |
| `context_weather` | 적용 날씨 | enum_list · 목록 `weather` | 선택 |  | `cold\|snow` |  |
| `judgement` | 판정 | enum · 목록 `judgement` | 필수 |  | `caution` |  |
| `strength` | 강도 1~5 | int | 필수 | 최소 1 · 최대 5 | `3` |  |
| `reason` | 판단 이유 | text | 필수 | 10자 이상 | `상·하의 볼륨이 동시에 커져 허리선이 흐려짐` |  |
| `display_text` | 사용자 안내 문장 | text | 선택 | 80자 이하 | `상의와 하의가 모두 넉넉해 허리선이 흐려질 수 있어요` |  |
| `exception_note` | 예외·주의 사항 | text | 선택 |  |  |  |
| `confidence` | 확신도 | enum · 목록 `confidence` | 필수 |  | `high` |  |
| `author` | 작성자 | ref → `evaluators` | 조건부: approval_status!=draft |  | `E1` |  |
| `reviewer` | 검토·승인자 | ref → `evaluators` | 조건부: approval_status=approved |  | `E2` |  |
| `approval_status` | 승인 상태 | enum · 목록 `approval_status` | 필수 |  | `approved` |  |
| `approved_at` | 승인일 | date | 조건부: approval_status=approved |  | `2026-10-23` |  |
| `data_origin` | 데이터 출처 | enum · 목록 `data_origin` | 필수 |  | `human` |  |
| `note` | 메모 | text | 선택 |  |  |  |

### 불일치 검토 — `disagreement_reviews`

파일 `disagreement_review.csv` · 기본 키 `outfit_id + dimension + round`

| 필드 | 이름 | 타입·허용값 | 필수 | 검증 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `outfit_id` | 코디 ID | ref → `outfits` | 필수 |  | `P11` |  |
| `dimension` | 평가 차원 | enum · 목록 `review_dimension` | 필수 |  | `overall` |  |
| `round` | 평가 회차 | int | 필수 | 최소 1 | `1` |  |
| `evaluator_1` | 평가자1 ID | ref → `evaluators` | 필수 |  | `E1` |  |
| `score_1` | 평가자1 점수 | int | 필수 | 최소 1 · 최대 5 | `4` |  |
| `evaluator_2` | 평가자2 ID | ref → `evaluators` | 필수 |  | `E2` |  |
| `score_2` | 평가자2 점수 | int | 필수 | 최소 1 · 최대 5 | `2` |  |
| `gap` | 차이 | int | 필수 | 최소 0 · 최대 4 | `2` |  |
| `label_1` | 평가자1 판정 | enum · 목록 `label` | 선택 |  | `suitable` |  |
| `label_2` | 평가자2 판정 | enum · 목록 `label` | 선택 |  | `unsuitable` |  |
| `reason_1` | 평가자1 이유 | text | 선택 |  |  |  |
| `reason_2` | 평가자2 이유 | text | 선택 |  |  |  |
| `cause` | 원인 분류 | enum · 목록 `review_cause` | 조건부: status=agreed |  | `criteria` |  |
| `agreed_score` | 합의 점수 | int | 조건부: status=agreed | 최소 1 · 최대 5 | `3` |  |
| `agreed_label` | 합의 판정 | enum · 목록 `label` | 선택 |  | `conditional` |  |
| `agreed_reason` | 합의 이유 | text | 조건부: status=agreed |  |  |  |
| `action` | 후속 조치 | enum · 목록 `review_action` | 조건부: status=agreed |  | `add_rule` |  |
| `rule_id` | 관련 규칙 ID | string | 선택 |  | `TPO-001` |  |
| `status` | 검토 상태 | enum · 목록 `review_status` | 필수 |  | `open` |  |
| `reviewed_at` | 검토일 | date | 조건부: status=agreed |  | `2026-10-22` |  |
| `data_origin` | 데이터 출처 | enum · 목록 `data_origin` | 필수 |  | `human` |  |
| `note` | 메모 | text | 선택 |  |  |  |

### 점수 차원

| 키 | 이름 | 평가 필드 | 규칙 ID 약자 | Match Score 항목 | 가중치 가설 | 보는 것 |
|---|---|---|---|---|---|---|
| `color` | 색 | `score_color` | `COL` | Color | 25 | 색상 조화, 명도 대비, 채도 균형, 면적 비율 |
| `silhouette_fit` | 핏·실루엣 | `score_silhouette_fit` | `FIT` | Fit / Silhouette | 25 | 상하 볼륨, 허리선, 길이, 레이어링 |
| `tpo` | TPO | `score_tpo` | `TPO` | TPO | 20 | 격식, 활동성, 노출, 기능성 |
| `material_season` | 소재·계절 | `score_material_season` | `MAT` | Material / Season | 15 | 광택, 두께, 드레이프, 텍스처, 계절·날씨 |
| `mood` | 무드 | `score_mood` | `MOOD` | User Preference(취향 데이터 없을 때 무드 일관성으로 대체 — D-F07) | 15 | 스타일 키워드 일관성, 디테일, 액세서리 |
| `overall` | 종합 | `score_overall` | — | Match Score와 비교하는 기준(사람이 직접 판단, 평균 아님) | — | 코디 전체 |

척도 1~5, 0~100 환산 `(점수 - 1) × 25` (상태: proposed, D-F05). 가중치는 **가설**이며 공동창업자 승인 전에는 확정값이 아니다.

### 평가 기준 문장(rubric) — proposed — Numbers V0.1 04_평가기준에서 옮김. 공동창업자 확정 필요(D-F05)

| 차원 | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| `color` | 충돌이 커서 조합을 방해 | 불안정한 조합 | 무난/중립 | 대체로 조화 | 의도와 대비가 명확하고 매우 조화 |
| `silhouette_fit` | 비율·볼륨이 크게 무너짐 | 어색함이 뚜렷 | 무난/조건부 | 균형이 좋음 | 실루엣 의도가 명확하고 비율이 매우 좋음 |
| `material_season` | 계절/물성 충돌이 심함 | 부조화가 눈에 띔 | 무난 | 재질 대비/통일감이 좋음 | 소재 조합이 코디의 완성도를 높임 |
| `tpo` | 상황에 명백히 부적합 | 다소 부적합 | 상황에 따라 가능 | 대체로 적합 | 상황과 기능에 매우 적합 |
| `mood` | 의도한 무드가 깨짐 | 무드 충돌 | 혼합되나 성립 | 대체로 일관 | 무드가 명확하고 각 아이템이 같은 방향을 강화 |

### 고정 목록 (정식 값 = 영어 키, 한국어 라벨도 같은 값으로 받음)

| 목록 | 값 (키 = 라벨) |
|---|---|
| `data_origin` | `human` = 사람, `example` = 예시, `claude_draft` = Claude 초안 |
| `taxonomy_status` | `proposed` = 제안, `in_review` = 검토중, `confirmed` = 확정, `retired` = 폐기 |
| `approval_status` | `draft` = 초안, `in_review` = 검토중, `approved` = 승인, `on_hold` = 보류, `retired` = 폐기 |
| `rule_type` | `base` = 기본, `exception` = 예외 |
| `dimension` | `color` = 색, `silhouette_fit` = 핏·실루엣, `material_season` = 소재·계절, `tpo` = TPO, `mood` = 무드 |
| `review_dimension` | `color` = 색, `silhouette_fit` = 핏·실루엣, `material_season` = 소재·계절, `tpo` = TPO, `mood` = 무드, `overall` = 종합 |
| `judgement` | `recommended` = 권장, `conditional` = 조건부 권장, `caution` = 주의, `not_recommended` = 비권장 |
| `confidence` | `high` = High, `medium` = Medium, `low` = Low |
| `label` | `suitable` = 적합, `conditional` = 조건부, `unsuitable` = 부적합 |
| `recommendable` | `yes` = 예, `no` = 아니오, `unsure` = 모름 |
| `yes_no` | `yes` = 예, `no` = 아니오 |
| `app_supported` | `yes` = 예, `converted` = 변환, `no` = 아니오 |
| `submission_status` | `in_progress` = 작성중, `submitted` = 제출 |
| `weather` | `cold` = 추움(5℃ 이하), `cool` = 선선(6~15℃), `mild` = 온화(16~22℃), `warm` = 따뜻(23~27℃), `hot` = 더움(28℃ 이상), `rain` = 비, `snow` = 눈 |
| `outfit_set` | `pilot` = Pilot, `main` = 본 평가 |
| `split` | `unassigned` = 미배정, `dev` = 개발용, `holdout` = 보류용 |
| `outfit_status` | `active` = 사용, `retired` = 폐기 |
| `evaluator_role` | `cofounder` = 공동창업자, `external` = 외부 평가자 |
| `garment_source` | `fixture` = 고정 옷장, `product_image` = 상품 이미지, `qa_upload` = QA 업로드, `other` = 기타 |
| `color_tone` | `bright`, `light`, `muted`, `dark`, `vivid` |
| `app_field` | `category`, `subCategory`, `color`, `colorTone`, `fit`, `material`, `season`, `tpo`, `style`, `none` = 없음 |
| `attribute_key` | `category` = 대분류, `subcategory` = 세부분류, `main_color` = 주색상, `value` = 명도, `saturation` = 채도, `fit` = 핏, `silhouette` = 실루엣, `material` = 소재(섬유), `material_feel` = 소재감, `thickness` = 두께감, `season` = 계절, `tpo` = TPO, `mood` = 무드 |
| `review_cause` | `criteria` = 기준 해석 차이, `missing_info` = 정보 부족(사진·설명), `taste` = 취향 차이, `input_error` = 입력 실수, `needs_rule` = 규칙 필요 |
| `review_action` | `add_rule` = 규칙 추가, `edit_rule` = 규칙 수정, `edit_rubric` = 평가 기준 문장 수정, `add_exception` = 예외 추가, `none` = 조치 없음 |
| `review_status` | `open` = 미검토, `discussing` = 논의중, `agreed` = 합의, `on_hold` = 보류 |

### 오류·경고 코드

| 코드 | 수준 | 의미 |
|---|---|---|
| `E_MANIFEST_INVALID` | 오류(가져오기 중단) | manifest.json 형식 오류 |
| `E_JSON_INVALID` | 오류(가져오기 중단) | bundle.json을 읽을 수 없거나 형식이 다름 |
| `E_EXAMPLE_BUNDLE_BUILD` | 오류(가져오기 중단) | purpose=example 묶음은 엔진용 빌드 불가 |
| `W_MANIFEST_MISSING` | 경고 | manifest.json 없음(Sheets 수동 내보내기면 정상) |
| `E_CONTRACT_MAJOR` | 오류(가져오기 중단) | 지원하지 않는 계약 주 버전 |
| `W_CONTRACT_NEWER` | 경고 | 가져오는 쪽보다 새 부 버전 — 모르는 필드는 무시 |
| `E_FILE_MISSING` | 오류(가져오기 중단) | 필수 파일 없음 |
| `E_HASH_MISMATCH` | 오류(가져오기 중단) | manifest의 해시와 파일 내용 불일치 |
| `W_UNKNOWN_FIELD` | 경고 | 계약에 없는 열(무시) |
| `E_MISSING_FIELD` | 오류(가져오기 중단) | 필수 열이 헤더에 없음 |
| `E_REQUIRED` | 오류(가져오기 중단) | 필수 값 비어 있음 |
| `E_PATTERN` | 오류(가져오기 중단) | ID 형식 오류 |
| `E_ENUM` | 오류(가져오기 중단) | 허용 목록에 없는 값 |
| `E_TAXONOMY_VALUE` | 오류(가져오기 중단) | 속성 사전에 없는(또는 폐기된) 값 |
| `E_INT` | 오류(가져오기 중단) | 정수 또는 범위 오류 |
| `E_DATE` | 오류(가져오기 중단) | 날짜 형식 오류 |
| `E_URL` | 오류(가져오기 중단) | 링크 형식 오류(https만) |
| `E_TEXT_LENGTH` | 오류(가져오기 중단) | 글자 수 기준 미달·초과 |
| `E_LIST_SIZE` | 오류(가져오기 중단) | 목록 개수 범위 오류 |
| `E_DUPLICATE_KEY` | 오류(가져오기 중단) | 기본 키 중복 |
| `E_REF` | 오류(가져오기 중단) | 참조 대상 없음 |
| `E_PARENT_MISMATCH` | 오류(가져오기 중단) | 세부분류가 대분류와 맞지 않음 |
| `E_APP_FIELD` | 오류(가져오기 중단) | 앱 필드가 이 속성에 맞지 않거나, 앱 필드가 none인데 지원(yes·converted)으로 표시됨 |
| `E_APP_VALUE` | 오류(가져오기 중단) | 앱 지원 표시와 앱 값이 맞지 않음(지원 값은 앱 허용값만, 변환은 앱 값 또는 계약의 규칙형 변환 필요) |
| `E_APP_PARENT_MISMATCH` | 오류(가져오기 중단) | 앱으로 보내는 세부분류의 앱 상위 대분류가 연구용 상위 대분류의 앱 변환값과 다르거나, 상위 대분류가 앱 미지원 |
| `W_APP_VALUE_IGNORED` | 경고 | 앱 미지원(no) 값에 앱 값이 적혀 있음 — 변환에 쓰지 않음(지원 표시가 아님) |
| `E_CONFIRM_ORIGIN` | 오류(가져오기 중단) | 출처가 human이 아닌 값을 확정 |
| `E_APPROVER_AUTHORITY` | 오류(가져오기 중단) | 승인·확정 권한 없는 평가자 |
| `E_RULE_PREFIX` | 오류(가져오기 중단) | 규칙 ID 약자와 평가 차원 불일치 |
| `E_CONDITION_INCOMPLETE` | 오류(가져오기 중단) | 조건의 속성·값 중 하나만 있음 |
| `E_EXCEPTION_BASE` | 오류(가져오기 중단) | 예외 규칙의 대상 기본 규칙 없음 |
| `E_EXCEPTION_BASE_NOT_APPROVED` | 오류(가져오기 중단) | 승인된 예외의 대상 기본 규칙이 미승인 |
| `E_EXAMPLE_APPROVED` | 오류(가져오기 중단) | 예시 행을 승인함 |
| `E_APPROVAL_ORIGIN` | 오류(가져오기 중단) | 출처가 human이 아닌 규칙을 승인함 |
| `E_APPROVAL_SAME_PERSON` | 오류(가져오기 중단) | 작성자와 승인자가 같음 |
| `E_UNCONFIRMED_VALUE` | 오류(가져오기 중단) | 승인 규칙이 확정되지 않은 속성값을 사용 |
| `W_UNSUPPORTED_ATTRIBUTE` | 경고 | 앱이 아직 저장하지 않는 속성을 쓰는 규칙(적용은 변환 또는 분석 확장 후) |
| `W_CONDITIONAL_NO_CONTEXT` | 경고 | 조건부 권장인데 적용 상황 없음 |
| `E_EVAL_MIXED_EVALUATOR` | 오류(가져오기 중단) | 한 평가 파일에 평가자 여러 명 |
| `E_EVAL_ORIGIN` | 오류(가져오기 중단) | 제출된 평가의 출처가 human이 아님 |
| `W_APP_UNSUPPORTED` | 경고 | 의류의 필수 속성에 앱 값이 없어 앱·엔진 입력에서 제외(원본은 보고서에 보존) |
| `W_APP_LOSSY` | 경고 | 의류의 목록 속성 중 앱 미지원 값이 빠짐(빠진 값은 보고서에 보존) |

### 공동창업자 승인이 필요한 패션 판단 (확정 전)

| ID | 주제 | 결정할 것 | 영향 |
|---|---|---|---|
| D-F01 | 핏과 실루엣 분리 | 앱의 핏 straight·wide를 실루엣으로 옮기고, Numbers의 fitted를 쓸지 | attribute_values: fit, silhouette, garments.fit/silhouette |
| D-F02 | 색 톤 체계 | 앱 colorTone 5단계 ↔ 명도(value)·채도(saturation) 변환표가 맞는지, multi 색을 어떻게 다룰지 | attribute_values: value, saturation, main_color.multi |
| D-F03 | TPO·무드·소재 목록 | TPO school·active 추가, 무드 romantic·edgy·vintage 사용, 소재를 섬유+소재감 두 축으로 볼지 | attribute_values: tpo, mood, material, material_feel, thickness |
| D-F04 | 판정 체계 | 규칙 판정 4단계(권장·조건부 권장·주의·비권장)와 강도 1~5의 의미 | lists.judgement, styling_rules.strength |
| D-F05 | 평가 척도와 기준 문장 | 차원별 1~5점 기준 문장(rubric) 확정 | rubric, outfit_evaluations.score_* |
| D-F06 | 적합 판정 경계 | Match Score를 적합/조건부/부적합으로 나누는 경계(가설 70·50) | 엔진 평가 보고 |
| D-F07 | 가중치와 취향 대체 | 가중치 가설(색 25·핏 25·TPO 20·소재 15·취향 15) 채택, 취향 데이터가 없을 때 무드 일관성으로 대체할지 | score_dimensions.weight_hypothesis |
| D-F08 | 평가 차원 구성 | 5개 차원(색·핏/실루엣·소재/계절·TPO·무드)로 충분한지(Numbers는 Season을 별도 차원으로 둠) | lists.dimension, score_dimensions |
| D-F09 | 승인 권한자 | E1·E2 두 사람만 승인 권한(can_approve)을 가질지, 외부 평가자를 둘지 | evaluators |
| D-F10 | Pilot 코디 구성 | Claude 초안 Pilot 20개를 그대로 쓸지 | outfits(set=pilot) |

<!-- END GENERATED -->

**조건부 필수** 표기 `status=confirmed`는 “그 레코드의 `status`가 `confirmed`일 때 필수”, `approval_status!=draft`는 “초안이 아닐 때 필수”라는 뜻이다(계약 JSON의 `required` 값 그대로).

## 6. 상태와 승인 조건

### 6.1 속성값 `attribute_values.status`

`proposed → in_review → confirmed`, 어느 단계에서든 `→ retired`

- `confirmed`: `data_origin = human` + 승인 권한자(`can_approve = yes`, `active = yes`)가 `decided_by` + `decided_at`
- `confirmed` 후 `value_key` 변경 금지 → 기존 값 `retired`, 새 값 추가(`version` +1)

### 6.2 스타일링 규칙 `approval_status`

`draft → in_review → approved → retired`, `in_review ↔ on_hold`

| 전이 | 누가 | 조건 |
|---|---|---|
| draft → in_review | 작성자 | `author` 필수 |
| in_review → approved | **작성자가 아닌 승인 권한자** | `reviewer`·`approved_at` 기록 |
| approved → retired | 승인 권한자 | — |
| approved 레코드 수정 | **금지** | 같은 `rule_id`로 새 레코드 + `rule_version` +1 → 다시 승인 |

**엔진에 들어가는 규칙 = 아래를 모두 만족**

| # | 조건 | 위반 코드 |
|---|---|---|
| 1 | `approval_status = approved` | (빌드 제외) |
| 2 | `data_origin = human` (Claude 초안·예시 아님) | `E_APPROVAL_ORIGIN`, `E_EXAMPLE_APPROVED` |
| 3 | `author ≠ reviewer` | `E_APPROVAL_SAME_PERSON` |
| 4 | `reviewer`가 승인 권한자 | `E_APPROVER_AUTHORITY` |
| 5 | `approved_at` 있음 | `E_REQUIRED` |
| 6 | 쓰는 모든 속성값(조건 A·B, 대분류, 적용 TPO·무드·계절)이 `confirmed` | `E_UNCONFIRMED_VALUE` |
| 7 | 예외 규칙이면 대상 기본 규칙도 `approved` | `E_EXCEPTION_BASE_NOT_APPROVED` |
| 8 | 같은 `rule_id`가 여러 버전이면 승인된 **최고 버전만** | — |
| 9 | 묶음 `manifest.purpose ≠ example` | `E_EXAMPLE_BUNDLE_BUILD` |

### 6.3 규칙 조건 읽는 법

- 쌍 규칙: 조건 A(`a_category`·`a_attribute`·`a_values`)를 만족하는 아이템과 조건 B를 만족하는 **다른** 아이템이 한 코디에 있을 때
- 단일 규칙: 조건 B를 비우면 A만 만족하면 됨
- `a_category = any`: 어떤 대분류든
- 적용 상황(`context_tpo`·`context_mood`·`context_season`·`context_weather`)을 적으면 그 상황에서만 적용
- 예외 규칙(`rule_type = exception`)은 `exception_of`의 기본 규칙 **대신** 적용

## 7. 코디 평가 — 독립 평가 요건 (Lab이 반드시 지킬 것)

1. 두 평가자 모두 제출(`submitted`)하기 전에는 **상대 점수·이유를 보여주지 않는다**
2. 평가 화면에 **추천엔진 점수를 보여주지 않는다**
3. `submitted` 후 수정 금지. 재평가는 `round` +1(이전 회차 보존)
4. `score_overall`은 하위 점수 평균으로 자동 계산하지 않는다(사람이 직접 판단 — 가중치 검증의 기준이 됨)
5. 내보내기: CSV는 평가자별 파일, JSON은 `evaluator_id`로 구분(한 파일·한 그룹 = 한 평가자: `E_EVAL_MIXED_EVALUATOR`)
6. 코디 표시 순서는 평가자마다 무작위(권장)

불일치 검토(`disagreement_reviews`)는 Claude A의 비교 도구가 만든다(어떤 차원이든 점수 차 ≥ 2, 또는 판정이 다름). Lab은 이를 가져와 합의를 입력받고, `status = agreed`로 바꿀 때 `cause`·`agreed_score`·`agreed_reason`·`action`·`reviewed_at`을 필수로 받는다. 원래 평가 레코드는 바꾸지 않는다.

## 8. 검증 규칙

### 8.1 필드 검사(계약 JSON으로 자동)

필수(조건부 포함), 타입(`id` 형식·`int` 범위·`date`·`url`(https)·글자 수·목록 개수), 고정 목록 값, 속성 사전 값(폐기 제외). 5장 표의 “검증” 열.

### 8.2 교차 검사

| # | 규칙 | 코드 |
|---|---|---|
| X1 | 기본 키 중복 금지(평가는 파일이 달라도) | `E_DUPLICATE_KEY` |
| X2 | 참조 대상 존재(평가자·의류·코디) | `E_REF` |
| X3 | 세부분류 ↔ 대분류 일치(`parent_value`, 의류의 `subcategory`) | `E_PARENT_MISMATCH` |
| X4 | 속성값 확정은 human + 승인 권한자 | `E_CONFIRM_ORIGIN`, `E_APPROVER_AUTHORITY` |
| X5 | 규칙 ID 약자 = 평가 차원 | `E_RULE_PREFIX` |
| X6 | 조건 속성·값은 함께, 값은 그 속성의 허용값 | `E_CONDITION_INCOMPLETE`, `E_TAXONOMY_VALUE` |
| X7 | 예외 규칙의 기본 규칙 존재·승인 | `E_EXCEPTION_BASE`, `E_EXCEPTION_BASE_NOT_APPROVED` |
| X8 | 승인 조건(6.2) | 6.2 표 |
| X9 | 앱이 아직 저장하지 않는 속성만 쓰는 조건 | `W_UNSUPPORTED_ATTRIBUTE`(경고) |
| X10 | 조건부 권장인데 적용 상황 없음 | `W_CONDITIONAL_NO_CONTEXT`(경고) |
| X11 | 한 평가 파일 = 한 평가자, 제출 평가는 human | `E_EVAL_MIXED_EVALUATOR`, `E_EVAL_ORIGIN` |
| X12 | manifest 주 버전·해시·형식 | `E_CONTRACT_MAJOR`, `E_HASH_MISMATCH`, `E_MANIFEST_INVALID`, `W_CONTRACT_NEWER` |
| X13 | JSON 타입(정수는 number, 목록은 배열), JSON에 한국어 라벨 | `E_JSON_INVALID`, `E_ENUM` |
| X14 | 속성값의 앱 필드가 그 속성에 맞음, 앱 필드 none이면 미지원 | `E_APP_FIELD` |
| X15 | 앱 지원 표시와 앱 값: yes는 앱 허용값만, converted는 앱 값 또는 규칙형 변환, 단일 필드는 값 1개 | `E_APP_VALUE`, `W_APP_VALUE_IGNORED`(경고) |
| X16 | 앱으로 보내는 세부분류의 앱 상위 = 연구용 상위 대분류의 앱 변환값 | `E_APP_PARENT_MISMATCH` |

오류(`E_`)가 하나라도 있으면 가져오기·빌드를 하지 않는다. 경고(`W_`)는 막지 않는다.

### 8.3 오류 보고 형식

```json
{ "contractVersion": "0.2.0", "errors": 1,
  "issues": [ { "level": "error", "code": "E_APPROVAL_SAME_PERSON", "entity": "styling_rules",
                "file": "styling_rules.csv", "line": 14, "record": "FIT-003/1", "field": "reviewer",
                "message": "작성자와 승인자가 같음" } ] }
```

Lab에서 저장 전 검사를 할 때도 **같은 코드**를 쓴다(공동창업자에게 같은 메시지가 보이도록).

### 8.4 Lab 검증 구현 확인 방법

- `examples/csv/`, `examples/json/bundle.json` → **오류 0개**(경고: CSV는 `W_UNSUPPORTED_ATTRIBUTE` 3개, JSON은 같은 3개)
- 앱 변환 보고서(`node scripts/fkd/cli.mjs compat examples/csv`) → exact 8, converted 1(G009), unsupported 1(G010)
- `examples/invalid/<case>.json` → `expected-errors.json`에 적힌 오류 코드가 **정확히 그 집합**으로 나와야 함
- 참고 구현(JavaScript, 외부 의존성 없음): STYLESEED 앱 저장소 `scripts/fkd/`(`validate.mjs`의 `createValidator`, `bundle.mjs`의 `loadBundle`). 다른 언어면 계약 JSON + 이 명세로 구현. **최종 판정은 Claude A 가져오기 결과**

## 9. 앱 의류 속성과의 호환 (0.2.0)

### 9.1 원칙

| # | 원칙 |
|---|---|
| A1 | **1라운드 STYLESEED 앱 대분류는 7개 고정**(top·bottom·outer·dress·shoes·bag·accessory). 8번째 앱 대분류를 추가하지 않는다(PO 결정 2026-10-21) |
| A2 | Knowledge Lab의 분류(대분류 8개 등)는 **연구 기준**으로 그대로 관리하고, 앱·엔진에는 계약의 변환 규칙으로만 보낸다 |
| A3 | **앱 지원이 검증된 값만** 지원(yes·converted 대상)으로 표시한다. 검증된 값 목록 = 계약 `app_compat.app_values`(앱 상수·Gemini 분석 스키마와 같음, 참고 검증기 테스트로 확인) |
| A4 | **조용한 유실 금지.** 변환 결과에는 연구 원본(`research`)과 앱 값(`app`)이 함께 남고, 바뀐 값(`conversions`)·빠진 값(`dropped`)·앱 값이 없는 값(`unresolved`)·연구 전용 값(`research_only`)이 모두 기록된다. 앱이 모르는 값을 가까운 값으로 임의 대체하지 않는다 |

### 9.2 속성값(`attribute_values`)에 앱 매핑을 적는 법

| `app_supported` | 뜻 | `app_field` | `app_value` |
|---|---|---|---|
| `yes` | 앱이 이 값을 그대로 저장 | 그 속성의 앱 필드 | 비우거나 `value_key`와 같게. `value_key`가 앱 허용값이어야 함 |
| `converted` | 앱에 없는 연구 값을 앱 값으로 바꿈 | 그 속성의 앱 필드 | **앱 허용값**(목록 필드 season·tpo·style은 `\|`로 여러 개). 비우려면 계약 `derived_conversions`에 규칙이 있어야 함 |
| `no` | 앱이 모름(지원 검증 전) | `none` 권장 | **비움**(적어도 변환에 쓰지 않음 → `W_APP_VALUE_IGNORED`) |

속성별로 쓸 수 있는 앱 필드(`app_compat.attribute_app_fields`): category → `category`, subcategory → `subCategory`, main_color → `color`, value·saturation → `colorTone`, fit → `fit`, material → `material`, season → `season`, tpo → `tpo`, mood → `style`. silhouette·material_feel·thickness는 앱 필드가 없다(항상 `none`·`no`).

규칙형 변환(`derived_conversions`): `season:all-season` → 계절 4개 모두, `value`·`saturation` → colorTone 변환표(D-F02 미확정: 확정 전에는 의류의 `color_tone`을 그대로 쓰고 명도·채도는 연구 전용으로 보존).

### 9.3 `jumpsuit` 변환 규칙

| 값 | `parent_value` | `app_field` | `app_value` | `app_supported` | 앱에서 |
|---|---|---|---|---|---|
| 대분류 `jumpsuit` | — | `category` | **`dress`** | **`converted`** | 대분류 `dress`(앱은 dress를 상의+하의를 대체하는 한 벌로 처리) |
| 세부분류 `jumpsuit` | `jumpsuit` | `subCategory` | `jumpsuit`(또는 비움) | `yes` | 세부분류 `jumpsuit`(앱에서 dress 아래, 기존 지원값 유지) |
| 세부분류 `romper` | `jumpsuit` | `none` | (비움) | `no` | **앱·엔진 입력에서 제외**(9.5) |

- 의류 `jumpsuit/jumpsuit` → 앱 `dress/jumpsuit`, 상태 `converted`, 원본 `research.category = jumpsuit` 보존.
- 대분류 `jumpsuit`를 `yes`로 적으면 `E_APP_VALUE`(8번째 앱 대분류 금지). 앱 매핑 없이(`none`·`no`) 두면 세부분류 `jumpsuit`가 앱으로 갈 상위 대분류가 없어 `E_APP_PARENT_MISMATCH`.
- 세부분류의 연구용 상위가 바뀌어도 **앱에서의 상위(앱 상수 기준)** 와 맞아야 한다: 예) `shirt`를 `jumpsuit` 아래에 두면 앱에서 shirt는 top이라 `E_APP_PARENT_MISMATCH`.

### 9.4 의류 필드 대응

| 계약(`garments`) | 앱 `Clothing` | DB `clothes` | AI 분석 출력 | 변환 |
|---|---|---|---|---|
| `category` | `category` | `category` | `category` | 속성 사전의 앱 매핑(9.2), 필수 |
| `subcategory` | `subCategory` | `sub_category` | `subCategory` | 앱 매핑 + 앱 상·하위 일치, 필수 |
| `main_color` | `color` | `color` | `color` | 앱 매핑, 필수 |
| `color_tone` | `colorTone` | `color_tone` | `colorTone` | 같은 목록(그대로), 필수 |
| `fit` | `fit` | `fit` | `fit` | 앱 매핑, 필수. `straight`·`wide`는 D-F01 |
| `material` | `material` | `material` | `material` | 앱 매핑, 필수 |
| `season` | `season[]` | `season text[]` | `season` | 앱 매핑, 미지원 값은 빠짐(기록) |
| `tpo` | `tpo[]` | `tpo text[]` | `tpo` | 앱 매핑, 미지원 값은 빠짐(기록) |
| `mood` | `style[]` | `style text[]` | `style` | 앱 매핑, 미지원 값은 빠짐(기록) |
| `value`, `saturation`, `silhouette`, `material_feel`, `thickness` | — | — | — | **연구 전용**(`research_only`로 보존) |

### 9.5 변환 결과 상태 (`node scripts/fkd/cli.mjs compat <묶음>`, 참고 구현 `scripts/fkd/app-compat.mjs`)

| 상태 | 뜻 | 앱·엔진 입력 | 경고 |
|---|---|---|---|
| `exact` | 모든 앱 필드가 연구 값 그대로 | 사용 | — |
| `converted` | 변환된 값이 있음(예: 대분류 jumpsuit → dress) | 사용, 원본 함께 기록 | — |
| `lossy` | 목록 속성 일부가 앱 미지원이라 빠짐(예: tpo `school`) | 사용, 빠진 값 기록 | `W_APP_LOSSY` |
| `unsupported` | 필수 속성에 앱 값이 없음(예: 세부분류 `romper`, 핏 `fitted`) 또는 앱 상·하위 불일치 | **제외**(`app = null`), 사유 기록 | `W_APP_UNSUPPORTED` |

### 9.6 세부분류 호환성 검증 기준 (Lab 60개 + 추가 후보)

| # | 대상 | 기준 |
|---|---|---|
| V1 | 기존 41개(앱에 있는 키) | 키 변경·삭제 금지. `subCategory`·`yes`. 앱 상위 = 연구용 상위의 앱 변환값(`jumpsuit`만 연구용 상위가 다르고 변환으로 일치) |
| V2 | 신규 19개 + 추가 후보(예: knit-vest·tailored-vest·padded-vest) | **`none`·`no`, 앱 값 비움.** 지원 표시하면 `E_APP_VALUE` |
| V3 | 대분류 8개 | 7개는 `yes`, `jumpsuit`는 `converted → dress` |
| V4 | 의류 | V2 값을 쓰는 의류는 `unsupported`로 제외되고 원본·사유가 남는다. 가까운 값으로 바뀌지 않는다 |
| V5 | 지원 승격 | V2 값을 `yes`·`converted`로 바꾸려면: 공동창업자의 앱 변환 결정(converted) **또는** 앱 상수·Gemini 스키마·엔진 처리·테스트 완료 후 계약 `app_values` 추가(yes) |

`attribute_values.app_supported`가 `no`인 속성만 쓰는 규칙은 경고(`W_UNSUPPORTED_ATTRIBUTE`) — 저장은 되지만 앱 옷장에는 아직 적용되지 않는다.

## 10. 버전과 변경 관리

| 변경 | 계약 버전 | 예 |
|---|---|---|
| 필드 삭제·이름 변경, 허용 목록 값 삭제, 의미 변경, 선택 → 필수 | **주** | 판정 체계 변경 |
| 선택 필드·목록 값·엔티티·경고 코드 추가 | **부** | `pattern` 필드 추가 |
| 설명·예시 수정 | **수** | 문구 |

- **draft(0.x) 단계:** 기존 데이터를 거부할 수 있는 검증 규칙 추가도 **부** 버전으로 올린다(주 버전을 올리면 Lab 가져오기가 모두 막히므로). 1.0.0부터 표대로 적용
- 가져오기는 **같은 주 버전**만 받는다. 더 새로운 부 버전은 경고(`W_CONTRACT_NEWER`)와 함께 받고 모르는 필드는 무시
- 레코드 버전: 속성값 `version`, 규칙 `rule_version`, 평가 `round` — 승인·제출된 레코드는 고치지 않고 새 버전을 만든다
- 데이터 버전: 빌드 결과에 `datasetVersion = fkd-<입력 해시 12자리>` 자동 기록

**변경 절차**
1. Claude C(형식) 또는 공동창업자(패션 의미)가 Claude A에게 요청 — 필드·이유·예시
2. Claude A가 계약 JSON·참고 검증기·예시·이 문서를 함께 고치고 버전을 올린다
3. **패션 의미가 바뀌는 변경**(허용값 체계, 평가 차원, 판정 체계, 척도)은 공동창업자 승인 후
4. 속성 **값**의 추가·폐기는 계약 변경이 아니라 데이터 변경(Lab에서 공동창업자가 처리)
5. Lab은 계약에 없는 필드를 필수로 만들거나 고정 목록 값을 임의로 추가하지 않는다

## 11. 예시 데이터 안내

`examples/csv`(= `examples/json/bundle.json`)에 들어 있는 것:

| 엔티티 | 개수 | 보여주는 경로 |
|---|---|---|
| evaluators | 3 | E1·E2 승인 권한, E3 승인 권한 없음 |
| attribute_values | 63 | 확정 58, 폐기 1(`fit:fitted`), 제안 4(`mood:romantic` Claude 초안, 대분류 `jumpsuit` 변환 → dress, 세부분류 `jumpsuit`(상위 jumpsuit), `romper` 미지원 Claude 초안) |
| garments | 10 | 속성 확인 완료 6, 제안 4(G009 점프수트 → 앱 dress 변환, G010 롬퍼 → 앱 입력 제외) |
| outfits | 4 | dev 2 / holdout 2, 날씨 상황 1, Claude 초안 구성 1 |
| outfit_evaluations | 8 | E1·E2 각 4개 제출 |
| styling_rules | 10 | 승인 기본(FIT-001·COL-001·MAT-001), 승인 예외(FIT-002 → FIT-001), 버전 1·2 승인(COL-002 → 빌드는 v2), 검토중(TPO-001), 초안(MOOD-001), 폐기(FIT-003), Claude 초안(COL-003) |
| disagreement_reviews | 2 | 합의(P02 핏·실루엣 → 예외 규칙 FIT-002), 미검토(P03 색) |

이 묶음을 빌드(purpose를 production으로 바꿔 시험)하면 승인 규칙 **5개**(FIT-001, FIT-002, COL-001, COL-002 v2, MAT-001)만 들어간다.

`examples/invalid/` — 각 파일은 올바른 JSON 예시에서 한 군데만 바꾼 것이다.

| 파일 | 바꾼 것 | 기대 오류 |
|---|---|---|
| `same-person-approval` | FIT-001 승인자 = 작성자 | `E_APPROVAL_SAME_PERSON` |
| `approver-without-authority` | COL-001 승인자 = E3 | `E_APPROVER_AUTHORITY` |
| `unconfirmed-value-in-approved-rule` | FIT-002 적용 무드 = romantic(미확정) | `E_UNCONFIRMED_VALUE` |
| `claude-draft-approved` | Claude 초안 COL-003 승인 | `E_APPROVAL_ORIGIN` |
| `exception-base-not-approved` | FIT-001을 검토중으로 | `E_EXCEPTION_BASE_NOT_APPROVED` |
| `korean-label-in-json` | 판정 = "권장" | `E_ENUM` |
| `int-as-string-in-json` | 강도 = "4"(문자열) | `E_JSON_INVALID` |
| `retired-value-used` | 의류 핏 = fitted(폐기) | `E_TAXONOMY_VALUE` |
| `subcategory-parent-mismatch` | 슬랙스(하의)의 세부분류 = shirt | `E_PARENT_MISMATCH` |
| `unknown-garment-in-outfit` | 코디에 G999 | `E_REF` |
| `submitted-evaluation-missing-score` | 제출 평가의 종합 점수 없음 | `E_REQUIRED` |
| `duplicate-rule-version` | COL-001 v1 중복 | `E_DUPLICATE_KEY` |
| `rule-id-prefix-mismatch` | MAT-001의 차원 = color | `E_RULE_PREFIX` |
| `contract-major-mismatch` | 계약 버전 1.0.0 | `E_CONTRACT_MAJOR` |
| `jumpsuit-category-marked-app-supported` | 대분류 jumpsuit = 앱 지원 yes | `E_APP_VALUE`, `E_APP_PARENT_MISMATCH` |
| `romper-marked-app-supported` | romper = 앱 subCategory yes | `E_APP_VALUE` |
| `jumpsuit-category-without-app-mapping` | 대분류 jumpsuit 앱 매핑 없음(none·no) | `E_APP_PARENT_MISMATCH` |

## 12. Claude C 작업 체크리스트

- [ ] 7개 엔티티를 계약 필드 그대로 저장(고정 목록은 영어 키, 화면은 한국어 라벨)
- [ ] 속성 허용값은 `attribute_values`에서 동적으로, 폐기 값 숨김, 세부분류는 대분류에 묶음
- [ ] 6장 상태 전이·승인 조건을 UI에서 강제(작성자 ≠ 승인자, 승인 권한, 승인 레코드 수정 금지 → 새 버전)
- [ ] 7장 독립 평가 요건
- [ ] 4장 형식으로 내보내기(CSV 또는 JSON, manifest 포함, `purpose` 구분)
- [ ] 8.4로 Lab 검증 구현 확인(예시 = 오류 0, invalid = 기대 코드)
- [ ] 5장 마지막 표(D-F01~D-F10)는 공동창업자 결정 화면·기록에 연결(Lab이 값을 임의로 정하지 않음)
- [ ] 9장 앱 매핑: 대분류 `jumpsuit` = converted → dress, 지원 검증 전 값은 `none`·`no`(9.6). 저장 전 X14~X16 검사
- [ ] 형식 변경이 필요하면 10장 절차로 Claude A에게 요청
