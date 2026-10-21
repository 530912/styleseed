# 대분류 `jumpsuit` 신설 · 세부분류 60개 · 독립 속성 — 앱 영향 분석과 구현 계획

- 작성: 2026-10-21 (Claude A, 추천엔진·Data Contract 담당) · 상태: **분석·계획.** PO 결정(2026-10-21): 1라운드 앱 대분류 7개 유지, Lab 8개 대분류는 연구 기준. **S0 완료 → 계약 0.2.0**(패키지 README 9장, `docs/handoff/knowledge-lab-app-mapping-0.2.md`). S1 이후는 승인 대기
- 확인한 것(읽기 전용)
  - 앱: `src/constants/clothingOptions.ts`, `src/types/index.ts`, `src/app/analyze.tsx`, `src/lib/clothes.ts`, `src/utils/{recommendation,outfitScore,weatherRecommendation,prototypeCore}.ts`, `src/app/{styling,shop,closet,item}.tsx`
  - 서버: `backend/server.js`(Gemini 분석 스키마·프롬프트)
  - DB: `supabase/migrations/20261017000000_baseline_clothes_rls_storage.sql`(운영 정의 기록본)
  - 계약: `data/fkd/contract/fkd-contract-v0.1.json`, `scripts/fkd/validate.mjs`, `data/round1/contract/product-catalog-v0.1.json`
  - Knowledge Lab(Claude C 작업 폴더, 커밋 안 된 상태): `docs/12-SUBCATEGORY-REVIEW.md`, `docs/subcategory/subcategory-draft.json`(2026-10-21)
- 결정 전제: 대분류 `jumpsuit` 신설과 세부분류 `jumpsuit`의 상위값 변경(dress → jumpsuit)은 PO 결정으로 받았다(Lab 문서 4장의 B안). 이 문서는 그 결정이 **앱에 언제·어떻게 반영되어야 안전한지**를 다룬다. 패션 분류의 최종 확정은 공동창업자

---

## 0. 결론

1. **지금 앱은 Lab 데이터를 실행 중에 읽지 않는다.** Lab에서 대분류를 바꿔도 앱·사용자 데이터·추천 결과는 바로 바뀌지 않는다. 영향은 ① Lab 내보내기를 엔진 기준선 측정에 쓸 때, ② 앱 분류 체계를 바꿀 때 생긴다.
2. **점프수트는 지금도 지원된다.** 단 `dress` 대분류의 세부분류로서다. 엔진은 `category === "dress"`를 "상의+하의를 대체하는 한 벌"로 처리하므로, 점프수트도 원피스처럼 신발·아우터와 조합된다.
3. **앱에 대분류 `jumpsuit`를 그냥 추가하면 깨진다.** 엔진의 12곳이 `dress`를 직접 비교한다. 그래서 점프수트가 상·하의를 대체하지 못하고, 엉뚱한 조합(점프수트+상의+하의)을 만들며, 완성도 점수가 떨어진다. 분석 화면은 모르는 대분류가 들어오면 수정 패널을 열 때 오류로 멈춘다.
4. **권장(1라운드):** 앱은 바꾸지 않는다. 계약의 기존 변환 칸으로 Lab 대분류 `jumpsuit`를 앱 값 `dress`로 변환해 표시한다(`app_supported = converted`, `app_value = dress`). 대신 계약에 "변환이면 앱 값 필수·유효" 규칙을 추가한다(패치 0.1.1).
5. **2라운드:** 엔진이 대분류 대신 **코디 슬롯(한 벌·상의·하의·레이어·신발·가방·액세서리)** 을 보도록 한 곳에 모은 뒤 앱 대분류 `jumpsuit`를 추가한다. 기존 `dress/jumpsuit` 저장 데이터는 슬롯 매핑으로 그대로 동작하므로 **DB 마이그레이션은 필수가 아니다**.
6. 세부분류 60개 중 신규 19개는 앱에 없는 값이다. 사진 분석이 만들 수 없고, 사용자가 고를 수도 없다. 그래서 지금 사용자 데이터에는 들어오지 않는다. 엔진에 쓰려면 앱 값으로 바꾸는 변환표(공동창업자 결정)가 필요하다.
7. 독립 속성은 **기장 → 소매 → 굽 높이 → 넥라인** 순으로 가치가 크다. 계약 0.2로 먼저 정의한다. 앱 저장(운영 DB 변경)은 전문가 규칙이 그 속성을 실제로 쓰는지 확인한 뒤에 한다.

---

## 1. 점프수트 지원 구조

### 1.1 현재 허용값

| 위치 | 대분류 | 점프수트 |
|---|---|---|
| 앱 상수 `clothingOptions.ts` | 7개: top·bottom·outer·dress·shoes·bag·accessory | `dress`의 세부분류 `jumpsuit` |
| Gemini 분석 스키마 `backend/server.js:515-587` | 같은 7개 enum | 세부분류 enum 41개 중 `jumpsuit` 있음, `romper` 없음 |
| 운영 DB `clothes` | `category text not null`, `sub_category text not null` — **값 제약 없음** | 어떤 문자열도 저장됨 |
| FKD 계약 | 대분류·세부분류 = 속성 사전 값(고정 목록 아님). 세부분류는 `parent_value` 필수, 의류의 대분류 ≠ 세부분류 상위값이면 `E_PARENT_MISMATCH` | `jumpsuit` 대분류 추가는 계약 구조 안에서 가능 |
| Round 1 상품 계약 | 앱 목록과 같음(테스트로 동기화 확인) | `dress/jumpsuit` |
| Knowledge Lab | 대분류 8개(앱 7 + `jumpsuit`), 세부분류 60개(기존 41 + 신규 19) | 신규 `romper`는 대분류 `jumpsuit`, 기존 `jumpsuit`는 아직 `dress` 아래(DB 미반영, 결정 대기) |

### 1.2 앱이 "한 벌 옷"을 처리하는 곳 (대분류를 직접 비교)

| # | 파일:줄 | 하는 일 | `category = jumpsuit`가 들어오면 |
|---|---|---|---|
| E1 | `recommendation.ts:31-39` `CATEGORY_PAIRS` | 함께 입는 카테고리 쌍(카테고리 점수 10) | 쌍 없음 → 5점(감점) |
| E2 | `recommendation.ts:186-202` `OUTFIT_CATEGORY_PLAN` | Styling: 기준 옷에 붙일 카테고리(dress → shoes) | 계획 없음 → **점프수트 단독**, Missing Item도 안 나옴 |
| E3 | `recommendation.ts:391` `getMissingItemSuggestion` | 빠진 원피스 제안 | 영향 없음(점프수트 제안 경로 없음) |
| E4 | `outfitScore.ts:192-200` `scoreFit` | 하체 쪽에 dress 포함 | 점프수트가 핏 비교에서 빠짐 |
| E5 | `outfitScore.ts:370-383` `getCompleteness` | dress면 상·하의 충족 | **완성도 1/3** → 총점 감점(완성도 계수 0.82 + 0.18c) |
| E6 | `outfitScore.ts:497-501` `OUTFIT_PLAN` | Looks: dress → shoes | 기본값 `top·bottom·shoes` → **점프수트 + 상의 + 하의** 조합 생성 |
| E7 | `outfitScore.ts:507-590` `getRankedLooksForItem` | 아이템 기준 코디(PLUS 구매 전 활용도 분석의 핵심) | "가방·액세서리처럼 상·하의에 더함" 분기 → **잘못된 조합**, PLUS 수치 왜곡 |
| E8 | `outfitScore.ts:603` `getRankedLooks` | 기준 옷 = top·bottom·dress | 점프수트가 기준 옷에서 빠짐 |
| E9 | `weatherRecommendation.ts:335` `getTodaysLooks` | 기준 옷 = top·dress | Today에서 기준 옷으로 쓰이지 않음 |
| E10 | `weatherRecommendation.ts:42-170` 날씨 규칙 | 세부분류 이름으로 선호·회피(mini-dress 더위 선호 등) | 영향 없음(세부분류 기준) |
| E11 | `prototypeCore.ts:181-201` Core 코디 | 슬롯 outer·top·bottom·shoes, 상·하의 없으면 dress | 점프수트가 Core 코디에서 빠짐 |
| E12 | `analyze.tsx:461-487` 분석 결과 수정 | `CLOTHING_SUBCATEGORIES[category].map` | **수정 패널을 열면 오류로 멈춤**(`undefined.map`) |
| E13 | `shop.tsx:54` | Missing 카테고리 유효성 | 점프수트 Missing은 무시 |
| E14 | `clothes.ts:500-505` 옷장 조회 | DB 값을 그대로 타입에 넣음(검사 없음) | 저장·조회는 됨 |

**현재(대분류 dress) 동작 확인:** 점프수트를 `dress/jumpsuit`로 저장하면 E2·E5·E6·E7·E8·E9 모두 원피스와 같은 경로를 탄다. 상의·하의를 대체하는 한 벌로 처리되고 Styling·Looks·Today·PLUS 결과도 정상이다. 점프수트만의 판단(바지 실루엣, 신발 궁합 차이)은 없다.

### 1.3 사진 분석이 점프수트·롬퍼·원피스를 구별하는가

| 항목 | 현재 |
|---|---|
| 프롬프트 | 세부분류 정의 없음(이름 목록만). "하단이 다리를 나누는가"라는 구분 기준이 없음 |
| 롬퍼 | 값이 없다. 롬퍼 사진은 `jumpsuit`·`mini-dress`·`shorts` 중 하나로 답할 수밖에 없다 |
| 대분류·세부분류 일관성 | 서버가 검사하지 않음 → `dress` + `jeans` 같은 어긋난 쌍이 이론상 가능(PRD FR-AI "분류 불일치 보정" 미구현) |
| 정확도 | **측정한 적 없음.** 평가용 사진 묶음이 없고 Gemini 무료 한도가 막혀 있다(KI-6) |

판단: 현재 앱이 원피스와 점프수트를 **구별할 수는 있다**(값이 있음). 다만 얼마나 맞히는지 모르고, 롬퍼는 구별할 수 없다.

### 1.4 화면·기능별 영향 요약

| 화면 | 지금(dress/jumpsuit) | 앱에 대분류 jumpsuit만 추가하면 | 슬롯 방식으로 추가하면(2라운드) |
|---|---|---|---|
| 분석·수정 | 정상 | 수정 패널 오류(E12), 구버전 앱이 새 서버 응답을 받으면 같은 오류 | 정상 + 서버가 세부분류로 대분류 보정 |
| Styling | 점프수트 + 신발(+아우터) | 점프수트 단독, Missing 없음(E2) | 정상 |
| Looks | 정상 | 점프수트+상의+하의(E6), 기준 옷 제외(E8), 완성도 감점(E5) | 정상 |
| Today | 정상 | 기준 옷 제외(E9) | 정상 |
| PLUS 구매 전 활용도 | 정상 | 잘못된 조합으로 "어울리는 옷 수" 왜곡(E7) | 정상 |
| Core 데모 | 원피스 대체 슬롯 | 제외(E11) | 정상 |

### 1.5 기존 저장 데이터 마이그레이션

- **권장안(1라운드, 앱 변경 없음):** 필요 없음.
- **2라운드(슬롯 방식):** 필요 없음. 슬롯 표에서 `dress/jumpsuit`와 `jumpsuit/jumpsuit`를 둘 다 "한 벌"로 보므로 옛 행과 새 행이 같이 동작한다.
- **선택 정리(별도 승인):** `update clothes set category = 'jumpsuit' where category = 'dress' and sub_category = 'jumpsuit'`처럼 운영 DB를 바꾸는 작업이다. 앱 새 버전이 충분히 퍼진 뒤에만 한다. 구버전 앱은 이 행을 열면 E12 오류가 날 수 있다.
- 영향 받는 운영 행 수는 확인하지 않았다(운영 DB 접근 금지). 필요하면 **개수만 세는 읽기 전용 조회**를 별도 승인 후 실행한다.

---

## 2. 세부분류 60개 호환성

### 2.1 현재 지원 범위

| 구분 | 개수 | 앱 상수 | Gemini | DB | 엔진 |
|---|---|---|---|---|---|
| 기존 41개 | 41 | 있음 | 있음 | 저장 | 세부분류를 직접 쓰는 곳: 날씨 선호·회피 목록, Missing 제안, Shop 매칭(세부 40점), Core 규칙 아이템 |
| 신규 19개 | 19 | **없음** | **없음** | 저장은 가능(제약 없음) | 이름을 모르므로 날씨 중립 15점, Shop 매칭 0점, Core 0점. 그 밖의 계산은 대분류·색·핏·소재로 동작 |

### 2.2 신규 19개가 앱에 들어오는 경로

| 경로 | 지금 가능한가 | 결과 |
|---|---|---|
| 사용자 사진 분석 | 불가(Gemini enum에 없음) | 가장 가까운 기존 값으로 답함. 예: 폴로셔츠 → `shirt`/`tshirt`, 롬퍼 → `jumpsuit`/`mini-dress` |
| 사용자가 직접 수정 | 불가(선택지에 없음) | — |
| Lab 내보내기 → 엔진 기준선 측정(Claude A 스크립트, 미구현) | 가능 | 앱 값으로 변환하지 않으면 엔진이 모르는 값으로 계산 → **변환 규칙 필요** |
| Round 1 브랜드 상품 CSV | 불가(앱 목록만 허용, 테스트로 동기화) | 브랜드가 "롬퍼" 상품을 주면 가장 가까운 값 + 메모(안내서 4장) |

**기존 사용자 데이터 안전성:** 신규 세부분류는 사용자 데이터에 들어올 경로가 없다. 기존 41개 키는 Lab 수정안에서도 **유지**(Lab 원칙 5-3)되므로 기존 행이 무효가 되지 않는다. 위험은 Lab에서 기존 키의 **뜻**(범위)을 좁힐 때 생긴다. 예를 들어 `heels`·`flats`를 "다른 구조에 해당하지 않는 것"으로 좁히면, 사용자 데이터의 같은 키와 Lab 데이터의 같은 키가 서로 다른 범위를 뜻하게 된다. → 엔진 규칙에 반영할 때 이 차이를 버전으로 표시해야 한다.

### 2.3 여러 기준이 섞인 세부분류의 문제

| 섞인 기준 | 예 | 생기는 문제 |
|---|---|---|
| 기장 | mini/midi/maxi-dress, shorts, culottes | `shirt-dress`(구조)를 넣으면 기장 정보가 사라진다. 지금 날씨 규칙이 쓰는 `mini-dress` 선호를 잃음. 한 옷이 두 값에 해당 → 사람·AI 판정이 갈림 |
| 소매 | sleeveless, bustier-top, bodysuit | 소매가 없다는 것은 형태가 아니라 디자인 속성. 날씨 판단에 중요한데 유형과 섞이면 반팔·긴팔을 구분할 칸이 없음 |
| 굽 높이 | heels, flats vs mary-jane, mules, loafer | 메리제인 하이힐은 어느 값인가. 굽은 TPO·눈·비 판단에 중요한데 유형에 묻힘 |
| 휴대 방식 | shoulder/crossbody/tote/clutch vs bucket/hobo/belt-bag | 투웨이 가방 판정이 갈림. 형태(무드)와 휴대 방식(활동성)이 한 칸에 섞임 |
| 소재 | knit(상의), jeans | 소재 속성과 겹쳐 "니트 조끼", "데님 셔츠" 판정이 갈림 |

공통 결과는 세 가지다. ① 두 평가자의 판정이 갈려 일치도가 떨어진다. ② AI가 고를 기준이 없어 결과가 흔들린다. ③ 엔진이 기장·굽·소매를 따로 쓸 수 없다. ④ Missing·Shop 매칭이 세부분류 일치(40점)에 크게 의존해, 같은 옷도 이름이 다르면 매칭이 안 된다.
→ Lab 원칙 "세부분류 = 구조적 유형, 나머지는 속성"에 동의한다. 다만 **앱 키는 유지하고 범위만 좁히는 방식**이 기존 데이터에 안전하다.

---

## 3. 독립 속성 확장

### 3.1 지금 구조에서 가능한가

| 위치 | 현재 | 확장 방법 |
|---|---|---|
| FKD 계약 | `attribute_key`가 **고정 목록 13개**(category·subcategory·main_color·value·saturation·fit·silhouette·material·material_feel·thickness·season·tpo·mood). 소매·기장 등은 없음 | 계약 0.2(부 버전)에서 속성 키 + 의류 필드 추가. Lab이 임의로 추가하지 않음(Lab 문서 6장과 같은 판단) |
| 앱 타입 `Clothing` | 9개 속성만 | 선택 필드 묶음(`details?`)으로 추가 |
| 운영 DB `clothes` | 고정 열 11개, 확장 열 없음 | 권장: **`details jsonb` 한 열**(null 허용, 키는 계약에서 정의). 열을 속성마다 늘리면 마이그레이션이 매번 필요. **운영 DB 변경 승인 필요** |
| Gemini | 9개 속성 | 스키마에 선택 enum 추가(응답 토큰 소폭 증가). 정확도 측정 필요 |
| 수정 화면 | 9개 속성 | 새 속성은 기본으로 숨긴다(등록 부담 증가 방지). "자세히"에서만 수정 |

### 3.2 우선순위

기준: ① 코디 판단(조화·날씨·TPO)에 실제로 쓰이는가, ② 사용자 취향·Core 표현에 쓰이는가, ③ 사진에서 안정적으로 읽히는가, ④ 지금 세부분류 중첩을 풀어주는가.

| 순위 | 속성 | 코디 판단 | 취향·Core | 사진 판독 | 중첩 해소 | 판단 |
|---|---|---|---|---|---|---|
| 1 | **기장**(크롭·미니·무릎·미디·맥시·풀) | 상하 비율·실루엣(D-F01), 날씨 | 높음(Poetcore 미디 스커트 등) | 좋음 | mini/midi/maxi, shorts, culottes | **P1** |
| 2 | **소매**(없음·캡·반팔·7부·긴팔) | 날씨 적합도에 직접, 레이어링 | 중간 | 좋음 | sleeveless·bustier·bodysuit | **P1** |
| 3 | **굽 높이**(플랫·로우·미드·하이) | TPO(격식), 눈·비 회피, 실루엣 | 중간 | 보통(옆모습 필요) | heels·flats·mary-jane·mules | **P2** |
| 4 | **넥라인** | 상의·아우터 겹침(칼라 위 칼라), 얼굴 주변 균형 | 높음(로맨틱·클래식 무드) | 보통 | — | **P2** |
| 5 | **여밈 방식**(풀오버·앞여밈 단추·지퍼·랩) | **레이어 역할 판단**(4장) | 낮음 | 보통 | cardigan·vest·hoodie 집업 | **P2**(레이어 역할을 도입하면 P1) |
| 6 | **가방 구조적 형태**(정형·비정형) | 격식·무드 | 중간 | 좋음 | bucket·hobo | P3 |
| 7 | **신발 앞코**(라운드·스퀘어·포인티드·오픈) | 낮음 | 중간(무드) | 보통 | — | P3 |
| 8 | **가방 휴대 방식**(손·어깨·크로스·등·허리) | 활동성 TPO 정도 | 낮음 | 보통(착용샷 필요) | shoulder/crossbody/tote/belt | P3 |

**순서 제안:** P1·P2를 계약 0.2에 정의하고 Lab에서 전문가가 먼저 기록한다. 규칙과 평가 데이터에서 실제로 쓰이는 것이 확인되면 앱에 저장한다(2라운드). Round 1 BM 검증에는 필요하지 않다.

---

## 4. 카디건·베스트

| 질문 | 현재 앱 |
|---|---|
| 카디건·조끼가 아우터로 고정인가 | **예.** `cardigan`·`vest` 모두 `outer`의 세부분류(`clothingOptions.ts`). 엔진은 아우터로만 다룬다: Looks는 "아우터 있는/없는" 두 후보, Today는 쌀쌀할 때만 아우터 추가, 핏 비교에서 상체 쪽 |
| 결과 | 단추를 채워 단독 상의로 입는 카디건, 셔츠 위의 니트 조끼는 "상의"가 될 수 없다. 카디건 1벌 + 하의 + 신발 코디는 상의 없음으로 완성도가 감점된다 |
| 날씨 | 선선한 날 `cardigan` 선호, `padding`은 더울 때 회피. `vest`는 규칙 없음(중립) → 패딩 조끼와 니트 조끼가 같은 점수 |

### 4.1 니트·테일러드·패딩 베스트를 구별하는 데 필요한 데이터

| 구별 | 이미 있는 데이터 | 추가로 필요한 것 |
|---|---|---|
| 니트 베스트 | 소재 `knit` | (충분하지만 사용자 수정이 잦을 수 있음) |
| 테일러드 베스트 | 소재 `wool`·`polyester` 등, TPO `office`·`formal` | **구조 신호**: 넥라인(V넥·라펠)·여밈(단추) 또는 세부분류 분리 |
| 패딩 베스트 | 소재 `nylon`·`polyester` | **두께·충전재**: 계약의 `thickness`(있음, 앱 없음) 또는 세부분류 `padding`과의 관계 |

선택지(공동창업자 결정, 지금 변경하지 않음)
- **A. 세부분류 분리:** `knit-vest`·`tailored-vest`·`padded-vest`. 단순하지만 세부분류가 늘고, 소재 정보와 겹친다.
- **B. 속성 조합:** `vest` + 소재 + 두께 + 여밈·넥라인. 2장 원칙과 맞는다. 다만 P2 속성이 앱에 있어야 한다.

### 4.2 고정 대분류와 코디 속 레이어 역할을 분리할 수 있는가

**구조적으로 가능하다. DB 변경 없이 엔진 안에서 계산할 수 있다.**

| 개념 | 정의 | 저장 |
|---|---|---|
| 대분류(고정) | 제품이 무엇인가(Lab 원칙 5-5: 설계 기준, 실제 겹쳐 입었는지로 바꾸지 않음) | 지금처럼 `category` |
| 코디 슬롯(계산) | 코디에서 어떤 자리를 채우는가: 한 벌 / 상의 / 하의 / 중간 레이어 / 아우터 / 신발 / 가방 / 액세서리 | **저장하지 않고** 대분류 + 세부분류 + 속성으로 계산하는 매핑 표 하나 |

예: 카디건은 "중간 레이어"로 계산된다. 상의가 없으면 상의 자리를, 상의가 있으면 그 위의 레이어 자리를 채운다. 니트 조끼는 중간 레이어, 패딩 조끼는 아우터, 점프수트·원피스는 한 벌이다.
이 매핑 표가 1장의 E1~E11을 한 곳으로 모으는 것과 같은 작업이다. 그래서 **점프수트 지원과 레이어 역할 분리를 한 번의 엔진 정리로 처리**하는 것이 효율적이다. 레이어 규칙(어떤 옷이 어떤 자리를 채우는가)은 공동창업자 결정 X-1 이후에 넣는다.

---

## 5. 구현 계획

### 5.1 단계

| 단계 | 내용 | 바뀌는 것 | 승인 | 시점 |
|---|---|---|---|---|
| **S0** | 계약 패치 0.1.1: `app_supported = converted`이면 `app_value` 필수, `app_value`는 해당 `app_field`의 앱 허용값이어야 함(새 오류 코드 `E_APP_VALUE`). 앱 허용값 목록을 계약에 넣고 앱 상수와 동기화 테스트. Lab 대분류 `jumpsuit` 행 예시 추가 | `data/fkd/contract/*`, `scripts/fkd/validate.mjs`, 테스트, 전달 패키지 재생성 | 계약 변경 승인(PO) | 1라운드 가능(약 4~6h) |
| **S1** | 엔진 기준선 측정 스크립트가 Lab 내보내기를 앱 값으로 변환(`converted` → `app_value`, `no` → 측정 제외 + 사유) | 기준선 스크립트(미구현분) | — | 1라운드 G7 작업과 함께(약 2~3h) |
| **S2** | 엔진 코디 슬롯 매핑 함수 1개로 E1~E11 정리. **결과는 그대로**(엔진 스냅샷 동일) | `src/utils/outfitSlots.ts`(신규), `recommendation.ts`, `outfitScore.ts`, `weatherRecommendation.ts`, `prototypeCore.ts`, 테스트 | 앱 코드 변경 승인 | 2라운드(약 6~8h) |
| **S3** | 앱 대분류 `jumpsuit` 추가(세부 `jumpsuit` + `romper` 여부는 결정 후): 상수·타입·수정 화면 안전 처리(E12, 모르는 값은 "기타"로 표시) | `clothingOptions.ts`, `analyze.tsx`, 상품 계약 `app_lists` | 앱 배포 승인 | 2라운드(약 3~4h) |
| **S4** | Gemini: 대분류 enum + `romper`, 일체형 구분 정의를 프롬프트에, **서버에서 세부분류 → 대분류 보정** | `backend/server.js` | 백엔드 배포 승인, 정확도 측정용 Gemini 호출(유료 등급 또는 한도 분산) | 2라운드, **S3 앱이 배포된 뒤**(약 3~4h + 측정 4~6h) |
| S5 | (선택) 기존 `dress/jumpsuit` 행 정리 | 운영 DB | **운영 DB 변경 승인** | 앱 새 버전이 충분히 퍼진 뒤 |
| S6 | 독립 속성: 계약 0.2(P1·P2 정의) → Lab 기록 → 앱 `details jsonb` + Gemini 선택 필드 → 엔진 규칙 반영 | 계약, 운영 DB, 서버, 앱 | 각각 승인 | 계약 0.2는 1라운드 말 가능(4~6h), 앱은 2라운드(12~20h) |
| S7 | 레이어 역할 규칙(카디건·베스트) | S2의 매핑 표 | 공동창업자 결정 X-1 | 2라운드(4~6h) |

**배포 순서(호환성):** 앱(S2·S3, 새 대분류를 알고 모르는 값도 안전 처리) → 백엔드(S4, 새 대분류를 응답) → 선택 DB 정리(S5). 순서가 바뀌면 구버전 앱에서 E12 오류가 난다.

### 5.2 바뀌는 파일

| 파일 | S0 | S1 | S2 | S3 | S4 | S6 |
|---|---|---|---|---|---|---|
| `data/fkd/contract/fkd-contract-v0.1.json`(→ 0.1.1 / 0.2) | ● | | | | | ● |
| `scripts/fkd/validate.mjs`, `scripts/fkd/__tests__/fkd.test.mjs`, `docs/handoff/fkd-data-contract-v0.1/*` | ● | | | | | ● |
| 기준선 스크립트(신규, `scripts/fkd/`) | | ● | | | | |
| `src/utils/outfitSlots.ts`(신규) + `recommendation.ts`·`outfitScore.ts`·`weatherRecommendation.ts`·`prototypeCore.ts` + 엔진 테스트 | | | ● | | | ● |
| `src/constants/clothingOptions.ts`, `src/types/index.ts`, `src/app/analyze.tsx` | | | | ● | | ● |
| `data/round1/contract/product-catalog-v0.1.json`(동기화 테스트가 감지) | | | | ● | | |
| `backend/server.js` + 분석 테스트 | | | | | ● | ● |
| `supabase/migrations/*`(신규, `details jsonb`) | | | | | | ● |

### 5.3 데이터 호환성 위험

| # | 위험 | 심각도 | 대응 |
|---|---|---|---|
| R1 | 서버가 새 대분류를 먼저 응답 → 구버전 앱 수정 패널 오류(E12) | **높음** | 배포 순서 고정, S3에서 모르는 대분류 안전 처리 |
| R2 | 앱에 대분류만 추가하고 엔진을 안 고침 → 점프수트+상의+하의 조합, 완성도 감점, PLUS 수치 왜곡 | **높음** | S2를 S3보다 먼저 하거나 같이. 엔진 스냅샷 + 점프수트 케이스 테스트 |
| R3 | Gemini가 대분류·세부분류를 어긋나게 답함 | 중간 | S4에서 서버가 세부분류로 대분류 보정 |
| R4 | Lab 내보내기에 앱이 모르는 값(`jumpsuit` 대분류, 신규 19개) → 엔진 기준선 왜곡 | 중간 | S0 변환 규칙 + S1에서 미변환 값은 제외하고 사유 기록 |
| R5 | 기존 키의 범위를 좁힘(heels·flats·knit 등) → 같은 키가 사용자 데이터와 Lab에서 다른 범위 | 중간 | 키는 유지, 계약 값 `version` 증가, 엔진 규칙에 버전 표시 |
| R6 | 일체형이 두 대분류(dress·jumpsuit)에 나뉜 과도기 | 낮음 | 슬롯 매핑이 둘 다 "한 벌"로 처리 |
| R7 | Lab에서 `jumpsuit` 대분류보다 `romper`·`jumpsuit` 세부분류를 먼저 확정 → 내보내기 `E_PARENT_MISMATCH` | 낮음 | 확정 순서(Lab E-1) |
| R8 | 독립 속성 추가로 사용자 수정 부담 증가 | 중간 | 새 속성은 AI 자동, 기본 숨김 |

### 5.4 예상 작업 범위 (Claude A)

| 범위 | 시간 |
|---|---|
| 1라운드 안(S0·S1) | **약 6~9h**, 앱·DB 변경 없음 |
| 2라운드 점프수트 앱 지원(S2·S3·S4) | **약 16~22h** + 사진 정확도 측정 4~6h(점프수트·롬퍼·원피스·스코트·큐롯 혼동 세트 30~40장) |
| 독립 속성 P1·P2(S6) | 계약 4~6h + 앱·서버·DB 12~20h(규칙 반영 제외) |
| 레이어 역할(S7) | 4~6h(결정 후) |

---

## 6. Claude C(Knowledge Lab)에 요청할 데이터 계약 사항

| # | 요청 | 이유 |
|---|---|---|
| L-1 | 대분류 `jumpsuit` 속성 값을 `app_field = category`, **`app_value = dress`, `app_supported = converted`** 로 등록 | 앱이 대분류 jumpsuit를 지원하기 전까지 엔진·기준선이 한 벌로 처리 |
| L-2 | 세부분류 `jumpsuit`: `parent_value = jumpsuit`, `app_field = subCategory`, `app_value = jumpsuit`, `app_supported = yes` | 상위값만 바뀌고 앱 값은 그대로 |
| L-3 | `romper`의 앱 변환 값(후보 `jumpsuit`)은 **공동창업자가 정한 뒤** `converted`로. 그전에는 `no` | 패션 판단 |
| L-4 | 신규 19개 각각 `app_value` 변환 후보를 공동창업자 결정 칸으로 두고, 결정 전에는 `no` 유지 | 엔진에 들어가는 변환은 사람이 결정 |
| L-5 | 확정 순서: 대분류 `jumpsuit` → 세부분류 `jumpsuit`·`romper`(Lab E-1) | 내보내기 검증 통과 |
| L-6 | 소매·기장 등 새 속성 키는 Lab DB에 추가하지 말고 메모로 수집. **계약 0.2 배포 후** 가져오기 | `attribute_key`는 계약 고정 목록 |
| L-7 | 계약 0.1.1(`E_APP_VALUE`)이 나오면 `vendor/styleseed-fkd` 갱신 + Lab 검증에 같은 규칙 반영 | 같은 오류 코드 |
| L-8 | 기존 41개의 **키는 바꾸지 말고** 정의 범위만 좁히기. 범위가 바뀌면 값 `version` 증가 | 사용자 데이터 호환(R5) |
| L-9 | 카디건·베스트 위치(X-1)는 결정 전까지 현행 유지. 레이어 역할은 의류 속성이 아니라 엔진 계산으로 다룰 예정임을 공유 | 4.2 |
| L-10 | Lab 요청서 Q1~Q14 중 C-6(변환 규칙)은 S0로 답함. 나머지 답변은 별도 | 대기 중 |

## 7. 공동창업자 결정이 필요한 것

| # | 결정 |
|---|---|
| F-1 | 롬퍼를 앱에서 어떤 값으로 다룰지(앱 값 `jumpsuit`로 변환 / 앱에 `romper` 추가) |
| F-2 | 신규 19개의 앱 변환표(예: windbreaker → jacket, polo-shirt → tshirt 또는 shirt) |
| F-3 | 오버올(멜빵바지)의 위치 |
| F-4 | 카디건·베스트의 대분류(X-1)와 베스트 구별 방식(4.1 A/B) |
| F-5 | 독립 속성 우선순위(3.2) 채택 여부와 각 속성의 값 목록 |
| F-6 | 기존 키 범위 축소(heels·flats·knit·sleeveless) 여부 |

## 8. 하지 않은 것

- 앱·엔진·서버 코드, 운영·QA Supabase, 배포, Data Contract, Knowledge Lab 파일과 DB는 바꾸지 않았다.
- 운영 DB의 점프수트 행 수는 조회하지 않았다.
- Gemini 정확도 측정은 하지 않았다(무료 한도, 별도 승인).
