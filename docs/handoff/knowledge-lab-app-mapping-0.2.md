# Claude C 전달: Data Contract 0.2.0 앱 매핑 지침 (Knowledge Lab)

- 작성: 2026-10-21 (Claude A, 계약 담당) · 대상: Claude C(Knowledge Lab)
- 근거: PO 결정(2026-10-21) — **1라운드에는 STYLESEED 앱 대분류 7개를 유지하고, Knowledge Lab의 대분류 8개는 연구 기준으로 별도 관리한다**
- 계약: `data/fkd/contract/fkd-contract-v0.1.json` `contract_version 0.2.0`(경로 이름의 v0.1은 유지). 명세: `docs/handoff/fkd-data-contract-v0.1/README.md` **9장**
- Claude A는 Lab 코드·DB·데이터를 수정하지 않았다. 아래 Lab 현황은 `backups/lab-backup-2026-10-21T11-43-27.json`을 **읽기만** 해서 확인한 것이다

---

## 1. 바뀐 것 (0.1.0 → 0.2.0)

| 항목 | 내용 |
|---|---|
| 계약 `app_compat` | 앱 허용값(= 앱 상수·Gemini 분석 스키마), 속성별 앱 필드, 규칙형 변환(사계절, 명도·채도), 의류 필드 대응, 연구 전용 필드 |
| 새 오류 | `E_APP_FIELD`(앱 필드가 속성에 맞지 않음 / none인데 지원 표시), `E_APP_VALUE`(지원 표시와 앱 값 불일치), `E_APP_PARENT_MISMATCH`(앱 상·하위 분류 불일치 또는 상위 대분류 앱 미지원) |
| 새 경고 | `W_APP_VALUE_IGNORED`(미지원 값에 앱 값), `W_APP_UNSUPPORTED`·`W_APP_LOSSY`(변환 보고서) |
| 참고 구현 | `scripts/fkd/validate.mjs`(X14~X16), `scripts/fkd/app-compat.mjs`(의류 변환), `node scripts/fkd/cli.mjs compat <묶음>` |
| 예시 | 대분류 `jumpsuit`(→ dress), 세부분류 `jumpsuit`(상위 jumpsuit), `romper`(미지원), 의류 G009·G010, 잘못된 예시 3개 추가(총 17) |
| 내보내기 형식 | **변경 없음.** manifest `contract_version`만 `0.2.0` |

## 2. Lab 데이터에 필요한 변경 (현재 Lab 상태 기준)

| 값 | 현재(백업) | 0.2.0 검사 | 바꿀 것 |
|---|---|---|---|
| 대분류 `jumpsuit` | `app_field none`, `app_value` 빈 값, `app_supported no` | 세부분류 `jumpsuit`가 앱으로 갈 상위 대분류가 없어 **`E_APP_PARENT_MISMATCH` 1건** | **`app_field = category`, `app_value = dress`, `app_supported = converted`** |
| 세부분류 `jumpsuit` | 상위 `jumpsuit`, `subCategory`, `jumpsuit`, `yes` | 위 변경 후 통과 | 그대로 |
| 대분류 7개(top·bottom·outer·dress·shoes·bag·accessory) | `category`, 같은 값, `yes` | 통과 | 그대로 |
| 기존 세부분류 40개(jumpsuit 제외) | `subCategory`, 같은 값, `yes` | 통과 | 그대로(키 변경 금지) |
| 신규 19개 + 추가 후보 3개(knit-vest·tailored-vest·padded-vest) | `none`, 빈 값, `no` | 통과 | 그대로. **앱 값을 적지 않는다** |
| 명도·채도·사계절(`converted`, 앱 값 빈 칸) | — | 규칙형 변환으로 통과 | 그대로 |

- 이 변경은 패션 판단이 아니라 PO가 정한 **앱 호환 규칙**이다. 그래도 Lab 규칙대로 작업 이력에 전후 값을 남기고, 값 상태(제안)는 바꾸지 않는다.
- 확정 순서: 대분류 `jumpsuit` → 세부분류 `jumpsuit`·`romper`(Lab E-1과 같음).

## 3. Lab 화면·검증에 넣을 규칙 (계약 9.2, X14~X16)

| # | 규칙 | 화면 제안 |
|---|---|---|
| M1 | `app_supported = yes`는 `value_key`가 **계약 `app_compat.app_values`에 있을 때만** | "앱 지원" 선택지를 앱 허용값이 아닌 값에서는 비활성 |
| M2 | `converted`는 앱 값 필수(목록 필드 season·tpo·style만 여러 개). 단 계약 `derived_conversions`에 있는 값은 빈 칸 허용 | 앱 값을 **앱 허용값 드롭다운**에서만 고르게. 세부분류는 "연구용 상위 대분류의 앱 변환값" 아래 앱 세부분류만 보이기 |
| M3 | `no`면 앱 값 비움 | 미지원으로 바꾸면 앱 값 자동 삭제 |
| M4 | 앱 필드는 속성별 허용값(`attribute_app_fields`)만, `none`이면 `no` | 속성 종류에 따라 앱 필드 고정 |
| M5 | 세부분류를 앱으로 보낼 때(yes·converted) 앱 상위 = 연구용 상위의 앱 변환값 | 상위값을 바꾸면 매핑 재검사 결과 표시 |
| M6 | 값별 앱 상태 배지: **앱 지원 / 앱 변환(→ 값) / 앱 미지원** | 공동창업자가 "엔진에 들어가는지"를 바로 알 수 있게 |
| M7 | 의류 화면: 미지원 세부분류·핏·소재를 쓰면 "앱·엔진 입력에서 제외됨", 목록 미지원 값은 "앱에서는 빠짐" 안내 | 변환 보고서 상태(exact·converted·lossy·unsupported)와 같은 말 |

## 4. `romper`와 신규 값의 지원 승격

| 경로 | 조건 | 결과 |
|---|---|---|
| 변환(converted) | **공동창업자 결정**(Lab `/decisions` 기록·서명): 예) romper → 앱 `jumpsuit` | romper 의류가 앱 `dress/jumpsuit`로 들어감(원본 romper 보존) |
| 앱 지원(yes) | 앱 상수·Gemini 분석 스키마·엔진 처리·테스트 완료 + 계약 `app_values` 추가(Claude A, 2라운드) | 1라운드에는 없음 |
| 그 전 | `none`·`no` 유지 | romper 의류는 앱·엔진 입력에서 **제외**되고 사유가 남음(가까운 값으로 자동 대체 안 함) |

**주의(베스트 후보):** 앱에서 `vest`는 `outer` 아래다. `knit-vest`·`tailored-vest`(연구용 상위 `top`)를 앱 `vest`로 변환하면 `E_APP_PARENT_MISMATCH`가 난다. 연구용 상위를 `outer`로 두거나, 앱 `top` 아래 값으로 변환해야 한다. 이것은 공동창업자 결정(X-1)이다.

## 5. 하지 말 것

- 8번째 **앱** 대분류를 지원으로 표시하기(대분류 `jumpsuit`를 `yes`로) — `E_APP_VALUE`
- 신규·후보 값을 `yes`로 표시하거나, 미지원 값에 앱 값 적기
- 기존 41개 키 이름 바꾸기·삭제(사용자 앱 데이터가 이 키를 쓴다). 뜻의 범위를 좁히면 값 `version`을 올린다
- 계약에 없는 속성 키(기장·소매·굽 높이 등)를 Lab DB에 추가하기 — 계약 0.3 이후

## 6. 확인 방법

1. Lab README의 계약 사본 갱신 절차(`npm run vendor:fkd` / `scripts/vendor-fkd.sh <Claude A 커밋>`)로 `vendor/styleseed-fkd/` 갱신
2. 패키지 `examples/csv`·`examples/json/bundle.json` → 오류 0, `examples/invalid/` 17개 → `expected-errors.json`과 정확히 같은 코드
3. 2장 변경 후 Lab 실제 데이터 내보내기 → 오류 0. 변환 보고서에서 `jumpsuit/jumpsuit` 의류가 `converted(→ dress)`로 나오는지
4. 결과를 Claude A에게 알림(커밋 번호, 오류 0 확인)

## 7. Lab 확인 요청서(Q1~Q14) 중 이번에 답한 것

| Q | 답 |
|---|---|
| C-6(변환 대상 앱 값 규칙) | 이 문서 3장 M2와 계약 9.2 |
| 나머지 | 별도 회신 예정(계약 0.3 후보: 의류 확정자 필드, 출처 엔티티, overall rubric, manifest `x_` 키, 결정 기록 전달) |
