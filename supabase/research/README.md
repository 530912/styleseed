# 조사 전용 Supabase 프로젝트 만들기 (2026-11 사용자 조사)

기존 운영(`zkgsxa…`)·QA(`xcwlga…`) 프로젝트는 **건드리지 않는다.** 새 조직·새 프로젝트에만 적용한다.

## 1. 프로젝트 (PO, 대시보드)

1. supabase.com → 조직 목록 → **New organization** → 이름 `STYLESEED Research`, 플랜 **Pro**, 카드 등록
2. 그 조직에서 **New project** → 이름 `styleseed-research`, 리전 **Northeast Asia (Seoul)**, DB 비밀번호 생성(본인만 보관)

## 2. 스키마 (SQL Editor)

저장소 루트에서 마이그레이션 5개를 순서대로 합쳐 클립보드에 복사한다:

```bash
cat supabase/migrations/*.sql | pbcopy
```

조사 프로젝트 **SQL Editor → New query → 붙여넣기 → Run**. 두 번 실행해도 안전하다(2026-10-26 빈 Postgres에서 2회 적용 확인).

## 3. Auth 설정 (운영과 같게)

| 위치 | 값 |
|---|---|
| Authentication → Sign In / Providers → Email | 켬, **Confirm email 끔**(앱의 "가입 직후 저장"이 의존) |
| 같은 화면 → Allow new users to sign up | 켬 |
| 같은 화면 → **Allow anonymous sign-ins** | **켬**(로그인 전 분석) |

Site URL·리디렉션 URL은 앱이 쓰지 않는다. Edge Function·트리거·추가 확장은 없다.

## 4. 키

Project Settings → API Keys:

- **Publishable key**(`sb_publishable_…`): 앱 빌드·Railway 둘 다. 공개 값
- **Secret key 새로 만들기** → 이름 `railway-research`(`sb_secret_…`): **Railway 변수에만** 직접 붙여넣는다. 채팅·파일에 적지 않는다

## 5. 확인

SQL Editor에서 `supabase/research/verify-research-db.sql` 실행 → **모든 행 `ok = true`**.
(스키마 직후에는 사용자 0명이라 마지막 두 행도 true. 배포 검증 뒤 다시 실행해 테스트 데이터가 정리됐는지 확인한다.)
