# Knowledge Lab 핏·실루엣 최신 자료 · Claude A 인계 (2026-10-23)

- 작성: Claude C. 받는 사람: Claude A (STYLESEED 앱).
- 기준: Lab 백업 `backups/lab-backup-2026-10-23T03-38-39.json` (sha256 `078c61402347`, 12:38 KST)
- 원문 사본: `knowledge-lab-fit-silhouette-2026-10-23.json` — 핏·실루엣 값 전체 원문(정의·판단 기준·예시·메모)과 핏 공통 판단 방법. 예시(example) 행 제외.
- 상태: 모든 값이 **제안**(서명 0건)입니다. 앱 코드와 Data Contract는 바꾸지 않았습니다. 실루엣 세부 검증·호환성 분석은 [실루엣 인계 r2](../2026-10-23-silhouette-r2/README.md)를 함께 보세요.

## 1. 이번에 반영된 것
- 실루엣 판단 기준·메모 9칸(S1·S2·P1~P4·W1~W3)을 담당자 승인 후 2026-10-23 11:17 KST에 반영했습니다. 12:38 백업에서 다시 대조해 9칸 모두 승인 문구와 같고, 그 뒤 실루엣 값에 다른 변경이 없음을 확인했습니다.
- 핏 값은 이번에 바뀌지 않았습니다. 핏 공통 판단 방법(1,502자)은 2026-10-22 15:31 KST에 E1이 저장한 것입니다.

## 2. 핏 (활성 7 · 폐기 2)

| 키 | 이름 | 출처 | 앱 지원(앱 값) |
|---|---|---|---|
| `slim` | 슬림 | 사람 | yes (slim) |
| `fitted` | 피티드 | 사람 | no |
| `regular` | 레귤러 | 사람 | yes (regular) |
| `relaxed` | 릴랙스드 | 사람 | yes (relaxed) |
| `oversized` | 오버사이즈 | 사람 | yes (oversized) |
| `semi-fitted` | 세미 피티드 | 사람 | no |
| `compression` | 컴프레션 핏 | 사람 | no |

| 폐기 키 | 이름 | 폐기 사유 |
|---|---|---|
| `straight` | 스트레이트 | 실루엣 섹션으로 이동 |
| `wide` | 와이드 | 실루엣 섹션으로 이동 |

- 공통 판단 방법 요지: 밀착도 순서 compression → fitted → semi-fitted → slim → regular → relaxed → oversized. 핏은 여유량·밀착도로 보고, straight·wide·A·flared 같은 외곽 형태는 실루엣에서 따로 봅니다. 근거가 부족하면 regular 등을 임의로 넣지 않고 추가 검토로 둡니다. (원문은 JSON `fit.common_guide`)

## 3. 실루엣 (활성 17 · 폐기 3)

| 키 | 이름 | 출처 | 앱 지원 |
|---|---|---|---|
| `A` | A라인 | 사람 | no |
| `X` | X라인 | 사람 | no |
| `straight` | 스트레이트 | 사람 | no |
| `flared` | 플레어 | 사람 | no |
| `wide` | 와이드 | Claude 초안 | no |
| `Y` | Y라인 | 사람 | no |
| `cocoon` | 코쿤 | 사람 | no |
| `balloon` | 벌룬 | 사람 | no |
| `mermaid` | 머메이드 | 사람 | no |
| `boxy` | 박시 | 사람 | no |
| `rectangular` | 렉텡귤러 | 사람 | no |
| `bootcut` | 부츠컷 | 사람 | no |
| `tapered` | 테이퍼드 | 사람 | no |
| `barrel` | 배럴 레그 | 사람 | no |
| `jogger` | 조거 | 사람 | no |
| `tulip` | 튤립 | 사람 | no |
| `circle` | 서클 | 사람 | no |

| 폐기 키 | 이름 | 폐기 사유 |
|---|---|---|
| `I` | I라인 | rectangular로 통합 |
| `H` | H라인 | rectangular로 통합 |
| `volume` | 볼륨 | 코쿤 및 벌룬 값으로 둥글게 부푼 실루엣을 세분화하기 위해 이 값 폐기 |

담당자 최종 원칙(2026-10-23):
1. circle = 허리부터 풍성하게 퍼지는 서클형. skater는 독립 값이 아닌 관련 쇼핑 명칭. 사진만으로 원형 재단이 불명확하면 상품 정보로 확인.
2. X는 상체·하단 폭 대비와 허리 수축이 **함께 뚜렷할 때만**. 상의와 스커트가 연결된 원피스라는 이유만으로 X가 아님.
3. 원피스·재킷·코트는 전체 외곽을 먼저 보고, X 조건이 아니면 A·flared·circle 등으로 판단.
4. 하의 다리통: wide(전체적으로 넓음) · tapered(점진적으로 좁아짐) · barrel(중간이 바깥으로 휘는 구조적 곡선) · balloon(원단이 부풀고 밑단이 모임) · jogger(발목 밴드·커프스로 모이는 밑단).

## 4. 앱 호환성에서 바뀐 것 없음 (요약)
- 앱 `CLOTHING_FITS`에는 아직 `straight`·`wide`가 있습니다. Lab은 이 둘을 핏에서 폐기하고 실루엣으로 옮겼습니다(D-F01 공동창업자 결정 전). 변환 시 실루엣만 정하고 **핏은 추측해 채우지 않는 것**을 권장합니다.
- 앱 핏에 없는 Lab 값: `fitted`·`semi-fitted`·`compression`(앱 지원 no).
- 앱에는 실루엣 필드가 없습니다(계약 `app_compat` 실루엣 = []). 계약 실루엣 예시값 `H`는 폐기된 값입니다.
- 남은 미결: X 예시 문장("피트 앤 플레어 드레스 → X")이 원칙 2와 어긋날 수 있어 담당자 결정 대기. `wide`(실루엣)의 출처가 아직 Claude 초안.
