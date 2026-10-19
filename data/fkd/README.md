# Fashion Knowledge Dataset (FKD)

패션 지식 데이터(속성 사전·평가용 의류·코디·평가·스타일링 규칙·불일치 검토)를 **Data Contract V0.1** 형식으로 주고받는다.

- 계약(단일 원본): `contract/fkd-contract-v0.1.json` — 문서: `docs/recommendation/DATA_CONTRACT_V0.1.md`
- 입력 주체: 공동창업자 2명(Knowledge Lab 또는 임시로 Google Sheets — `docs/recommendation/DATASET_GUIDE.md`)
- Lab 개발: Claude C / 계약·가져오기·엔진: Claude A

| 폴더 | 내용 | Git |
|---|---|---|
| `contract/` | 계약 JSON, `manifest.example.json` | 추적 |
| `templates/` | 계약 형식 빈 묶음(헤더는 계약에서 생성). 예시 행은 `예시`·`EX-` | 추적 |
| `sheets/` | 실제로 받은 묶음(사람이 작성한 데이터 기록) | 추적 |
| `review/` | 두 평가 비교 결과 `disagreement_review.csv` | 추적 |
| `build/` | 승인 규칙만 모은 `ruleset.json`(자동 생성, 직접 수정 금지) | 추적 |

```bash
npm run fkd:validate -- [묶음]          # 계약 검증. --json이면 Lab용 오류 목록(코드·행·필드)
npm run fkd:build -- [묶음]             # 오류 0일 때만 build/ruleset.json (approved + human 규칙만)
npm run fkd:compare -- [묶음]           # evaluations/의 두 평가자 일치도 + review/disagreement_review.csv
npm run test:fkd                        # 검증·빌드·비교·문서 동기화 테스트
node scripts/fkd/gen-contract-doc.mjs   # 계약 JSON을 바꾼 뒤 문서 표 갱신
```

안전장치: 미승인(초안·검토중·보류·폐기)·예시·Claude 초안 규칙은 `build`에 들어가지 않고, 엔진 로더(`loadApprovedRules`)가 한 번 더 거른다. 승인 규칙은 작성자 ≠ 승인자, 승인 권한자, 승인일, 확정된 속성값만 허용한다.
