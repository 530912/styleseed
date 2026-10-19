# Beta Launch 준비 현황 (출시 트랙 1차)

| 항목 | 내용 |
|---|---|
| 작성일 | 2026-10-19 |
| 브랜치 | `release/beta-prep` (기준 `sprint/1a-2` `835681e`). **커밋·Push·병합 안 함**(작업 트리 변경 상태) |
| 승인 범위 | A 정책·개인정보 / B EAS 설정 / C 클라우드 배포 준비 / D 계정 삭제 |
| 하지 않은 것 | 운영 DB 변경, 실제 데이터 삭제, Secret 생성·변경, 외부 배포, 유료 서비스 활성화, 빌드·스토어 제출, 식별자 등록 |

상세 문서: `PRIVACY_DATA_FLOW.md`(A) · `../legal/*_DRAFT.md`(A) · `EAS_SETUP.md`(B) · `BACKEND_DEPLOY.md`(C) · `ACCOUNT_DELETION.md`(D) · `../handoff/release-beta-prep-handoff.md`(개발 트랙 연동)

---

## 1. 기능별 수용 기준(AC)과 검증 결과

표기: ✅ Tested(Pass) · ⬜ Not Tested(이유 기재) · ⚖️ 법률 검토 필요

### A. 앱스토어 정책·개인정보

| AC | 내용 | 결과 |
|---|---|---|
| A-1 | 사진·개인정보의 실제 흐름을 코드 근거로 문서화(Gemini·BRIA·Supabase·fal·위치·로그) | ✅ `PRIVACY_DATA_FLOW.md` |
| A-2 | 개인정보처리방침·이용약관 초안, 미확정 사업자 정보는 빈칸, 법률 검토 항목 표시 | ✅ 초안 2건(`【미정】`, ⚖️) — 게시 ⬜ |
| A-3 | 첫 분석 전 사진 AI 전송 안내·동의, 거부 시 분석하지 않음, 철회 가능, 문구 버전 관리 | ✅ 구현·단위 테스트(CS-01~03)·웹 번들 렌더링 / 실기기 탭 동작 ⬜(시뮬레이터 탭 도구 없음, B10) |
| A-4 | Gemini 무료 등급 사용 사실 고지(설정으로 전환) | ✅ 기본 표시, `EXPO_PUBLIC_GEMINI_PAID_TIER=true`면 숨김 |
| A-5 | Google Play 웹 계정 삭제 요청 페이지 | ✅ 구현·테스트(AD-18~20) / 공개 URL ⬜(배포 전) |
| A-6 | 정책 문서 링크를 앱에서 열 수 있음(주소 미정이면 "준비 중") | ✅ 계정 화면 렌더링 확인 / 실제 링크 ⬜(문서 미게시) |

### B. Expo EAS

| AC | 내용 | 결과 |
|---|---|---|
| B-1 | `eas.json` development·preview·production, 키가 공식 스키마와 맞음 | ✅ 스키마 대조 / CLI 검증 ⬜(로그인 필요) |
| B-2 | 식별자 후보 `com.styleseed.app` 반영, 등록하지 않음 | ✅ `app.json`만 반영, 빌드 안 함. 공개 스토어 중복 없음(검색) |
| B-3 | 권한 문구 한국어, 쓰지 않는 권한 제거 | ✅ 로컬 `expo prebuild`(설치 없이) 결과 Info.plist·AndroidManifest 확인 후 생성물 삭제 |
| B-4 | 필요한 에셋 목록 | ✅ `EAS_SETUP.md` 5장 — 아이콘·스플래시가 **템플릿 기본값**임을 확인 |
| B-5 | 실제 EAS 빌드 성공 | ⬜ 빌드 금지(승인 범위 밖) |

### C. 클라우드 백엔드 (Railway + SlimSAM)

| AC | 내용 | 결과 |
|---|---|---|
| C-1 | 배포용 Dockerfile(백엔드 의존성만, 모델 포함, 비밀값 제외, 비루트 실행) | ✅ 작성 / `docker build` ⬜(이 Mac에 Docker 없음) |
| C-2 | 배포 전용 의존성으로 설치·기동·헬스 체크 200 | ✅ BD-01~03 |
| C-3 | 모델 캐시만으로 로딩(런타임 다운로드 없음) | ✅ BD-02(0.23초) |
| C-4 | 의존성 누락·버전 차이 자동 감지 | ✅ DP-01~03 |
| C-5 | 로딩 시간·메모리·성능 측정 도구와 측정값 | ✅ macOS 측정(최대 2.3GB, 동시 2건 3.6GB) / 리눅스 컨테이너 ⬜ |
| C-6 | 헬스 체크·환경변수 구조 문서 | ✅ `BACKEND_DEPLOY.md` 2장 |
| C-7 | Railway 배포 | ⬜ 외부 배포·유료(승인 필요) |

### D. 계정 삭제

`ACCOUNT_DELETION.md` 3장 AD-AC1~12. 요약: 서버 단위 테스트 21건·클라이언트 5건 통과(권한 검증, 실패 복구, 중복 요청, 로그 마스킹, 웹 페이지). **실제 Supabase 연동(AD-E1~E3)은 Not Tested** — QA 관리자 키 필요(Secret 승인).

## 2. 테스트 실행 결과 (2026-10-19, 이 작업 트리)

| 명령 | 결과 | 기준선(작업 전) |
|---|---|---|
| `npm run test:backend` | **61 pass / 0 fail** | 37 pass |
| `npm run test:client` | **29 pass / 0 fail** | 21 pass |
| `node --test backend/test/e2e/account-deletion.e2e.js`(키 없음) | 3 skipped(의도대로 건너뜀) | — |
| `npx tsc --noEmit` | 기존 오류 2건만(`animated-icon.module.css`, `@/global.css`) — 새 오류 0 | 같은 2건 |
| `npx expo export --platform web` | 성공, 새 라우트 3개 포함 정적 렌더링 | — |
| 웹 번들 브라우저 확인(`/ai-consent`, `/account`, `/delete-account`) | 화면 표시 정상. React #418(hydration) 경고는 **기존 `/login`에서도 동일** → 기존 정적 웹 내보내기 문제, 네이티브 무관 | — |
| `npx expo prebuild --no-install`(생성물 삭제·`package.json`/`yarn.lock` 원복) | 성공, 권한 결과 확인 | — |
| `backend/scripts/prefetch-models.mjs`, `measure-slimsam.mjs` | 성공 | — |
| `npx expo lint` | ⬜ 실행 불가(ESLint 미설정, 기존 상태) | 같음 |
| `npm run test:e2e` 전체, `docker build`, EAS 빌드, 실기기 | ⬜ Not Tested | — |

## 3. 앱스토어 정책 관련 미완료 항목

| # | 항목 | Apple | Google | 막는 것 |
|---|---|---|---|---|
| P-1 | 개인정보처리방침 **게시 URL** | 필수 | 필수 | 사업자 정보(D-3), 법률 검토(D-13), 게시 위치 |
| P-2 | 이용약관 게시 | 권장 | 권장 | 같음 |
| P-3 | 계정 삭제 웹 URL 등록 | — | **필수** | 백엔드 배포(C-7) |
| P-4 | 지원(Support) URL | **필수** | 연락처 이메일 필수 | 지원 채널 결정(D-6) |
| P-5 | 연령 등급·대상 연령 | 설문 | 콘텐츠 등급·타깃 연령 | **Gemini 약관 18세 이상**(D-4) |
| P-6 | 개인정보 라벨(App Privacy) / 데이터 보안(Data safety) | 필수 | 필수 | 이 문서·PRIVACY_DATA_FLOW 3장으로 작성 가능, 확정은 D-10 이후 |
| P-7 | 심사용 테스트 계정·접근 안내 | 필수 | 필수 | 운영 DB에 리뷰 계정 생성(승인 필요) |
| P-8 | 앱 아이콘·스크린샷·그래픽 | 필수 | 필수 | 브랜드 에셋(D-14) |
| P-9 | 회원가입 시 약관·처리방침 동의 기록(PRD SEC-08) | — | — | 문서 게시 후 구현. 서버 기록은 DB 변경 승인 필요 |
| P-10 | 사진 AI 동의의 서버 기록 | 권장 | — | DB 변경 승인 필요(현재 기기 기록) |
| P-11 | 실제 Supabase 계정 삭제 E2E | 필수(동작 보장) | 필수 | QA 관리자 키(D-12) |
| P-12 | 비밀번호를 잊은 사용자의 삭제 경로 | — | 권장 | 지원 이메일 또는 비밀번호 재설정(FR-AUTH-04) |
| P-13 | 무료 등급 Gemini + EEA·영국·스위스 배포 금지 | — | — | 배포 국가 제한(D-5) |

## 4. 개발 트랙과 병합 시 충돌 가능 파일

병합 시뮬레이션 결과 **6개 공유 파일 모두 자동 병합(충돌 0)**: `backend/server.js`, `src/app/upload.tsx`, `src/app/closet.tsx`, `app.json`, `.env.example`, `.gitignore`. 상세·요청 사항은 `docs/handoff/release-beta-prep-handoff.md`.

| 파일 | 위험 | 이유 |
|---|---|---|
| `backend/server.js` | 낮음 | 출시 트랙은 끝부분 7줄만 추가. 개발 트랙이 파일 끝 오류 처리기 근처를 고치면 충돌 가능 |
| `src/app/upload.tsx` | 중간 | 개발 트랙이 `pickImage`를 크게 바꿨다. 출시 트랙은 `handleAnalyze`만 수정(현재 자동 병합) |
| `backend/package.json`·`package-lock.json` | 중간(새 파일) | 개발 트랙이 루트 의존성을 바꾸면 `deps.test.js`가 실패 → 같이 갱신 |
| `app.json` | 낮음 | 개발 트랙이 플러그인을 추가하면 같은 `plugins` 배열 |
| `package.json` | 없음 | 출시 트랙은 수정하지 않음 |

## 5. 사용자(PO) 결정이 필요한 사항

| # | 결정 | 선택지·권장 |
|---|---|---|
| D-1 | 앱 식별자 확정 | `com.styleseed.app`(후보) / 회사 도메인 역순 — 스토어 등록 후 변경 불가 |
| D-2 | 홈 화면 앱 이름 | 현재 `styleseed` → `STYLESEED` 권장 |
| D-3 | 운영 주체·사업자 정보, 개인정보 보호책임자, 문의처 | 처리방침·약관·스토어 필수 |
| D-4 | **가입·이용 연령** | Gemini 약관상 **만 18세 이상** 권장(또는 유료 등급·다른 모델로 바꿔도 같은 약관 적용 여부 법률 확인) |
| D-5 | 배포 국가 | 무료 등급이면 **한국만** 권장(EEA·영국·스위스 불가) |
| D-6 | 지원 채널(이메일·URL) | Apple Support URL 필수, 웹 삭제 페이지 `SUPPORT_EMAIL` |
| D-7 | 배포 브랜치·병합 순서 | `sprint/1a-3` 병합 후 `release/beta-prep` 병합 권장 |
| D-8 | Railway 설정 방식 | 대시보드 / IaC(`railway.ts`). Config as Code(`railway.json`)는 2026-12-01 지원 종료 |
| D-9 | 운영 감시 도구(헬스 체크·오류 수집) | Railway는 배포 시에만 헬스 체크 |
| D-10 | Gemini 유료 등급 전환 시점(기존 계획 B5) | 처리방침·동의 문구·배포 국가가 함께 바뀜 |
| D-11 | Supabase Pro 전환(기존 계획 B6) | |
| D-12 | **QA 관리자 키 발급**으로 계정 삭제 실연동 테스트 | ⛔ Secret 승인 |
| D-13 | 법률 검토 의뢰 범위 | PRIVACY_DATA_FLOW 5장 L-1~L-7 |
| D-14 | 앱 아이콘·스플래시·스크린샷 제작 | 현재 템플릿 이미지 |
| D-15 | 스토어 계정 유형(개인/조직) | 개인이면 Google 12명×14일 비공개 테스트 의무 |
| D-16 | SlimSAM 메모리 대응 | 동시 1건 제한(개발 트랙) + 4GB / 8GB로 상향 |

## 6. TestFlight·Google Play 비공개 테스트까지 남은 단계

⛔ = 승인 필요

| 순서 | 단계 | 담당 | 의존 |
|---|---|---|---|
| 1 | D-1·D-3·D-4·D-5·D-6 결정 | PO | — |
| 2 | 법률 검토 의뢰(초안 2건 + L-1~L-7) | PO | 1 |
| 3 | 개발 트랙 H-1(SlimSAM 동시 1건) 반영, 두 브랜치 병합 | 개발·출시 | D-7 |
| 4 | ⛔ QA 관리자 키 → 계정 삭제 E2E(AD-E1~E3) | 출시 | D-12 |
| 5 | ⛔ Railway 생성·배포(싱가포르, 4GB), 변수 입력, `/healthz` 확인, 리눅스 측정(BD-07) | 출시(+PO 비밀값) | 3 |
| 6 | ⛔ Gemini 유료 전환·Supabase Pro(기존 B5·B6) | PO | — |
| 7 | 처리방침·약관 확정본 게시 → EAS 변수에 URL 등록 | PO·출시 | 2 |
| 8 | 브랜드 에셋 교체(D-14) | PO·디자인 | — |
| 9 | ⛔ Apple Developer·Google Play 계정 등록(결제), `eas init` | PO | 1 |
| 10 | EAS 환경변수 등록, ⛔ preview 빌드 → 실기기 QA(B10, 개발 트랙 H-6~H-8 사진 처리 확인 포함) | 출시 | 5, 9 |
| 11 | ⛔ 심사용 계정 생성(운영 DB) | PO 승인 | 5 |
| 12 | ⛔ production 빌드 → `eas submit` → **TestFlight 내부 테스트** → 외부 테스트(베타 앱 심사 약 1일~) | 출시 | 7, 8, 10, 11 |
| 13 | Play Console: 등록정보·데이터 보안·콘텐츠 등급·계정 삭제 URL → ⛔ AAB 업로드 → 내부 테스트 → **비공개 테스트**(개인 계정이면 12명×14일 카운트 시작) | 출시·PO | 5, 7, 8, 9 |
