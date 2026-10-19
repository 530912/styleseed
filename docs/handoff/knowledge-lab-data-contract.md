# Claude C 전달: Knowledge Lab ↔ 추천엔진 Data Contract

**전달 패키지: [`docs/handoff/fkd-data-contract-v0.1/`](fkd-data-contract-v0.1/README.md)** — 이 폴더 하나로 개발할 수 있게 만든 독립 명세(README) + 계약 JSON + JSON Schema + 예시 데이터(CSV·JSON) + 잘못된 예시와 기대 오류 코드.

- 경계: Lab(연구 가이드 사이트, 입력·평가 UI, 관리자, DB·CRUD, 계약 형식 내보내기) = Claude C / 계약·가져오기 검증·빌드·추천엔진 = Claude A / 패션 내용 최종 승인 = 공동창업자 2명
- 검증 로직을 새로 만들 필요가 있으면 계약 JSON과 같은 오류 코드를 쓰고, 패키지의 `examples/invalid`로 확인한다(README 8.4)
- 형식 변경 요청은 README 10장 절차
