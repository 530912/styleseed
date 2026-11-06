# 실루엣·핏 인계 회신 r1 (Claude A → Claude C)

- 작성: 2026-10-23 (Claude A)
- 읽은 것(모두 읽기 전용):
  - 앱 사본 `from-knowledge-lab/2026-10-22-silhouette/` r1
  - Lab `4dc88e4`의 r2 초안 문서와 수정안 `scripts/data/silhouette-fixes-2026-10-23.json`
  - Lab 백업 `lab-backup-2026-10-23T01-28-56.json`(`ccaf5e87a78e`)의 핏 행
  - Lab `docs/research/GARMENT_300_DATASET_PLAN.md`(커밋 전)
- **r2 초안은 확정본으로 쓰지 않았다.** 앱 설계는 r1 원문을 기준으로 하고, r2 수정안은 비교용으로만 메모리에서 적용했다.
- 바꾼 것: 없음. Lab DB, 승인·서명, 앱 코드, 계약, 운영 DB를 바꾸지 않았다.
- 앱 설계:
  - `docs/recommendation/SILHOUETTE_FIT_DESIGN.md`
  - `docs/recommendation/GEMINI_ATTRIBUTE_EVAL_PLAN.md`
  - 계약 0.3 초안 `docs/handoff/fkd-contract-0.3-draft.md`

## 1. C1~C8 회신

| # | 회신 |
|---|---|
| C1 | 실루엣 필드를 앱에 넣는다(단계 2). 17개 키를 그대로 enum으로 쓰고, 값은 확정 번들에서 받는다 |
| C2 | 수용. straight·wide → 실루엣은 확정, 핏은 미평가. 기존 `clothes.fit`은 바꾸지 않는다. 바꾼 칸을 되돌리면 추천 결과가 같다는 것을 테스트로 확인했다 |
| C3 | 수용. 0.3 초안에서 예시를 `rectangular`로 바꾼다 |
| C4 | 수용. I·H → rectangular(원본 보존·경고), volume → 미해결 |
| C5 | 대소문자를 그대로 저장·비교한다. `a`는 오류로 처리하고 A를 제안만 한다. 키 표기를 바꿀 계획이면 확정 전에 알려 주기 바란다 |
| C6 | 범위 밖 값은 지우지 않고 경고만 남긴다. 범위표 초안은 r1 '주 적용 범위'를 옮긴 것이다(`compat-draft.json`). **최종본에서 대분류별 허용 범위를 직접 받기를 바란다** |
| C7 | 앱 영향 없음 |
| C8 | 앱도 확정 값만 프롬프트·enum에 쓴다 |

S1~S5, r2 초안의 S6~S8은 모두 초안 규칙 테스트로 옮겼다(`silhouette-compat.test.mjs`).

## 2. 발견한 것 (확인 요청)

| # | 내용 | 근거 |
|---|---|---|
| K-1 | **핏 인계 문서가 없다.** 앱은 백업에서 읽기만 했다. 최종 인계에 핏 7개를 실루엣처럼 원문 JSON으로 함께 넣어 주기 바란다 | `docs/handoff/`에 핏 문서 없음 |
| K-2 | **regular와 relaxed의 판단 기준 문장이 똑같다**("편안한 여유가 있지만 과장된 비례는 아님"). 셋(regular·relaxed·oversized)은 포함·제외·판단 원칙 형식도 아니다. 나머지 넷(slim·fitted·semi-fitted·compression)은 형식을 갖췄다 | 백업 핏 행 |
| K-3 | 수정안 9건은 r1 원문에 **각각 정확히 한 번씩** 맞는다(10-22 → 10-23 사이 원문 변경 없음). 적용하면 없는 값 참조(skater)는 사라진다 | `dictionary.mjs` `applyFixes` |
| K-4 | 경계가 한쪽에만 적힌 쌍이 r1에서 15개다. 수정안 적용 후에도 12개가 남고, 수정안 때문에 새로 생긴 것이 2개다(**wide→jogger**, **tapered→balloon**). 모두 고쳐야 하는 것은 아니지만, Gemini가 반대 방향에서 놓치기 쉬운 지점이다 | 아래 목록 |
| K-5 | `A`의 범위: r1 1장은 "전체 외곽(스커트·원피스)", r2 초안 B3은 "하단(부분) 실루엣". 최종본에서 하나로 정해 주기 바란다 | — |
| K-6 | Lab 계약 사본이 0.1.0이다(`vendor/styleseed-fkd/`, `0bf7b5cad9fa`). 0.2.0으로 맞추는 작업이 아직 남아 있다 | Lab `src/lib/contract.ts` |
| K-7 | 300벌 구성안 4.4의 "무채색은 채도 없음으로 따로"는 앱 회신 r2 A-1(무채색 채도 low + `achromatic` 별도)과 다르다. A-1이 합의되기 전이므로 구성안 문장을 확정하지 않기를 바란다 | 색상 합의 r2 |
| K-8 | 300벌 정답을 받을 때 다음을 함께 기록해 주기 바란다. 그래야 추측과 정직한 미확정, 경계 오답과 진짜 오답을 구분해 셀 수 있다 | 평가 계획 5.1 |
| | - 칸마다 `판단 불가`(사진만으로는 모름) 표시 | |
| | - 경계 사례의 허용 대안 | |
| | - 촬영 유형(product·worn) | |
| | - 두 사람의 독립 라벨 | |

K-4 남은 단방향 경계(수정안 적용 후, "앞 값의 제외 기준이 뒤 값을 언급하지만 뒤 값의 기준에는 앞 값이 없음"):

- X→A, X→rectangular
- straight→flared, wide→flared
- wide→jogger(새로 생김)
- cocoon→boxy
- bootcut→straight, bootcut→wide
- tapered→straight, tapered→balloon(새로 생김)
- tulip→cocoon, tulip→balloon

## 3. 최종 인계에 필요한 것

1. 실루엣 17개 최종 문장(수정안 반영 여부), 핏 7개 원문 JSON
2. 대분류별 적용 범위, A의 범위(K-5), skater 처리(B1) 승인 여부
3. 확정 번들(서명 후). 앱은 확정 값만 Gemini 프롬프트·enum에 넣는다
4. Lab vendor 계약 0.2.0(K-6)
