# Round 1 BM Validation → Claude B(출시·인프라) 요청

- 작성: 2026-10-19 (Claude A, 브랜치 `sprint/1a-3`, 로컬 커밋 · Push 안 함)
- 계획: `docs/round1/BM_VALIDATION_PLAN.md`, `SPRINT_ROADMAP.md`, `PLUS_PRICING_EXPERIMENT.md`
- Claude A는 Claude B 담당 파일(처리방침·약관, 사진 AI 동의, 계정 삭제, EAS·스토어, Dockerfile·Railway)을 고치지 않았다. 아래는 R1-02 전에 확인·반영을 부탁하는 내용이다

## 1. 공유 파일 변경 (R1-01)

| 파일 | 변경 |
|---|---|
| `package.json` | 스크립트 1줄 추가: `test:round1`. 의존성 변경 없음 |

새 파일은 모두 Claude A 소유: `docs/round1/*`, `data/round1/*`, `scripts/round1/*`, 이 문서.

## 2. 부탁하는 것

| # | 항목 | 이유 | 필요 시점 |
|---|---|---|---|
| R-1 | 처리방침·사진 AI 동의 문구와 **연구 동의서 초안**(`docs/round1/SURVEY_AND_CONSENT.md` 2장) 대조 | 수탁자·국외 이전·보관 기간 표현을 맞춰야 함 | R1-02 초 |
| R-2 | 처리방침에 연구 데이터 항목 반영 검토: 참가 코드, 연구 이벤트(5.1 공통 필드), 공식몰 이동 기록, UTM | 새 수집 항목 | R1-03 전 |
| R-3 | **연구용 Paywall**의 스토어 정책 검토(실제 결제 없는 가격 표시, 참가 코드 입력 시에만 노출) + 외부 공식몰 링크 | TestFlight 외부 테스트 심사·Play 정책 | 실험 빌드 전 |
| R-4 | (운영 DB 연구 테이블이 승인되면) `research_events`를 계정 삭제 대상에 포함 확인 | H-6 원칙대로 `user_id ... on delete cascade`로 만들 예정 | 승인 후 |
| R-5 | 실험 빌드 배포 채널(내부 테스트) 일정 공유 | R1-03 세션 시작(11/9)의 전제 | R1-02 중 |
| R-6 | 창업활동자금 예산안 B-1(설문 패널)·B-2(인터뷰 음료)와 이 세션(18명)의 관계 정리 | 같은 활동을 두 번 모집하지 않기 위해. 사례비는 상품권·현금 불가(`FUNDING_RULES.md` 5-9) | R1-01 |

## 3. 개발 트랙이 R1-02에서 할 일 중 Claude B와 닿는 것

| 작업 | 닿는 부분 | 방식 |
|---|---|---|
| H-1 SlimSAM 동시 처리 제한, H-4 `demo` 숨김 | `backend/server.js`(같은 구역 아님), 앱 라우트 | 완료 후 이 문서에 결과 추가 |
| PLUS 사진 분석 | 사진 AI 동의 | `hasAiConsent` 재사용, 동의 화면 파일은 수정하지 않음 |
| 새 화면 | 홈·Missing·Shop에 진입 링크 1~2줄 | `closet.tsx`·`upload.tsx`(Claude B 수정 파일)는 건드리지 않음 |
| 작업 브랜치 | `integration/beta-rc1.1`에서 새 브랜치 | RC 병합 충돌 최소화 |
