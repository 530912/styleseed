# Fashion Knowledge Dataset (FKD)

공동창업자가 Google Sheets에서 작성하고 CSV로 내보내는 패션 지식 데이터. 입력 방법은 `docs/recommendation/DATASET_GUIDE.md`.

| 폴더 | 내용 | Git |
|---|---|---|
| `templates/` | 빈 템플릿 4종(속성 사전·규칙·평가·불일치 검토). 예시 행은 `예시`·`EX-`로 표시 | 추적 |
| `sheets/` | 공동창업자가 내보낸 실제 CSV. `sheets/evaluations/outfit_evaluation_E1.csv`, `_E2.csv` | 추적(사람이 검토한 데이터의 기록) |
| `review/` | 두 평가 비교 결과(`disagreement_review.csv`) | 추적 |
| `build/` | 승인 규칙만 모은 `ruleset.json`(자동 생성, 직접 수정 금지) | 추적 |

```bash
npm run fkd:validate                    # sheets/ (없으면 templates/) 검사 — 오류는 한국어 + 행 번호
npm run fkd:build                       # 오류 0일 때만 build/ruleset.json 생성(승인 + 출처 '사람' 규칙만)
npm run fkd:compare -- <E1.csv> <E2.csv> # 두 평가자 일치도 + review/disagreement_review.csv
npm run test:fkd                        # 검증·빌드·비교 단위 테스트
```

안전장치: 승인되지 않은 규칙(초안·검토중·보류·폐기), 예시, Claude 초안은 `build`에 들어가지 않고, 엔진 로더(`loadApprovedRules`)가 한 번 더 거른다. 승인 규칙은 작성자 ≠ 검토자, 승인일, 확정된 속성값만 허용한다.
