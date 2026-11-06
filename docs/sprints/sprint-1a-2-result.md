# Sprint 1A-2 결과 — 인증 및 데이터 보안 고도화

| 항목 | 내용 |
|---|---|
| 기간 | 2026-10-17 ~ 2026-10-19 |
| 브랜치 | `sprint/1a-2` (로컬 전용, Push 안 함). 시작점 `6ee9d57` |
| 계획 | `docs/sprints/sprint-1a-2-plan.md` (v2) |
| 상태 | **종료 권고(2026-10-19 최종 QA)** — 로그인 상태 화면 확인은 출시 전 필수 QA(B10)로 이관 |

---

## 1. 구현 결과

| Task | 결과 | 주요 파일 |
|---|---|---|
| S2-01 QA 환경 | QA 프로젝트 익명 로그인 켜기(QA 한정), 1A-2 E2E 추가, 1A-1 E2E를 새 입력 방식에 맞게 갱신 | `backend/test/e2e/*` |
| S2-02 익명 사용자 차단 정책 | `clothes`·`storage.objects`(clothing-images)에 RESTRICTIVE `FOR ALL` 정책 2개. 기존 정책 무변경 | `supabase/migrations/20261018000000_block_anonymous_users.sql` |
| S2-03 영구 사용량 | `ai_usage` 테이블(직접 접근 불가) + `consume_ai_quota`(security definer, `auth.uid()`만 사용, 실행 권한 authenticated만) | `…000100_ai_usage.sql` |
| S2-04 버킷 제한 | 10MB, `image/jpeg·png·webp·heic·heif`. 앱 업로드 형식 보정(알 수 없으면 JPEG) | `…000200_bucket_limits.sql`, `src/lib/clothes.ts` |
| (DB-5) anon 권한 회수 | `clothes`에서 anon 역할 권한 전부 회수 | `…000300_revoke_anon_clothes.sql` |
| S2-05 접근 등급 | user / anonymous / guest. 이미지 처리: 익명 403 `ANONYMOUS_NOT_ALLOWED`, 토큰 없음 401. 토큰 없는 분석은 **임시 호환 모드**(`ALLOW_TOKENLESS_GUEST`, 기본 켜짐)로 분리 | `backend/auth.js`, `backend/server.js` |
| S2-06 영구 한도 | 익명·정식 사용자는 `ai_usage`에 기록(재시작 후에도 유지). 익명·guest는 IP 상한(메모리) 추가. 저장소 장애 시 메모리 한도로 대체. 한도 전부 환경변수 | `backend/quota.js`, `backend/guestLimiter.js`, `backend/userSupabase.js` |
| S2-07 로그인 판단 통일 | `isSignedIn()`(익명 = 로그아웃). 화면 판단 5곳 교체 | `src/lib/sessionPolicy.ts`, `analyze.tsx`, `index.tsx`, `item.tsx`, `use-closet-loader.ts` |
| S2-08 익명 세션·가입 전환 | 첫 분석 시 익명 세션 자동 생성(실패 시 토큰 없이 계속). 회원가입 시 익명 사용자를 같은 ID로 전환 후 세션 갱신(실패 시 일반 가입) | `src/lib/api.ts`, `src/lib/authActions.ts`, `src/app/signup.tsx` |
| S2-09 SSRF 차단 | 이미지 처리는 Storage 경로만 받음. 서버가 소유자 확인 후 **사용자 토큰으로** 서명 URL 생성. 서명 URL 주소 검증. 요청 본문의 URL은 무시 | `backend/storagePaths.js`, `src/lib/clothes.ts` |
| 부수 수정 | 긴 대기 시간 문구("55595초" → "약 16시간") | `src/lib/apiErrors.ts` |

모든 Secret·관리자 키 없이 구현했다(사용자 본인 토큰 + Publishable key).

---

## 2. 운영 DB 적용 상태 (2026-10-19)

각 단계 전에 운영 상태를 읽기 전용으로 재확인했고 계획과 일치했다(정책 8개, `ai_usage` 없음, 버킷 제한 없음, anon 권한 있음, 버킷 1개, `public` 테이블 `clothes` 1개). 적용은 Dashboard SQL Editor(프로젝트 ref 확인 가드 포함), 확인은 MCP 읽기 전용 조회와 운영 동작 테스트로 했다.

| ID | 적용 | 적용 후 확인 |
|---|---|---|
| DB-1 | ✅ 적용 | RESTRICTIVE 2 + 기존 PERMISSIVE 8 그대로. 조건식이 마이그레이션과 일치(`IS NOT TRUE` → 정식 토큰은 클레임이 false이거나 없어도 통과) |
| DB-5 | ✅ 적용 | anon: SELECT·INSERT 권한 false, authenticated: 4개 권한 true. anon REST 조회·쓰기 `42501` |
| DB-2 | ✅ 적용 | RLS 켜짐·정책 0, 테이블 권한 anon·authenticated 모두 없음, 함수 실행 authenticated만, security definer, `search_path=""` |
| DB-3 | ✅ 적용 | 10MB, 이미지 5종. 기존 객체는 JPEG·PNG만, 최대 0.65MB(호환) |
| DB-4 | ✅ 적용 | 익명 로그인 켜짐. 가입 허용·이메일 인증(꺼짐)·수동 연결(꺼짐) 변화 없음. Auth 설정 API로 재확인 |

**운영 테스트 데이터:** 익명 세션 1개(Auth 익명 사용자 행 1개, 데이터 쓰기 불가)와 그 사용자의 `ai_usage` 행 1개(사용량 3)를 만들었다. 정식 테스트 계정은 운영에 만들지 않았다(정리 불가).

**마이그레이션 이력:** Dashboard에서 SQL로 적용했으므로 Supabase 마이그레이션 이력 테이블에는 기록되지 않았다. CLI로 `db push`를 쓰기 전에 `supabase migration repair`로 등록해야 한다(파일은 모두 재실행해도 안전하게 작성).

---

## 3. 테스트 결과 — Confirmed / Failed / Not Tested

### Confirmed

| 구분 | 내용 | 근거 |
|---|---|---|
| 단위 | 백엔드 37/37, 앱 17/17, `tsc` 통과 | `npm run test:backend`, `test:client` |
| QA E2E 1A-2 | 9/9 (실제 Gemini 사용, 대체값 없음) | `backend/test/e2e/sprint-1a-2.e2e.js` |
| QA E2E 1A-1 회귀 | 8/8 (+ 알려진 결함 KI-1 todo 1) | `backend/test/e2e/sprint-1a-1.e2e.js` |
| 익명 세션 접근 | 분석 허용, 이미지 처리 4종 403 `ANONYMOUS_NOT_ALLOWED` | QA E2E T2-01/03, **운영**(2종) |
| 익명 데이터 차단(DB-1) | 익명 세션의 `clothes` 조회 0건, 쓰기·Storage 업로드 거절 | QA E2E T2-06/07, **운영** |
| 정식 사용자 회귀(DB-1 하에서) | 저장·조회·수정·삭제, 배경 제거 포함 저장(650×430, 투명 31.7%, box 대비 0.99) | QA E2E T2-08/19, 1A-1 E2E-05·06 |
| 사용자 간 차단 | 다른 사용자 경로 처리 403, 없는 파일 404, 옷장·사진 접근 차단 | QA E2E T2-09/18, 1A-1 E2E-07 |
| 영구 한도 | 한도 초과 429, **서버 재시작(메모리 초기화) 후에도 429 유지** | QA E2E T2-10/11 |
| 한도 우회 방지 | 익명 세션을 새로 만들어도 IP 상한, 사용자별 독립, 저장소 장애 시 대체 | 단위 T2-12·13, 10c |
| `ai_usage` 보호(DB-2) | 직접 조회·쓰기 거절, 비로그인 호출 거절, 잘못된 kind 거절, 동시 10회 정확 | QA E2E T2-14/15, **운영**(비로그인 거절·직접 조회 거절·본인 호출 정상) |
| 백엔드 사용량 기록 | 분석 요청 시 운영 `ai_usage`에 기록 | **운영**(직접 호출 1 → 분석 → 3) |
| 버킷 제한(DB-3) | 텍스트 거절, 10MB 초과 거절, 정상 JPEG 허용 | QA E2E T2-16 |
| anon 권한 회수(DB-5) | anon 조회·쓰기 `42501` | **운영**, QA |
| SSRF | 외부·내부 주소, `..`, 다른 사용자 폴더 차단, 서버 외부 요청 0건, 서명 URL 주소 검증 | 단위 T2-17/18, QA E2E |
| 익명 → 정식 전환 | **같은 사용자 ID**, 갱신 후 `is_anonymous=false`, 저장 성공, 같은 이메일로 재로그인 | QA E2E T2-20 |
| 익명 → 기존 계정 로그인 | 그 계정에 저장 | QA E2E T2-21 |
| 앱(웹) 익명 세션 | 첫 분석 시 익명 세션 생성, 요청에 토큰 첨부, 백엔드 통과 | 웹 빌드(QA 연결) T2-01 |
| 앱(웹) 화면 | 익명 세션 상태의 홈·옷장·Today·Looks = 로그아웃 화면, "내 옷장 보기" → 로그인 화면 | 웹 빌드 T2-22 |
| 로그인 판단 코드 | 화면의 로그인 판단 전부 `isSignedIn` 경유 | 코드 검사 T2-23 |
| 익명 로그인 실패 시 분석 유지 | 운영 설정(당시 익명 꺼짐)에서 익명 로그인 422 → 토큰 없이 분석 요청 → 백엔드 통과 | 웹 빌드 T2-02 |
| 이메일 가입·로그인 설정 | DB 변경 후에도 이메일 제공자·가입 허용·자동 확인 그대로 | 운영 Auth 설정 API |

### Failed

| 내용 | 판단 |
|---|---|
| 없음 (Sprint 범위 기능 기준) | — |
| 참고: 운영 동작 테스트 중 1회 Gemini 혼잡으로 504 `AI_TIMEOUT` | 외부 서비스 지연. 서버가 설계대로 응답. 재시도에서 200 |

### Not Tested

| 내용 | 이유 | 처리 |
|---|---|---|
| **운영에서 정식 로그인 사용자의 저장·조회·수정·삭제(DB 변경 후)** | 운영에 정리할 수 없는 테스트 계정을 만들지 않음. 같은 정책을 QA에서 검증했고 운영 정책이 같은 식임을 확인 | **PO 확인으로 확정** |
| 앱 화면의 회원가입·로그인 입력 흐름(T2-25) | 원격 서비스로 가는 비밀번호를 브라우저에 입력할 수 없음, 시뮬레이터 조작 도구 없음 | PO 확인 |
| 앱 화면의 익명 → 회원가입 전환(같은 ID 유지 체감) | 위와 같음. 서비스 단계는 QA E2E로 확인 | PO 확인 |
| G0(PQ-1~3) | Sprint 중 Gemini 일일 한도 소진으로 대기 | PO 확인(지금 가능) |
| 실제 휴대폰 사진 크기(PQ-6) | 실기기 사진 필요 | PO 확인 시 백엔드 로그로 측정 |
| CAPTCHA | 이번 범위 아님 | Beta 전 검토 |

---

## 4. 남은 문제

| 항목 | 내용 | 다음 조치 |
|---|---|---|
| 토큰 없는 분석 임시 호환 모드 | 켜져 있음(PRD SEC-01 ① 미충족). 익명 로그인 실패 시 분석을 지키기 위함 | 운영 익명 로그인 안정 확인 후 `ALLOW_TOKENLESS_GUEST=false` 결정 |
| 익명 Auth 사용자 누적 | 분석할 때마다 익명 사용자가 생기고 지울 수 없음(관리자 키 없음) | 1A-11(계정 삭제·서버 관리자 권한)과 함께 정리 작업 설계 |
| 익명 로그인 남용 | Supabase가 CAPTCHA를 권장. 현재 Supabase 익명 로그인 IP당 시간당 30회 + 서버 IP 상한 | Beta 전 CAPTCHA 도입 여부 결정 |
| Gemini 무료 등급 | 하루 사용으로 한도 소진 경험. Beta 참가자 규모면 바로 막힘(PRD AC-G7) | Phase 2 진입 전 유료 등급·호출량 결정(별도 승인) |
| 마이그레이션 이력 미등록 | 운영·QA 모두 SQL Editor로 적용 | CLI 도입 시 `migration repair` |
| KI-1 배경 제거 품질 | 이관 상태 유지(Sprint 1A-3) | 1A-3 첫 작업 |
| 한도 값 | 개발·QA 가설(익명 30, 사용자 30, IP 30, guest 10) | 베타 전 비용 기준으로 재검토 |

---

## 5. 완료 판단

**조건부 완료.** Sprint 범위의 코드·DB 작업과 자동·실연동 검증은 끝났고 실패 항목은 없다. 운영 DB 5건도 적용·확인했다. 다만 완료 기준 1(G0)과 4(PO 화면 확인 T2-25)가 남아 있고, 운영에서 정식 사용자 동작은 PO 확인으로 확정해야 한다.

**종료 조건:** PO 확인(약 10분) 통과 → Sprint 1A-2 종료. 실패하면 Sprint 범위 결함으로 수정한다.

**PO 확인 (iOS 시뮬레이터, `npm run backend` + `npx expo start` → `i`)**
1. 로그아웃 상태에서 사진 분석 → "내 옷장에 저장" → **새 계정으로 회원가입** → 옷장에 배경 제거 이미지로 저장되는지 (익명 → 정식 전환 경로)
2. 로그아웃 → 다른 사진 분석 → 저장 → **기존 계정 로그인** → 그 계정 옷장에 저장되는지
3. 저장한 옷으로 Styling → Looks → 홈 Today's Look
4. 옷 상세에서 **사진 교체**와 **삭제**가 되는지(운영 DB-1·DB-3 하에서 정식 사용자의 Storage·DB 쓰기 확인)
5. 틀린 비밀번호 → "로그인 실패"

흰 옷 + 흰 배경 사진은 KI-1 때문에 피한다.

---

## 6. 최종 QA (2026-10-19)

QA Supabase 프로젝트에서 새 QA 계정으로 실행했다(운영 데이터 무변경). 앱의 Supabase 호출 순서(`src/lib/clothes.ts`)를 그대로 따르는 E2E `backend/test/e2e/sprint-1a-2-qa.e2e.js`를 추가했다.

| # | 요청 항목 | 결과 | 근거 |
|---|---|---|---|
| 1 | 분리된 QA 계정 사용 | **Confirmed** | QA 프로젝트(`styleseed-qa`)에서 실행마다 새 계정 생성. 운영에는 계정을 만들지 않음 |
| 2 | 회원가입 → 로그인 → 저장 → 조회 → 수정 → 삭제 | **Confirmed**(서비스 단계) | Q-01 가입·로그아웃·재로그인, Q-03 실제 Gemini 분석 + SlimSAM(650×430) 저장, Q-04 조회·이미지 2장 표시, Q-05 사진 교체(행 갱신·이전 파일 삭제), Q-06 삭제(행 0·파일 0) |
| 3 | 익명 분석 → 신규 가입 → 로그인 → 저장 | **Confirmed**(서비스 단계) | 1A-2 E2E T2-20: 같은 사용자 ID로 전환, 저장, 같은 이메일로 재로그인 |
| 4 | 기존 로그인 사용자로 저장 | **Confirmed**(서비스 단계) | 1A-2 E2E T2-21, QA E2E Q-03 |
| 5 | iOS 시뮬레이터 Styling / Looks / Today | **부분 Confirmed** | iOS(Expo Go, iPhone 17 Pro, iOS 26.5)에서 앱 번들 실행·런타임 오류 0건. 로그아웃 상태 홈·Today(실제 날씨 표시)·Looks·Closet 렌더링 확인. **로그인 상태(옷 데이터 있음) 화면은 Not Tested** — 시뮬레이터 입력 도구 없음 |
| 6 | 잘못된 비밀번호 안내 | **Confirmed + 결함 수정** | Supabase가 `invalid_credentials`와 영어 문구 "Invalid login credentials"를 돌려주고 앱이 그대로 보여주던 결함을 발견 → 한국어 안내로 수정(아래). 화면의 알림 표시는 Not Tested |
| 7 | 이미지 10MB 제한 | **Confirmed** | Storage: 9.9MB 허용, 10.1MB 거절, PDF 거절(Q-07). 분석 요청: 본문 약 9.9MB 통과, 약 10.3MB는 413(Q-08) |
| 8 | KI 상태 갱신 | 완료 | `docs/sprints/known-issues.md` |

### 발견·수정한 결함

| 결함 | 원인 | 수정 | 검증 |
|---|---|---|---|
| 로그인·가입 오류가 영어로 표시 | `login.tsx`·`signup.tsx`가 Supabase 오류 원문(`error.message`)을 그대로 표시 | `src/lib/authErrors.ts`: 실제 코드(`invalid_credentials`, `user_already_exists`, `email_exists`, `weak_password`, `validation_failed`, 요청 한도, 네트워크)를 한국어로. 알 수 없는 오류는 기본 안내(원문 미노출). 익명 전환의 "이미 가입된 이메일" 판별도 코드 기준으로 변경 | 단위 테스트 4개(QA에서 수집한 실제 응답 사용), `tsc` |

### 새로 확인한 제약

- **분석 가능한 사진 크기 상한은 실질적으로 약 7.4MB:** 앱이 사진을 base64(약 4/3배)로 보내므로 요청 본문 10MB 제한에 먼저 걸린다. Storage 한도(10MB)보다 작다 → 업로드 전 리사이즈 권장(KI-9).

### 최종 회귀

| 항목 | 결과 |
|---|---|
| 백엔드 단위 | 37/37 |
| 앱 단위 | 21/21 |
| `tsc` | 통과 |
| QA E2E (종료 QA) | 8/8 (실제 Gemini) |
| QA E2E 1A-2 / 1A-1 | 9/9, 8/8(+KI-1 todo) — 같은 날 앞선 실행 |

### Sprint 1A-2 종료 판단

**종료(Done) 권고.** Sprint 범위의 인증·데이터 보호 기능은 단위·QA 실연동·운영 동작 테스트로 확인했고, 실패 항목은 없다. 이번 QA에서 찾은 결함(오류 영어 노출)은 수정·재검증했다.

남은 것은 **로그인 상태의 앱 화면 확인**(PQ-1·2·3 화면 부분, PQ-7)뿐이다. 이 확인은 Claude가 실행할 수 없고(원격 로그인 입력·시뮬레이터 조작 불가), 출시 계획의 실기기 QA(`docs/launch/DEPLOYMENT_PLAN.md` B10, TestFlight 빌드)에서 반드시 거치는 단계와 같다. 따라서 Sprint를 막는 조건이 아니라 **출시 전 필수 QA 항목**으로 옮긴다.
