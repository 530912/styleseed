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
