# Knowledge Lab 분류 체계 인계(2026-10-22) — 앱 영향 검토와 통합 계획

- 작성: 2026-10-22 (Claude A) · 상태: **분석·비파괴 테스트만.** 앱 코드·운영 DB·Data Contract·Knowledge Lab 데이터는 바꾸지 않았다
- 받은 자료(Claude C 작업 폴더, 읽기만): `docs/handoff/KNOWLEDGE_LAB_TAXONOMY_HANDOFF.md`, `docs/handoff/knowledge-lab-taxonomy-2026-10-22.json`(스냅샷 `lab-backup-2026-10-22T02-47-25.json`, sha256 `c76e347f8c44`)
- 기준 코드: 앱 저장소 `9285f7d`(계약 0.2.0)
- 재현: `LAB_TAXONOMY_JSON=<위 JSON 경로> bash scripts/analysis/taxonomy-review-2026-10-22/run.sh`. 엔진을 임시 폴더에 컴파일한 사본과 모의 옷장, 계약 검증기만 쓴다
- Lab 분류는 **모두 제안 상태**(서명 0)라서, 이 문서의 결론도 공동창업자 확정 전 기준이다

---

## 0. 요약

| 구분 | 결론 |
|---|---|
| 지금 운영 앱 사용자에게 생긴 문제 | **없음.** 앱은 Lab 데이터를 실행 중에 읽지 않는다. 사진 분석·수정 화면은 앱 값 41개만 만든다 |
| Lab → 앱 연결(엔진 기준선·상품·향후 Dataset) | **막는 문제 1건(P0-1):** 대분류 `jumpsuit` 앱 매핑이 비어 있다. 계약 0.2.0 기준 오류 1건. Lab이 dress로 변환하면 오류 0(테스트 확인) |
| 앱 분류를 바꿀 때 바로 생기는 문제 | **P0-2, P0-3:** 대분류 `jumpsuit`를 앱에 그대로 넣으면 ① 분석 수정 화면이 오류로 멈추고 ② 점프수트+상의+하의 조합이 나온다. 1라운드에는 앱 대분류를 바꾸지 않으므로 지금은 발생하지 않는다 |
| 1라운드 품질 영향(P1) | 8건. 핵심은 세 가지다. ① 같은 키의 뜻이 Lab(좁음)과 앱(넓음)에서 다르다. ② 구조형 신규 값으로 라벨링하면 엔진 입력에서 빠진다. ③ Lab 안에서 판단 기준과 메모가 서로 다른 답을 준다(T-1~T-7) |
| 원피스와 상의·하의 중복 추천 | **없음.** Styling·Looks·Today 48개 코디 전수 검사에서 0건 |
| 독립 속성 | 1라운드 BM 검증에 **꼭 필요한 새 속성은 없다.** 연구용으로 기장·굽·소매를 먼저 정의한다(계약 0.3). 앱 반영은 2라운드 |

---

## 1. 현재 앱 분류 구조

### 1.1 앱 허용값

| 위치 | 대분류 | 세부분류 | 근거 |
|---|---|---|---|
| 앱 상수 | 7개(top·bottom·outer·dress·shoes·bag·accessory) | 41개 | `src/constants/clothingOptions.ts` |
| Gemini 분석 스키마 | 같은 7개 enum | 같은 41개 enum(대분류와 묶이지 않은 한 목록) | `backend/server.js:515-587` |
| 계약 0.2.0 `app_compat.app_values` | 같음(테스트로 동기화) | 같음 | `scripts/fkd/__tests__/app-compat.test.mjs` |
| 운영 DB `clothes` | `category text not null` — **값 제약 없음** | `sub_category text not null` — 제약 없음 | `supabase/migrations/20261017000000_baseline_clothes_rls_storage.sql` |
| 분석 결과 수정 화면 | 상수 7개 칩 | 고른 대분류의 세부분류 칩 | `src/app/analyze.tsx:461-487` |

### 1.2 Lab 최신 분류와의 차이 (Lab 63개 기준)

| 구분 | 개수 | 값 | 앱에서 |
|---|---|---|---|
| 같음(키·상위) | 40 | 앱 41개 중 `jumpsuit` 제외 | 그대로 |
| 상위만 다름 | 1 | `jumpsuit`(Lab 상위 jumpsuit, 앱 상위 dress) | 대분류 변환으로 해결(계약 9.3) |
| Lab 대분류만 있음 | 1 | `jumpsuit` | 앱 dress로 변환 |
| Lab 신규(10/21) | 19 | polo-shirt, bodysuit, bustier-top, culottes, skort, shirt-dress, slip-dress, windbreaker, cape-poncho, romper, mules, oxford-shoes, mary-jane, bucket-bag, hobo-bag, belt-bag, ring, hair-accessory, gloves | 앱 미지원 |
| Lab 담당자 추가 | 3 | knit-vest(top), tailored-vest(top), padded-vest(outer) | 앱 미지원 |
| **같은 키, 다른 범위** | 다수 | `sleeveless`(→ 탱크·캐미솔로 축소), `heels`(→ 펌프스), `vest`(→ 범용 베스트), `knit`(→ 풀오버 스웨터), `flats`, `jacket` 등 | 앱·Gemini는 넓은 뜻 그대로 |

### 1.3 사진 분석 → 저장 경로

```text
Gemini(responseSchema enum: 대분류 7·세부분류 41)
  → backend/server.js:748-777  JSON.parse 후 그대로 전달(대분류·세부분류 조합 검사 없음)
  → src/app/analyze.tsx:160-166 상태에 저장 → 사용자 수정(대분류 칩을 바꾸면 세부분류가 그 대분류의 첫 값으로 초기화)
  → analyze.tsx:240-252 저장 값 = 수정 값 ?? 분석 값
  → src/lib/clothes.ts:408-425 clothes.insert({ category, sub_category, ... }) 검사 없이 저장
  → src/lib/clothes.ts:500-505 조회 시에도 검사 없이 타입에 넣음
```

- 분석은 앱 41개 밖의 값을 **만들 수 없다.** 뮬·메리제인·니트 베스트 같은 Lab 신규 유형은 가장 가까운 앱 값으로 답한다(예: 니트 베스트 → `outer/vest`).
- 서버는 대분류·세부분류가 서로 맞는지 보지 않는다. Gemini가 어긋난 쌍(예: `top` + `jumpsuit`)을 주고 사용자가 고치지 않으면 그대로 저장된다. **실측은 하지 않았다**(Gemini 호출 없음, 코드 확인).
- 색 톤(`colorTone`)은 분석·저장되지만 **화면에서 고칠 수 없고 엔진도 쓰지 않는다**(엔진 4개 파일에서 사용 0건).

### 1.4 기존 사용자 데이터

- Lab 변경은 사용자 데이터에 영향을 주지 않는다(실행 중 연결 없음, DB 변경 없음).
- 다만 **같은 키의 뜻이 달라진다.** 사용자 데이터의 `sleeveless`·`heels`·`vest`는 넓은 뜻이고, Lab의 같은 키는 좁은 뜻이다. Lab 기준 규칙을 사용자 옷장에 적용하거나, 사진 분석 정확도를 Lab 정답과 비교할 때 이 차이가 오차가 된다(P1-1).
- 운영 DB의 실제 값 분포는 조회하지 않았다(운영 DB 접근 금지).

---

## 2. 신규 분류의 앱 호환성

| 항목 | 앱 현재 | 변환 시 결과(테스트) | 위험 | 권장(1라운드) |
|---|---|---|---|---|
| **점프수트** | `dress/jumpsuit`로 한 벌 처리. Styling: 점프수트+신발, Looks 92·88, 단독+신발 88 | Lab `jumpsuit/jumpsuit` → 앱 `dress/jumpsuit`(converted, 원본 보존). 코디 결과는 현재 앱과 같다 | 대분류 jumpsuit를 앱에 그대로 넣으면 Styling 단독, Looks 점프수트+티셔츠+청바지(83), 전체 Looks·Today에서 빠짐(E2) | Lab에서 대분류 jumpsuit = dress로 변환(P0-1) |
| **롬퍼** | 값 없음. 사진은 jumpsuit·mini-dress·shorts 중 하나로 분석됨 | 미지원 → 엔진 입력 **제외**(사유 기록). 앱 `jumpsuit`로 변환하면 오류 0 | 변환 시 "짧은 기장" 신호가 사라짐: 더위 적합도 mini-dress 100 vs jumpsuit 90(E6) | 공동창업자가 정할 때까지 제외. 변환하면 기장 속성 도입 전까지 감수 |
| **니트·테일러드 베스트** | 사진 분석은 `outer/vest` | Lab 상위 top이라 앱 vest로 변환하면 `E_APP_PARENT_MISMATCH`. 앱 `knit`(top)로 변환하면 오류 0 | 니트 베스트를 상의로 보면 셔츠 위 레이어가 상의 2벌로 계산됨. 아우터로 보면 Lab 정의와 다름 | 1라운드 미지원 유지(X-1 결정 전) |
| **패딩 베스트** | `outer/vest`(재질 nylon) | `padding`으로 변환 시 오류 0, 보온 규칙 적용. `vest`로 변환 시 날씨 규칙 없음 | 더위 적합도: 니트 vest 65, 나일론 vest 30, padding 15(E5) | 공동창업자 결정 |
| **뷔스티에·바디수트** | 사진은 sleeveless·top으로 분석 | 미지원(제외) | Lab상 top → 하의 필요(엔진 규칙과 맞음) | 미지원 유지. 변환 후보 `sleeveless`(앱 넓은 뜻 기준) |
| **스코트·큐롯** | 사진은 skirt·shorts·slacks | 미지원(제외) | 정면 사진에서 스커트처럼 보임(Lab 4.5). 큐롯은 판단 기준과 메모가 충돌(T-5) | T-5 정리 후 변환 후보 결정 |
| **셔츠·슬립 원피스 vs 미니·미디·맥시** | 원피스는 기장 3개 + jumpsuit | 구조형으로 라벨링하면 제외. 기장형은 exact(S3) | 정답이 둘(T-2·T-3). 값 하나로 정한 변환은 불가(기장이 의류마다 다름) | **1라운드는 기장 키를 앱용 대표값**, 구조형은 메모·연구 열 |
| **옥스퍼드·더비·로퍼·메리제인** | 로퍼만 있음. 나머지는 loafer·flats·heels로 분석 | 미지원(제외) | 더비가 들어갈 값이 없음(T-1). 굽 있는 메리제인이 flats로 분석되면 비 오는 날 회피가 빠짐 | T-1 정리. 굽 높이 속성은 2라운드 |
| **호보·토트·숄더·크로스백** | 숄더·크로스·토트·백팩·클러치 | 호보·버킷·벨트백 미지원 | 호보 숄더백 정답이 둘(T-4), 슬링백 위치 미정(T-7). 가방은 코디 점수에 거의 영향 없음(카테고리 점수 7, 날씨 계산 제외) | T-4·T-7 정리. 휴대 방식 속성은 2라운드 |

---

## 3. 추천엔진 영향 (실제 코드 + 모의 옷장)

| 질문 | 결과 | 근거 |
|---|---|---|
| 새 세부분류가 들어오면 정상 동작하는가 | **동작한다.** 예외 없음. 엔진 점수는 세부분류를 보지 않고(대분류·색·핏·소재·계절·TPO·스타일), 날씨 규칙에서는 모르는 값을 중립(15점)으로 본다 | E1: mules·knit-vest 옷장 Styling·Looks·Today 정상 |
| 지원하지 않는 분류의 안전 처리 | 세부분류는 안전. **대분류는 안전하지 않다:** 분석 수정 화면이 모르는 대분류에서 `undefined.map` 오류(E8), 엔진은 잘못된 조합(E2), Missing은 모르는 대분류를 받으면 `accessory/belt`를 제안(E7) | E2·E7·E8 |
| 굽 높이만 다른 같은 신발 유형 | **왜곡 있음.** 코디 점수는 모두 83으로 같다. 날씨에서는 `heels`만 비 회피(75), `flats`·`heels`만 눈 회피. 모르는 값(mary-jane·mules)은 비 90으로 오히려 heels보다 높다 | E4 |
| 원피스·점프수트에 상의·하의 중복 | **없음**(48개 코디 전수 0건). 단, 대분류 jumpsuit가 그대로 들어오면 발생 | E3, E2 |
| 카디건·베스트 레이어링 | **실제 착용과 다를 수 있다.** 카디건은 항상 아우터라 상의로 쓰지 못한다. 카디건+스커트+플랫은 Styling에서 "상의 없음"이 되고, 점수는 셔츠 조합 83 vs 카디건 조합 77이다. Looks는 상의 없는 스커트+플랫(81)도 코디로 보여준다. 날씨가 없는 Looks는 패딩 베스트를 아우터로 더한다 | E5 |
| 패션 코어·취향 | 코어 데모 규칙은 세부분류 이름 목록(POETCORE primary blazer·skirt·shirt·loafer)을 쓴다. tailored-vest·oxford-shoes·mary-jane은 앱 값이 아니라 코어 점수에 들어갈 수 없다. 취향 점수(옷장 분포)는 스타일·색만 본다 | `src/data/coreDemo.ts`, `src/utils/prototypeCore.ts`, `outfitScore.ts:306-367` |
| 잘못된 분류로 상품·Missing 누락 | Missing 제안은 앱 41개 안의 고정 값만 만든다(E7). Shop은 세부분류가 같아야 40점을 준다. 브랜드 상품을 가까운 값으로 태깅하면(상품 안내서 4장) 매칭은 되지만 원래 유형 정보가 사라진다. 앱 목록 밖 값은 상품 검증에서 오류로 카탈로그 생성이 멈춘다(누락이 아니라 차단) | `src/app/shop.tsx:64-90`, `scripts/round1/products.mjs` |

---

## 4. 독립 속성

| 구분 | 속성 | 설명 |
|---|---|---|
| **A. 앱에 있고 쓰임** | 색(`color`), 핏(`fit`), 소재(`material`), 계절(`season`), TPO(`tpo`), 스타일(`style` = 계약 mood) | 엔진 점수·날씨·코어에서 사용 |
| **B. 있지만 분석·추천에 쓰이지 않음** | **색 톤(`colorTone`)** — Gemini 분석·DB 저장되지만 엔진 사용 0, 수정 화면 없음 / 계약·Lab에만 있음: 명도·채도(D-F02 미확정), 실루엣(D-F01), 소재감, 두께감 / `box2d`(배경 제거에만), `mask`(요청 끔) | 실루엣·두께감은 연구 데이터로만 쌓임 |
| **C. 새로 필요** | 기장, 굽 높이(+굽 형태), 소매 형태, 여밈 방식, 넥라인, 가방 휴대 방식(여러 값), 가방 몸통 형태, 신발 앞코, **의류 구조/레이어 역할**(속성이 아니라 엔진 슬롯 계산) | Lab 4.4 |
| **D. 1라운드 불필요(2라운드 이후)** | C 전부의 **앱 구현**(DB 열·Gemini 필드·엔진 규칙). 1라운드에는 Lab 연구 기록만 | BM 검증(가격·커머스·사용성)은 이 속성 없이 진행 가능 |

**우선순위(2라운드 앱 반영 순서):**

| 순위 | 속성 | 이유 |
|---|---|---|
| 1 | 기장 | T-2·T-3 해소, 원피스 구조형 도입의 전제, 날씨(mini-dress·shorts) 신호 유지, 롬퍼 변환 손실 보완 |
| 2 | 굽 높이 | E4 왜곡(비·눈 회피), heels 범위 축소의 손실 보완, TPO |
| 3 | 소매 형태 | E6(민소매 블라우스 더위 100 → 90), 날씨 판단에 직접 쓰임 |
| 4 | 레이어 역할(엔진 슬롯) + 여밈 | E5 카디건 상의 처리, 베스트 3종 |
| 5 | 넥라인 | 코어·무드(로맨틱·클래식) |
| 6 | 가방 휴대 방식·몸통 형태, 신발 앞코 | T-4·T-7, 무드. 코디 점수 영향 작음 |

1라운드에는 **계약 0.3에서 기장·굽 높이·소매 형태를 연구 전용 속성으로 정의**하는 것까지만 권장한다(앱 필드 없음, Lab 기록만).

---

## 5. 문제 목록

### P0 — 다음 단계 전에 막아야 함 (현재 운영 사용자에게는 발생하지 않음)

| ID | 문제 | 파일 | 재현 | 영향 | 해결 |
|---|---|---|---|---|---|
| P0-1 | Lab 대분류 `jumpsuit` 앱 매핑이 비어 있어, 세부분류 `jumpsuit`가 앱으로 갈 상위 대분류가 없음 | Lab `attribute_values`(category/jumpsuit), 계약 README 9.3 | `run.sh` S1 → `E_APP_PARENT_MISMATCH:subcategory/jumpsuit` | 10/29 Lab 내보내기를 앱 검증기가 거부 → 엔진 기준선(S1)·상품 연동 불가. 우회하면 점프수트가 잘못된 조합으로 들어감(P0-3) | Lab에서 category / dress / converted(S2에서 오류 0 확인). 공동창업자 확인 후 Claude C |
| P0-2 | 분석 수정 화면이 모르는 대분류를 받으면 오류로 멈춤 | `src/app/analyze.tsx:478` | E8: `CLOTHING_SUBCATEGORIES["jumpsuit"].map` → TypeError | 서버(Gemini 스키마)나 DB에 8번째 대분류가 생기는 순간 수정 패널 오류. 구버전 앱 포함 | 1라운드에는 앱·서버 대분류를 바꾸지 않음(PO 결정). 2라운드 S3에서 모르는 값 안전 처리 + 배포 순서(앱 → 서버) |
| P0-3 | 대분류 jumpsuit가 그대로 엔진에 들어가면 상·하의 대체 판단 실패 | `outfitScore.ts:370-383,497-590`, `recommendation.ts:186-202`, `weatherRecommendation.ts:335` | E2: Looks `점프수트+티셔츠+청바지`, Styling 단독, Looks·Today 제외 | 잘못된 코디, PLUS 활용도 수치 왜곡 | 변환 규칙(P0-1)으로 차단. 2라운드에 엔진 슬롯 정리(S2) |

### P1 — 1라운드 추천 품질·사용자 테스트에 영향

| ID | 문제 | 파일 | 재현 | 영향 | 해결 |
|---|---|---|---|---|---|
| P1-1 | 같은 키의 뜻이 Lab(좁음)과 앱·Gemini(넓음)에서 다름(sleeveless·heels·vest·knit·flats) | Lab 정의·메모, `backend/server.js` 스키마 | E6: 민소매 블라우스를 Lab 기준 blouse로 라벨링하면 더위 적합도 100 → 90 | 전문가 평가 세트·AI 정확도 비교·날씨 규칙이 서로 다른 뜻으로 계산됨 | 1라운드 라벨링 규칙: **앱용 대표값은 앱(넓은) 뜻**으로, Lab 세부 유형은 연구 값으로 따로. 정확도 비교는 변환 후 앱 값 기준 |
| P1-2 | 구조형 신규 값으로 라벨링하면 엔진 입력에서 제외 | 계약 9.5, `scripts/fkd/app-compat.mjs` | S3: shirt-dress·mary-jane·knit-vest·romper → unsupported | Pilot·60개 세트·PLUS 검수에서 코디가 빠져 기준선 표본 감소 | 평가용 의류는 앱 지원값으로 고르거나, 공동창업자가 변환(converted)을 정함(romper → jumpsuit, polo-shirt → tshirt/shirt, windbreaker → jacket, padded-vest → padding 등) |
| P1-3 | Lab 판단 기준 ↔ 메모 모순(T-1~T-7) | Lab 인계 4.1 | 같은 제품에 정답 둘 | 두 평가자 일치도·AI 정확도가 의미 없어짐 | 10/29 서명 전에 담당자가 정리(Lab N-2) |
| P1-4 | 카디건을 상의로 쓸 수 없고, Looks가 상의 없는 코디도 보여줌 | `outfitScore.ts:370-383,597-657`, `recommendation.ts:186-202` | E5: 카디건+스커트+플랫 Styling "상의 없음", 77 vs 83 / Looks에 스커트+플랫(81) | 카디건을 상의로 입는 참가자 세션에서 추천 신뢰 저하 | 1라운드: 세션 진행안에 "상의 1벌 이상 등록" 안내, 관찰 기록. 2라운드: 레이어 역할(슬롯) |
| P1-5 | 사진 분석은 Lab 신규 유형을 가까운 앱 값으로 강제, 대분류·세부분류 조합 검사 없음 | `backend/server.js:515-587,748-777` | 코드 확인(Gemini 실측 안 함) | AI 정확도 측정 시 Lab 정답과 체계가 달라 대분류부터 틀린 것으로 집계(니트 베스트 outer/top) | 측정은 Lab 정답을 앱 값으로 변환한 뒤 비교. 조합 보정(세부분류 → 대분류)은 서버 변경이라 2라운드(승인) |
| P1-6 | Lab 인계 JSON에 계약 필수 필드 `attribute_ko`가 없음 | Lab `knowledge-lab-taxonomy-2026-10-22.json` | 그대로 검증하면 71행 모두 `E_REQUIRED` | 실제 내보내기도 같으면 가져오기 전체 실패 | Claude C가 내보내기 묶음에 `attribute_ko`가 있는지 확인(인계 사본만의 문제일 수 있음) |
| P1-7 | Lab 계약 사본 0.1.0, 앱 검증기 0.2.0이 더 오래된 부 버전을 **경고 없이** 받음 | `scripts/fkd/validate.mjs` `validateManifest`, Lab `vendor/styleseed-fkd/` | S12: manifest 0.1.0 → 이슈 0 | Lab 화면은 오류 0, 앱 가져오기는 오류 1 | Claude C 사본 0.2.0 갱신(Lab N-4). 오래된 부 버전 경고 추가는 다음 계약 변경 때 |
| P1-8 | 상품 CSV 안내가 "목록에 없으면 가까운 값 + 메모"로 계약 원칙(가까운 값 대체 금지)과 다름 | `docs/round1/PRODUCT_CSV_GUIDE.md` 4장, `data/round1/contract/product-catalog-v0.1.json` | 뮬·호보백·메리제인 상품 | Missing·Shop 매칭이 원래 유형을 잃음 | 상품 계약에 브랜드 원래 유형 칸 추가 + 앱 값은 변환 규칙과 같은 기준(변경 승인 필요) |

### P2 — 2라운드 이후

| ID | 문제 | 파일 | 재현 | 해결 |
|---|---|---|---|---|
| P2-1 | 굽 높이 미반영(코디 점수 동일, 날씨 회피는 heels·flats 키만) | `weatherRecommendation.ts:167-170`, `outfitScore.ts` | E4 | 굽 높이 속성 + 날씨 규칙이 속성을 읽도록 |
| P2-2 | 아우터 기준 Looks에 원피스 조합이 나오지 않음 | `outfitScore.ts:575-588` | E3: 카디건 기준 Looks에 원피스 false | 슬롯 정리 때 아우터+원피스 후보 추가 |
| P2-3 | Missing 제안이 모르는 대분류를 `accessory/belt`로 처리 | `recommendation.ts:308-416` 마지막 분기 | E7 jumpsuit → belt | 모르는 대분류는 제안 없음 |
| P2-4 | 베스트 종류별 날씨·레이어 차이 없음(재질로만 일부 차이) | `weatherRecommendation.ts` | E5 | 베스트 결정(X-1) 후 규칙 |
| P2-5 | 코어 규칙 목록에 Lab 신규 유형 없음 | `src/data/coreDemo.ts` | 코드 확인 | 신규 값을 지원할 때 코어 목록도 같이 |
| P2-6 | 롬퍼 → jumpsuit 변환 시 짧은 기장 신호 손실 | `weatherRecommendation.ts` | E6(90 vs 100) | 기장 속성 |
| P2-7 | 들어갈 곳 없는 품목(더비·크롭 팬츠·플립플롭·슬링백·레그웨어·세트업) | Lab 4.3 | — | 공동창업자 결정 |
| P2-8 | 색 톤을 분석·저장하지만 엔진 미사용·수정 불가 | `analyze.tsx`, 엔진 4개 파일 | 사용 0건 | 명도·채도(D-F02)와 함께 색 점수에 반영할지 결정 |
| P2-9 | Lab 메모 500자 한도 근접, 표기 오류(Lab 4.2) | Lab | — | Lab 담당자 |

---

## 6. 구현 우선순위

| 순서 | 작업 | 담당 | 바뀌는 것 | 승인 |
|---|---|---|---|---|
| 1 | P0-1 Lab 대분류 jumpsuit = dress 변환 | 공동창업자 확인 → Claude C | Lab 데이터 1칸 | Lab 데이터 변경 |
| 2 | P1-3 T-1~T-7 정리, 신규 19개 "내가 확인함" | Lab 담당자 | Lab 데이터 | — |
| 3 | P1-6·P1-7 Lab 계약 사본 0.2.0 갱신, 내보내기에 `attribute_ko` 확인 | Claude C | Lab 코드(사본) | Claude C 작업 승인 |
| 4 | P1-1·P1-2 1라운드 라벨링 규칙(앱용 대표값 = 앱 뜻, 연구 값 따로)과 변환 결정 목록 | 공동창업자 + Claude A(문서) | 문서 | — |
| 5 | S1 엔진 기준선 변환(변환 보고서의 앱 값만 사용, 제외 사유 기록) | Claude A | `scripts/fkd`(로컬 스크립트) | **S1 승인 대기** |
| 6 | P1-8 상품 계약에 원래 유형 칸 | Claude A | `data/round1/*`, 안내서 | 상품 계약 변경 승인 |
| 7 | P1-4 세션 진행안 보완(상의 1벌 이상 등록 안내, 카디건 착용 관찰) | Claude A | `docs/round1/SESSION_PROTOCOL.md` | — |
| 8 | 계약 0.3: 기장·굽 높이·소매 형태(연구 전용), 오래된 부 버전 경고 | Claude A | 계약 | 계약 변경 승인 |
| 9 | 2라운드: 엔진 슬롯(점프수트·레이어), 앱 대분류·Gemini 확장, 서버 조합 보정, 모르는 값 안전 처리, 속성 앱 반영 | Claude A(+B 배포) | 앱·서버·DB | 각각 승인 |

## 7. 하지 않은 것

- 앱 코드(`src/`·`backend/`), 운영·QA DB, Data Contract, Knowledge Lab 데이터·코드는 바꾸지 않았다.
- Gemini 실제 호출, 운영 DB 조회는 하지 않았다.
- 추가한 것: 이 문서와 재현용 분석 스크립트 `scripts/analysis/taxonomy-review-2026-10-22/`(엔진 사본을 임시 폴더에 컴파일해 실행).
