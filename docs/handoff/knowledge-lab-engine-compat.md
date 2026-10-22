# Knowledge Lab 분류 → STYLESEED 앱·엔진 호환 매핑 명세 (점프수트·롬퍼·베스트 3종)

- 작성: 2026-10-22 (Claude A) · 대상: Claude C, 공동창업자
- 구현: `src/utils/taxonomyCompat.ts`(호환 계층), 엔진 `src/utils/{recommendation,outfitScore,weatherRecommendation,prototypeCore}.ts`, 분석 화면 `src/app/analyze.tsx`
- 테스트: `src/utils/__tests__/taxonomy.compat.test.mjs`(23개), 기존 엔진 스냅샷 불변
- **Knowledge Lab 원본 분류는 바꾸지 않는다.** Lab 대분류(jumpsuit 포함 8개)와 각 세부분류의 Lab 상위값을 그대로 유지하고, 앱이 받는 쪽에서 변환한다
- 바꾸지 않은 것: Data Contract(0.2.0), Lab DB, 운영 DB·사용자 데이터, Gemini 분석 스키마(`backend/server.js`), 배포 버전

---

## 1. 두 단계로 나뉜 호환

| 단계 | 무엇을 정하나 | 기준 | 이번 변경 |
|---|---|---|---|
| ① 계약 내보내기 검증(Lab → 앱 데이터 가져오기) | 어떤 Lab 값이 **앱 지원 값**(분석·선택 목록 41개)인가 | Data Contract 0.2.0 `app_compat`(README 9장) | **변경 없음.** romper·베스트 3종은 계속 `no`(미지원) → 엔진 기준선 가져오기(S1)에서는 제외·사유 기록 |
| ② 앱·엔진 호환 계층(이 문서) | 앱에 어떤 값이 들어와도 **오류 없이, 옷의 실제 역할대로** 코디를 만드는가 | `taxonomyCompat.ts` | **신규.** 대분류는 앱 7개로 바꾸고, 세부분류는 원래 값을 보존. 엔진은 "코디 역할"로 판단 |

②는 "앱 목록에 넣었다"는 뜻이 아니다. 사진 분석·수정 선택지는 여전히 41개다. ②는 그 밖의 값이 들어왔을 때(Lab 데이터, 구버전·외부 데이터, 이후 확장) 안전하게 처리하는 장치다.

## 2. 매핑표

| Lab 대분류 / 세부분류 | 앱 대분류 | 저장·엔진 세부분류 | 앱 목록 대응값 | 상태 | 코디 역할 | 비고 |
|---|---|---|---|---|---|---|
| `jumpsuit` / `jumpsuit` | **dress** | jumpsuit | jumpsuit | converted | 한 벌(onePiece) | 앱 기존 지원값과 같음 |
| `jumpsuit` / `romper` | **dress** | **romper(유지)** | 없음 | preserved | 한 벌(onePiece) | jumpsuit·mini-dress로 **바꾸지 않음** |
| `top` / `knit-vest` | top | **knit-vest(유지)** | 없음 | preserved | **상의 겸 레이어(topLayer)** | 앱 vest(아우터)로 바꾸지 않음 |
| `top` / `tailored-vest` | top | **tailored-vest(유지)** | 없음 | preserved | **상의 겸 레이어(topLayer)** | 같음 |
| `outer` / `padded-vest` | outer | **padded-vest(유지)** | vest | preserved | 아우터 | 앱 목록 기준으로는 vest에 대응(아래 3.3) |
| 앱 41개 값(올바른 대분류) | 그대로 | 그대로 | 그대로 | exact | 대분류 그대로 | 기존 결과 불변 |
| 대분류는 앱 값, 세부분류는 모름(예: shoes / mules) | 그대로 | 그대로 | 없음 | preserved | 대분류 그대로 | 날씨 규칙은 중립 |
| 대분류를 정할 수 없음(예: foo / bar) | — | 그대로 | 없음 | **unsupported** | unknown | 코디에 쓰지 않음, 오류 없음 |

- **원본 보존:** 바뀐 값은 `taxonomySource`(원래 대분류·세부분류)에 남는다. DB에는 이 칸이 없지만, 세부분류에 Lab 값이 그대로 남기 때문에 `toLabTaxonomy()`로 Lab 분류를 되살릴 수 있다. 예: `dress/romper` → `jumpsuit/romper`, `dress/jumpsuit` → `jumpsuit/jumpsuit`, `top/knit-vest` → `top/knit-vest`.
- **중복 변환 안전:** 같은 값을 여러 번 넣어도 결과와 원래 값이 같다(테스트).
- **Lab 상위 우선:** 알려진 Lab 값이 다른 대분류로 들어오면(예: outer/knit-vest) Lab 상위(top) 기준으로 맞추고 메모를 남긴다.
- **새 분석 결과의 어긋난 쌍**(예: top + midi-dress)은 세부분류 기준(dress)으로 바로잡는다. **이미 저장된 데이터는 대분류를 그대로 믿는다**(기존 사용자 결과 불변).

## 3. 엔진이 역할을 쓰는 방식

### 3.1 한 벌 옷(원피스·점프수트·롬퍼)

- 상의·하의를 대체한다. 코디에는 신발, 필요하면 아우터만 더한다(Styling·Looks·Today·Core 모두).
- 추운 날 Today는 아우터를 더한다(레이어링 확인).
- 한 벌 옷 안에 상의를 받쳐 입는 이너 조합은 만들지 않는다. 중복 추천과 구별할 수 없어서다(4장 제약).
- Lab 대분류 jumpsuit 그대로 들어와도 앱 dress/jumpsuit와 **엔진 점수가 같다**(테스트).

### 3.2 니트·테일러드 베스트(topLayer)

- **상의 자리를 채운다.** 베스트 + 하의 + 신발이면 완성도가 1이다.
- **셔츠 위 레이어:** 베스트 기준 Styling은 안에 입을 상의를 더한다. Looks는 "베스트 단독"과 "셔츠 + 베스트"를 모두 후보로 보고, 셔츠 기준 Looks에도 베스트를 겹친 후보가 생긴다.
- **아우터로 추천하지 않는다.** 아우터 자리(추운 날 Today의 아우터 추가, Looks의 아우터 변형)에는 들어가지 않는다.
- 날씨(Claude 초안, 공동창업자 검토 필요): knit-vest는 knit과 같이 추운 날 선호·더운 날 회피. tailored-vest는 중립.

### 3.3 패딩 베스트

- 아우터 역할(Lab 상위 outer = 앱 outer)이다. 아우터는 한 코디에 1벌만 들어간다.
- **앱 목록 기준 outer/vest 대응: 대분류는 안전하지만 세부분류로 바꾸면 충전재 정보가 사라진다.** 그래서 저장·엔진 값은 `padded-vest`로 유지하고, 앱 목록이 필요한 곳(선택지 비교·상품 목록)에서만 `vest`를 대응값으로 쓴다.
- 날씨(Claude 초안): padding처럼 추운 날 선호·더운 날 회피. 테스트로 일반 vest보다 더위 적합도는 낮고 추위 적합도는 높게 나오는 것을 확인했다.

## 4. 앱 화면·데이터 처리

| 경로 | 처리 |
|---|---|
| Gemini 사진 분석 | **스키마 변경 없음(41개).** 응답을 받으면 `normalizeAnalysisTaxonomy`로 정리한다(대분류 jumpsuit → dress, 어긋난 쌍 보정, 원래 값 기록) |
| 분석 결과 수정 화면 | 세부분류 선택지는 `getSubcategoryOptions`. 앱 대분류가 아니어도 오류 없이 빈 목록을 보이고, 현재 값이 목록 밖(knit-vest 등)이면 그 값을 남겨 지워지지 않게 한다(이전 `undefined.map` 오류 해결) |
| Supabase 저장 | 앱 대분류 + 세부분류 원래 값을 저장한다(`category`·`sub_category`는 텍스트, 제약 없음). **DB 스키마·기존 행 변경 없음** |
| 옷장 조회 | 변경 없음. 엔진이 역할로 해석 |
| Missing Item·상품 | 제안은 앱 41개 값만 만든다. 신규 값이 있는 코디에서도 오류 없음(테스트). 상품 카탈로그 계약은 변경 없음(앱 값만) |

## 5. Claude C·공동창업자에게 요청

| # | 요청 |
|---|---|
| C-1 | Lab 원본(대분류 jumpsuit, knit-vest·tailored-vest 상위 top, padded-vest 상위 outer)은 **그대로 유지** |
| C-2 | 계약 내보내기 매핑은 지금처럼: 대분류 jumpsuit = `category/dress/converted`(지침 0.2 2장), romper·베스트 3종 = `none/no` |
| C-3 | knit-vest·tailored-vest를 계약에서 `converted → vest`로 바꾸지 말 것(앱 vest는 아우터, `E_APP_PARENT_MISMATCH`). padded-vest를 `converted → vest`로 바꾸면 계약상 통과하지만 충전재 정보가 사라지므로, 계약 0.3에서 "역할 보존" 표시를 정할 때까지 `no` 유지를 권장 |
| C-4 | 날씨 규칙 초안(knit-vest = knit과 같음, padded-vest = padding과 같음, tailored-vest = 중립)을 공동창업자가 검토 |
| C-5 | 롬퍼의 기장(짧음) 신호, 베스트의 레이어 역할은 독립 속성(기장)·레이어 규칙이 생기면 그쪽으로 옮김 |

## 6. 남은 제약

- 사진 분석(Gemini)은 여전히 41개 값만 출력한다. 롬퍼·베스트 3종을 사진에서 직접 인식하려면 서버 스키마 변경·정확도 측정·배포가 필요하다.
- `taxonomySource`는 DB에 저장되지 않는다(열 없음). 점프수트·롬퍼·베스트는 세부분류로 되살릴 수 있다. 새 분석의 어긋난 쌍을 보정한 경우 원래 쌍은 저장 후 남지 않는다.
- 계약 단계(S1 기준선)에서는 romper·베스트 3종이 여전히 제외된다. 엔진은 처리할 수 있지만 계약은 바뀌지 않았다. 계약 0.3에서 "역할 보존(preserved)" 개념을 추가할지 결정이 필요하다.
- 한 벌 옷 안의 이너 레이어, 카디건을 상의로 쓰는 경우는 지원하지 않는다(X-1 결정 대기).
- 분석 화면 변경은 타입 검사·단위 테스트로만 확인했다. 시뮬레이터·실기기 화면 확인은 하지 않았다.
