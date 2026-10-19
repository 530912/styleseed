# Fashion Knowledge Data Contract V0.1 — 안내

**정식 명세(Claude C 전달용 독립 패키지): [`docs/handoff/fkd-data-contract-v0.1/README.md`](../handoff/fkd-data-contract-v0.1/README.md)**

| 무엇 | 어디 |
|---|---|
| 계약 원본(기계 판독, 단일 원본) | `data/fkd/contract/fkd-contract-v0.1.json` (패키지 `contract/`에 사본 자동 생성) |
| JSON Schema | `docs/handoff/fkd-data-contract-v0.1/contract/fkd-bundle.schema.json` |
| 예시 묶음(CSV·JSON), 잘못된 예시 + 기대 오류 코드 | `docs/handoff/fkd-data-contract-v0.1/examples/` |
| 참고 검증기·빌드·비교 | `scripts/fkd/`(`npm run fkd:validate · fkd:build · fkd:compare · test:fkd`) |
| 패키지 다시 만들기 / 최신 확인 | `node scripts/fkd/gen-handoff.mjs` / `--check` (테스트에도 포함) |

이 문서에는 명세를 다시 쓰지 않는다(중복 방지). 아래는 추천엔진 쪽(Claude A) 내용만 둔다.

## 기존 엔진 기준선 측정 (공동창업자 Pilot 평가 제출 후)

| 항목 | 방법 |
|---|---|
| 대상 | `data/fkd/templates/outfits.csv` Pilot 20개. 의류는 `garments.csv`의 `source_ref = engine-closet#N`(엔진 스냅샷 고정 옷장)이라 현재 엔진에 그대로 넣을 수 있다 |
| 현재 엔진 점수 | 엔진 B `evaluateOutfit(items, closet)` = 화면 MATCH, 엔진 C = Today 표시 점수(날씨 있는 코디) |
| 사람 점수 | 두 평가자 종합 점수 평균(1~5 → 0~100: (점수−1)×25), 판정 |
| 지표 | 순위 상관(Spearman), 판정 일치(경계는 D-F06), 쌍 비교 정확도, 차원별 순위 상관 |
| 기록 | `docs/recommendation/baseline/`에 날짜·`datasetVersion`·엔진 커밋과 함께. 같은 20개로 새 엔진도 비교 |
| 상한선 | 평가자 간 일치도(가중 kappa) |

## 통합 계획

| 단계 | 내용 | 조건 |
|---|---|---|
| 1 | 계약 V0.1 확정 | Claude C 검토 + 공동창업자 D-F01~D-F10 결정 |
| 2 | Lab에서 Pilot 평가·속성 확정·규칙 작성/승인 | 사람 작업 |
| 3 | 기준선 측정(위 표) | Pilot 제출 |
| 4 | 새 엔진(`src/engine`, `MATCH_SCORE_V0.1.md`) — `ruleset.json`만 입력, 스크립트로 비교 | 승인 규칙 존재 |
| 5 | 앱 연결 | `MATCH_SCORE_V0.1.md` 9장 Go 조건 + **PO 승인**. 그 전에는 기존 앱 추천 로직을 바꾸지 않는다 |

## 변경 이력

| 버전 | 날짜 | 내용 |
|---|---|---|
| 0.1.0 (draft) | 2026-10-19 | 최초 작성(엔티티 7, 고정 목록 25, 오류·경고 코드 34) |
| 0.1.0 (draft) | 2026-10-19 | Claude C 전달 패키지로 분리. JSON 내보내기 형식·JSON Schema, manifest `purpose`·`format`, 점수 차원·rubric·판정 효과(가설), 공동창업자 결정 항목 D-F01~D-F10, 오류 코드 2개(`E_JSON_INVALID`, `E_EXAMPLE_BUNDLE_BUILD`), 예시·잘못된 예시 데이터. 아직 공식 배포 전이라 0.1.0 유지 |
