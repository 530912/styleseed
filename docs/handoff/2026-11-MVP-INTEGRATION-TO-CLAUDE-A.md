# Claude B → Claude A: 통합 브랜치 `integration/mvp-2026-11` 인계 (2026-10-26)

상세: `docs/launch/2026-11-MVP-DEPLOY-PREP.md`. 아래는 A가 알아야 할 것만.

## 1. 요청하신 R-항목 결과

| R | 결과 |
|---|---|
| R-1 통합 브랜치 | **완료(로컬, Push 안 함).** `integration/mvp-2026-11` = `release/beta-prep`(`d3b8197`) + `audit/2026-11-mvp`(`eedc531`), 충돌 0. 회귀: backend 86(+1 skip) → 수정 후 **99(+1 skip)**, client 38, engine 35, fkd 36, round1 16, `tsc` 0, 웹 내보내기 성공. `upload.tsx` 79행에 `hasAiConsent` 유지(정적). **화면 실행 확인은 A 몫** |
| R-3 모델 고정 | 배포값 `gemini-3.6-flash` 제안(PO 승인 AP-4). `/healthz`에 `gemini.model`·`gemini.lastServedModel`, 호출마다 `gemini_call` 로그 |
| R-4 fal | `FAL_KEY` 없으면 `/segment-garment` 404 `FEATURE_DISABLED` |
| R-5 | 배포값 `ALLOW_TOKENLESS_GUEST=false` 제안(PO) |
| R-8 | 400 `INVALID_IMAGE`(Gemini 호출 없음). 감지한 mimeType 전달 |
| R-9 | 한 줄 JSON 로그 `http_error`(400 이상), `gemini_call`(시간 초과 포함) |
| 추가 | `GEMINI_DAILY_LIMIT`(서버 전체 일일 상한 → 429 `AI_RATE_LIMITED`), JSON 404·500 |

## 2. A 파일·공유 파일에 한 변경

| 파일 | 변경 |
|---|---|
| `backend/server.js` | 분석 경로: 이미지 검사·일일 상한 추가, **"Gemini 사용량:" console.log 줄을 `gemini_call` JSON 로그로 대체**(같은 토큰 필드 + 요청/응답 모델). fal 경로에 `requireFalEnabled`. 파일 끝 JSON 404·500 |
| `backend/test/limits.test.js` | `imageBase64: "abc"` → `FAKE_JPEG`(JPEG 시그니처 base64). **앞으로 분석 성공 경로 테스트는 실제 이미지 시그니처가 필요** |
| `backend/test/imageTasks.test.js` | S-7에서 `app.locals.falEnabled = true` 후 원복 |
| `.env.example` | 요청하신 `EXPO_PUBLIC_SHOW_PROTOTYPES` 추가 |

## 3. A에게 부탁

1. 다음 작업은 `integration/mvp-2026-11` 기준으로(병합 또는 여기서 분기) — `server.js` 분석 경로 충돌 방지.
2. 통합본 화면 확인: AI 동의 → 분석, 로그아웃 캐시 삭제.
3. (선택) `src/lib/apiErrors.ts`에 `INVALID_IMAGE` 문구 추가 — 지금은 일반 분석 실패 문구가 나온다.
4. **타임아웃 협의**: 10/26 22시 Gemini가 25초를 넘겨 504가 2번 났다(텍스트 8토큰도 19.8초). 서버 `GEMINI_TIMEOUT_MS` 40~45초로 올리려면 앱 `ANALYZE_TIMEOUT_MS`(30초)를 그보다 길게(예: 50초) 바꿔야 한다.
5. BUG-06 `NOT_CLOTHING`을 할 때는 분석 경로의 이미지 검사 → 일일 상한 → Gemini 순서를 유지해 주세요.

---

## 2차 (2026-10-27) — A 3차 인계(`2026-11-MVP-APP-TO-B.md`) 반영

| 요청 | 결과 |
|---|---|
| 통합 | `audit/2026-11-mvp` `4a975f5`까지 `integration/mvp-2026-11`에 병합(충돌 0). `upload.tsx`에 `register_started`와 `hasAiConsent` 둘 다 남음 |
| **R-10 / BUG-31** | **B가 (b) 방식으로 수정**: 동의 기록에 동의한 사용자(ownerId) 저장 + **로그아웃(`SIGNED_OUT`) 시 삭제**. 진행자 [세션 종료]는 `signOut`을 부르므로 **A가 `research.tsx`에 따로 넣을 것 없음**. 웹 실행으로 [세션 종료] 2번 → 동의 기록 삭제 확인 |
| A 파일 변경 | `src/app/_layout.tsx`: `startAiConsentSignOutSync()`를 부르는 `useEffect` 1개 + import 1줄 |
| R-11·R-12 | `EAS_SETUP.md` 4장 표, `.env.example`에 `EXPO_PUBLIC_RESEARCH_MODE`·`EXPO_PUBLIC_SHOW_PROTOTYPES` |
| R-13 | `node backend/scripts/check-env.mjs --app --target research` — API 주소 누락·http·localhost, 운영·QA Supabase, `RESEARCH_MODE≠true`, `SHOW_PROTOTYPES` 설정 시 오류 |
| R-15 | `check-env`·런북에 선택 변수로 반영(1차) |
| 새 서버 코드 | Gemini 402(선불 잔액 소진) → 503 `AI_CREDIT_EXHAUSTED`(앱은 503을 "혼잡"으로 안내, 변경 불필요) |

**환경 메모:** 새 작업 트리에서 `tsc`가 `/research` 경로 타입 오류를 내면 `.expo/types/router.d.ts`가 오래된 것 — `npx expo start`를 한 번 띄웠다 끄면 다시 생긴다(git 무시 파일). `verify-all.sh`에 넣을지 검토 바람.

**실기기에서 꼭 볼 것(A 점검표):** 참가자 1 동의 → 분석 → 가입 → [세션 종료] → 참가자 2가 사진 선택 후 [분석하기]에서 **동의 화면이 다시 나오는지**.
