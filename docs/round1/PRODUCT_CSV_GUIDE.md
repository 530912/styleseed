# 브랜드 상품 정보 작성 안내 (STYLESEED 커머스 PoC)

- 대상: 협력 브랜드 담당자(여성복 2곳, 주얼리 1곳) · 전달: PO
- 양식 파일: `data/round1/products/templates/brands.csv`, `products.csv` (Google Sheets로 열어 작성 후 CSV로 내려받기)
- 작성 예시: `data/round1/products/examples/`
- 형식 원본: `data/round1/contract/product-catalog-v0.1.json` · 검사: `node scripts/round1/products.mjs <폴더>`

---

## 1. STYLESEED가 상품 정보를 쓰는 방식

| 항목 | 내용 |
|---|---|
| 용도 | 연구 참가자 18~20명이 쓰는 **실험용 앱**에서, 참가자 옷장에 빠진 아이템을 채울 상품으로 보여줍니다 |
| 기간 | 2026년 11월 연구 기간(보관·삭제 일정은 별도 안내) |
| 표시 | 상품명, 가격, 상품 이미지(허락하신 경우만), 브랜드명 |
| 이동 | 참가자가 누르면 **브랜드 공식몰 상품 페이지**가 열립니다. 앱 안에서 판매·결제하지 않습니다 |
| UTM | 허락하신 경우에만 링크 끝에 `utm_source=styleseed&utm_medium=app&utm_campaign=r1_bm_validation&utm_content=<상품ID>`를 붙입니다 |
| 주문 확인 | 동의하신 경우에만, 연구 기간 UTM(또는 쿠폰) 기준 주문 수를 알려 주시면 됩니다. 개인 주문 정보는 받지 않습니다 |

## 2. 브랜드 정보 (`brands.csv`, 1줄)

| 열 | 작성 |
|---|---|
| 브랜드 ID | 영문 대문자 2~4자(STYLESEED가 정해 드립니다) |
| 상품 정보 사용 허가 / 이미지 사용 허가 / UTM 허용 / 주문 확인 회신 | `yes` · `pending`(검토 중) · `no` |
| 허가 확인일·근거 | 예: `이메일 회신 2026-10-24` (담당자 실명·연락처는 적지 않습니다) |

## 3. 상품 정보 (`products.csv`, 상품 1개 = 1줄, 10~15개)

| 열 | 작성 방법 | 예 |
|---|---|---|
| 상품 ID | `브랜드ID-001`부터 순서대로 | `BRA-001` |
| 상품명 | 공식몰 표기 그대로(80자 이하) | 울 블렌드 싱글 코트 |
| 판매가(원) | VAT 포함 현재가, 숫자만 | `189000` |
| 판매 상태 | `on_sale` 판매 중 · `sold_out` 품절 · `discontinued` 판매 종료 | `on_sale` |
| 공식몰 상품 URL | `https://`로 시작하는 상품 페이지 주소. **utm 붙이지 않은 원래 주소** | |
| 상품 이미지 URL | 이미지 사용을 허락하신 경우 필수 | |
| 카테고리 / 세부 품목 | 아래 4장 목록에서 선택 | `outer` / `coat` |
| 색 / 색 톤 | 목록에서 하나 | `beige` / `muted` |
| 핏 | 목록에서 하나(액세서리는 비워도 됨) | `regular` |
| 소재 | 목록에서 하나(금속·원석 주얼리는 `other`) | `wool` |
| 계절 / TPO / 스타일 | 여러 개는 `|`로 구분(스타일은 최대 2개) | `fall|winter` |
| 속성 출처 | 브랜드가 적었으면 `brand` | `brand` |
| 속성 검수자 | 비워 두세요(STYLESEED 공동창업자가 검수) | |
| 정보 갱신일 | `YYYY-MM-DD` | `2026-10-24` |

## 4. 고를 수 있는 값

| 항목 | 값 |
|---|---|
| 카테고리 | top 상의 · bottom 하의 · outer 아우터 · dress 원피스 · shoes 신발 · bag 가방 · accessory 액세서리 |
| 세부 품목 | top: tshirt, shirt, blouse, knit, sweatshirt, hoodie, sleeveless / bottom: jeans, slacks, trousers, shorts, skirt, leggings / outer: jacket, coat, cardigan, blazer, padding, vest / dress: mini-dress, midi-dress, maxi-dress, jumpsuit / shoes: sneakers, loafer, boots, heels, sandals, flats / bag: shoulder-bag, crossbody-bag, tote-bag, backpack, clutch / accessory: hat, belt, scarf, necklace, bracelet, earrings, glasses |
| 색 | black, white, gray, beige, brown, navy, blue, red, pink, orange, yellow, green, purple, multi |
| 색 톤 | bright 밝은 · light 연한 · muted 차분한 · dark 어두운 · vivid 선명한 |
| 핏 | slim, regular, relaxed, oversized, straight, wide |
| 소재 | cotton, denim, leather, wool, linen, polyester, nylon, silk, knit, other |
| 계절 | spring, summer, fall, winter |
| TPO | casual 일상 · office 출근 · date 데이트 · formal 격식 · travel 여행 · party 파티 |
| 스타일 | minimal, classic, casual, street, sporty, feminine, vintage |

목록에 딱 맞는 값이 없으면 가장 가까운 값을 고르고 메모에 원래 표현을 적어 주세요(예: 색 `gray`, 메모 "실버").

## 5. 앱에 표시되지 않는 경우

- 상품 정보 사용 허가가 `yes`가 아닌 브랜드의 상품
- 판매 상태가 `on_sale`이 아닌 상품
- 형식 오류가 있는 줄(STYLESEED가 고쳐 달라고 요청드립니다)
- 공동창업자 검수에서 "이 옷장에 맞지 않는 상품"으로 판단된 상품(연구 품질 관리)
- 액세서리(주얼리)는 코디를 완성하는 "포인트 아이템" 영역으로만 보여 드릴 수 있습니다
