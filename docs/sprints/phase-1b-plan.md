# Phase 1B 계획 — 추천엔진 고도화

- 작성: 2026-10-19 · 상태: **v2 — PO 승인(조건부) 반영.** v1(아래 0~10장)은 기록으로 유지하고, 다른 내용은 이 v2 절이 우선한다
- 근거: PRD Objective 1B, FR-SCORE-01~06, FR-DS-01~08, FR-REC-01~06, FR-DATA-01~03, AC-G5·G6·G9·G10, `docs/PRODUCT_AUDIT.md` 9장, Sprint 1A-3 엔진 스냅샷
- 작성 방식: `sprint-plan`(용량·스토리·의존성·위험)과 `test-scenarios`(시나리오·커버리지) 형식

---

## v2. PO 승인 조건 반영 (2026-10-19)

### v2.1 승인 내용과 조건

| 항목 | 결정 |
|---|---|
| Phase 1B | **승인.** 단, 공동창업자 2명이 직접 참여하는 Fashion Knowledge Dataset 환경을 먼저 준비 |
| 역할 | 패션 지식·추천 규칙·평가 기준 = **공동창업자 2명**(패션·의상학 전공, 1명은 개발 경험 없음) / 데이터 구조·알고리즘 = Claude |
| 이번 자율 범위 | 기존 엔진 Audit, 협업용 데이터셋 템플릿, Match Score 설계, 이 계획 조정**까지만** |
| 적용 제한 | **사람이 검토한 규칙 데이터가 준비되기 전에는 새 엔진을 앱에 적용하지 않는다** |
| 별도 승인 | 운영 DB 변경(행동 기록 테이블 포함), Git Push, 외부 배포, Gemini 유료 전환 |
| 담당 분리 | 출시·인프라·앱스토어는 Claude B. 해당 영역 코드는 수정하지 않음 |

### v2.2 v1에서 바뀐 점

| v1 | v2 |
|---|---|
| D-1: Numbers를 CSV로 내보내 그대로 연결 | **새 템플릿 4종**(Google Sheets ↔ CSV)으로 다시 작성. Numbers의 속성 사전·평가 기준·예시는 템플릿에 옮김(예시·`제안` 상태로) |
| D-3: 대표자 1명 + 가능하면 2명째 | **2명 독립 평가 필수.** Pilot 20개 → 60개 이상 |
| 가중치: 현재 엔진 B 값을 Dataset으로 이전 | **Match Score V0.1 가설 가중치** Color 25 · Fit/Silhouette 25 · TPO 20 · Material/Season 15 · User Preference 15 (`docs/recommendation/MATCH_SCORE_V0.1.md`) |
| 1B-4: 저장률·만족도 | 저장률·**선택률**·만족도. 운영 DB 테이블은 **별도 승인 후** |
| 1.2 P1 “Styling 100점 vs Looks 77점” | **정정:** 100은 엔진 A의 내부 점수(화면 미표시). 사용자가 보는 불일치는 Today가 날씨 혼합 점수를 MATCH로 표시하는 것(Looks 77 → Today 83). 상세 `docs/recommendation/CURRENT_ENGINE_AUDIT.md` 6장 |
| 1B-2 완료 = 화면 교체 | 1B-2는 **엔진 구현 + 스크립트 비교까지.** 화면 연결은 MATCH_SCORE_V0.1 9장 Go 조건 충족 + PO 승인 후 |

### v2.3 이번에 만든 것 (1B-1 선행 작업, 완료)

| 산출물 | 위치 |
|---|---|
| 현재 엔진 Audit | `docs/recommendation/CURRENT_ENGINE_AUDIT.md` |
| 데이터셋 템플릿 4종 | `data/fkd/templates/garment_schema.csv`(127값, 모두 `제안`), `styling_rules.csv`(예시 8), `outfit_evaluation.csv`(Pilot 20 + 예시 1), `disagreement_review.csv` |
| 입력 안내(한국어, 비개발자용) | `docs/recommendation/DATASET_GUIDE.md` |
| 검증·빌드·비교 도구 | `scripts/fkd/*`, `npm run fkd:validate · fkd:build · fkd:compare · test:fkd`(12 테스트) |
| Match Score V0.1 설계 | `docs/recommendation/MATCH_SCORE_V0.1.md` |

### v2.4 조정된 Sprint 계획

사람 작업(공동창업자)과 Claude 작업을 나눠 적는다. **사람 작업이 끝나야 다음 Claude 작업이 의미 있는 단계**는 “관문”으로 표시한다.

#### Sprint 1B-1 — Audit · 템플릿 · 평가 환경 · 기준선

| # | 작업 | 담당 | 상태 |
|---|---|---|---|
| 1B1-1 | 현재 엔진 Audit | Claude | **완료** |
| 1B1-2 | 템플릿 4종 + 입력 안내 + 검증·빌드·비교 도구 | Claude | **완료** |
| 1B1-3 | Google Sheets 준비, **Pilot 20개 독립 평가** | E1·E2 각자 | 대기 |
| 1B1-4 | 두 평가 비교 → 일치도 보고 + 불일치 목록 | Claude | 관문: 1B1-3 |
| 1B1-5 | 불일치 검토·합의 | E1·E2 함께 | 관문: 1B1-4 |
| 1B1-6 | **현재 엔진 기준선**: Pilot 20개를 현재 엔진 B(MATCH)·C(Today)로 채점 → 사람 종합 평균과 순위 상관·판정 일치·쌍 비교 정확도 | Claude | 관문: 1B1-3 |
| 1B1-7 | 속성 사전 확정(핏/실루엣, 명도·채도 변환표, TPO·무드 목록) | E1·E2 함께 | 대기 |
| 1B1-8 | Core 엔진 스냅샷 테스트 추가, 미사용 `getLookInsights` 정리 | Claude | 대기 |

**AC**
- [x] AC1-1 Audit 문서가 후보 생성·점수식·화면별 엔진·점수 불일치 원인·Mock 구분·Dataset 범위를 다룬다
- [x] AC1-2 템플릿 4종이 검증 도구를 오류 0으로 통과하고, 빌드 결과의 승인 규칙이 0개다(예시·초안 제외 확인)
- [x] AC1-3 미승인·예시·Claude 초안 규칙이 빌드에 들어가지 않음을 단위 테스트로 보장
- [ ] AC1-4 E1·E2 각각 Pilot 20개 평가 완료, 한 파일에 한 평가자(검증 통과)
- [ ] AC1-5 평가자 간 일치도(차원별 가중 kappa·1점 이내 비율, 종합 순위 상관)가 기록됨
- [ ] AC1-6 현재 엔진 기준선(종합 순위 상관·판정 일치·쌍 비교 정확도)이 `datasetVersion`·엔진 버전과 함께 기록됨
- [ ] AC1-7 속성 사전에서 규칙에 쓸 값이 `확정` 상태(결정자·결정일 포함)

#### Sprint 1B-2 — 승인 규칙 기반 Match Score + 추천 근거

| # | 작업 | 담당 | 관문 |
|---|---|---|---|
| 1B2-1 | 규칙 작성 → 교차 승인(작성자 ≠ 검토자). 목표: 5개 차원 각 5개 이상 | E1·E2 | 1B1-7 |
| 1B2-2 | `src/engine` 구현: 승인 ruleset 로더, 하위 점수(중립 60 + 규칙 효과), 예외 우선, 가중치 V0.1, 완성도, Weather Fit 분리, 제외 규칙 | Claude | 1B1-6 이후 착수 가능(규칙 없이도 테스트 데이터로 개발) |
| 1B2-3 | 추천 근거 생성: 적용 규칙 문장만, 주의 1줄, 변환 판정 문장 제외 | Claude | 1B2-2 |
| 1B2-4 | 취향 데이터 없음 처리(무드 일관성 대체), 엔진·가중치·데이터셋 버전 기록 | Claude | 1B2-2 |
| 1B2-5 | 비교 스크립트: 새 엔진 vs 현재 엔진 vs 사람(Pilot) | Claude | 1B2-1 |

**AC**
- [ ] AC2-1 엔진은 `loadApprovedRules`를 거친 규칙만 사용(미승인 규칙을 넣은 테스트에서 점수 변화 0)
- [ ] AC2-2 같은 아이템 조합은 화면 맥락(Styling·Looks·Today)과 관계없이 같은 Match Score(단위 테스트)
- [ ] AC2-3 모든 추천 이유 문장이 적용된 승인 규칙에서 나옴(단위 테스트), 근거 없으면 문장 없음
- [ ] AC2-4 결과에 `engineVersion`·`weightsVersion`·`datasetVersion`·`coverage` 포함
- [ ] AC2-5 날씨 제외 규칙이 승인되어 있으면 Today 후보에서 위반 0건
- [ ] AC2-6 **앱 화면 코드 변경 0건**(Go 조건 충족 + PO 승인 전)

#### Sprint 1B-3 — 두 사람의 독립 평가로 정확도 검증·개선

| # | 작업 | 담당 |
|---|---|---|
| 1B3-1 | 평가 세트 60개 이상으로 확장(실제 옷 사진 링크 포함), 개발용 70% / 보류용 30% | Claude(코디 구성) → E1·E2(독립 평가) |
| 1B3-2 | 불일치 검토 → 규칙 추가·수정·예외 | E1·E2 |
| 1B3-3 | 엔진 vs 사람: 종합·차원별 순위 상관, 판정 일치, 쌍 비교 정확도, 규칙 커버리지 | Claude |
| 1B3-4 | 가중치 점검(사람의 차원 점수 → 종합 점수 설명력, 교차 검증) → 변경안 | Claude 제안 → **E1·E2 승인** |
| 1B3-5 | Go 조건(MATCH_SCORE_V0.1 9장) 판정 → 앱 적용 승인 요청 | Claude → PO |

**AC**
- [ ] AC3-1 60개 이상 × 2명 독립 평가, 일치도 기록
- [ ] AC3-2 보류용 세트에서 새 엔진의 종합 순위 상관이 현재 엔진보다 높음 — 미달이면 실패로 보고하고 원인·다음 조치 제시
- [ ] AC3-3 가중치 변경은 두 사람 승인 기록과 새 `weightsVersion`이 있을 때만 반영
- [ ] AC3-4 결과 보고서에 표본 수·평가자 간 일치도·해석 한계 명시

#### Sprint 1B-4 — 코디 저장률·선택률·만족도 측정

| KPI | 정의(v1 6장 기준, 선택률 추가) |
|---|---|
| 저장률 | `look_saved` / `look_view`(코디·사용자·일 단위 중복 제거) |
| **선택률** | 노출된 Top 3 중 사용자가 상세를 열거나 “오늘 입음”을 누른 코디 비율 `look_selected` / `look_view`, 순위별(1~3위)로도 집계 |
| 만족도 | 엄지 위/아래 비율 + 5점 척도(하루 1회까지) |

| # | 작업 | 승인 |
|---|---|---|
| 1B4-1 | 이벤트·저장 테이블 마이그레이션 + RLS → **QA 프로젝트에만** 적용·교차 계정 E2E | 자율(QA) |
| 1B4-2 | 앱 이벤트 클라이언트, 저장·선택·평가 UI | 새 엔진 화면 연결과 함께(1B3-5 승인 후) |
| 1B4-3 | 운영 DB 적용 | **별도 승인** |
| 1B4-4 | 계정 삭제·개인정보처리방침 반영 | Claude B 핸드오프 |

### v2.5 테스트 시나리오 추가 (v1 8장에 더함)

| ID | 시나리오 | 우선순위 | 자동화 |
|---|---|---|---|
| TS-19 | 템플릿 그대로 빌드 → 승인 규칙 0개 | Critical | 단위(완료) |
| TS-20 | 초안·검토중·보류·폐기·예시·Claude 초안 규칙 → 빌드 제외 | Critical | 단위(완료) |
| TS-21 | 작성자 = 검토자인 승인 규칙 → 검증 오류 | Critical | 단위(완료) |
| TS-22 | 확정되지 않은 속성값을 쓴 승인 규칙 → 검증 오류 | High | 단위(완료) |
| TS-23 | 한 평가 파일에 평가자 2명 → 검증 오류(독립 평가 보호) | High | 단위(완료) |
| TS-24 | 미평가 코디가 남은 상태 또는 같은 평가자 파일 2개로 비교 요청 → 거부 | High | CLI 확인(2026-10-19) |
| TS-25 | 빌드 파일에 미승인 규칙을 손으로 넣어도 엔진 로더가 거름 | High | 단위(완료) |
| TS-26 | 승인 규칙의 버전 2가 있으면 버전 1 대신 사용 | Medium | 단위(완료) |
| TS-27 | 미승인 규칙 추가 전후 엔진 점수 동일 | Critical | 1B-2 |
| TS-28 | 예외 규칙(street) 적용 시 기본 규칙 효과 대신 예외 효과 | High | 1B-2 |
| TS-29 | 규칙이 하나도 적용되지 않은 차원 → 60점 + `coverage: none` + 이유 문장 없음 | High | 1B-2 |

### v2.6 위험 (v1 10장에 더함)

| 위험 | 대응 |
|---|---|
| 공동창업자 작업 시간이 부족해 관문에서 대기 | Claude 작업은 관문 없이 가능한 것(엔진 골격·테스트)부터. 대기 상태를 진행 보고에 표시 |
| 두 사람 일치도가 낮음 | 평가 기준 문장을 먼저 고치고(4단계), 엔진 목표치는 일치도 이하로 잡음 |
| 사진 없이 텍스트 코디로 평가 → 판단 어려움 | Pilot은 텍스트로 진행, 60개 확장 때 실제 사진 링크 추가 |
| 속성 체계가 앱 데이터와 달라 규칙 적용 불가 | 변환표(MATCH_SCORE 3.4) 확정 + AI 분석 항목 확장 여부를 1B-1에서 결정 |
| 규칙이 적어 대부분 60점(중립) | 커버리지를 매번 보고, 규칙이 부족한 차원을 공동창업자에게 요청 |

---

## 0. 한눈에

| Sprint | 기간(이상적 작업일) | 목표 한 문장 | PRD Gate |
|---|---|---|---|
| **1B-1 기준 만들기** | 5일 | 규칙 데이터와 전문가 평가 세트를 코드가 읽을 수 있게 만들고, **현재 엔진의 기준선 점수**를 잰다 | AC-G9(절차) |
| **1B-2 통합 Match Score** | 9일 | 4개 점수 체계를 **하나의 엔진**으로 바꾸고 모든 화면이 같은 점수·같은 이유를 보인다 | AC-G5 |
| **1B-3 정확도 검증** | 6일 | 전문가 평가 세트·실제 옷장으로 새 엔진이 기준선보다 나은지 **숫자로** 확인한다 | AC-G9(결과), AC-G10 |
| **1B-4 측정 체계** | 7일 | 코디 저장률·추천 만족도를 앱 이벤트로 잴 수 있게 한다 | AC-G6 |

- 합계 약 27일 + 버퍼 15%(약 4일) → **약 6~7주**(Claude A 1명 + PO 검토·평가 시간)
- 순서: 1B-1 → 1B-2 → 1B-3. 1B-4는 **DB 변경 승인**이 나면 1B-2와 병행 가능
- 승인 필요 항목은 9장. 운영 DB 변경, Push, 배포, 유료 API는 각 Sprint 안에서도 **따로** 승인 요청

---

## 1. 현재 4개 점수 체계 분석 (요구 1)

### 1.1 무엇이 있나

| # | 엔진 | 파일 | 쓰는 화면 | 점수 방식 | 이유 문장 |
|---|---|---|---|---|---|
| A | 1:1 궁합 | `recommendation.ts:102` `getCompatibilityScore`, `:232` `getRecommendedOutfit` | Styling(아이템 선택), Missing, Demo | 계절·스타일·TPO **겹치면 25/25/20, 아니면 0** + 색 10~20 + 카테고리 0~10. 기준 옷과 후보만 비교(별 모양) | 지표별 고정 문장 |
| B | MATCH SCORE | `outfitScore.ts:434` `evaluateOutfit`, `:507`, `:597` | Looks, Styling(점수 **표시**), Today 내부 | 6개 지표(색 .22·핏 .16·소재 .14·계절 .20·TPO .18·선호 .10) × 완성도(0.82+0.18c) × 약점 보정(0.88/0.94) | 상위 3개 지표 메모 |
| C | Today | `weatherRecommendation.ts:242`, `:320` | 홈, Today | 온도 구간 규칙(계절 50·소재 25·세부 품목 25) → 40 미만 제외(단, 카테고리에 통과 옷이 없으면 **전부 다시 허용**) → `0.7×B + 0.3×날씨` | 날씨 라벨만 |
| D | Core(데모) | `prototypeCore.ts:28`, `coreDemo.ts:94` | Core Look·Match·Shop | 아이템 단독 점수(색 30/12·품목 25/12·소재 20/10·스타일·계절 10). 아이템끼리 비교 없음 | 일치 신호 이름 |

### 1.2 무엇이 문제인가 (근거: 1A-3 엔진 스냅샷 `src/utils/__tests__/fixtures/engine-baseline.json`)

| # | 문제 | 실제 사례 |
|---|---|---|
| P1 | **고르는 엔진(A)과 보여주는 점수(B)가 다르다** | 같은 코디 [티셔츠·반바지·스니커즈]: Styling 내부 100점, Looks 77점 |
| P2 | 이분법 점수: 하나라도 겹치면 만점 | 엔진 A 최고점 코디가 쉽게 100점 |
| P3 | 아이템끼리 궁합을 보지 않음 | 하의·신발을 각각 상의 기준으로만 고름 |
| P4 | 날씨 부적합 옷이 “되돌아옴” | −3℃ 눈: 실크 원피스 + 가죽 재킷이 2순위(날씨 48점, 30% 가중이라 약 10점만 깎임) |
| P5 | 같은 개념을 다르게 계산 | 계절 3곳·3방식, `NEUTRAL_COLORS` 중복, 같은 색 18/20 vs 74/86 |
| P6 | 쓰지 않는 속성 | `colorTone`, 패턴(데이터 필드 없음), 신발의 핏·실루엣 |
| P7 | 근거 없는 상수 | 가중치·소재표 14쌍(나머지 72 기본값)·핏 볼륨이 모두 손으로 정한 값. Dataset 연결 없음 |
| P8 | “Preference”는 실제 취향이 아님 | 옷장 안 빈도. PRD FR-SCORE-05: UI에 명시 필요 |
| P9 | 죽은 코드·검증 공백 | `getLookInsights` 미사용, Core 엔진은 스냅샷 테스트 밖 |

### 1.3 각 엔진에서 살릴 것

- **B의 구조**(독립 지표 0~100, 명시적 가중치, 완성도, 약점 보정, 계산된 지표에서 이유 생성) → 통합 엔진의 뼈대 (PRD FR-SCORE 처리 로직과 일치)
- **C의 날씨 규칙** → 별도 **Weather Fit**(합산하지 않고 표시, PRD FR-SCORE-02) + 날씨 **거부 규칙**
- **D의 primary/secondary 규칙 형식** → **Core Fit**(별도 표시)과 Dataset Core 스키마
- **A** → 아이템 선택에서 제거(PRD FR-SCORE AC④). 후보를 줄이는 빠른 1차 필터로만 쓸지는 성능 측정 후 결정

---

## 2. 목표 설계 — 통합 Match Score 엔진 (요구 2·4·7)

### 2.1 구조

```
src/engine/                         (신규, 순수 함수 · React Native 의존 없음 · Node 테스트 가능)
  knowledge/fkd-v0.1.json           Fashion Knowledge Dataset → 버전 JSON (dataset_version)
  knowledge/schema.ts               행 스키마 + 검증기(rule_id, target_attribute, value_a, value_b, score, rationale, source)
  rules.ts                          JSON → 조회 테이블(색 쌍·톤·소재 쌍·실루엣·계절·TPO·날씨·Core)
  score.ts                          scoreOutfit(items, ctx) → { matchScore, subScores[6], weatherFit?, coreFit?, reasons[], vetoes[], scoreVersion }
  candidates.ts                     후보 생성: 카테고리 계획 × 상위 k 아이템, 아이템끼리 모두 비교(쌍 평균)
  rank.ts                           rankLooks(closet, {anchor?, weather?, core?, limit}) — Styling/Looks/Today/Core가 모두 사용
  explain.ts                        이유 문장: 계산된 지표·규칙 rationale에서만 생성
```

- 화면은 `rankLooks` 하나만 부른다. Styling = `anchor` 지정, Looks = 없음, Today = `weather` 지정, Core = `core` 지정
- **Outfit Match Score는 날씨·Core와 합산하지 않는다**(PRD FR-SCORE-01·02). Today는 “날씨 반영” 표시와 Weather Fit을 따로 보이고, 순위만 `(veto 통과) → Match → Weather Fit` 순으로 정렬. 합산 규칙(α·β)은 Phase 3
- `scoreVersion`(예: `match-1.0.0`)과 `dataset_version`을 결과에 넣는다(PRD FR-SCORE-06, FR-DS-03)
- 결정적: 같은 입력 = 같은 순위(동점은 아이템 id 순)

### 2.2 6개 하위 지표와 규칙 (요구 4)

| 지표 | 지금(B) | 1B 규칙 (Dataset 행으로 관리) |
|---|---|---|
| **Color** | 색 쌍 5단계 | 색 쌍 규칙(중립·유사·보색·충돌) + **colorTone 조화**(같은 톤 / 밝기 대비) + 강조색 1개 원칙(강한 색 2개 이상 감점). 패턴은 필드가 없으므로 1B 범위 밖(Phase 2, 분석 스키마 추가 필요) |
| **Fit·Silhouette** | 위·아래 볼륨 차이 | 볼륨 차이 규칙 + **실루엣 유형**(I·A·V·H: 상하 핏 조합으로 판정) + 아우터-상의 길이/볼륨 + 신발 무게감(부츠·로퍼 vs 샌들·플랫) |
| **Material** | 14쌍 + 기본 72 | 소재 쌍 규칙 확대(앱 소재 9종(other 제외), 같은 소재 포함 45쌍 전부 명시) + 계절 무게감(리넨·실크 vs 울·니트) 일관성 |
| **Season** | 공유/합집합 | 아이템 간 계절 일관성. **날씨가 있으면 Season 대신 Weather Fit이 맥락 역할**(중복 계산 제거) |
| **TPO** | 공유/합집합 | TPO 공통 교집합 + 충돌 규칙(예: sporty × formal) + 선택 TPO가 있으면 일치도 |
| **Preference** | 옷장 빈도 | 1B는 그대로 두고 **“옷장 기준”임을 UI 문구로 명시**(PRD FR-SCORE-05). 명시적 취향 입력은 Phase 3 |

**날씨 거부 규칙(veto) — P4 해결**: Dataset의 `weather_veto` 행(예: `cold|snow` × `material=silk|linen`, `rain` × `sandals|heels`, `cold` × `outer 없음`)에 걸리면 Today 1~3순위에서 제외하고, 대안이 없으면 “오늘 날씨에 맞는 ○○이 옷장에 없어요”를 Missing으로 안내. 억지로 채우지 않는다(PRD FR-CORE-07 AC⑤와 같은 원칙).

### 2.3 이해하기 쉬운 추천 이유 (요구 7)

| 원칙 | 구현 |
|---|---|
| 계산된 값에서만 만든다 | `explain.ts`는 상위 지표 2개 + 적용된 규칙의 `rationale`로 문장 생성. 계산에 없는 칭찬 금지 |
| 구체적으로 | “색이 잘 어울려요” 대신 “네이비 하의가 베이지 니트의 밝은 톤을 차분하게 잡아줘요(톤 대비)” — 아이템 이름 + 규칙 근거 |
| 약점도 말한다 | 최저 지표가 55 미만이면 “소재 무게감이 달라요: 리넨 셔츠 + 울 슬랙스” 1줄 |
| 날씨는 따로 | “−3℃ 눈: 울 코트·부츠로 보온과 미끄럼 대비” (Weather Fit 근거) |
| 길이 | 이유 최대 3줄, 줄당 40자 내외 [제안] |
| 검증 | 단위 테스트(문장 ↔ 상위 지표 일치) + 1B-3 이해도 확인(9장 D-5) |

---

## 3. Fashion Knowledge Dataset 실제 연결 (요구 3)

### 3.1 현재 확인된 것

- `STYLESEED_Fashion_Knowledge_Dataset_V0.1.numbers`(저장소 루트, **Git에 올리지 않은 사용자 파일**). 표 약 20개
- 첫 시트(작업지시서)에서 확인: 산출물 ① Fashion Attribute Guide ② Styling Rulebook V0.1 ③ Labeled Outfit Dataset(1~5점) ④ Styling Evaluation Rubric ⑤ Exception / Edge Case Guide. 작성 원칙: 관찰 가능한 이유, Color/Silhouette & Fit/Material/TPO/Mood 따로 판단, Confidence 표기, 예외 분리. 권장량: 스타일링 규칙 100, 코디 라벨링 200~300, 평가 고정 세트 100, 예외 20
- **나머지 시트의 실제 내용·채움 정도는 미확인**: Numbers 내보내기 자동화가 응답 시간 초과로 실패했다(Numbers 창에 확인 대화상자가 떠 있을 수 있음). 내용을 추정해 계획하지 않는다

### 3.2 연결 방식 (제안)

| 단계 | 내용 | 산출물 |
|---|---|---|
| 1 | PO가 Numbers에서 시트별 CSV 내보내기(파일 → 내보내기 → CSV) → `data/fkd/v0.1/*.csv`로 저장소에 추가 **[결정 D-1]** | CSV 원본(버전 고정) |
| 2 | 변환 스크립트 `scripts/fkd-build.mjs`: CSV → 검증 → `src/engine/knowledge/fkd-v0.1.json`. 필수 필드(`rule_id`, `target_attribute`, `value_a/b`, `score`, `rationale`, `source`, `confidence`) 누락·앱 속성 값과 불일치(예: 데이터의 “트위드”가 앱 material 목록에 없음)를 **오류 목록**으로 출력 | 검증 보고서 |
| 3 | 앱 속성 사전 맞추기: Dataset 용어 ↔ `clothingOptions.ts` 값 매핑표. 없는 값은 “매핑 필요”로 PO에게 반환 | 매핑표 |
| 4 | 엔진이 JSON만 읽는다. `outfitScore.ts`의 `WEIGHTS`·`MATERIAL_PAIRS`·`FIT_VOLUME`·색 점수표를 JSON 기본값으로 이전(PRD FR-DS AC①) | 상수 0개 |
| 5 | Labeled Outfit Dataset·평가 고정 세트 → 4장 전문가 평가 세트로 사용 | golden set |

- 1B는 **앱 번들 JSON**(코드 배포로 갱신). “코드 배포 없이 갱신”(FR-DS AC②, PRD상 Phase 3)은 Supabase 테이블 + 서버 배포가 필요하므로 이후로 미룬다 **[결정 D-2]**
- Dataset 규칙이 없는 항목은 현재 상수를 `source: "legacy-code"`, `confidence: low`로 옮겨 빈칸 없이 시작하고, 평가 결과로 교체

---

## 4. 전문가 평가 세트 비교 (요구 6)

| 항목 | 설계 |
|---|---|
| 세트 | Dataset의 “평가 고정 세트”(권장 100) 사용. 없으면 1B-1에서 **최소 40코디**를 만든다: 고정 옷장 3종(미니멀·캐주얼·포엣코어 성향, 각 15~25벌) × 기준 아이템별 후보 코디 |
| 라벨 | 대표자(의상학) 1~5점 + 적합/부적합 + 지표별 이유(색·실루엣·소재·TPO·무드) + Confidence. 가능하면 **2명째 평가자**로 20% 중복 평가 → 평가자 간 일치도(가중 kappa) **[결정 D-3]** |
| 지표 | ① **순위 상관**(Spearman ρ, 같은 기준 아이템의 후보 코디끼리) ② **NDCG@3**(Top 3 품질) ③ **쌍 비교 정확도**(전문가가 더 높게 본 코디를 엔진도 더 높게 보는 비율) ④ **부적합 1순위율**(전문가 “부적합” 코디가 엔진 1순위인 비율) ⑤ **규칙 위반 0건**(날씨 veto 위반) |
| 비교 대상 | 기준선 = 현재 엔진 A(Styling 선택), B(Looks), C(Today) 각각 / 후보 = 통합 엔진 |
| 기록 | `docs/eval/phase-1b-eval-<날짜>.md` + JSON: `dataset_version`, `score_version`, 세트 버전, 지표값(PRD FR-DS AC⑤) |
| 합격선 [가설] | 기준값은 PRD상 1B 첫 측정 후 확정(FR-DS AC⑥). 1B 개발 판단용 임시선: 통합 엔진이 **기준선 대비 ρ·NDCG@3 모두 개선**, 쌍 비교 정확도 ≥ 0.70, 부적합 1순위율 ≤ 10%, veto 위반 0 |
| 과적합 방지 | 세트를 개발용 70% / 보류용 30%로 나누고, 규칙 조정은 개발용으로만. 최종 보고는 보류용 숫자 |

---

## 5. 사용자 옷장 기준 정확도 검증 (요구 5)

| 단계 | 방법 | 데이터 원칙 |
|---|---|---|
| 5.1 합성 옷장 | 1A-3 고정 옷장 15벌 + 평가 세트 옷장 3종 + 극단 옷장(옷 2벌, 상의만 20벌, 한 색만, 여름옷만) | 저장소 fixture |
| 5.2 QA 실사진 옷장 | QA 프로젝트 테스트 계정에 실제 옷 사진 20~30벌 등록(분석 → 저장 경로 그대로) → 분석 오류가 추천에 미치는 영향까지 확인 | QA 전용, 테스트 사진은 PO 제공 또는 저장소 이미지 **[결정 D-4]** |
| 5.3 PO·내부 옷장 | PO(와 동의한 내부 인원)가 자기 옷장 결과를 검토 시트로 평가: Top 3 각각 “입겠다/애매/안 입겠다” + 이유 | **본인 동의 후에만**. 운영 실제 사용자 데이터는 조회하지 않음 |
| 지표 | 옷장별 “입겠다” 비율(Top 1, Top 3), 엔진 간 비교(기준선 vs 통합), 날씨 5종에서 veto 위반 0 |
| 화면 일치 | 같은 옷장·같은 코디가 Styling·Looks·Today에서 **같은 Match Score**(AC-G5) — 자동 테스트 |

---

## 6. KPI 측정 설계 (요구 8)

### 6.1 지표 정의

| KPI | 정의 | 분모·분자 | 이벤트 |
|---|---|---|---|
| **코디 저장률**(Look Save Rate) | 노출된 코디 중 저장된 비율 | `look_saved` 고유(look_key) / `look_view` 고유(look_key) — 사용자·일 단위 중복 제거 | `look_view{source, look_key, rank, match_score, score_version}`, `look_saved{look_key, source}` |
| **추천 만족도** | 코디에 대한 명시적 평가 | ① 엄지 위/아래 비율 ② 5점 척도 평균(선택 응답, 1B는 Looks·Today에서 하루 1회까지만 묻기 [제안]) | `look_feedback{look_key, value, reason_code?}` |
| 스킵률 | 노출 대비 “다른 코디” 요청 | `look_skipped` / `look_view` | `look_skipped` |
| 착용률 | “오늘 입음” | `look_worn` / `look_view`(Today) | `look_worn` |
| 보조 | 추천 가능한 옷장 도달률, 1벌 등록 시간(AC-G6) | `closet_ready`, `upload_started`→`clothing_saved` | PRD 24.3 |

- `look_key` = 정렬된 아이템 id + `score_version` 해시 → 엔진 버전별로 KPI 비교 가능(통합 전후 A/B 해석)
- 목표 수치는 PRD상 Phase 2 진입 전 확정(OQ-24). 1B는 **측정 가능 상태 + 첫 값 기록**까지

### 6.2 저장 구조 (운영 DB 변경 → 별도 승인 D-6)

| 테이블 | 열(요약) | 정책 |
|---|---|---|
| `saved_looks` | id, user_id, item_ids[], match_score, score_version, source, created_at | RLS: 본인만 조회·추가·삭제 |
| `app_events` | id, user_id(익명 세션 포함), name, props jsonb, app_version, created_at | RLS: 본인 추가만, 조회는 서비스(집계)만. 개인정보 필드 금지(이름·이메일·사진 URL 저장 안 함) |
| `look_feedback` | id, user_id, look_key, value, reason_code, created_at | RLS: 본인만 |

- 계정 삭제 시 함께 삭제(SEC-09) — **삭제 처리는 Claude B 영역**이므로 테이블 목록을 핸드오프로 전달
- 개인정보처리방침에 “이용 기록(앱 이벤트)” 항목 추가 필요 → **Claude B**에 전달
- QA 프로젝트에 먼저 적용·E2E 후 운영 적용 승인 요청(1A-2와 같은 절차)

---

## 7. Sprint별 계획

### Sprint 1B-1 — 기준 만들기 (5일)

**목표:** 규칙 데이터와 평가 세트를 코드가 읽을 수 있게 하고, 현재 엔진의 기준선을 숫자로 남긴다.

| # | 스토리 | 일 | 의존 |
|---|---|---|---|
| 1B1-1 | Dataset CSV 수령 → 변환·검증 스크립트 + 앱 속성 매핑표 | 1.5 | D-1(CSV 제공) |
| 1B1-2 | 평가 세트 형식(CSV 템플릿) + 고정 옷장 3종 + 후보 코디 생성 → PO 평가 요청 | 1 | 1B1-1 |
| 1B1-3 | 평가 스크립트 `npm run eval:engine`(ρ, NDCG@3, 쌍 정확도, 부적합 1순위율, veto 위반) | 1 | 1B1-2 |
| 1B1-4 | 현재 엔진 A·B·C 기준선 측정·기록 + Core 엔진을 스냅샷 테스트에 추가 | 0.5 | 1B1-3, PO 라벨 |
| 1B1-5 | NFR-01·02 기준선(앱 분석·저장 시간, 엔진 계산 시간) 측정 계획·Node 측정 | 0.5 | — |
| 버퍼 | | 0.5 | |

**AC**
- [ ] AC1-1 Dataset CSV → JSON 변환이 오류 0으로 끝나거나, 오류 목록(행·필드·이유)이 PO에게 전달되었다
- [ ] AC1-2 Dataset의 모든 규칙 행에 `rule_id`, `score`, `rationale`, `source`가 있다(누락 행 수 = 0 또는 목록화)
- [ ] AC1-3 평가 세트 ≥ 40코디가 PO 라벨과 함께 저장소에 있다(개발 70% / 보류 30% 분리)
- [ ] AC1-4 `npm run eval:engine`이 엔진 A·B·C 각각의 지표 5종을 `dataset_version`과 함께 출력·기록한다
- [ ] AC1-5 기존 테스트 전부 통과(backend 46, client 25, engine 스냅샷 2 + Core 추가분, quality 8)

### Sprint 1B-2 — 통합 Match Score 엔진 (9일)

**목표:** 모든 추천 화면이 하나의 엔진·하나의 점수·계산된 이유를 쓴다.

| # | 스토리 | 일 | 의존 |
|---|---|---|---|
| 1B2-1 | `src/engine` 골격: 규칙 로더, `scoreOutfit` 6개 지표(Dataset 기반), 완성도·약점 보정, `scoreVersion` | 2 | 1B-1 |
| 1B2-2 | Color(톤 포함)·Silhouette(실루엣 유형·신발)·Material(45쌍)·TPO 충돌 규칙 | 2 | 1B2-1, Dataset |
| 1B2-3 | 후보 생성: 아이템끼리 모두 비교, 결정적 정렬, Top 3 서로 다름 | 1 | 1B2-1 |
| 1B2-4 | Weather Fit 분리 + veto + “없는 옷” Missing 연결 | 1 | 1B2-1 |
| 1B2-5 | Core Fit 분리(데모 POETCORE를 Dataset 행으로) | 0.5 | 1B2-1 |
| 1B2-6 | 이유 문장 생성기(`explain.ts`) + 약점 1줄 + Preference 안내 문구 | 1 | 1B2-2 |
| 1B2-7 | 화면 교체: Styling·Looks·Today·Home·Missing·Core가 `rankLooks` 사용. 기존 엔진 A 선택 제거, `getLookInsights` 삭제 | 1 | 1B2-1~6 |
| 1B2-8 | 스냅샷 기준 갱신 + **변경 이유 문서**(무엇이 왜 바뀌었나) | 0.5 | 1B2-7 |

**AC**
- [ ] AC2-1 (AC-G5) 같은 코디는 Styling·Looks·Today에서 같은 Outfit Match Score(자동 테스트, 고정 옷장 전 코디)
- [ ] AC2-2 (FR-REC AC①) Styling 베스트 코디 = Looks에서 그 아이템 포함 1위
- [ ] AC2-3 (FR-SCORE AC④) 엔진 A의 이분법 점수가 아이템 선택에 쓰이지 않는다(코드 검색 0건)
- [ ] AC2-4 `WEIGHTS`·`MATERIAL_PAIRS`·`FIT_VOLUME`·색 점수표가 코드 상수가 아니라 Dataset JSON에서 온다
- [ ] AC2-5 모든 이유 문장이 해당 코디의 상위 지표 또는 적용 규칙 `rule_id`와 연결된다(단위 테스트)
- [ ] AC2-6 Today 1~3순위에 veto 규칙 위반 아이템 0개(날씨 5종 × 고정 옷장)
- [ ] AC2-7 Today는 Match Score와 “날씨 반영” Weather Fit을 따로 표시한다(FR-SCORE AC②)
- [ ] AC2-8 같은 입력 2회 호출 → 같은 순위(결정성)
- [ ] AC2-9 옷 200벌 옷장에서 `rankLooks` Top 3 계산 ≤ 300ms(Node, [제안] 기준) — 실기기는 1B-3
- [ ] AC2-10 기존 테스트 통과 + 스냅샷 차이는 모두 변경 이유 문서에 설명됨

### Sprint 1B-3 — 정확도 검증 (6일)

| # | 스토리 | 일 |
|---|---|---|
| 1B3-1 | 평가 세트(개발용)로 규칙 조정 → 보류용으로 최종 측정·보고 | 2 |
| 1B3-2 | QA 실사진 옷장(20~30벌) 등록·검증, 분석 오류의 추천 영향 기록 | 1.5 |
| 1B3-3 | PO·내부 옷장 검토 시트 진행·집계(동의자만) | 1 |
| 1B3-4 | 이유 문장 이해도 확인: 코디 10개 × 이유 → PO(+내부 2~3명) “이해됨/모호/틀림” | 0.5 |
| 1B3-5 | NFR 기준선 기록(AC-G10), 결과 문서 | 1 |

**AC**
- [ ] AC3-1 (AC-G9) 보류용 세트에서 통합 엔진·기준선 엔진 지표 5종이 버전과 함께 기록됨
- [ ] AC3-2 통합 엔진이 기준선 대비 ρ·NDCG@3 개선, 쌍 정확도 ≥ 0.70, 부적합 1순위율 ≤ 10% [가설 임시선] — 미달이면 **실패로 보고**하고 원인·다음 조치 제시
- [ ] AC3-3 실사진·내부 옷장 Top 3 “입겠다” 비율이 엔진별로 기록됨
- [ ] AC3-4 이유 문장 “틀림” 0건, “이해됨” ≥ 80% [제안]
- [ ] AC3-5 (AC-G10) NFR-01·02 기준선 값 기록

### Sprint 1B-4 — 측정 체계 (7일, DB 승인 후)

| # | 스토리 | 일 |
|---|---|---|
| 1B4-1 | 마이그레이션(`saved_looks`, `app_events`, `look_feedback`) + RLS → **QA 적용** + 교차 계정 E2E | 1.5 |
| 1B4-2 | 앱 이벤트 클라이언트(일괄 전송, 실패 시 버림, 개인정보 필드 차단) | 1.5 |
| 1B4-3 | Styling·Looks·Today에 저장 / 다른 코디 / 오늘 입음 / 엄지 평가 UI(FR-REC-05, FR-TODAY-04) | 2 |
| 1B4-4 | KPI 집계 SQL(저장률·만족도·스킵률·착용률, 엔진 버전별) + 문서 | 1 |
| 1B4-5 | 운영 적용 승인 요청 패키지(SQL, 롤백, 영향) + Claude B 핸드오프(계정 삭제·처리방침) | 1 |

**AC**
- [ ] AC4-1 (AC-G6) PRD 24.3 Phase 1B 이벤트 중 추천 관련(`look_view`, `look_saved`, `look_skipped`, `look_worn`, `first_look_view`, `missing_item_view`)이 QA에서 기록된다
- [ ] AC4-2 저장한 코디가 계정에 남고 재로그인 후 다시 보인다(FR-REC AC④)
- [ ] AC4-3 다른 사용자의 `saved_looks`·`look_feedback`·`app_events`를 조회·수정할 수 없다(QA E2E)
- [ ] AC4-4 집계 SQL이 QA 데이터에서 저장률·만족도를 `score_version`별로 계산한다
- [ ] AC4-5 이벤트 `props`에 이메일·이름·사진 URL이 없다(단위 테스트로 차단)
- [ ] AC4-6 운영 DB 적용은 승인 후에만, 적용 결과는 1A-2 DB-1~5와 같은 형식으로 기록

---

## 8. 테스트 시나리오 (test-scenarios)

**출처:** 7장 AC · **총 18개** · 범위: 정상 / 경계 / 오류 / 보안 / 성능

| ID | 시나리오 | 대상 AC | 우선순위 | 자동화 |
|---|---|---|---|---|
| TS-01 | 고정 옷장 15벌: 같은 코디의 Match Score가 Styling·Looks·Today에서 같다 | AC2-1 | Critical | 단위 |
| TS-02 | Styling에서 셔츠 선택 → 베스트 코디 = Looks의 셔츠 포함 1위 | AC2-2 | Critical | 단위 |
| TS-03 | −3℃ 눈: Top 3에 실크·리넨·샌들·플랫 0개, 아우터 포함 | AC2-6 | Critical | 단위 |
| TS-04 | −3℃인데 옷장에 아우터 없음 → 코디는 보이되 “아우터 없음” Missing 안내, veto 아이템 미포함 | AC2-6 | High | 단위 |
| TS-05 | 비: 샌들·힐이 1순위에 없음(PRD FR-TODAY AC②) | AC2-6 | High | 단위 |
| TS-06 | 옷 2벌(상의 1 + 하의 1) → First Look 1개 이상, 오류 없음 | FR-REC AC② | High | 단위 |
| TS-07 | 빈 옷장·상의만 20벌·한 색만 → 예외 없음, 안내 문구 | AC2-8 | High | 단위 |
| TS-08 | 같은 입력 2회 → 같은 순위·점수, Top 3 아이템 조합 서로 다름 | AC2-8, FR-REC AC③ | High | 단위 |
| TS-09 | 이유 문장이 상위 지표와 일치, 존재하지 않는 아이템·속성을 언급하지 않음 | AC2-5 | Critical | 단위 |
| TS-10 | Dataset 규칙 1개 값 변경 → 해당 코디 점수만 바뀌고 `dataset_version` 기록 | AC2-4 | Medium | 단위 |
| TS-11 | Dataset 필수 필드 누락·앱에 없는 속성 값 → 변환 실패와 오류 목록 | AC1-1·1-2 | High | 스크립트 |
| TS-12 | 평가 스크립트: 알려진 정답 세트(완전 일치·완전 역순)에서 ρ = 1 / −1 | AC1-4 | High | 단위 |
| TS-13 | 보류용 세트 측정 결과가 버전과 함께 파일로 남음 | AC3-1 | High | 스크립트 |
| TS-14 | 옷 200벌에서 Top 3 ≤ 300ms(Node) | AC2-9 | Medium | 성능 |
| TS-15 | 코디 저장 → 재로그인 → 저장 목록에 그대로 | AC4-2 | High | QA E2E |
| TS-16 | 사용자 B가 A의 `saved_looks`·`look_feedback`·`app_events` 조회·수정·삭제 → 0건/거절 | AC4-3 | Critical | QA E2E |
| TS-17 | 익명 세션: 이벤트 추가만 가능, 저장 코디는 가입 후 같은 user_id로 유지 | AC4-1·4-3 | High | QA E2E |
| TS-18 | 이벤트 `props`에 이메일·사진 URL 넣으려 하면 클라이언트가 제거 | AC4-5 | High | 단위 |

**대표 시나리오 상세 — TS-03**

| 단계 | 행동 | 기대 결과 |
|---|---|---|
| 1 | 고정 옷장 + 날씨 {−3℃, snow} 로 `rankLooks` 호출 | 결과 1~3개 |
| 2 | 각 코디 아이템의 material·subCategory 확인 | silk·linen·sandals·flats 0개 |
| 3 | 각 코디 확인 | outer 1개 포함, 또는 Missing에 “아우터” |
| 4 | 표시 값 확인 | Match Score와 Weather Fit이 따로 있고 `vetoes`에 제외 이유 기록 |

**대표 시나리오 상세 — TS-16**

| 단계 | 행동 | 기대 결과 |
|---|---|---|
| 1 | QA에서 A·B 테스트 계정 생성, A가 코디 1개 저장 | A 조회 1건 |
| 2 | B 토큰으로 `saved_looks` 전체 조회 | 0건 |
| 3 | B가 A 행 id로 수정·삭제 | 0행 영향 |
| 4 | B가 user_id=A로 추가 | RLS 거절 |
| 5 | 정리 | 테스트 행 삭제 |

### 커버리지

| 요구 | 정상 | 경계 | 오류 | 보안·성능 |
|---|---|---|---|---|
| 통합 점수(AC-G5) | TS-01·02 | TS-06·07·08 | — | TS-14 |
| 날씨 규칙 | TS-05 | TS-03·04 | — | — |
| 이유 문장 | TS-09 | — | — | — |
| Dataset | TS-10 | — | TS-11 | — |
| 평가 세트 | TS-12·13 | — | — | — |
| KPI·저장 | TS-15·17 | — | — | TS-16·18 |

### 테스트 데이터

- 고정 옷장 15벌(있음) + 평가용 3종 + 극단 옷장 4종(1B-1에서 작성)
- 날씨 5종(있음: 없음·−3℃ 눈·17℃·31℃·14℃ 비) + 경계(5℃·15℃·22℃·27℃)
- 평가 세트 ≥ 40코디 + PO 라벨
- QA 계정·실사진 20~30벌(QA 프로젝트만)

---

## 9. 승인 요청 (PO 결정 필요)

| # | 결정 | 권장안 | 영향 |
|---|---|---|---|
| **D-1** | Dataset CSV 제공·저장소 추가 | PO가 시트별 CSV로 내보내 `data/fkd/v0.1/`에 추가 허락(또는 Numbers 내보내기를 Claude가 다시 시도하도록 허락 — 확인 대화상자 처리 필요) | 없으면 1B-1 시작 불가. 원본 `.numbers`는 계속 Git 밖 |
| **D-2** | Dataset 저장 위치 | 1B는 앱 번들 JSON, Supabase 테이블은 Phase 3 | “배포 없이 규칙 변경”은 1B에서 안 됨 |
| **D-3** | 전문가 평가자와 분량 | 대표자 1명 40코디 + 가능하면 2명째 20% 중복 | 평가자 1명이면 일치도 해석에 한계 명시 |
| **D-4** | 실사진 옷장·내부 옷장 검증 범위 | QA 계정 + 동의한 내부 인원만, 운영 실사용자 데이터 미사용 | 표본 작음 |
| **D-5** | 날씨 부적합 처리 | 하드 veto + Missing 안내(현재 “되돌아오기” 제거) | 옷장이 작으면 Today 코디 수가 줄 수 있음 |
| **D-6** | KPI 테이블(운영 DB 변경) | QA 적용·검증 후 운영 적용을 **별도 승인** | 1B-4 일정. 승인 없으면 1B-4는 QA까지만 |
| **D-7** | Today 점수 표기 | Match Score와 Weather Fit 분리 표시(PRD 기준), 기존 0.7/0.3 합산 점수 제거 | 화면 숫자가 바뀜 |
| **D-8** | Gemini 모델 비교 실험(분석 정확도·비용) | 1B-1에 평가 세트 기반 **실험만**(무료 한도 안), 모델 변경은 결과 보고 후 별도 승인 | 한도 소진 시 지연 |

## 10. 위험과 대응

| 위험 | 대응 |
|---|---|
| Dataset 내용이 비었거나 앱 속성과 맞지 않음 | 1B-1 첫날 검증 보고서로 확인 → 부족분은 `legacy-code` 행으로 채우고 PO 보완 목록 |
| 평가 라벨 지연(PO 시간) | 평가 템플릿을 1B-1 둘째 날 전달, 라벨 전에도 엔진 개발(1B-2)은 진행 |
| 평가 세트 과적합 | 개발/보류 분리, 보류 숫자만 보고 |
| 점수 변화로 사용자 혼란 | Beta 전이라 영향 작음. 변경 이유 문서 + `score_version` |
| Gemini 무료 한도(KI-6) | 엔진 검증은 Gemini 없이 가능. 실사진 등록(1B3-2)만 영향 → 한도 초기화 시간에 맞춰 배치 |
| 계정 삭제·처리방침 연동(Claude B) | 1B-4 시작 시 테이블 목록 핸드오프, 운영 적용 전 Claude B 반영 확인 |
| 화면 테스트 도구 부재(PQ-4·5) | 엔진은 순수 함수로 두고 단위 테스트, 화면은 웹 빌드 확인 + 실기기 QA(B10) |

---

**요청:** 위 9장 D-1~D-8에 대한 결정과 함께 **Phase 1B 개발 시작 승인**을 요청합니다. 승인 전에는 코드 변경을 시작하지 않습니다.
