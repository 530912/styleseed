# Sprint 1A-3 결과 — 핵심 기능 품질 안정화

- 작성: 2026-10-19
- 브랜치: `sprint/1a-3` (기준 커밋 `835681e`, Sprint 1A-2 최종 QA). **로컬 커밋만, Push 안 함**
- 범위: A. SlimSAM 분리 품질(KI-1) · B. 업로드 이미지 최적화(KI-9) · C. Gemini 효율 · D. 회귀 테스트
- 손대지 않은 것(Claude B 담당): 계정 삭제·웹 삭제 요청 페이지, 개인정보처리방침·이용약관, EAS·스토어 설정, Railway·클라우드 배포, TestFlight·Google Play, Dockerfile·인프라
- 운영 DB 변경 0건, Secret 변경 0건, 유료 API 전환 0건, Gemini 모델 변경 0건, 실제 사용자 데이터 접근 0건

## 1. 판정 요약

| 항목 | 판정 | 근거 |
|---|---|---|
| A. KI-1 흰 셔츠 단추만 남는 결함 | **Confirmed 해결** | 평가 세트 7장 실제 모델 통과(`npm run test:quality`), QA E2E-09 일반 테스트로 통과, 결과 PNG 육안 확인 |
| A. 품질 미달 시 저장하지 않고 BRIA로 대체 | **Confirmed**(서버 422) / 앱 대체 경로는 코드 확인 | 품질 미달 테스트(배경 상자 → 422 `LOW_QUALITY_CUTOUT`). 앱은 `apiPost`가 비정상 응답을 모두 예외로 던지고 `saveClothingToSupabase`가 BRIA로 넘어감(기존 경로, 화면 확인은 안 함) |
| A. 기존에 잘 되던 이미지 품질 유지 | **Confirmed** | 스니커즈·로퍼·데님 상자 채움 이전과 같거나 높음(2장 표) |
| B. KI-9 실제 휴대폰 사진 10MB 초과 | **Confirmed 해결(웹)** | 10.79MB·EXIF 회전 6 사진 → 1200×1600, 254KB, 분석 본문 0.33MB(이전 약 14.4MB → 413) |
| B. 실기기 HEIC·EXIF·처리 시간 | **Not Tested** | 실기기 없음 → PQ-8(B10) |
| B. 단계별 성능 측정 | **부분 Confirmed** | 계측 코드 반영(`[perf]` 로그, 개발 빌드만). 사진 준비·SlimSAM 측정 완료. 분석(Gemini 한도), 앱 저장 단계(원격 계정 비밀번호 입력 불가)는 **Not Tested** |
| C. 미사용 `mask` 출력 제거 | **Confirmed(요청 형식)** | 단위 테스트: 기본 요청에 mask 스키마·지시 없음, 응답 `mask: []` 유지 |
| C. 토큰 절감·속성/상자 정확도 동일성 | **Not Tested** | Gemini 무료 한도 소진(KI-6, 1A-3 중 429). 비교 스크립트 준비 완료 → KI-11 |
| C. 모델 후보·비용 비교 | **문서 Confirmed / 품질 Not Tested** | 3장. 모델·결제 설정은 바꾸지 않음 |
| D. 사진 등록 → 분석 → 옷장 저장 | **Confirmed(서비스 단계)** | QA E2E 3개 묶음 26/26 통과(분석은 Gemini 한도로 대체 분석값 사용) |
| D. Styling / Looks / Today's Look | **Confirmed(엔진)** | 엔진 기준 스냅샷 신설, 엔진 코드 변경 0건으로 결과 동일. 화면 확인은 PQ-2 그대로 |
| D. 이미지 오류·예외 처리 | **Confirmed** | 413·422·403·404·429 경로 테스트, 사진 준비 실패 알림 |

## 2. A. SlimSAM 분리 품질 (KI-1)

### 2.1 진짜 원인

이전 분석(“중심 점이 단추 위에 놓임”)은 절반만 맞았다. **SlimSAM ONNX 모델은 `input_boxes`를 무시한다**
(transformers 경고 `Too many inputs (5 > 4) ... input_boxes ignored`). 상자를 보내도 실제로는 **중심 점 하나**로만 분리하고 있었다.
상자 모서리 점(label 2/3)도 시험했으나 배경이 크게 번져 쓸 수 없었다.

### 2.2 바꾼 방식 (`backend/cutout.js`, `backend/server.js`)

1. 상자 안 양성 점 5개(가운데 + 네 사분면)로 모델 실행
2. 후보 마스크 3개 중 **상자 밖 비율 ≤ 15%** 인 것 가운데 **상자 채움이 가장 큰 것** 선택(채움 차이 2%p 이내면 모델 IoU가 높은 쪽)
3. 상자 채움 < 25% 또는 상자 밖 > 20% → 중심 점 하나로 재시도
4. 그래도 미달 → **422 `LOW_QUALITY_CUTOUT`** (저장하지 않음, 앱은 BRIA로 대체)
5. 이미지 면적 0.3% 이하이면서 테두리에 닿지 않는 구멍 메우기(단추·칼라 사이)
6. 원본을 한 번만 받고 `sharp().rotate()`로 EXIF 방향 보정 후 분리

“처리 성공(HTTP 200)”과 “분리 품질(상자 채움·상자 밖 비율)”을 따로 판정하고, 품질 지표를 응답 헤더 `X-Cutout-*`와 서버 로그에 남긴다.

### 2.3 이전/이후 (평가 이미지 7장, 실제 모델·실제 경로)

| 이미지 | 이전 상자 채움 | 이후 상자 채움 | 이후 상자 밖 | 비고 |
|---|---|---|---|---|
| white-shirts | **0.0003** (단추만) | **0.706** | 0 | 구멍 41개 메움, 단추·칼라·소매 보존 육안 확인 |
| white-sneakers | 0.786 | 0.786 | 0 | 유지 |
| brown-loafer | 0.68 | 0.68 | 0 | 유지 |
| poet-core-denim | 0.751 | 0.759 | 0 | 유지 |
| poet-core-skirt | **0.059** (조각) | **0.616** | 0 | 해결 |
| white-sneakers2 | **0.248** (배경 76%를 분리) | **0.733** | 0 | 해결 |
| white-sneakers3 | 0.575 (잡티 구멍 68개) | 0.638 | 0 | 개선 |

- 실패(육안 기준): 이전 **3/7** → 이후 **0/7**
- QA E2E 흰 셔츠 결과: 이전 14×16px(상자 대비 0.05%) → 이후 640×692px(상자 대비 98.9%)
- 품질 미달 판정: 로퍼 사진의 배경 구석 상자 → 422 `background` (상자 밖 97.7%)
- 처리 시간: QA E2E 기준 `/segment-garment-local` 약 2.45~2.5초(모델 로딩 후, macOS arm64)
- 잔여: 흰 셔츠 오른쪽 소매 가장자리가 약간 거칠다(Low). 착용샷·패턴·액세서리 평가 이미지 없음

## 3. C. Gemini 효율

### 3.1 반영

- 앱은 Gemini `mask`를 쓰지 않는다(`USE_GEMINI_SEGMENTATION = false`, SlimSAM이 분리). 기본 요청에서 `mask` 지시와 스키마를 뺐다.
- 응답 형식은 그대로(`mask: []`) → 앱 변경 불필요. `GEMINI_REQUEST_MASK=true`로 되돌릴 수 있다.
- 서버 로그에 `Gemini 사용량:`(모델, 입력·출력·추론 토큰) 한 줄을 남긴다(비용 추적용, 값에 비밀정보 없음).
- **모델·추론 수준·결제 설정은 바꾸지 않았다**(`.env` 요청 모델 그대로).

### 3.2 미검증 (KI-11)

| 측정할 것 | 방법 | 판단 기준(제안) |
|---|---|---|
| 출력 토큰 감소 | `node backend/test/quality/gemini-mask-ab.js 5` (mask 켠 서버 / 끈 서버 동시 비교) | 평균 출력 토큰 감소 확인(COST_ESTIMATE 가정: 783 → 약 250) |
| 속성 일치 | 같은 스크립트: category·subCategory·color·colorTone·fit·material, season·tpo·style | 6개 단일 속성 중 5개 이상 일치가 대부분 |
| 상자 정확도 | 같은 스크립트: 두 응답의 box IoU | 평균 IoU ≥ 0.85, 이후 SlimSAM 품질 테스트 재통과 |

2026-10-19 실행 시 두 서버 모두 429(`AI_RATE_LIMITED`) → 측정 0건. 스크립트 자체(서버 2개 기동·종료, 결과 집계)는 동작 확인.

### 3.3 모델 후보와 예상 비용 (변경하지 않음, 결정용)

`docs/launch/COST_ESTIMATE.md` 2장의 실측 토큰(입력 1,637 / 출력 783)과 공식 가격 기준. mask 제거 열은 출력 250토큰 가정.

| 모델 | 1회 원가(현재 출력) | mask 제거 시 | 비고 |
|---|---|---|---|
| `gemini-3.6-flash` (현재 실제 응답 모델, ~2026-12-31) | 5.8원 | 3.0원 | 2027-01-01부터 가격 2배(11.7원 / 6.1원) |
| `gemini-2.5-flash` | 3.4원 | 1.6원 | thinking 설정 방식이 달라 실측 필요 |
| `gemini-3.1-flash-lite` | 2.2원 | 1.1원 | 속성 정확도 실험 필요 |
| `gemini-2.5-flash-lite` | 0.7원 | 0.4원 | 가장 저렴, 상자 정확도 위험 가장 큼 |

- 1600px 리사이즈 이후 이미지 입력 토큰이 달라졌는지 **미측정**(이전 측정은 525~736px 상품 이미지).
- 모델 전환은 같은 평가 세트(속성 정답 + 상자 IoU + SlimSAM 품질)로 비교한 뒤 **PO 승인으로만** 결정한다. Phase 1B 계획의 S1B-0에 실험 항목으로 넣었다.

## 4. B. 업로드 이미지 최적화 (KI-9)

| 항목 | 내용 |
|---|---|
| 방식 | 사진 선택 직후 `prepareClothingImage`(`src/lib/imagePrep.ts`): 이미지 라이브러리로 실제 렌더링 크기 측정 → 긴 변 1600px 초과면 축소 → JPEG 0.8로 재저장(HEIC 등도 JPEG). 같은 결과를 분석과 저장에 함께 사용(상자 좌표와 저장 이미지 일치) |
| 근거 | SlimSAM은 내부적으로 긴 변 1024px로 처리, Gemini 이미지 토큰은 해상도에 크게 비례하지 않음, 옷장 표시는 1600px이면 충분[가정] |
| 한도 방어 | 재저장 결과도 base64 9.5MB를 넘으면 `ImageTooLargeError` → “사진을 불러오지 못했어요” 알림(요청을 보내지 않음) |
| 측정(웹) | 10.79MB·EXIF 6 JPEG → 회전 반영 3024×4032 → 1200×1600, **254KB, 950ms**. 분석 요청 본문 0.33MB |
| 발견 | 웹에서 한 변만 지정한 resize가 실패(“source width is zero”) → 두 변을 모두 계산해 지정 |
| Not Tested | iOS/Android 실기기 HEIC·EXIF·처리 시간(PQ-8) |

### 4.1 단계별 성능 계측

개발 빌드(`__DEV__`)에서만 콘솔에 `[perf] <단계> {"ms":…}`를 남긴다(`src/lib/perf.ts`).

| 단계 | 로그 이름 | 측정값 |
|---|---|---|
| 사진 준비 | `image.prepare` | 웹 950ms(10.79MB 사진) |
| 분석 요청 | `analyze.request` | **Not Tested**(Gemini 한도). 참고: 1A-2 실측 3.8~9.6초 |
| 원본 업로드 | `save.uploadOriginal` | **Not Tested**(앱 화면 저장은 원격 계정 로그인이 필요해 자동화 불가) |
| SlimSAM | `save.slimsam` | 서버 기준 약 2.5초(QA E2E) |
| BRIA 대체 | `save.bria` | Not Tested(대체 경로 미발생) |
| 저장 전체 | `save.total {cutoutVia}` | Not Tested(앱) |

## 5. D. 회귀 테스트

### 5.1 자동 테스트 (2026-10-19 최종 실행)

| 묶음 | 명령 | 1A-2 종료 시 | 1A-3 이후 | 비고 |
|---|---|---|---|---|
| 백엔드 단위 | `npm run test:backend` | 37/37 | **46/46** | 분리 순수 함수·mask 제거 테스트 추가. 실제 모델 테스트는 이 묶음에서 분리 |
| 앱 단위 | `npm run test:client` | 21/21 | **25/25** | 이미지 크기 규칙 추가 |
| 추천엔진 스냅샷 | `npm run test:engine` | 없음 | **2/2** | 신설 |
| SlimSAM 품질 | `npm run test:quality` | 없음 | **8/8** | 실제 모델 7장 + 품질 미달 422 |
| QA E2E 1A-1 | `sprint-1a-1.e2e.js` | 8 pass + 1 todo(KI-1) | **9/9** | E2E-09를 일반 테스트로 승격 |
| QA E2E 1A-2 | `sprint-1a-2.e2e.js` | 9/9 | **9/9** | T2-08이 Gemini 한도 시 대체 분석값 사용 |
| QA E2E 1A-2 QA | `sprint-1a-2-qa.e2e.js` | 8/8 | **8/8** | |
| 타입 검사 | `npx tsc --noEmit` | 통과 | **통과** | |
| Lint | `npx expo lint` | (미실행) | 오류 10·경고 6 | **모두 1A-3 이전 코드**(내 변경 줄 아님) → KI-12 |

1A-2 종료 시 숫자는 1A-2 결과 문서 기준. E2E는 모두 QA 프로젝트(`styleseed-qa`)에서 실행했고 운영 주소면 실행을 거부한다. 분석 단계는 Gemini 한도(429 `AI_RATE_LIMITED`)로 대체 분석값을 썼다.

### 5.2 추천엔진 기준 스냅샷

- 고정 옷장 15벌(`src/utils/__tests__/fixtures/engine-closet.json`) + 날씨 없음·추움(−3℃ 눈)·선선(17℃)·더움(31℃)·비(14℃)
- Styling(옷마다 추천 코디), Looks(전체 순위, 옷 3벌 기준 순위), Today's Look(날씨 5종)을 `engine-baseline.json`에 저장하고 비교
- 1A-3은 엔진 파일을 바꾸지 않았다(`git diff 835681e -- src/utils src/types src/constants` 0건). Phase 1B에서는 이 기준과의 차이를 “의도한 변경”으로 문서화한다
- 스냅샷에서 바로 보이는 Phase 1B 근거: 같은 코디 [티셔츠·반바지·스니커즈]가 Styling 100점, Looks 77점 — **점수 체계가 화면마다 다르다**. 추운 날씨에서 실크 원피스+가죽 재킷 코디(날씨 48점)가 2순위로 나온다

### 5.3 예외 처리 확인

| 상황 | 결과 |
|---|---|
| 본문 10MB 초과 분석 요청 | 413 `PAYLOAD_TOO_LARGE`(E2E) |
| 9.5MB 넘는 재저장 결과 | 요청 전 알림(단위 테스트로 한도 확인) |
| 분리 품질 미달 | 422 `LOW_QUALITY_CUTOUT` → 앱 BRIA 대체 |
| 다른 사용자 이미지 경로 | 403 `IMAGE_PATH_FORBIDDEN`(E2E) |
| 없는 이미지 | 404(E2E) |
| 익명 세션 이미지 처리 | 403 `ANONYMOUS_NOT_ALLOWED`(E2E) |
| Gemini 한도 | 429 `AI_RATE_LIMITED` + `retryAfterSeconds`(E2E 실제 발생) |

## 6. 바뀐 파일

| 파일 | 내용 |
|---|---|
| `backend/cutout.js` (신규) | 프롬프트 점, 마스크 통계·선택, 품질 판정, 구멍 메우기(순수 함수) |
| `backend/server.js` | `/segment-garment-local` 재작성, `GEMINI_REQUEST_MASK`, Gemini 사용량 로그 |
| `backend/test/cutout.test.js`, `backend/test/limits.test.js` | 단위 테스트 |
| `backend/test/quality/*` (신규) | 실제 모델 품질 테스트, Gemini mask A/B 스크립트 |
| `backend/test/fixtures/cutout-cases.json` (신규) | 평가 이미지 7장 상자·이전 값·하한 |
| `backend/test/e2e/sprint-1a-1.e2e.js`, `sprint-1a-2.e2e.js` | E2E-09 승격, T2-08 대체 분석값 |
| `src/lib/imageSizing.ts`, `imagePrep.ts`, `perf.ts` (신규) | 사진 준비, 성능 계측 |
| `src/app/upload.tsx`, `src/app/analyze.tsx`, `src/lib/clothes.ts` | 사진 준비 연결, 단계별 계측 |
| `src/lib/__tests__/imageSizing.test.mjs`, `src/utils/__tests__/*` (신규) | 앱 단위·엔진 스냅샷 |
| `package.json` | `test:engine`, `test:quality` 추가, `test:backend`를 단위 테스트로 한정 |
| `.env.example`, `backend/README.md`, `docs/sprints/known-issues.md` | 문서 |
| `docs/handoff/sprint-1a-3-handoff.md` (신규) | Claude B 연동 안내 |

## 7. 남은 위험과 다음 행동

| 항목 | 다음 행동 | 담당 |
|---|---|---|
| KI-11 mask 제거 효과 미측정 | 한도 초기화 후 A/B 스크립트 실행, 결과를 이 문서에 추가 | Claude A |
| KI-10 libvips 중복 로드 | 배포 이미지에서 정리 | Claude B |
| 서버 메모리 최대 약 3.06GB(품질 테스트 프로세스, macOS) | 배포 메모리 산정(COST_ESTIMATE 가정 2.5GB보다 큼) | Claude B |
| PQ-8 실기기 사진 준비 | 출시 전 실기기 QA | PO + Claude B(빌드) |
| KI-6 Gemini 무료 한도 | 유료 등급·모델 결정(별도 승인) | PO |
| 평가 세트가 상품 사진 7장뿐 | 착용샷·패턴·액세서리·실사진 추가(Phase 1B S1B-0) | Claude A |
