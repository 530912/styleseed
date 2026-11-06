# 핏·실루엣 분리(D-F01) 앱 도입 설계 r1

- 작성: 2026-10-23 (Claude A)
- 상태: **설계 초안.** Knowledge Lab 최종 인계 전이다. 앱 코드, DB, Gemini 프롬프트, Data Contract는 바꾸지 않았다.
- 같이 볼 문서:
  - Gemini 판단 기준 연결·300벌 평가: `GEMINI_ATTRIBUTE_EVAL_PLAN.md`
  - 계약 0.3 변경 초안: `docs/handoff/fkd-contract-0.3-draft.md`
  - Claude C 회신: `docs/handoff/knowledge-lab-silhouette-fit-reply.md`
- 초안 규칙과 테스트: `scripts/analysis/attribute-eval-2026-10-23/`
  - 호환 규칙 `silhouette-compat.mjs`, 설정 `compat-draft.json`
  - 엔진 회귀 테스트 `src/utils/__tests__/fit.silhouette.compat.test.mjs`

## 1. 인계 자료 확인 (2026-10-23 10시 기준)

| 자료 | 앱 저장소 사본 | Lab 최신 | 상태 |
|---|---|---|---|
| 실루엣 인계 | `from-knowledge-lab/2026-10-22-silhouette/` r1 (백업 `44391e798704`) | Lab `4dc88e4`의 r2 **초안**: 수정안 9건(S1·S2·P1~P4·W1~W3), **DB 미반영·승인 대기** | r1만 인계됨. r2는 Claude C 작업 중 → **확정본으로 쓰지 않음** |
| 실루엣 JSON(원문 17 + 폐기 3) | r1 사본 | Lab 파일과 바이트 단위로 같음 | 원문은 r1 그대로 |
| 핏 인계 | **없음** | 별도 인계 문서 없음. Lab DB에 활성 7개(제안), 폐기 2개(straight·wide) | 설계에는 Lab 백업 `lab-backup-2026-10-23T01-28-56.json`(`ccaf5e87a78e`)을 **읽기만** 해서 썼다. 사본은 저장소에 넣지 않았다 |
| 색상 인계 | 주색상 r1, 계약 요구 r1 | 새 문서 없음 | 앱 회신 r2(A-1~A-10) 합의 대기 |
| 세부분류 인계 | r2 (`c00a9a8e6bcc`) | 변경 없음 | — |
| 300벌 구성안 | 없음 | Lab `docs/research/GARMENT_300_DATASET_PLAN.md`(**커밋 전**, 제안) | 참고만 함 |

### 버전 차이

| # | 차이 | 영향 |
|---|---|---|
| V-1 | **Lab이 쓰는 계약은 0.1.0이다.** `vendor/styleseed-fkd/fkd-contract-v0.1.json`(`0bf7b5cad9fa`). 앱 계약은 0.2.0(`78311d5bc310`)이다. 인계 문서들은 0.2.0을 기준으로 쓰여 있다 | Lab 내보내기 번들의 `contract_version`이 0.1.0으로 찍힌다. 앱 0.2.0 검증기로 읽으면 `app_compat` 규칙이 없는 번들이 된다. 이전부터 남은 "vendor 0.2.0" 항목이 아직 처리되지 않았다 |
| V-2 | 실루엣 인계 r1(10-22 백업)과 r2 초안 수정안(10-23 백업)은 기준 백업이 다르다 | 수정안 9건을 r1 원문에 메모리에서 적용해 보니 9건 모두 정확히 한 번씩 맞았다. 그 사이 원문은 바뀌지 않았다 |
| V-3 | `A`의 적용 범위: r1 1장은 "전체 외곽(스커트·원피스)", r2 초안 B3은 "하단(부분) 실루엣" | 전체·부분 충돌 규칙이 달라진다. 최종본에서 확인해야 한다 |
| V-4 | 300벌 구성안 4.4: "명도 3 × 채도 3, **무채색은 채도 없음으로 따로**" | 앱 회신 r2 A-1(무채색 채도 = low)과 충돌한다. A-1이 합의되지 않은 상태다 |
| V-5 | 계약 0.2.0 `garments.silhouette.example = "H"` | H는 폐기된 값이다(Lab C3). 0.3 초안에서 바꾼다 |

## 2. 현재 앱 구조

| 층 | fit | colorTone | 실루엣 |
|---|---|---|---|
| 타입 `src/types/index.ts` | `Clothing.fit`, `ClothingAnalysis.fit`: `ClothingFit`(필수) | `ColorTone`(필수) | 없음 |
| 상수 `src/constants/clothingOptions.ts:68` | slim·regular·relaxed·oversized·**straight·wide** | 5개 | 없음 |
| DB `clothes` | `fit text not null`, CHECK 없음 | `color_tone text not null` | 없음 |
| 저장·조회 `src/lib/clothes.ts:417-419, 508-510` | 그대로 쓰고 그대로 읽음 | 같음 | — |
| Gemini `backend/server.js:610-624, 687-688` | enum 6개, **필수** | enum 5개, 필수 | 없음. 프롬프트에 속성 기준 문장 없음 |
| 분석 화면 `src/app/analyze.tsx:517-590` | 수정 가능(6개 중 선택) | 표시·수정 없음 | — |
| 저장 후 수정 | 없음(`item.tsx`는 사진만 교체) | 없음 | — |
| 엔진 | `outfitScore.ts:76` `FIT_VOLUME`(slim 1, regular·straight 2, relaxed·wide 3, oversized 4)로 상·하의 볼륨 차이 점수(가중치 0.16) | 쓰지 않음(회귀 테스트로 고정) | — |
| 계약 0.2.0 | `garments.fit` 필수, app_values 6개 | 필수 | `garments.silhouette` 선택, `attribute_app_fields.silhouette = []` |

관찰한 문제:

- **신발·가방·액세서리에도 fit이 저장된다.** Gemini 스키마가 fit을 필수로 요구하기 때문이다. 엔진 픽스처에서도 신발·가방이 모두 regular다. Lab 핏 정의는 몸과의 여유량이라서 이 의류들에는 해당하지 않는다.
- **엔진은 모르는 fit을 중립으로 보지 않는다.**
  - `FIT_VOLUME[알 수 없는 값]`이 undefined가 되어 차이가 NaN이 되고, 결과는 58점(가장 낮은 구간)으로 떨어진다.
  - fit을 비우거나 새 값(fitted 등)으로 바꾸면 추천 결과가 달라진다. 테스트로 고정했다.

## 3. 권장 데이터 구조

핏과 실루엣은 **별도의 두 칸**으로 둔다. 칸마다 값·상태·출처·사유를 둔다(색상 r2와 같은 형식).

| 칸 | 값 | 상태 |
|---|---|---|
| `fit` | Lab 핏 활성 키(지금 7개) | assessed · unrecorded · undeterminable(사유 필수) · not_applicable |
| `silhouette` | Lab 실루엣 활성 키(지금 17개) | 같음 + unresolved(폐기값 volume처럼 자동 변환 불가) |
| `*_source` | human · gemini · derived_from_legacy_fit · legacy_app_fit | — |
| `legacy_fit` | 기존 `clothes.fit` 원본 | 바꾸지 않음 |

- **not_applicable은 대분류로만 정한다.** 신발·가방·액세서리에만 쓰고, Gemini나 사람이 판단하지 않는다.
  - 색상 r2에서 multi에 not_applicable을 쓰지 않기로 한 것과는 다르다. multi는 색 특성이 있지만, 신발에는 '몸과의 여유량'이나 '의복 외곽' 속성이 없다.
- **실루엣은 1라운드에 한 칸(단일 값)이다.**
  - 이유:
    - 계약 `garments.silhouette`가 단일 enum이다.
    - 두 칸으로 나누면 라벨링 부담과 Gemini 출력이 두 배가 된다.
    - Lab r2 초안(B3)이 단일 값 우선순위 규칙을 이미 정하고 있다.
  - 전체·부분이 둘 다 보이는 의류는 아래 5장 규칙으로 하나를 고른다. 평가 실험에서만 Gemini의 2순위(`silhouette_runner_up`)를 받아, 두 칸이 필요한지 데이터로 판단한다.
- **대소문자를 바꾸지 않는다.** `A`·`X`·`Y`는 대문자 그대로 저장하고 비교한다. `a`는 오류로 처리하고 A로 제안만 한다(Lab C5·S3).

## 4. 기존 데이터·추천 결과 보존

### 4.1 원칙

1. **`clothes.fit`은 바꾸지 않는다.** 일괄 변환하지 않고, straight·wide도 그대로 둔다.
2. 새 칸은 읽을 때 계산하거나(단계 1), 새 열에 추가로 기록한다(단계 2). 원본은 `legacy_fit`으로 남는다.
3. **straight·wide → 실루엣은 확정, 핏은 미평가.** regular나 relaxed로 추측해 채우지 않는다(Lab C2, 색상 결정 3과 같은 원칙).
4. 엔진은 새 칸에서 기존 키를 다시 만들어 쓴다(`toEngineFit`).
   - 실루엣이 straight·wide이고 핏이 미평가이면 기존 straight·wide로 되돌린다.
   - 핏 6개 모두 왕복 시 같은 값이 되고, 추천 결과도 같다. 테스트로 확인했다.
5. **새 핏 값(fitted·semi-fitted·compression)은 엔진이 중립 처리를 갖춘 뒤에만 저장한다.** 그 전에 저장하면 위 2장의 58점 문제가 생긴다.

### 4.2 단계

| 단계 | 내용 | DB | 엔진 | 승인 |
|---|---|---|---|---|
| 0 (지금) | 초안 규칙과 테스트만 | 없음 | 그대로 | — |
| 1 | 앱에 호환 모듈(`src/utils/fitSilhouetteCompat.ts`) 추가. 조회할 때 `fit`을 새 칸으로 나눠 보기만 한다. 화면에는 아직 보이지 않는다 | 없음 | `toEngineFit`으로 기존 키를 그대로 씀 | Lab 최종 인계 + D-F01 |
| 2 | 마이그레이션 M-1(아래)로 새 열을 추가한다. Gemini가 silhouette을 출력한다(Claude B 인계). 새로 등록하는 옷은 새 칸과 기존 `fit`을 함께 저장한다 | 열 추가만, 기존 행은 null | 그대로 | PO(운영 DB) + Claude B |
| 3 | 엔진 볼륨 함수를 `fit` + `silhouette`로 바꾼다. 미평가·해당 없음은 중립(점수 제외) | 없음 | 변경(회귀 테스트를 의도적으로 갱신) | 공동창업자(규칙) + 평가 결과 |
| 4 | 화면에 실루엣 표시·수정, 저장 후 수정 | 없음 | — | PO |

- 단계 2에서 새 옷의 `fit` 열에는 계속 엔진이 아는 값(앱 enum 6개)만 쓴다.
  - **F-2(새 핏 값 → 엔진 볼륨 대응)가 결정되기 전에는 운영 Gemini의 핏 enum을 바꾸지 않는다.** 단계 2에서 새로 묻는 것은 실루엣뿐이다.
  - F-2가 정해지면 Gemini는 Lab 핏 키를 내고, 새 칸에 기록한다. `fit` 열에는 대응 규칙으로 바꾼 값(예: fitted → slim, 공동창업자 결정)을 쓴다. 같은 사진을 두 번 묻지 않는다.

### 4.3 마이그레이션 후보 (운영 적용 금지, 승인 대기)

| # | 내용 | 기존 행 영향 |
|---|---|---|
| M-1 | `alter table clothes add column silhouette text null, add column silhouette_status text null, add column silhouette_source text null, add column fit_v2 text null, add column fit_status text null, add column fit_source text null, add column attribute_rules_version text null` | 없음(모두 null = 미평가). RLS는 행 단위라서 정책을 바꿀 필요 없음. 기존 `fit`은 not null 그대로 |
| M-2 (선택) | 사진 없이 기존 `fit`에서만 계산되는 칸(straight·wide → silhouette)을 채운다. 출처 `derived_from_legacy_fit` | 원본 열은 바뀌지 않음. 읽기 계산(단계 1)으로 충분하면 하지 않는다 |
| M-3 (나중) | CHECK 제약(`silhouette_status in (...)`). 값 목록 CHECK는 넣지 않는다(Lab 값이 바뀔 수 있음) | 없음 |

- `fit_v2`라는 이름은 기존 `fit`과 뜻이 다르다는 것을 드러내기 위한 것이다. 계약·Lab 키와 맞추려면 단계 4에서 `fit`을 legacy로 바꾸는 대신, 새 열 이름을 `fit_assessed`로 하는 방안도 있다. PO가 결정한다.
- 마이그레이션은 QA 프로젝트에서 먼저 검증한다.

## 5. 대분류별 적용 범위와 전체·부분 충돌

### 5.1 적용 범위 (경고만, 지우지 않음)

- `compat-draft.json`의 `silhouette_scope`가 r1 1장 '주 적용 범위'와 C6을 옮긴 것이다. 의류 묶음은 pants·skirt·one_piece·outer·top이다.
  - 앱 점프수트(대분류 dress)는 다리통 실루엣을 함께 허용한다.
- Lab DB가 범위를 강제하지 않으므로 범위 밖 값은 지우지 않고 `W_SILHOUETTE_SCOPE` 경고만 남긴다. 예: 후드티에 jogger.
- 신발·가방·액세서리에 실루엣 값이 있으면 오류 `E_SILHOUETTE_NOT_APPLICABLE`이다.
- 범위표는 **Lab 최종본으로 다시 만든다.** 지금 표는 r1 문장을 Claude A가 해석한 것이다.

### 5.2 전체·부분 충돌 (r2 초안 B3 기준, 승인 대기)

| 경우 | 결정 |
|---|---|
| 원피스, 상체 폭 + 허리 수축이 함께 외곽을 이룸 | X 우선 |
| 원피스, 상체 특징 없이 하단 퍼짐만 | 하단 형태(A·flared·circle·mermaid) |
| 스커트·팬츠 | 그 의류 자체의 외곽 → 하단·다리통 값으로 바로 판단(X 우선 없음) |
| mermaid vs flared | mermaid |
| jogger vs tapered | jogger |
| boxy vs rectangular | 넓고 각진 비례가 뚜렷하면 boxy |
| 규칙이 없는 쌍(예: barrel vs balloon) | **정하지 않고** `conflict`로 사람 검토 |

- "상체 폭 + 허리 수축"은 사진에서 판단하는 시각 단서다. 평가 정답에는 이 단서를 따로 기록하지 않고, 정답 실루엣과 허용 대안(`acceptable`)만 둔다.

## 6. 앱 적용 시 변경 지점

| 파일 | 변경 | 담당 |
|---|---|---|
| `src/constants/clothingOptions.ts` | `CLOTHING_SILHOUETTES` 추가. 핏 목록은 단계 3 전까지 그대로 | A |
| `src/types/index.ts` | `ClothingSilhouette`, `AttributeCell<T>`, `Clothing.silhouette?`, `Clothing.fitAssessment?`, `ClothingAnalysis.silhouette?` (선택 필드로 추가 → 기존 코드 영향 없음) | A |
| `src/utils/fitSilhouetteCompat.ts`(새 파일) | `splitLegacyFit`·`toEngineFit`·`normalizeSilhouette`·`checkScope`를 초안에서 옮김 | A |
| `src/utils/taxonomyCompat.ts` | `normalizeAnalysisTaxonomy`와 같은 자리에서 실루엣을 정규화(alias·폐기값·대소문자) | A |
| `src/lib/clothes.ts` | 저장(417행 근처)·조회(508행 근처)에 새 열 추가. 열이 없는 DB에서도 동작하도록 조회는 `item.silhouette ?? null` | A |
| `src/app/analyze.tsx` | 실루엣 AttributeCard(대분류별 후보만 표시). 핏 후보에서 straight·wide를 빼는 것은 단계 3 | A |
| `src/utils/outfitScore.ts` | 단계 3: `FIT_VOLUME` → `getVolume(item)`(핏 + 실루엣, 미평가는 중립) | A, 규칙은 공동창업자 |
| `backend/server.js` | 스키마에 silhouette, 프롬프트 기준 문장, fit 비필수·not_applicable | **Claude B**(인계) |
| `supabase/migrations/` | M-1 | A 작성, 적용은 PO 승인 |
| `data/fkd/contract/fkd-contract-v0.1.json` | 0.3(초안 문서) | A, 승인 후 |
| 테스트 | 계약 app_values ↔ 상수 ↔ 서버 스키마 일치 테스트에 silhouette 추가 | A |

## 7. 호환성 위험

| # | 위험 | 대응 |
|---|---|---|
| H-1 | 기존 `fit`을 바꾸거나 비우면 추천이 바뀐다(58점) | 단계 3 전까지 `fit` 열은 쓰기 전용 호환 값. 회귀 테스트로 고정 |
| H-2 | straight·wide 하의를 regular로 채우면 볼륨이 3 → 2로 바뀐다(wide) | 채우지 않음. `toEngineFit`이 실루엣에서 기존 키를 다시 만든다 |
| H-3 | Gemini가 새 스키마에서 기존 필드(대분류·색 등)를 다르게 답할 수 있다 | 평가 팔 A0 vs A1로 확인(평가 계획 3장). 차이가 나면 단계 2를 보류 |
| H-4 | 프롬프트가 길어져 비용·지연이 늘어난다(문자 수 1,624 → 8,705) | 평가 계획 2장. 운영 적용 전에 실제 토큰을 측정 |
| H-5 | Lab 값 목록이 바뀌면 저장된 값이 폐기값이 된다 | 값 CHECK를 넣지 않는다. `normalizeSilhouette` 폐기값 매핑으로 읽고, `attribute_rules_version`을 기록 |
| H-6 | 앱 이전 버전이 새 열을 모름 | 새 열은 null 허용·선택이라 이전 버전도 저장된다(새 칸만 비어 있음) |
| H-7 | 신발·가방의 기존 fit(regular) | 원본은 보존하고, 새 칸은 해당 없음. 엔진은 지금처럼 원본을 쓴다(신발은 상·하의 볼륨 계산에 들어가지 않음) |

## 8. 결정이 필요한 것

| # | 내용 | 결정 주체 |
|---|---|---|
| F-1 | D-F01 확정: 핏 7개·실루엣 17개, straight·wide 이동 | 공동창업자 |
| F-2 | 새 핏 값 → 지금 엔진 볼륨 대응(fitted·semi-fitted, compression) | 공동창업자 |
| F-3 | 실루엣 한 칸(권장) vs 전체·부분 두 칸 | 공동창업자 + 평가 결과 |
| F-4 | 대분류별 적용 범위표, A의 범위(V-3) | Claude C 최종본 |
| F-5 | 신발·가방·액세서리의 fit을 not_applicable로 둘지(Gemini 스키마 변경) | PO + Claude B |
| F-6 | 새 열 이름(`fit_v2` vs `fit_assessed`) | PO |
