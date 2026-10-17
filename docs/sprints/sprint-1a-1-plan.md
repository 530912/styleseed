# Sprint 1A-1 계획 — 백엔드 보호의 첫 단계

| 항목 | 내용 |
|---|---|
| 상태 | **계획(승인 대기)**. 승인 전에는 코드를 수정하지 않는다 |
| 작성일 | 2026-10-17 |
| 기준 문서 | `PRD.md` v0.2.1(Phase 1A), `docs/PRODUCT_AUDIT.md`, Phase 1A·1B 우선순위 분석(1A-01·03·04·10·14) |
| 적용 Skill | `pm-execution:sprint-plan`(용량·의존성·위험), `pm-execution:test-scenarios`(테스트 시나리오) |
| 역할 | 개발: Claude(Lead Developer) / 승인·수동 E2E 확인: PO |

---

## 1. Sprint 목표

> **"로그인 전 분석 → 로그인 → 옷장 저장 → 코디 추천" 흐름을 그대로 유지하면서, 백엔드가 토큰 없는 요청으로부터 이미지 처리 기능을 보호하고, 큰 요청과 응답 지연을 안전하게 처리하게 만든다.**

### 이 Sprint에서 하지 않는 것
- Supabase 익명 로그인 활성화와 restrictive RLS(FR-AUTH-07, 1A-05): 운영 Auth 설정·정책 변경이 필요해 별도 승인 대상이다.
- 사용자별 하루 AI 한도 저장소(1A-08), SSRF 차단(1A-09), 배포(1A-12)
- 앱 화면 디자인 변경, DB 스키마 변경

---

## 2. 핵심 설계: 로그인 전 분석을 막지 않는 인증 구조

현재 익명 로그인은 **꺼져 있고**(2026-10-17 확인), 켜려면 운영 설정과 RLS 정책을 먼저 바꿔야 한다. 따라서 이번 Sprint는 **2단계 접근(Guest / User)**으로 설계하고, 익명 세션은 다음 단계에서 같은 구조에 끼워 넣는다.

| 엔드포인트 | 호출 시점(코드) | 토큰 없음(Guest) | 유효한 사용자 토큰(User) | 잘못된·만료 토큰 |
|---|---|---|---|---|
| `POST /analyze-clothing` | 로그인 전 분석(`analyze.tsx:151`) | **허용** + IP당 Guest 한도 | 허용 | 401 (`AUTH_INVALID`) |
| `POST /segment-garment-local` | 로그인 후 저장(`clothes.ts:171`) | 401 (`AUTH_REQUIRED`) | 허용 | 401 |
| `POST /apply-garment-mask` | 로그인 후 저장(`clothes.ts:198`) | 401 | 허용 | 401 |
| `POST /segment-garment` | 호출되지 않는 코드(`clothes.ts:238`) | 401 | 허용 | 401 |
| `POST /remove-background` | 로그인 후 저장(`clothes.ts:270`) | 401 | 허용 | 401 |
| `GET /` | 상태 확인 | 허용 | 허용 | 허용 |

**동작 원칙**
1. **토큰 검증:** 백엔드가 `@supabase/supabase-js`(이미 설치됨)의 `auth.getClaims(token)`으로 검증한다. 비대칭 서명 키(JWKS)면 서버 안에서 서명을 검증하고, 레거시 키면 Supabase Auth에 확인한다. **새 Secret이나 관리자 키는 필요 없다.** 이미 `.env`에 있는 공개 URL과 Publishable key를 그대로 쓴다.
2. **Guest 한도:** 토큰 없는 분석 요청은 IP당 시간 한도(초안: **시간당 10회** [제안], 환경변수로 조정)를 넘으면 `429 GUEST_RATE_LIMITED`와 "로그인하면 계속 분석할 수 있어요" 안내를 받는다. 저장소는 서버 메모리이며, 영구 한도는 1A-08에서 만든다.
3. **확장 지점:** 토큰 안의 `is_anonymous` 값이 참이면 Guest와 같은 등급으로 처리한다. 지금은 익명 로그인이 꺼져 있어 해당되는 경우가 없지만, 1A-05에서 익명 세션을 도입할 때 미들웨어를 바꾸지 않아도 된다.
4. **PRD와의 차이(임시):** PRD SEC-01·AC-G3 ①은 "토큰 없으면 5개 모두 401"이다. 이번 Sprint는 FR-AUTH-07이 생길 때까지 `/analyze-clothing`만 Guest를 허용한다. Sprint 종료 시 PRD SEC-01에 "임시 Guest 허용 + IP 한도"를 기록한다.
5. **CORS:** 네이티브 앱은 Origin 헤더를 보내지 않으므로 그대로 허용한다. 웹 Origin은 허용 목록(`ALLOWED_ORIGINS`, 개발 기본값 `http://localhost:8081`)만 허용한다.

**흐름 보존 확인**
- 로그인 전 분석: 토큰 없이 Guest로 성공한다.
- 로그인·가입 직후 저장: `saveClothingToSupabase`가 호출되는 시점에는 항상 세션이 있다(`login.tsx:92-96`, `signup.tsx:74-77`, `analyze.tsx:274-292`, `item.tsx:118-134`). 공통 API 함수가 이 세션 토큰을 붙이므로 이미지 처리 4개 엔드포인트가 정상 동작한다.
- **주의할 실패 방식:** 이미지 처리가 실패하면 저장 로직은 조용히 원본 사진으로 대체한다(`clothes.ts:343-418`). 토큰 첨부가 빠지면 오류 없이 "배경 제거가 안 된 옷"만 남는다. 그래서 이 경로를 별도 테스트(TS-07)로 확인한다.

---

## 3. 용량과 일정

| 항목 | 값 |
|---|---|
| 인원 | 1명(Claude). PO는 승인과 수동 E2E 확인(약 10분) |
| 기간 | 1 Sprint. 일정 대신 완료 기준으로 종료 |
| 확정 작업 | 5개, 12 포인트 |
| 여유분 | 약 20%(회귀 테스트, 예상 밖 오류) |

| 순서 | 작업 | 포인트 | 선행 작업 |
|---|---|---|---|
| 1 | 1A-01 준비 | 1 | 없음 |
| 2 | 1A-03 API 호출 모음 | 2 | 1A-01 |
| 3 | 1A-10 본문 크기·타임아웃 | 2 | 1A-01(테스트 실행 구조) |
| 4 | 1A-04 인증 미들웨어 + Guest 정책 | 5 | 1A-03(토큰 첨부), 1A-01 |
| 5 | 1A-14 로그인·저장 실패 분리 | 2 | 없음(1A-03 이후 진행 권장) |

**핵심 경로:** 1A-01 → 1A-03 → 1A-04. 1A-10과 1A-14는 핵심 경로 밖에서 병행할 수 있다.

---

## 4. 작업별 정의

### 1A-01 준비

| 항목 | 내용 |
|---|---|
| 목적 | 서버 실행·테스트를 명령 하나로 할 수 있게 하고, 필요한 환경변수를 문서화하며, 되돌릴 수 있는 시작점을 만든다 |
| 수정 파일 | `package.json`(scripts만), 신규 `.env.example`, 신규 `backend/README.md`, `backend/server.js`(app export 구조), 신규 `backend/test/` |
| 구현 | ① scripts에 `backend`(`node backend/server.js`), `test:backend`(`node --test backend/test`) 추가 ② `.env.example`에 키 **이름만** 기록(기존 키 + 새 선택 키 `EXPO_PUBLIC_API_URL`, `ALLOWED_ORIGINS`, `GUEST_ANALYZE_LIMIT_PER_HOUR`, `GEMINI_TIMEOUT_MS`) ③ `server.js`를 `module.exports = app`으로 바꾸고, 직접 실행할 때만 `listen`(`require.main === module`) ④ Node 내장 테스트 러너(`node:test`)를 사용해 **새 의존성 없음** |
| 선행 | Git 시작점 결정(6장 D1) |
| AC | ① `npm run backend`로 서버가 3001 포트에서 뜬다 ② `npm run test:backend`가 실행되고 결과를 출력한다 ③ `.env.example`에 값이 하나도 없다 ④ `package.json`의 dependencies가 바뀌지 않는다 |
| 테스트 | TS-01, `git diff package.json` 확인 |
| 완료 기준 | AC ①~④ 충족, 기존 기능 회귀 없음 |

### 1A-03 API 호출 모음

| 항목 | 내용 |
|---|---|
| 목적 | 백엔드 주소를 설정으로 빼고, 토큰 첨부·타임아웃·오류 해석을 한 곳에서 처리한다(TR-01) |
| 수정 파일 | 신규 `src/lib/api.ts`, 신규 `src/lib/apiErrors.ts`(외부 의존 없는 순수 함수), `src/app/analyze.tsx:151`, `src/lib/clothes.ts:11, 171, 198, 238, 270` |
| 구현 | ① `API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001"`(값이 없으면 지금처럼 localhost이므로 `.env`를 바꾸지 않아도 됨) ② `apiPost(path, body, { auth: "optional" \| "required", timeoutMs })`: `supabase.auth.getSession()`에서 토큰을 읽어 `Authorization: Bearer` 헤더를 붙인다. 필수(`required`)인데 세션이 없으면 요청 전에 오류를 낸다. 지정 시간이 지나면 `AbortController`로 중단 ③ 오류 응답을 공통 코드(`AUTH_REQUIRED`, `AUTH_INVALID`, `PAYLOAD_TOO_LARGE`, `TIMEOUT`, `AI_RATE_LIMITED`, `GUEST_RATE_LIMITED`, `AI_BUSY`, `NETWORK`)로 해석하고 사용자 문구를 매핑 ④ 분석은 `optional`, 이미지 처리 4종은 `required` |
| 선행 | 1A-01 |
| AC | ① `src`에 `localhost:3001` 문자열이 `api.ts` 기본값 한 곳에만 있다 ② 로그인 상태의 요청에는 Authorization 헤더가 붙고, 비로그인 분석 요청에는 붙지 않는다 ③ 기존 분석 오류 문구(429, 503)가 그대로 나온다 ④ `tsc --noEmit`이 통과한다 |
| 테스트 | TS-02, TS-03, `apiErrors.ts` 단위 테스트, `tsc`, `expo lint` |
| 완료 기준 | AC 충족, 분석·저장 경로의 호출 대상과 본문이 기존과 같음 |

### 1A-10 본문 크기·타임아웃

| 항목 | 내용 |
|---|---|
| 목적 | 대용량 요청으로 서버 자원이 고갈되는 것을 막고, AI 응답 지연 시 앱이 무한 대기하지 않게 한다(SEC-06, FR-AI-05) |
| 수정 파일 | `backend/server.js:22-26`과 Gemini·BRIA 호출부, `src/lib/api.ts`, `src/app/analyze.tsx`(오류 문구) |
| 구현 | ① 전역 50MB를 **경로별 제한**으로 교체: 분석은 10MB [제안](원본 사진 `quality: 0.7` base64 기준 여유 포함), 이미지 처리 4종은 1MB(URL과 좌표만 보냄) ② 크기 초과는 JSON `413 PAYLOAD_TOO_LARGE`로 응답 ③ Gemini 호출에 `AbortSignal.timeout(GEMINI_TIMEOUT_MS, 기본 25초)`을 걸고, 초과하면 `504 AI_TIMEOUT`(초과 시 재시도하지 않음) ④ BRIA·이미지 다운로드에도 타임아웃을 건다 ⑤ 앱의 분석 요청 타임아웃은 30초. 초과하면 "응답이 늦어요. 다시 시도해주세요" |
| 선행 | 1A-01 |
| AC | ① 11MB 분석 요청은 413 JSON ② 정상 크기 사진은 기존처럼 분석된다 ③ Gemini가 응답하지 않으면 25초 안에 504 ④ 앱에서 413·504·네트워크 끊김이 각각 다른 문구로 보인다 |
| 테스트 | TS-08, TS-09, TS-10, TS-11 |
| 완료 기준 | AC 충족, 실제 사진 3장(작은·보통·큰 사진)의 base64 크기를 개발 로그에 기록 |

### 1A-04 인증 미들웨어 + Guest 정책

| 항목 | 내용 |
|---|---|
| 목적 | 토큰 없는 요청이 유료 이미지 처리 API를 쓰지 못하게 하면서, 로그인 전 분석은 제한된 범위에서 유지한다(SEC-01) |
| 수정 파일 | 신규 `backend/auth.js`(미들웨어·검증 주입 구조), 신규 `backend/guestLimiter.js`, `backend/server.js`(CORS와 라우트 연결) |
| 구현 | ① `createAuth({ verify })`: Bearer 토큰 → `getClaims` 검증 → `req.auth = { tier: "user" \| "guest", userId }`. 테스트에서는 `verify`를 가짜로 주입 ② `requireUser`: User 등급이 아니면 401 `AUTH_REQUIRED` ③ `allowGuest`: 토큰이 없으면 Guest 등급. **토큰이 있는데 무효면 401**(Guest로 내려가지 않음) ④ Guest 한도: IP별 1시간 고정 창, `GUEST_ANALYZE_LIMIT_PER_HOUR` ⑤ CORS 허용 목록 ⑥ 검증 실패 원인은 로그에 남기되 토큰 값은 남기지 않음 |
| 선행 | 1A-03(앱 토큰 첨부), 1A-01 |
| AC | ① 토큰 없이 이미지 처리 4종을 호출하면 401 ② 토큰 없이 분석하면 허용되고, 한도를 넘으면 429 `GUEST_RATE_LIMITED` ③ 유효한 토큰이면 5개 모두 인증 단계를 통과 ④ 위조·만료 토큰이면 분석 포함 5개 모두 401 ⑤ 허용되지 않은 웹 Origin은 CORS로 차단, Origin이 없는 네이티브 요청은 허용 ⑥ 로그인 후 저장에서 배경 제거 경로가 실제로 실행된다(원본으로 대체되지 않음) ⑦ 로그에 토큰 문자열이 없다 |
| 테스트 | TS-04 ~ TS-07, TS-12, TS-13 |
| 완료 기준 | 자동 테스트 통과 + PO 수동 E2E(8장)에서 로그인 후 저장 시 배경 제거 확인 |

### 1A-14 로그인·저장 실패 분리

| 항목 | 내용 |
|---|---|
| 목적 | 로그인은 성공했는데 옷 저장이 실패한 경우를 "로그인 실패"로 잘못 안내하지 않는다(FR-AUTH-03) |
| 수정 파일 | `src/app/login.tsx:81-125`, `src/app/signup.tsx:53-100`(같은 결함), 신규 `src/hooks/use-save-pending-clothing.ts`(두 화면 공통 처리) |
| 구현 | ① "로그인 완료" 알림을 저장 **전**에 띄우지 않는다(`login.tsx:90`) ② 인증 오류와 저장 오류를 나눠 처리: 인증 실패는 "로그인 실패", 인증 성공 + 저장 실패는 "로그인됐어요. 옷 저장에 실패했어요" + [다시 시도] [나중에] ③ 저장에 실패해도 `pendingClothing`과 분석 화면 상태를 지우지 않는다(지금처럼 성공했을 때만 지움) ④ [나중에]를 누르면 분석 화면으로 돌아간다(세션이 있으므로 저장 버튼으로 바로 재시도 가능) ⑤ 회원가입 화면에도 같은 규칙 적용 ⑥ 쓰이지 않는 `savingClothing` 정리 |
| 선행 | 없음(1A-03 이후 진행하면 오류 코드 문구를 함께 쓸 수 있음) |
| AC | ① 비밀번호가 틀리면 "로그인 실패" ② 로그인 성공 + 저장 실패면 "로그인됨 / 저장 실패" 안내가 나오고 세션이 유지된다 ③ 저장에 실패해도 보류 중인 옷이 남아 있어 재시도할 수 있다 ④ 정상 경로(로그인 → 저장 → 옷장)는 기존과 같다 ⑤ 회원가입 경로도 ①~④와 같다 |
| 테스트 | TS-14 ~ TS-17 |
| 완료 기준 | AC 충족, `tsc` 통과 |

---

## 5. 테스트 시나리오 (`test-scenarios`)

**구분:** [자동] Claude가 이 환경에서 실행 / [수동] 외부 네트워크(Gemini·Supabase)가 필요해 PO가 실기기·시뮬레이터에서 확인

| ID | 시나리오 | 요구사항 | 방식 | 기대 결과 | 우선순위 |
|---|---|---|---|---|---|
| TS-01 | 서버 실행·테스트 명령 | 1A-01 | 자동 | `GET /` 200, 테스트 러너 출력 | High |
| TS-02 | 로그인 상태 요청에 토큰 첨부 | 1A-03 | 자동(헤더 구성 함수 단위) | `Authorization: Bearer …` 포함 | Critical |
| TS-03 | 오류 코드 → 문구 매핑 | 1A-03·10 | 자동 | 코드 8종이 각각 정해진 문구 | High |
| TS-04 | 토큰 없이 이미지 처리 4종 호출 | 1A-04 | 자동 | 모두 401 `AUTH_REQUIRED` | Critical |
| TS-05 | 토큰 없이 분석 → 한도 초과 | 1A-04 | 자동 | 한도까지 인증 통과(본문 없으면 400으로 확인), 다음 요청 429 | Critical |
| TS-06 | 위조·만료 토큰 | 1A-04 | 자동(가짜 검증 함수 주입) | 5개 모두 401 `AUTH_INVALID` | Critical |
| TS-07 | 로그인 후 저장 시 배경 제거 실행 | 1A-04 | **수동** | 저장된 옷에 배경 제거 이미지가 있음(`cutout_image_path` 존재) | Critical |
| TS-08 | 크기 초과 분석 요청 | 1A-10 | 자동 | 413 JSON | High |
| TS-09 | 이미지 처리 경로 1MB 초과 | 1A-10 | 자동 | 413 JSON | Medium |
| TS-10 | Gemini 무응답 | 1A-10 | 자동(`fetch` 대역으로 지연) | 지정 시간 안에 504 `AI_TIMEOUT` | High |
| TS-11 | 앱 30초 타임아웃 | 1A-10 | 자동(순수 함수) + 수동 | "응답이 늦어요" 문구 | Medium |
| TS-12 | 허용되지 않은 웹 Origin | 1A-04 | 자동 | CORS 헤더 없음 | Medium |
| TS-13 | 로그에 토큰 노출 없음 | 1A-04 | 자동(로그 수집 후 검사) | 토큰 문자열 0건 | High |
| TS-14 | 잘못된 비밀번호 | 1A-14 | 수동 | "로그인 실패" | High |
| TS-15 | 로그인 성공 + 저장 실패(백엔드 중지 상태) | 1A-14 | 수동 | "로그인됐어요 / 저장 실패", 재시도 가능 | Critical |
| TS-16 | 실패 후 [다시 시도] 성공 | 1A-14 | 수동 | 옷장으로 이동, 보류 중인 옷 비워짐 | High |
| TS-17 | 회원가입 경로 동일 확인 | 1A-14 | 수동 | TS-15·16과 동일 | Medium |
| TS-R | **회귀: 핵심 흐름** 사진 선택 → 분석(비로그인) → 저장 → 로그인 → 옷장 → Styling → Looks → Today | 전체 | **수동** | 모든 단계 정상, 배경 제거 적용 | Critical |

**공통 자동 회귀:** 매 작업 후 `tsc --noEmit`, `expo lint`, `npm run test:backend`를 실행한다.

**테스트 데이터:** 자동 테스트는 가짜 토큰과 가짜 검증 함수만 쓰고 실제 계정·DB는 쓰지 않는다. 수동 E2E는 PO의 기존 테스트용 계정 또는 새로 가입한 계정을 사용한다(운영 DB에 옷 1~2건 생성, 테스트 후 앱에서 삭제).

---

## 6. 승인 시 함께 결정할 사항

| ID | 결정 | 권장안 |
|---|---|---|
| **D1** | Git 시작점 | **로컬 브랜치 `sprint/1a-1` 생성 + 현재 미커밋 작업 전체를 "baseline" 커밋 1개로 저장**(Push 없음). 이후 Sprint 변경만 별도 커밋으로 분리돼 되돌리기 쉽다. 원하지 않으면 대안으로 커밋 없이 시작 시점 diff를 scratchpad에 백업 |
| **D2** | Guest 분석 임시 정책 | 토큰 없는 분석 허용 + IP당 시간당 10회 [제안]. FR-AUTH-07 도입 시 익명 세션으로 교체 |
| **D3** | 수동 E2E | Sprint 종료 시 PO가 실기기·시뮬레이터로 TS-07, TS-14~17, TS-R 확인(약 10분). 체크리스트는 제가 준비 |

---

## 7. 위험과 대응

| 위험 | 영향 | 대응 |
|---|---|---|
| 샌드박스가 외부 네트워크를 막아 Gemini·Supabase를 포함한 실제 E2E를 Claude가 실행할 수 없음 | 실제 동작 증거가 수동 확인에 의존 | 새 의존성 없이 가짜 검증·`fetch` 대역으로 자동 테스트. 실제 흐름은 PO 수동 E2E로 확인. 보고 시 "자동 확인"과 "수동 확인 필요"를 구분 |
| 토큰 첨부 누락 시 저장이 오류 없이 원본 사진으로 대체됨 | 배경 제거 기능이 몰래 꺼짐 | TS-07을 Critical로 지정. 대체 발생 시 서버·앱 로그에 원인 코드 기록 |
| `getClaims`의 Supabase 키 방식(비대칭 / 레거시)이 확인되지 않음 | 레거시면 요청마다 Auth 호출(약간의 지연) | 두 방식 모두 지원하는 함수 사용. 수동 E2E에서 지연을 확인 |
| 큰 사진이 10MB 제한에 걸릴 수 있음 | 분석 실패 | 413 전용 문구, 실제 사진 크기 기록. 필요하면 다음 Sprint에서 업로드 전 리사이즈(별도 요구사항) |
| Guest 한도의 IP 기준: 같은 Wi-Fi Beta 참가자가 한도를 공유하고, 서버 재시작 시 초기화됨 | 정상 사용자 차단 또는 한도 우회 | 한도는 환경변수로 조정. 영구 한도는 1A-08 |
| 미커밋 사용자 변경과 Sprint 변경이 같은 파일에 섞임(`analyze.tsx`, `clothes.ts`, `login.tsx`, `signup.tsx`, `server.js`) | 되돌리기 어려움 | D1 baseline 커밋 |
| 실기기에서 `localhost`는 PC를 가리키지 않음(기존 문제) | 실기기 E2E 불가 | `EXPO_PUBLIC_API_URL`로 PC의 LAN IP 지정 가능. 배포는 1A-12 |
| Supabase Free 플랜 자동 일시정지 | 수동 E2E 중 로그인·저장 실패 | E2E 전에 프로젝트 상태 확인. 정지돼 있으면 재개 승인 요청 |

---

## 8. Sprint 종료 보고 형식

- AC별 결과: **자동 확인됨 / 수동 확인됨 / 코드만 변경(미확인)**으로 구분
- 변경 파일 목록과 커밋
- 테스트 실행 기록(명령, 통과·실패 수)
- PRD·Audit 상태 갱신 내역(SEC-01 임시 Guest 정책, TR-01, SEC-06, FR-AI-05, FR-AUTH-03)
- 남은 문제와 다음 Sprint 후보(1A-05 익명 세션 + restrictive RLS, 1A-08, 1A-09)
