# 앱스토어 등록 준비 — PO가 할 일 / Claude가 할 일

| 항목 | 내용 |
|---|---|
| 작성일 | 2026-10-19 |
| 범위 | iOS TestFlight(내부·외부), Google Play 내부·비공개 테스트 |
| 원칙 | 결제·본인 인증·법적 결정·비밀값 입력·외부 제출은 **PO**. 문서 초안·설정 파일·코드·검증·양식 답안 초안은 **Claude** |
| 상세 체크리스트 | `STORE_SUBMISSION_CHECKLIST.md` |

## 1. 계정

| 항목 | PO | Claude |
|---|---|---|
| Apple Developer Program 가입(본인 인증·결제, 개인/조직) | ✅ | 가입 유형별 차이 정리(완료: D-15) |
| Google Play 개발자 계정(본인 인증·등록비), 조직이면 D-U-N-S | ✅ | — |
| App Store Connect·Play Console에 Claude가 쓸 권한 | 직접 제출만 할지 결정 | 제출 화면 입력값 초안 |
| Expo(EAS) 계정 생성·로그인(`eas login`) | ✅(대화형 로그인) | `eas init` 이후 설정·빌드 명령(⛔ 빌드 승인 후) |
| Railway 계정·결제 수단, 플랜(Hobby/Pro) | ✅ | 구성값·비용표(`RAILWAY_DEPLOY_RUNBOOK.md`) |
| Supabase Pro 전환, Gemini 유료 등급 결제 | ✅ | 전환 후 설정·검증 |
| 비밀값 발급·입력(Supabase Secret key, Gemini, BRIA, OPS 토큰) | ✅ 대시보드에 직접 | 변수 이름·형식 안내, `check-env.mjs`로 값 없이 확인 |

## 2. 정책·법적 정보

| 항목 | PO | Claude |
|---|---|---|
| 운영 주체·주소·연락처, 개인정보 보호책임자 | ✅ 결정·제공 | 문서에 반영 |
| 가입 연령(만 18세 권장, Gemini 약관), 배포 국가(한국 권장) | ✅ 결정 | 근거 정리(완료), 약관·연령 설문 반영 |
| 개인정보처리방침·이용약관 법률 검토 | ✅ 의뢰 | 초안(완료: `docs/legal/`), 검토 의견 반영 |
| 정책 문서 게시 위치(웹사이트·Notion·GitHub Pages 등) | ✅ 결정 | 게시용 페이지 작성, 앱 링크·EAS 변수 연결 |
| 지원 URL·지원 이메일 | ✅ 결정 | 웹 삭제 페이지·앱·스토어에 반영 |
| Apple 개인정보 라벨 / Play 데이터 보안 양식 | 최종 확인·제출 | 답안 초안(코드 기준, `STORE_SUBMISSION_CHECKLIST.md` 2.1) |
| 연령 등급(Apple) / 콘텐츠 등급·타깃층(Play) | 최종 확인·제출 | 답안 초안 |
| 수출 규정(암호화) | — | 설정 완료(`ITSAppUsesNonExemptEncryption=false`) |
| 광고·특수 기능 선언(Play) | 제출 | 답안 초안(광고 없음) |

## 3. 에셋·스토어 문구

| 항목 | PO | Claude |
|---|---|---|
| 앱 아이콘·Android 적응형 아이콘·스플래시 디자인 | ✅ 디자인 확정(또는 외주) | 규격 목록(완료), 받은 파일을 `app.json`·`assets/`에 반영, 미리보기 확인 |
| 앱 이름(표시 이름 `styleseed` → `STYLESEED`?) | ✅ 결정 | `app.json` 반영 |
| 스크린샷(iPhone·Android), Play 그래픽 이미지 | 촬영 승인·최종 선택 | 시뮬레이터·preview 빌드로 촬영 초안(개인정보 없는 데모 옷장) |
| 앱 설명·짧은 설명·키워드·카테고리 | 최종 승인 | 초안 작성 |
| TestFlight 베타 앱 설명·피드백 이메일 | 피드백 이메일 결정 | 문구 초안 |

## 4. URL

| URL | 필요한 곳 | 준비 | 상태 |
|---|---|---|---|
| 개인정보처리방침 | 앱(계정 화면), App Store Connect, Play Console | PO 게시 → Claude 연결 | 초안만 |
| 이용약관 | 앱(계정 화면) | 같음 | 초안만 |
| 지원(Support) URL | App Store Connect(필수) | PO 결정 | 없음 |
| **웹 계정 삭제** `https://<백엔드>/account-deletion` | Play 데이터 보안 양식(필수) | Claude(구현 완료) → 백엔드 배포 후 주소 확정 | 배포 대기 |
| 백엔드 API `https://<백엔드>` | EAS `EXPO_PUBLIC_API_URL` | Claude(배포 후 연결) | 배포 대기 |

## 5. 심사·테스트 운영

| 항목 | PO | Claude |
|---|---|---|
| 심사용 계정(운영 DB) 생성 승인 | ✅ ⛔ | 계정에 넣을 데모 옷장 구성·심사 안내 문구 |
| 심사 연락처(이름·전화·이메일) | ✅ | — |
| 내부 테스터(팀원) 초대 | ✅ | 초대 대상 정리 |
| 외부 테스터 300명 모집, (개인 계정이면) 12명 × 14일 유지 | ✅ | 안내 문구·피드백 양식 초안 |
| 빌드·제출(`eas build`, `eas submit`) | ⛔ 승인 | 명령 실행·결과 보고 |
| 실기기 QA | 기기 제공·직접 확인 일부 | 체크리스트·결과 기록 |
