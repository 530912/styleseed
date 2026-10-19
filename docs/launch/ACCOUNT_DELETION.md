# 계정 삭제 (회원 탈퇴 + 웹 삭제 요청) — Beta Launch

| 항목 | 내용 |
|---|---|
| 작성일 | 2026-10-19 |
| 요구사항 | PRD FR-AUTH-05, SEC-09, TR-13 / Apple 5.1.1(v) 앱 내 계정 삭제 / Google Play 계정 삭제 요구사항(앱 내 + 웹 링크) |
| 상태 | **구현·단위 테스트 완료. 실제 Supabase 연동은 Not Tested(QA 관리자 키 필요 → Secret 승인).** 운영 데이터는 건드리지 않았다 |

---

## 1. 삭제 범위 분석

| 데이터 | 위치 | 삭제 방법 | 근거 |
|---|---|---|---|
| 옷 사진(원본·배경 제거·처리 중) | Storage `clothing-images/{userId}/originals·cutouts·processing/` | 관리자 키로 폴더 전체 조회 후 100개씩 삭제 | 앱 업로드 경로(`src/lib/clothes.ts`) |
| 옷 정보 | `public.clothes` | **Auth 사용자 삭제 시 자동**(`user_id` FK `on delete cascade`) | baseline 마이그레이션 |
| AI 사용량 | `public.ai_usage` | **Auth 사용자 삭제 시 자동**(FK cascade) | `20261018000100_ai_usage.sql` |
| 계정 | `auth.users`(+ identities·sessions·refresh tokens, Supabase 관리) | `auth.admin.deleteUser(id, false)` — 영구 삭제(soft delete 아님) | Supabase 문서 |
| 기기 캐시 | AsyncStorage(옷장·보류 중인 옷·이미지 선호), 메모리(분석 이미지) | 앱이 삭제 성공 후 지움 + 로컬 로그아웃 | `src/lib/accountDeletion.ts` |
| 이벤트·코디 기록 | 아직 테이블 없음(PRD FR-DATA) | 생기면 FK `on delete cascade`로 만들 것 | 개발 트랙 인계 H-6 |
| 사진 AI 동의 기록 | 기기(계정과 무관) | 남김(기기 단위 설정) | |
| 외부 업체 사본 | Gemini(무료 등급 시 개선용 보관 가능), BRIA | **회사가 지울 수 없음** → 처리방침에 고지 ⚖️ | PRIVACY_DATA_FLOW 3장 |

**순서가 중요한 이유:** Supabase는 Storage 객체를 소유한 사용자를 삭제하지 못한다 [공식: Supabase User Management]. 그래서 Storage → Auth 순서로 지운다.

## 2. 설계

```text
[앱] 내 옷장 → 계정 → 회원 탈퇴
  ① 삭제 항목 안내, 비밀번호 입력, "되돌릴 수 없음" 체크, 확인 알림
  ② supabase.auth.signInWithPassword(현재 이메일, 비밀번호)  → 새 토큰(amr 시각 = 지금)
  ③ POST /account/delete  { confirm: "DELETE" }  Bearer 새 토큰
[백엔드]
  ④ authenticate(토큰 서명 검증) → requireUser(익명 403) → 확인 문구(400) → 최근 인증 10분 이내(401 REAUTH_REQUIRED)
  ⑤ 관리자 키 없으면 503
  ⑥ Storage {userId}/ 전체 삭제 → auth.admin.deleteUser(영구) → Storage 한 번 더 비움
[앱]
  ⑦ 200이면 기기 캐시 삭제 + 로컬 로그아웃 → 홈
```

웹(Google Play 요구사항): `GET /account-deletion` 페이지에서 이메일·비밀번호·확인 체크 → `POST /account-deletion`이 Publishable key로 비밀번호 로그인해 본인 확인 → 같은 삭제 함수 실행.

### 권한 검증

| 위협 | 대책 |
|---|---|
| 다른 사람 계정 삭제 | 삭제 대상은 **검증된 토큰의 `sub`** 또는 **비밀번호 로그인으로 얻은 사용자 ID**뿐. 요청 본문의 ID는 받지 않음 |
| 토큰을 훔친 사람의 삭제 | 토큰의 `amr` 인증 시각이 10분 이내여야 함(토큰 갱신으로는 바뀌지 않음) → 비밀번호를 알아야 함 |
| 익명 세션으로 호출 | 403 `ANONYMOUS_NOT_ALLOWED` |
| 웹 페이지 비밀번호 대입 | IP당 시간당 5회(초과 429, `TRUST_PROXY=1` 필수), Supabase Auth 자체 한도 |
| 웹 페이지 XSS·클릭재킹 | 출력 이스케이프, CSP `default-src 'none'`·`frame-ancestors 'none'`, `X-Frame-Options: DENY`, `noindex`, `no-store` |
| 관리자 키 노출 | 서버 환경변수(`SUPABASE_SECRET_KEY`)로만 읽음. 앱 번들·응답·로그에 없음. 로그에는 사용자 ID 대신 SHA-256 앞 12자리 |

### 실패 복구

| 실패 지점 | 상태 | 응답 | 복구 |
|---|---|---|---|
| Storage 조회·삭제 | 계정 유지, 일부 파일 삭제됐을 수 있음 | 502 `ACCOUNT_DELETION_FAILED` `step: storage` | 같은 요청 재시도 → 남은 파일부터 이어서 삭제 |
| Auth 삭제 | 파일은 모두 삭제, 계정 유지 | 502 `step: auth` | 재시도 → 파일 없음 → 계정 삭제 |
| 삭제 후 마지막 Storage 정리 | 계정 삭제 완료 | **200**(계정은 지워짐) | 서버 로그 `수동 확인 필요` → 운영자가 해시로 찾아 정리 |
| 관리자 키 없음 | 아무것도 안 함 | 503 | 설정 후 재시도 |

모든 단계는 반복 실행해도 안전하다. 계정이 남아 있는 동안은 다시 로그인해 재시도할 수 있다(그래서 중간에 계정을 **차단(ban)하지 않는다**).

### 중복 요청

| 경우 | 동작 |
|---|---|
| 같은 사용자의 동시 요청 | 서버 메모리에서 진행 중인 작업 하나를 함께 기다림 → 삭제 1회, 모두 200 |
| 끝난 뒤 같은 토큰으로 다시 요청(토큰은 만료 전까지 유효) | `deleteUser` 404 → **200 `alreadyDeleted: true`**, 남은 파일 정리 |
| 서버 인스턴스가 여러 개 | 동시 요청이 다른 인스턴스로 가도 각 단계가 멱등이라 결과는 같음(삭제 호출이 2번 갈 수 있음) |

## 3. 수용 기준(AC)과 검증 결과

| AC | 내용 | 결과 | 근거 |
|---|---|---|---|
| AD-AC1 | 앱 안에서 탈퇴할 수 있다(계정 화면, 3번 이하 이동) | ✅ 구현 / 화면 렌더링 확인 | 내 옷장 → 계정 → 회원 탈퇴. 웹 번들 정적 렌더링 확인. 실기기 동작 **Not Tested** |
| AD-AC2 | 탈퇴 후 해당 사용자의 Storage 파일·`clothes`·`ai_usage`·Auth 계정이 0건 | ✅ 단위 / ⬜ 실연동 | AD-07·08(가짜 관리자). 실 DB cascade는 AD-E1 **Not Tested** |
| AD-AC3 | 다른 사용자 데이터는 그대로 | ✅ 단위 / ⬜ 실연동 | AD-07, AD-19 / AD-E3 Not Tested |
| AD-AC4 | 토큰 없음 401, 익명 403, 무효 토큰 401, 확인 문구 없음 400, 오래된 인증 401 | ✅ | AD-01~05 |
| AD-AC5 | 관리자 키가 없으면 안전하게 거절(503) | ✅ | AD-06 |
| AD-AC6 | 중간 실패 후 재시도로 완료 | ✅ | AD-09·10·11 |
| AD-AC7 | 중복·동시 요청에 삭제 1회, 모두 성공 | ✅ | AD-13 |
| AD-AC8 | 이미 삭제된 계정 요청은 성공 처리 | ✅ | AD-12 |
| AD-AC9 | 로그에 사용자 ID·토큰 원문 없음 | ✅ | AD-15 |
| AD-AC10 | 웹 삭제 페이지: 앱 없이 삭제 가능, 잘못된 비밀번호 거절, 입력 이스케이프, 시도 제한 | ✅ | AD-18·19·20 / 실 Supabase 비밀번호 확인 AD-E2 **Not Tested** |
| AD-AC11 | 실제 Supabase 토큰에 `amr` 시각이 있어 최근 인증 검사가 동작 | ⬜ **Not Tested** | AD-E1에서 확인하도록 작성. Supabase 액세스 토큰은 `amr`을 포함하는 것으로 알려져 있으나 이 프로젝트에서 미확인 |
| AD-AC12 | 앱 응답 해석(재인증·로그인 만료·재시도 구분) | ✅ | 클라이언트 AC-01~05 |

실연동 실행(승인 후):

```bash
E2E_SUPABASE_URL=https://<qa-ref>.supabase.co \
E2E_SUPABASE_PUBLISHABLE_KEY=sb_publishable_... \
E2E_SUPABASE_SECRET_KEY=sb_secret_... \
node --test backend/test/e2e/account-deletion.e2e.js
```

키가 없으면 3건 모두 건너뛴다(확인함). 테스트 계정은 삭제가 곧 정리라 QA에 남지 않는다.

## 4. 남은 일

| # | 항목 | 필요 |
|---|---|---|
| R-1 | QA 관리자 키로 AD-E1~E3 실행 | ⛔ Secret 발급·전달 승인 |
| R-2 | 운영 `SUPABASE_SECRET_KEY`를 Railway 변수로 등록 | ⛔ Secret·배포 승인 |
| R-3 | 웹 삭제 페이지 주소를 Play Console "데이터 삭제" 항목에 입력 | 백엔드 배포 후 |
| R-4 | 비밀번호를 잊은 사용자의 삭제 경로(지원 이메일 또는 비밀번호 재설정 — PRD FR-AUTH-04 미구현) | 결정 D-6 |
| R-5 | 익명 Auth 사용자 정리(KI-4): 같은 관리자 키로 정리 작업 가능 | 별도 작업 |
| R-6 | 서버 측 삭제 감사 기록(누가 언제 삭제했는지) | DB 변경 승인 필요. 현재는 서버 로그(해시)만 |
