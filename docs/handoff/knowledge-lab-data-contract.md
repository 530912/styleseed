# Claude C 전달: Knowledge Lab ↔ 추천엔진 Data Contract V0.1

- 작성: 2026-10-19 · Claude A(추천엔진·Data Contract 책임) → Claude C(Knowledge Lab)
- 정식 명세: `docs/recommendation/DATA_CONTRACT_V0.1.md`, 기계 판독 원본 `data/fkd/contract/fkd-contract-v0.1.json`
- 상태: **draft** — Claude C 검토 의견을 받아 0.1.0을 확정한다(형식 변경 요청은 12장 절차)

## 1. 경계

| Claude C가 만드는 것 | Claude A가 이미 가진 것(다시 만들지 말 것) |
|---|---|
| 연구 가이드 웹사이트, 데이터 입력 UI, 코디 평가 UI, 관리자 기능, DB·CRUD | 계약 JSON(필드·허용값·오류 코드) |
| 계약 형식의 **내보내기 묶음**(manifest + CSV) | 가져오기 검증 `scripts/fkd/validate.mjs`(`createValidator`, 외부 의존성 없는 ESM) |
| Lab 화면의 상태 전이·권한·독립 평가 보장 | 승인 규칙 빌드 `build.mjs`, 두 평가 비교·일치도 `compare.mjs` |
| | 엔진 로드 안전장치 `loadApprovedRules` |

추천엔진 코드(`src/utils`, 이후 `src/engine`)와 앱 화면은 Claude A 영역이다. Lab은 `ruleset.json`을 직접 만들지 않는다(빌드는 가져오기 쪽에서만).

## 2. Lab이 구현해야 할 계약 요건 (체크리스트)

### 2.1 데이터 모델
- [ ] 7개 엔티티: `evaluators`, `attribute_values`, `garments`, `outfits`, `outfit_evaluations`, `styling_rules`, `disagreement_reviews` — 필드·타입·필수·허용값은 계약 JSON 그대로
- [ ] 고정 목록은 **영어 키로 저장**(화면에는 한국어 라벨). 키·라벨 쌍은 계약 JSON `lists`
- [ ] 속성 허용값은 `attribute_values`에서 동적으로(폐기 값 숨김). 세부분류는 `parent_value`로 대분류에 묶음
- [ ] 평가자는 ID만(`E1`). 이름·이메일·연락처를 내보내기 파일에 넣지 않음
- [ ] Lab 전용 열이 필요하면 `x_` 접두어(가져오기에서 조용히 무시)

### 2.2 승인·상태 (계약 9장)
- [ ] 규칙: `draft → in_review → approved → retired`, `in_review ↔ on_hold`
- [ ] **승인은 작성자가 아닌 `can_approve = yes` + `active = yes` 평가자만.** 승인 시 `reviewer`·`approved_at` 자동 기록
- [ ] **승인된 규칙은 수정 불가.** 수정 = 같은 `rule_id` 새 행 + `rule_version` +1 → 다시 승인
- [ ] 예외 규칙은 기본 규칙이 승인된 뒤에만 승인 가능
- [ ] 승인 규칙이 쓰는 속성값은 모두 `confirmed`여야 함(UI에서 미확정 값 선택 시 승인 버튼 비활성 권장)
- [ ] 속성값 `confirmed`는 승인 권한자만, `data_origin = human`만
- [ ] `data_origin`: 사람이 입력 = `human`, Claude가 제안 = `claude_draft`, 설명용 = `example`. **Claude 초안은 사람이 human으로 바꾸고 승인해야 사용**

### 2.3 독립 평가 (계약 9.3) — 일치도 측정의 전제
- [ ] 두 평가자 모두 제출하기 전에는 상대 점수·이유 비공개
- [ ] 평가 화면에 추천엔진 점수 비표시
- [ ] `submitted` 후 수정 불가, 재평가는 `round` +1
- [ ] 종합 점수(`score_overall`)는 하위 점수 평균으로 자동 계산하지 않음(직접 입력)
- [ ] 코디 표시 순서 평가자별 무작위(권장)

### 2.4 내보내기
- [ ] 묶음 폴더 구성(계약 3.1), 평가는 평가자별 파일 `evaluations/outfit_evaluation_<ID>.csv`
- [ ] `manifest.json`: `contract_version`, `source = "knowledge-lab"`, `exported_at`, `exported_by`, 파일별 sha256, 엔티티별 행 수(`data/fkd/contract/manifest.example.json`)
- [ ] CSV UTF-8, 헤더는 필드 키(또는 `라벨 [키]`), 목록 값 `|`, 날짜 `YYYY-MM-DD`
- [ ] 내보내기 전 Lab 안에서 같은 검증을 돌려 오류 0 확인(아래 3장)

### 2.5 불일치 검토
- [ ] `fkd:compare` 결과 `disagreement_review.csv`를 가져와 합의 입력 UI 제공
- [ ] `agreed` 처리 시 `cause`·`agreed_score`·`agreed_reason`·`action`·`reviewed_at` 필수
- [ ] 원래 평가 레코드는 바꾸지 않음

## 3. 검증 재사용 방법

```js
import { loadContract } from "./scripts/fkd/lib.mjs";
import { createValidator } from "./scripts/fkd/validate.mjs";

const contract = loadContract();
const { issues } = createValidator(contract).validateBundle({
  evaluators, attribute_values, garments, outfits, styling_rules,      // { file, keys, rows: [{ line, values }] }
  outfit_evaluations: [ /* 평가자별 테이블 */ ], disagreement_reviews,
});
// issues: [{ level, code, entity, file, line, record, field, message }]
```

- JavaScript가 아니면 계약 JSON의 `fields`(type·pattern·min·max·required 조건식 `field=value`/`field!=value`)와 `error_codes`를 그대로 구현하고, **같은 코드**를 쓴다
- 최종 판정은 항상 Claude A의 가져오기(`npm run fkd:validate -- <묶음> --json`)
- 이미 만든 검증 테스트: `npm run test:fkd`(19개, 템플릿·문서 동기화 포함)

## 4. 시작 데이터

`data/fkd/templates/`(계약 형식, 헤더 자동 생성)를 Lab 초기 데이터로 가져가면 된다.

| 파일 | 내용 | 상태 |
|---|---|---|
| `evaluators.csv` | E1, E2(공동창업자, 승인 권한) | 공동창업자 확인 필요 |
| `garment_schema.csv` | 속성 13종 127개 값(Numbers 속성 사전 + 앱 값) | 모두 `proposed` |
| `garments.csv` | 평가용 의류 15벌(엔진 고정 옷장, `source_ref`로 연결) | `proposed`, `claude_draft` |
| `outfits.csv` | Pilot 코디 20개 + 예시 1 | `claude_draft`(구성), 평가는 사람 |
| `evaluations/outfit_evaluation.csv` | 평가 틀 20행(`in_progress`) + 예시 1 | — |
| `styling_rules.csv` | 예시 8행(Numbers 7 + Claude 1) | 모두 예시, 승인 불가 |
| `disagreement_review.csv` | 예시 1행 | — |

## 5. 계약 변경 요청

형식 변경이 필요하면 Claude A에게 요청(필드·이유·예시). Claude A가 계약 JSON·검증기·템플릿·문서를 함께 고치고 버전을 올린다(계약 12장). 패션 의미가 바뀌는 변경(허용값 체계, 평가 차원, 판정 체계)은 공동창업자 승인 후 반영한다. **Lab에서 계약에 없는 필드를 필수로 만들거나 고정 목록 값을 임의로 추가하지 말 것** — 가져오기에서 `E_ENUM`·`W_UNKNOWN_FIELD`가 난다.

## 6. 공유 파일

| 파일 | 소유 | Claude C가 바꿀 때 |
|---|---|---|
| `data/fkd/contract/*` | Claude A | 변경 요청(5장) |
| `scripts/fkd/*` | Claude A | 가져다 쓰기만 |
| `data/fkd/templates/*` | Claude A(계약에서 생성) | 변경 요청 |
| `package.json` 스크립트 `fkd:*`, `test:fkd` | Claude A | 이름 유지 |
