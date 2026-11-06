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

---

## 3차 (2026-10-27) — 11월 베타 서버: 카페24 이지업 EASY C

| 항목 | 내용 |
|---|---|
| 서버 | 카페24 이지업 Easy C(4코어·8GB·160GB, Ubuntu 24.04), 결제 완료, **10/27 현재 OS 설치 중(IP 미발급)** |
| API 주소(예정) | **`https://styleseed.mycafe24.com`** — 카페24 기본 도메인 + Caddy 자동 인증서. 12월 Railway 이전 때 앱 재빌드를 피하려면 자체 도메인(`api.<도메인>`)으로 바꿔야 함(PO 결정 대기) |
| 앱 빌드 변수 | `EXPO_PUBLIC_API_URL=https://styleseed.mycafe24.com`(위 주소가 `/healthz` 200을 낸 뒤 확정), Supabase는 조사 프로젝트, `EXPO_PUBLIC_RESEARCH_MODE=true`. 빌드 전 `node backend/scripts/check-env.mjs --app --target research` |
| 배포 키트 | `deploy/vm/` (bootstrap → deploy → status). 코드 변경 없음, 같은 Dockerfile |

**통합 테스트 순서(서버 가동 후):**
1. B: `curl https://styleseed.mycafe24.com/healthz` → 200, `gemini.model = gemini-3.6-flash`
2. B: `verify-deploy --suite smoke` → `--suite full --analyze 1`(실제 Gemini 1회, 테스트 계정 자동 정리) → `verify-research-db.sql`
3. A: 위 주소로 Expo Go(또는 preview 빌드)에서 S1~S8 + BUG-31 확인(참가자 1 동의 → [세션 종료] → 참가자 2 동의 화면)
4. A·B: 동시 저장 2건(E6) — `bash deploy/vm/status.sh`로 메모리 확인

---

## 4차 (2026-10-27) — iPhone Safari 모바일 웹 전환

상세: `docs/launch/2026-11-MOBILE-WEB-BACKEND.md` 3장(빌드 변수·업로드·테스트 W-1~W-11).

- **API 주소: `EXPO_PUBLIC_API_URL=https://styleseed.mycafe24.com/api`** — 웹 화면(`/`)과 API(`/api`)를 같은 도메인에 둔다(CORS 설정 불필요).
- **A 파일 변경 1건**: `src/app/_layout.tsx`에 `installWebAlert()` 호출 추가. react-native-web의 `Alert.alert`는 빈 함수라 **웹에서 옷 삭제·계정 삭제 확인 창이 안 떠서 삭제가 안 되고, 로그인·저장 실패 안내도 보이지 않았다.** 웹에서만 브라우저 `alert`/`confirm`으로 연결(`src/lib/webAlert.ts`). 기존 `Alert.alert` 호출은 그대로 둬도 된다.
- 웹 빌드는 `npx expo export --platform web --output-dir dist` → B가 `deploy/vm/deploy-web.sh dist`로 서버에 올림.

---

## 5차 (2026-10-27) — 조사용 Supabase·API 확정값

| 변수 | 값 |
|---|---|
| `EXPO_PUBLIC_API_URL` | `https://styleseed.mycafe24.com/api` (가동 중, `/api/healthz` 200) |
| `EXPO_PUBLIC_SUPABASE_URL` | `https://jvqgjshwvsovdmkzhaqd.supabase.co` (조사 전용, 서울) |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_qiwuMCu-Odd9p42o9dk8QA_z0yQ8J2i` (공개 키) |
| `EXPO_PUBLIC_RESEARCH_MODE` | `true` |
| `EXPO_PUBLIC_GEMINI_PAID_TIER` | Gemini 유료 전환 후 `true`(그 전엔 비움 → 무료 등급 고지 표시) |

- 인증: Supabase 이메일·비밀번호 + 익명 세션(이메일 인증 없음). API 호출은 `Authorization: Bearer`. 같은 도메인이라 CORS 설정 불필요.
- 빌드 전: `node backend/scripts/check-env.mjs --app --target research` 오류 0.
- **로컬 개발 `.env`는 아직 운영 DB** — 위 값으로 웹 빌드할 때만 셸 변수로 넣고, 개발 `.env`는 건드리지 말 것(운영 데이터 분리 유지).
- 서버는 아직 조사 DB 미연결(PO가 `api.env` 입력 → B 배포 예정). 그 전에는 로그인은 되지만 분석·이미지 처리 API는 동작하지 않음.
