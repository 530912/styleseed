# Fashion Knowledge Data Contract V0.1

- 계약 버전: **0.1.0 (draft)** · 작성 2026-10-19
- 기계 판독 원본: `data/fkd/contract/fkd-contract-v0.1.json` — **이 JSON이 단일 원본이다.** 이 문서의 표(5~7장), 검증기(`scripts/fkd/validate.mjs`), CSV 템플릿 헤더(`data/fkd/templates/`)는 모두 이 JSON에서 나오고, 테스트가 서로 일치하는지 확인한다
- 대상 독자: Claude C(Knowledge Lab 개발), Claude A(추천엔진), 공동창업자 2명(패션 기준 결정)

---

## 1. 목적과 책임

이 계약은 **Knowledge Lab에서 사람이 만든 패션 지식이 추천엔진에 들어가는 유일한 통로**의 형식과 규칙을 정한다.

| 역할 | 맡는 것 | 맡지 않는 것 |
|---|---|---|
| **공동창업자 2명(E1·E2)** | 속성 허용값 확정, 스타일링 규칙 작성·**승인**, 코디 독립 평가, 불일치 합의, 가중치 변경 승인 — **패션 내용의 최종 승인자** | 코드 |
| **Claude C** | Knowledge Lab: 연구 가이드 웹사이트, 데이터 입력 UI, 코디 평가 UI, 관리자 기능, DB·CRUD, **계약에 맞는 내보내기(export bundle)** | 추천엔진, 가져오기(import)·빌드, 계약 변경 결정 |
| **Claude A** | 이 계약(필드·허용값·검증 규칙·버전), 가져오기 검증·빌드(`scripts/fkd`), 추천엔진, 기준선 측정, 앱 통합 | Lab UI·DB·CRUD |

원칙: **승인되지 않은 데이터는 추천엔진에 들어가지 않는다.** 규칙은 `approval_status = approved` + `data_origin = human` + 작성자 ≠ 승인자 + 승인 권한 + 확정된 속성값일 때만 쓰인다.

## 2. 데이터 흐름

```
[Knowledge Lab DB] ──export──▶ 묶음 폴더(manifest.json + CSV) ──▶ fkd:validate ──▶ fkd:build ──▶ data/fkd/build/ruleset.json ──▶ 엔진 loadApprovedRules()
   (Claude C)                    (계약 형식)                        (Claude A)         승인 규칙만        (datasetVersion 포함)          (한 번 더 거름)
                                         │
                                         └── evaluations/*.csv ──▶ fkd:compare ──▶ 일치도 + disagreement_review.csv ──▶ Lab으로 다시 가져와 합의 입력
```

Lab이 준비되기 전에는 Google Sheets에서 같은 형식의 CSV를 손으로 내보낸다(`docs/recommendation/DATASET_GUIDE.md`, 임시). 형식은 같고 `manifest.json`만 없어도 된다(경고).

## 3. 공통 형식

| 항목 | 규칙 |
|---|---|
| 파일 | CSV(RFC 4180), UTF-8(BOM 허용), 1행 = 헤더 |
| 헤더 | 필드 키(`rule_id`) 또는 `한국어 이름 [rule_id]`. 대괄호 안 키로 읽는다. 열 순서는 자유 |
| 목록 값 | 한 칸에 여러 값은 `\|`로 구분: `office\|date` |
| 날짜 | `YYYY-MM-DD` |
| 고정 목록 값 | **정식 값은 영어 키**(`approved`). 한국어 라벨(`승인`)도 받아서 영어 키로 바꾼다. Lab DB에는 영어 키 저장을 권장 |
| 속성값 | 속성 사전(`garment_schema.csv`)의 `value_key`(영어). 폐기(`retired`)된 값은 허용하지 않음 |
| 모르는 열 | `x_`로 시작하면 Lab 전용으로 조용히 무시. 그 밖에는 경고 후 무시 |
| 예시 행 | `data_origin = example` 또는 ID가 `EX-`로 시작 → 검증·집계·빌드에서 제외(단, 예시를 승인하면 오류) |
| 개인정보 | 평가자는 ID(`E1`)만. 이름·이메일·연락처를 어떤 파일에도 넣지 않는다 |

### 3.1 묶음 폴더(export bundle)

```
<묶음>/
  manifest.json                 Lab 내보내기 필수(계약 버전·파일 해시). 예: data/fkd/contract/manifest.example.json
  evaluators.csv                필수
  garment_schema.csv            필수(속성 사전)
  garments.csv                  필수(평가용 의류)
  outfits.csv                   필수(평가용 코디)
  styling_rules.csv             필수
  disagreement_review.csv       선택
  evaluations/*.csv             선택. 평가자 1명 = 파일 1개(예: outfit_evaluation_E1.csv)
```

## 4. 엔티티 관계

```
evaluators ─┬─< attribute_values.decided_by        (확정한 사람)
            ├─< garments.labeled_by                (태깅한 사람)
            ├─< styling_rules.author / reviewer    (작성자 / 승인자)
            ├─< outfit_evaluations.evaluator_id    (평가자)
            └─< disagreement_reviews.evaluator_1/2
attribute_values ──(허용값)──▶ garments의 속성 열, styling_rules의 조건·상황, outfits의 상황
garments ─< outfits.garment_ids ─< outfit_evaluations.outfit_id ─< disagreement_reviews.outfit_id
styling_rules ─< styling_rules.exception_of        (예외 → 기본 규칙)
```

## 5~7. 필드 정의 · 고정 목록 · 오류 코드 (계약 JSON에서 생성)

<!-- BEGIN GENERATED: scripts/fkd/gen-contract-doc.mjs -->

계약 버전 `0.1.0` (상태: draft)

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
| `app_field` | 앱 필드 | enum · 목록 `app_field` | 필수 |  | `fit` | 현재 앱 Clothing 타입의 필드. 대응 없음은 none |
| `app_value` | 현재 앱 값 | string | 선택 |  | `oversized` |  |
| `app_supported` | 앱 지원 | enum · 목록 `app_supported` | 필수 |  | `yes` | yes=앱이 저장 / converted=다른 앱 값에서 변환 / no=앱이 아직 모름 |
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

<!-- END GENERATED -->

## 8. 교차 검증 규칙 (필드 검사 다음 단계)

필드 하나의 검사(필수·형식·허용값·범위)는 위 표대로 자동 적용된다. 아래는 여러 레코드를 함께 보는 규칙이다.

| # | 대상 | 규칙 | 코드 |
|---|---|---|---|
| X1 | 모든 엔티티 | 기본 키 중복 금지(평가는 파일이 달라도 `outfit_id + evaluator_id + round` 중복 금지) | `E_DUPLICATE_KEY` |
| X2 | 참조 | `ref`·`ref_list` 값이 대상 엔티티에 있어야 함(평가자·의류·코디) | `E_REF` |
| X3 | 속성 사전 | 세부분류의 `parent_value`는 대분류 값 / 의류의 `subcategory`는 그 `category`에 속함 | `E_PARENT_MISMATCH` |
| X4 | 속성 사전 | `confirmed`는 `data_origin = human`만, `decided_by`는 승인 권한자만 | `E_CONFIRM_ORIGIN`, `E_APPROVER_AUTHORITY` |
| X5 | 규칙 | `rule_id` 약자 = 평가 차원(color→COL, silhouette_fit→FIT, material_season→MAT, tpo→TPO, mood→MOOD) | `E_RULE_PREFIX` |
| X6 | 규칙 | 조건의 속성과 값은 함께 있어야 하고, 값은 그 속성의 허용값 | `E_CONDITION_INCOMPLETE`, `E_TAXONOMY_VALUE` |
| X7 | 규칙 | 예외 규칙의 `exception_of`가 존재, 승인된 예외는 기본 규칙도 승인 | `E_EXCEPTION_BASE`, `E_EXCEPTION_BASE_NOT_APPROVED` |
| X8 | 규칙(승인) | `data_origin = human`, 작성자 ≠ 승인자, 승인자는 `can_approve = yes` + `active = yes`, 승인일 | `E_APPROVAL_ORIGIN`, `E_APPROVAL_SAME_PERSON`, `E_APPROVER_AUTHORITY`, `E_REQUIRED` |
| X9 | 규칙(승인) | 쓰는 모든 속성값(조건 A·B, 대분류, 적용 TPO·무드·계절)이 `confirmed` | `E_UNCONFIRMED_VALUE` |
| X10 | 규칙 | 예시 행 승인 금지 | `E_EXAMPLE_APPROVED` |
| X11 | 규칙 | 앱이 저장하지 않는 속성만 쓰는 조건 → 경고(변환표 또는 분석 확장 후 적용) | `W_UNSUPPORTED_ATTRIBUTE` |
| X12 | 규칙 | `conditional`(조건부 권장)인데 적용 상황이 없음 → 경고 | `W_CONDITIONAL_NO_CONTEXT` |
| X13 | 평가 | **한 파일 = 한 평가자**(제출 행 기준) | `E_EVAL_MIXED_EVALUATOR` |
| X14 | 평가 | 제출(`submitted`) 행은 `data_origin = human`, 점수·판정·이유 등 필수 | `E_EVAL_ORIGIN`, `E_REQUIRED` |
| X15 | manifest | 계약 주 버전 일치, 파일 해시 일치, 새 부 버전은 경고 | `E_CONTRACT_MAJOR`, `E_HASH_MISMATCH`, `W_CONTRACT_NEWER` |

오류(`E_`)가 하나라도 있으면 빌드하지 않는다. 경고(`W_`)는 빌드를 막지 않는다.

## 9. 상태와 승인 절차

### 9.1 속성값(`attribute_values.status`)

```
proposed ──▶ in_review ──▶ confirmed
    └──────────┴──────────▶ retired
```

- `confirmed` 후에는 `value_key`를 바꾸지 않는다. 바꿔야 하면 기존 값을 `retired`, 새 값을 추가(`version` 증가)
- Claude 초안(`claude_draft`) 값은 사람이 출처를 `human`으로 바꾸고 확정한다

### 9.2 스타일링 규칙(`approval_status`)

```
draft ──▶ in_review ──▶ approved ──▶ retired
              │  ▲
              ▼  │
            on_hold
```

| 전이 | 누가 | Lab이 강제할 것 |
|---|---|---|
| draft → in_review | 작성자 | 필수 필드 입력 완료 |
| in_review → approved | **작성자가 아닌 승인 권한자** | 승인자 ID·승인일 자동 기록 |
| in_review ↔ on_hold | 승인자·작성자 | 사유 메모 |
| approved → retired | 승인 권한자 | — |
| approved 행 수정 | **금지** | 바꾸려면 같은 `rule_id`로 새 행 + `rule_version` +1 → 다시 승인. 빌드는 승인된 최고 버전만 사용 |

### 9.3 코디 평가(`submission_status`) — 독립 평가 요건

Knowledge Lab은 다음을 **반드시** 지킨다(평가자 간 일치도의 전제):

1. 평가자는 자기 평가만 본다. **두 사람이 모두 제출하기 전에는 상대 점수·이유를 보여주지 않는다**
2. 평가 중에는 **추천엔진 점수를 보여주지 않는다**(점수에 끌려가지 않게)
3. `submitted` 후에는 평가를 고치지 않는다. 다시 평가하려면 `round` +1(이전 회차 보존)
4. 내보낼 때 평가자별로 파일을 나눈다(`evaluations/outfit_evaluation_E1.csv`)
5. 코디 표시 순서는 평가자마다 섞는 것을 권장(순서 효과 감소)

### 9.4 불일치 검토(`disagreement_reviews`)

- 생성: Claude A의 `fkd:compare`(두 평가자 모두 제출 후). 기준: 어떤 차원이든 점수 차 ≥ 2, 또는 판정이 다름
- Lab은 이 파일을 가져와 합의 입력 UI를 제공하고, `agreed` 상태로 만들 때 `cause`·`agreed_score`·`agreed_reason`·`action`·`reviewed_at`을 받는다
- 원래 평가 레코드는 바꾸지 않는다

## 10. 가져오기(Import)·검증 구조

| 단계 | 하는 일 | 실패 시 |
|---|---|---|
| 1. 수신 | 묶음 폴더를 `data/fkd/sheets/`(또는 Lab 내보내기 위치)에 둔다 | — |
| 2. 묶음 검사 | 필수 파일, `manifest.json`(계약 버전·해시) | `E_FILE_MISSING`, `E_CONTRACT_MAJOR`, `E_HASH_MISMATCH` |
| 3. 필드 검사 | 계약 JSON 기준 자동: 필수(조건부 포함)·형식·허용값·범위·글자 수 | `E_REQUIRED`, `E_ENUM`, `E_INT` … |
| 4. 교차 검사 | 8장 X1~X15 | 각 코드 |
| 5. 승인 필터·빌드 | `approved + human + EX- 아님` 규칙만, 같은 ID는 최고 버전, 확정 속성값 목록 → `ruleset.json` | 오류가 있으면 빌드하지 않음 |
| 6. 버전 도장 | `datasetVersion = fkd-<입력 해시 12자리>`, `contractVersion` | — |
| 7. 엔진 로드 | `loadApprovedRules()`가 `approved`만 다시 거름(빌드 파일을 손으로 고쳐도 안전) | — |

명령: `npm run fkd:validate -- <묶음>` (`--json`이면 Lab이 화면에 보여줄 수 있는 오류 목록), `npm run fkd:build -- <묶음>`, `npm run fkd:compare -- <묶음>`.

오류 보고 형식(`--json`):

```json
{ "contractVersion": "0.1.0", "errors": 1,
  "issues": [{ "level": "error", "code": "E_APPROVAL_SAME_PERSON", "entity": "styling_rules",
               "file": "styling_rules.csv", "line": 14, "record": "FIT-003/1", "field": "reviewer",
               "message": "작성자와 승인자가 같음" }] }
```

**중복 구현 금지:** Lab에서 저장 전 검사가 필요하면 `fkd-contract-v0.1.json`을 읽어 같은 규칙·같은 코드를 쓰거나, JavaScript라면 `scripts/fkd/validate.mjs`의 `createValidator`를 그대로 가져다 쓴다(외부 의존성 없음). 최종 판정은 항상 가져오기 단계의 검증 결과다.

## 11. 앱 의류 속성과의 호환

| 계약(`garments`) | 앱 `Clothing` | DB `clothes` | Gemini 분석 출력 | 비고 |
|---|---|---|---|---|
| `category` | `category` | `category` | `category` | 같음 |
| `subcategory` | `subCategory` | `sub_category` | `subCategory` | 같은 값 목록 |
| `main_color` | `color` | `color` | `color` | 앱의 `multi`는 속성 사전에서 결정 대기 |
| `color_tone` | `colorTone` | `color_tone` | `colorTone` | 앱 값 그대로 |
| `value`, `saturation` | — | — | — | `colorTone`에서 변환(MATCH_SCORE_V0.1 3.4, 확정 필요) |
| `fit` | `fit` | `fit` | `fit` | 앱의 `straight`·`wide`는 실루엣 이전 여부 결정 대기 |
| `silhouette` | — | — | — | 앱·분석에 없음 |
| `material` | `material` | `material` | `material` | 같음(섬유) |
| `material_feel`, `thickness` | — | — | — | 앱·분석에 없음 |
| `season` | `season[]` | `season text[]` | `season` | Numbers의 `autumn` → `fall` |
| `tpo` | `tpo[]` | `tpo text[]` | `tpo` | `school`·`active`는 앱에 없음 |
| `mood` | `style[]` | `style text[]` | `style` | `romantic`·`edgy`는 앱에 없음 |

- 엔진은 앱 의류(실제 옷장)에 대해 **앱에 있는 필드만** 직접 쓰고, 없는 필드는 변환표로 근사하거나 규칙을 적용하지 않는다(`W_UNSUPPORTED_ATTRIBUTE`)
- 앱·DB·Gemini 출력에 필드를 추가하는 것은 **별도 결정**(분석 정확도 실험 + DB 마이그레이션 승인)이며 이 계약의 다음 부 버전에서 다룬다

## 12. 버전과 변경 관리

### 12.1 버전 종류

| 버전 | 형식 | 의미 |
|---|---|---|
| `contract_version` | `주.부.수` | 이 계약의 형식 |
| `version`(속성값), `rule_version`(규칙), `round`(평가) | 정수 | 레코드 하나의 개정 |
| `datasetVersion` | `fkd-<해시>` | 빌드에 들어간 데이터 내용(자동) |
| `engineVersion`, `weightsVersion` | MATCH_SCORE_V0.1 8장 | 엔진·가중치 |

### 12.2 계약 버전 올리는 기준

| 변경 | 버전 | 예 |
|---|---|---|
| 필드 삭제·이름 변경, 허용 목록 값 삭제, 의미 변경, 필수로 변경 | **주** | `label` 값 체계 변경 |
| 선택 필드 추가, 허용 목록 값 추가, 새 엔티티 추가, 새 경고 코드 | **부** | `pattern` 필드 추가 |
| 설명·예시 수정 | **수** | 문구 수정 |

호환: 가져오기는 **같은 주 버전**만 받는다. 새 부 버전 묶음은 경고와 함께 받고 모르는 필드는 무시한다.

### 12.3 변경 절차

1. 요청: Claude C(형식 필요) 또는 공동창업자(패션 의미 변경)가 변경 요청
2. Claude A가 계약 JSON·검증기·템플릿·이 문서를 한 번에 고치고 테스트(`npm run test:fkd`, 문서 동기화 검사 포함)
3. **패션 의미가 바뀌는 변경**(허용값 추가·삭제, 평가 차원, 판정 체계)은 공동창업자 2명 승인 후 반영
4. 변경 기록: 이 문서 끝 “변경 이력”에 버전·날짜·내용·영향
5. 주 버전 변경 시 Lab은 이전 버전 내보내기를 한 부 버전 기간 동안 함께 지원

속성 **값** 추가·폐기는 계약 변경이 아니라 데이터 변경이다(`garment_schema.csv`에서 사람이 처리).

## 13. 기존 엔진 기준선 측정과 통합 계획

### 13.1 기준선 측정 (공동창업자 Pilot 평가 제출 후 실행)

| 항목 | 방법 |
|---|---|
| 대상 | `outfits.csv` Pilot 20개. 의류는 `garments.csv`의 `source_ref = engine-closet#N`(엔진 스냅샷 고정 옷장)이라 현재 엔진에 그대로 넣을 수 있다 |
| 현재 엔진 점수 | 엔진 B `evaluateOutfit(items, closet)` = 화면 MATCH, 엔진 C = Today 표시 점수(날씨 있는 코디만) |
| 사람 점수 | 두 평가자 종합 점수 평균(1~5 → 0~100: (점수−1)×25), 판정 |
| 지표 | 순위 상관(Spearman), 판정 일치(엔진 ≥ 70 적합 · 50~69 조건부 · < 50 부적합 [가설]), 쌍 비교 정확도, 차원별(색·핏·소재·TPO) 순위 상관 |
| 기록 | `docs/recommendation/baseline/`에 날짜·`datasetVersion`·엔진 커밋과 함께. 같은 20개를 새 엔진에도 적용해 비교 |
| 참고 | 평가자 간 일치도(가중 kappa)가 엔진 목표의 상한선 |

### 13.2 통합 계획

| 단계 | 내용 | 조건 |
|---|---|---|
| 1 | 계약 V0.1 확정(공동창업자·Claude C 검토) | 이번 |
| 2 | Lab(또는 임시 Sheets)에서 Pilot 평가·속성 확정·규칙 작성/승인 | 사람 작업 |
| 3 | 기준선 측정(13.1) | Pilot 제출 |
| 4 | 새 엔진(`src/engine`, MATCH_SCORE_V0.1) 구현 — `ruleset.json`만 입력, 스크립트로 비교 | 승인 규칙 존재 |
| 5 | 앱 연결 | MATCH_SCORE_V0.1 9장 Go 조건 + **PO 승인**. 그 전에는 기존 앱 추천 로직을 바꾸지 않는다 |

## 14. 열린 결정

| # | 결정 | 누가 |
|---|---|---|
| O1 | 속성 체계(핏/실루엣 분리, 명도·채도 변환표, TPO·무드 목록, 소재 두 축) | 공동창업자 |
| O2 | 평가 판정 기준(엔진 점수 → 적합/조건부/부적합 경계) | 공동창업자 |
| O3 | Lab DB에 고정 목록을 영어 키로 저장할지(권장) | Claude C |
| O4 | 패턴(`pattern`) 필드 추가 시점(계약 0.2) | 공동창업자 + Claude A |
| O5 | 앱·Gemini에 실루엣·소재감·두께 추가 여부 | PO(분석 실험·DB 승인 필요) |

## 변경 이력

| 버전 | 날짜 | 내용 |
|---|---|---|
| 0.1.0 | 2026-10-19 | 최초 작성. 7개 엔티티, 고정 목록 25개, 오류·경고 코드 34개. 기존 CSV 템플릿을 계약에 맞게 재구성(evaluators·garments·outfits 분리, 평가 파일 평가자별 분리, 영어 키 + 한국어 라벨) |
