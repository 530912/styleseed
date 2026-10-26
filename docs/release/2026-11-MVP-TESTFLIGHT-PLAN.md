# 2026-11 사용자 조사 — iOS TestFlight 우선 배포 준비

| 항목 | 내용 |
|---|---|
| 작성 | 2026-10-27, Claude A |
| 결정 | PO 10/27: 조사 참여자 다수가 iPhone → **첫 배포는 iOS TestFlight(외부 테스터)**, Android는 빌드 가능 상태 유지 |
| 기준 | 로컬 브랜치 `app/mvp-2026-11`(B `integration/mvp-2026-11` `8bec599`까지 병합). Push 안 함 |
| 하지 않은 것 | `eas init`, Apple 가입·결제, 빌드·제출·배포, 환경변수 등록 |
| 표기 | **실행** = 직접 실행해 확인 · **문서** = Apple·Expo 공식 문서 확인 · **미확인** |

## 0. 결론

- **iOS 빌드 설정은 준비됨(실행)**:
  - prebuild로 만든 iOS 프로젝트에 다음이 들어간 것을 확인했다.
    - 앱 이름 `STYLESEED`
    - 사진·카메라·위치 권한 한국어 문구
    - 개인정보 매니페스트
    - 1024 아이콘
    - 수출 규정(암호화 없음)
  - iOS JS 번들 생성 성공.
  - 네이티브 컴파일은 이 PC에 CocoaPods가 없어 **EAS 서버 빌드에서 처음 확인**된다(미확인).
- **TestFlight 외부 배포를 막는 것** (순서대로):
  1. ⛔ Apple Developer Program 가입 (PO, 연 US$99)
  2. ⛔ 서버 HTTPS 배포 + 조사용 DB (B). iOS 출시 빌드는 http 주소에 연결하지 않는다.
  3. 개인정보처리방침 공개 URL (B 초안 → PO 확정·게시)
  4. Beta App Review용 데모 계정 (조사 DB)
  5. ⛔ `eas init` 소유 계정 결정 (팀 계정 권장)
  6. 빌드 전 정리: `.easignore`, `yarn.lock` (B)
- **일정:**
  - 첫 외부 빌드의 Beta App Review가 끝나야 참가자가 설치할 수 있다.
  - 반려 1회를 감안해 **11/04까지 첫 심사 제출**을 목표로 한다.
  - 그러려면 Apple 가입을 **이번 주 초**에 시작해야 한다.

## 1. iOS 빌드 점검 결과

| # | 항목 | 결과 | 근거 |
|---|---|---|---|
| I-1 | prebuild(iOS 프로젝트 생성) | 성공 | 실행(scratchpad 복사본, 저장소에 `ios/` 안 만듦) |
| I-2 | 앱 이름 | `CFBundleDisplayName = STYLESEED` | 실행 |
| I-3 | Bundle ID | `com.styleseed.app`. Apple 계정에서 등록할 때 사용 가능 여부 확정(미확인) | 실행 |
| I-4 | 최소 iOS | 16.4 | 실행 |
| I-5 | 권한 문구 | 사진·**카메라(이번에 추가)**·위치(사용 중) 한국어. 마이크·항상 위치 없음 | 실행 — 문구가 빠지면 `appConfig.test.mjs`가 실패하게 함 |
| I-6 | 개인정보 매니페스트 | `PrivacyInfo.xcprivacy` 생성. 사용 라이브러리(react-native, expo-*, async-storage)가 선언한 API 사유 4종을 앱에 모음: UserDefaults CA92.1, FileTimestamp C617.1·0A2A.1·3B52.1, SystemBootTime 35F9.1, DiskSpace E174.1·85F4.1. 추적 없음 | 실행 + 문서(Expo: 정적 CocoaPods의 매니페스트는 Apple이 제대로 읽지 못할 수 있어 앱 설정에 복사 권장) |
| I-7 | 수출 규정 | `ITSAppUsesNonExemptEncryption = false` → 업로드마다 질문 안 받음 | 실행 |
| I-8 | 화면 모드 | `UIUserInterfaceStyle = Light`(앱이 밝은 색만 지원, 다크 모드 시스템 UI와 어긋남 방지) | 실행 |
| I-9 | 아이콘 | **임시 STYLESEED 아이콘**(흰 바탕 + 검은 S + 워드마크, 1024, 투명도 없음). 최종 브랜드 아이콘은 PO 전달 시 교체 | 실행 |
| I-10 | iOS JS 번들 | Hermes 3.8MB, 비밀키·서버 코드 없음 | 실행 |
| I-11 | 네이티브 컴파일 | **미확인**(CocoaPods 미설치). EAS 첫 빌드에서 확인 | — |
| I-12 | 빌드 프로필 | `testflight` 새로 추가: 스토어 배포(TestFlight 업로드용) + `preview` 환경(조사 변수) + 빌드 번호 자동 증가. `eas submit --profile testflight` | `eas.json`, 테스트 |
| I-13 | HTTPS | iOS 출시 빌드는 ATS 때문에 http 서버에 연결하지 않음 → 서버는 **https 주소 필수**(B `check-env --app`이 http면 오류) | 문서 |
| I-14 | 계정 삭제 | 앱 안에서 가능(옷장 → 계정 → 계정 삭제, B 구현) — Apple 심사 지침 5.1.1(v) 대비 | 코드 |
| I-15 | 제3자 AI 고지 | 첫 분석 전 사진 AI 동의 화면(Google Gemini 등 수탁자·국외 처리 고지, 거부 가능) — 개인 데이터를 제3자 AI로 보내기 전 고지·동의 요구에 대비 | 웹 실행 |

**Android 유지:** `preview` 프로필(내부 APK) 그대로. 카메라 권한 문구를 넣었으므로 Android도 촬영 시 권한을 묻는다(라이브러리 매니페스트의 `CAMERA`가 다시 포함됨, prebuild로 확인). 앱 이름·아이콘 같이 바뀜.

## 2. 배포 방식이 바뀌어 달라지는 점 (진행자 기기 → 참가자 본인 iPhone)

| 영향 | 내용 | 대응 |
|---|---|---|
| 서버 | 참가자 휴대폰이 인터넷으로 직접 접속 → LAN·Expo Go 방식 불가 | B 배포(HTTPS) 필수 |
| 계정 | 참가자가 **본인 이메일로 가입** → 조사 DB에 개인 이메일이 들어감 | 처리방침·동의서에 명시, 조사 후 계정 삭제 안내(앱 안 삭제 가능) |
| 이벤트 기록 | 기기에만 저장 → 참가자 휴대폰마다 내보내야 함 | **대면 세션**: 진행자가 참가자 휴대폰에서 로고 길게 누르기 → 참가 코드 설정 → 세션 끝에 [기록 내보내기] → AirDrop으로 진행자 Mac. **7일 사용 기록(선택)**은 휴대폰을 다시 받아야 하므로 서버 저장이 필요(⛔ `research_events` 테이블, 결정 D-T1) |
| 진행자 화면 | TestFlight 빌드는 모든 테스터에게 같음 → 로고를 길게 누르면 누구나 진행자 화면이 열림 | 참가 코드는 배정표에 있는 것만 받으므로 피해는 작음. 문제가 되면 진행자 PIN 추가(D-T2) |
| 연령 | Gemini 약관 18세 이상 | 모집 조건에 명시, App Store Connect 연령 등급 설정 |
| 기기 조건 | iOS 16.4 이상, TestFlight 앱 설치 | 모집 공지에 명시 |
| 빌드 유효기간 | 업로드 후 90일 | 조사 기간(11월~1월) 안에 새 빌드 1회 필요할 수 있음 |

## 3. Apple Developer Program

| 항목 | 개인(Individual) | 조직(Organization) |
|---|---|---|
| 비용 | 연 US$99(현지 통화). 한국 계정 갱신액 129,000원 사례 보고(공식 원화 가격은 결제 화면에서 확인) | 같음 |
| 필요한 것 | 2단계 인증을 켠 Apple 계정, 법적 성년, **본인 법적 이름** | + **D-U-N-S 번호**(무료), 법인(계약 체결 가능한 법적 실체), 서명 권한, **회사 도메인 이메일**, **회사 도메인의 실제 웹사이트** |
| 판매자 이름 | 개인 실명이 표시 | 법인명 표시 |
| 소요 | 보통 빠름(구체 기간은 Apple 미공개) | D-U-N-S 발급 + Apple 검증 → **더 오래 걸림**(기간 미공개) |
| 판단 | **11/09 일정이면 현실적인 선택** | 법인·D-U-N-S·웹사이트가 이미 있으면 장기적으로 권장 |
| 비영리 면제 | 개인·개인사업자·1인 기업은 대상 아님 | 비영리·교육기관·정부만 |

→ **결정 D-T3(PO):** 개인/조직. 나중에 개인 → 조직으로 옮기는 앱 이전에는 조건이 있으니, 처음부터 조직이 가능하면 조직으로.

## 4. TestFlight 외부 배포 절차 (담당·승인)

| 단계 | 할 일 | 누가 | 승인 |
|---|---|---|---|
| T-1 | Apple Developer Program 가입·결제, 약관 동의 | **PO** | ⛔ 결제 |
| T-2 | App Store Connect API 키 발급(관리자 권한, `.p8` 파일 안전 보관 — 저장소에 넣지 않음) | **PO** | — |
| T-3 | `app.json`에 `owner`(팀 계정) → `eas init` | B(또는 A) | ⛔ |
| T-4 | EAS `preview` 환경변수: `EXPO_PUBLIC_API_URL=https://…`, 조사 Supabase URL·publishable key, `EXPO_PUBLIC_RESEARCH_MODE=true`, (유료 전환 후) `EXPO_PUBLIC_GEMINI_PAID_TIER=true`, 처리방침·약관 URL → `node backend/scripts/check-env.mjs --app --target research` 통과 | B | ⛔ |
| T-5 | `eas build --platform ios --profile testflight` — **첫 빌드에서 Apple 계정 로그인(2단계 인증)으로 배포 인증서·프로비저닝 생성** | **PO가 터미널에서 직접 입력**(Claude는 비밀번호를 입력하지 않음) | ⛔ |
| T-6 | `eas submit --platform ios --profile testflight`(첫 제출 때 App Store Connect 앱 레코드 생성, 이후 `ascAppId`를 `eas.json`에 기록) | A/B(키는 PO) | ⛔ |
| T-7 | App Store Connect 앱 이름 등록 — **"STYLESEED"가 이미 쓰이면** 다른 이름(예: "STYLESEED 옷장") 필요. 휴대폰에 보이는 이름은 그대로 STYLESEED | PO | — |
| T-8 | TestFlight → 테스트 정보 입력(5장 문구), 외부 그룹 생성, 빌드 추가 → **Beta App Review 제출** | PO | ⛔ 제출 |
| T-9 | 승인 후 **공개 링크**(인원 상한 설정) 또는 이메일 초대 → 참가자 TestFlight 설치 | PO | ⛔ 배포 |
| T-10 | 세션 전 실기기 E2E(6장) — 내부 테스터(최대 100명, 심사 없음)로 먼저 받아 확인 | PO + A | — |

**권장 순서:** T-1과 동시에 T-2~T-4 준비 → 빌드는 먼저 **내부 테스터**(팀)로 받아 6장 확인 → 고친 빌드로 외부 심사(T-8).

## 5. Beta App Review 준비물

| 항목 | 필수 | 준비 상태 | 담당 |
|---|---|---|---|
| 베타 앱 설명 | 필수 | 아래 초안 | PO 확정 |
| 피드백 이메일 | 필수(외부) | 팀 공용 메일 필요 | PO |
| **로그인 정보(데모 계정)** | 로그인이 있는 앱은 필수, **만료되지 않아야 함** | 조사 DB에 심사용 계정 1개 + 옷 3~4벌 미리 등록 | B(DB) + PO |
| 개인정보처리방침 URL | 외부 테스트에 요구됨(여러 자료가 일치, Apple 문구는 미확인) | B 초안 있음 → **공개 게시 필요** | B + PO |
| 연락처(이름·이메일·+82 형식 전화) | 심사 연락용 | — | PO |
| 심사 메모 | 선택 | 아래 초안 | A 초안 → PO |
| 마케팅 URL | 선택 | — | — |
| 수출 규정 | 앱 설정으로 해결 | 완료(I-7) | — |
| 연령 등급·카테고리 | 앱 정보 | 연령 조건 18세 이상 모집 반영 | PO |

**베타 앱 설명 초안(한국어)**
> STYLESEED는 내 옷장 사진으로 코디를 추천하는 앱입니다. 옷 사진을 찍거나 고르면 AI가 종류·색·핏·소재·스타일을 분석해 디지털 옷장에 정리하고, 가진 옷으로 만든 코디와 점수, 부족한 아이템(Missing Item)을 보여줍니다. 이 베타는 2026년 11월 사용자 조사용이며, 상품 화면은 연구용 예시로 실제 구매 기능이 없습니다.

**테스트할 내용(참가자용)**
> 옷 3벌 이상 등록(카메라 또는 앨범) → AI 분석 결과 확인·수정 → 코디 추천과 TOP 3 확인 → 코디 저장 → Missing Item 확인. 이상한 분석 결과나 오류는 스크린샷과 함께 TestFlight 피드백으로 보내 주세요.

**심사 메모 초안(영문, 심사팀용)**
> STYLESEED organizes a user's wardrobe from photos and recommends outfits from items they own. Sign in with the demo account below to see a closet with sample items. To add an item, tap "옷 등록하기", take or choose a photo of one garment, accept the photo AI notice, and tap "분석하기"; the photo is analyzed by Google Gemini through our server. Product cards are labeled as research examples and have no purchase flow. Account deletion: 내 옷장 → 계정 → 계정 삭제. The "research" screen (long-press on the logo) is for our in-person study facilitators only.

## 6. iOS 실기기 검증 대상 (내부 TestFlight 빌드로 먼저)

`DEVICE-TEST-PLAN` 5장 절차를 iPhone에서 실행한다. **iOS 필수 항목:**

| # | 대상 | 확인할 것 |
|---|---|---|
| iOS-1 | TestFlight 설치·첫 실행 | 공개 링크/초대 → 설치 → 아이콘·이름 STYLESEED → 인트로 → 온보딩 |
| iOS-2 | **카메라** | [카메라로 찍기] → 권한 팝업 문구(한국어) → 거부 → 안내·[설정 열기] → 허용 → 촬영 → 자르기 → 분석. **앱 종료 없음** |
| iOS-3 | **앨범** | 사진 선택기(전체/선택 접근), HEIC 사진, 세로 사진 방향 |
| iOS-4 | **사진 업로드·Gemini 분석** | AI 동의 → 분석 시간(목표 15초, 제한 50초) → 결과 수정 |
| iOS-5 | **로그인** | 가입(본인 이메일) → 자동 저장 → 로그아웃 → 로그인 → 앱 완전 종료 후 재실행 시 로그인 유지 |
| iOS-6 | **옷장 저장** | 배경 제거 이미지(실패 시 원본) → 목록·상세·삭제·정보 수정 |
| iOS-7 | **코디 추천** | Styling·TOP 3·Missing·예시 상품·코디 저장·저장한 코디 |
| iOS-8 | 위치 | 허용/거부 모두 홈 정상 |
| iOS-9 | 실패 | 비행기 모드 분석 → 안내 → 회복 |
| iOS-10 | 계정 삭제 | 앱 안에서 삭제 → 다시 로그인 불가, 옷 사라짐 |
| iOS-11 | 연구 모드 | 로고 길게 누르기 → 코드 → 이벤트 → [기록 내보내기] → **AirDrop으로 Mac 수신** → `events.mjs` 형식 오류 0 |
| iOS-12 | 새 빌드 업데이트 | TestFlight에서 다음 빌드로 업데이트 후 로그인·옷장·저장한 코디 유지 |

## 7. PO가 직접 처리할 일

1. **Apple Developer Program 가입·결제**(연 US$99) — 개인/조직 결정(D-T3), 2단계 인증 Apple 계정, 법적 이름(조직이면 D-U-N-S·도메인 이메일·웹사이트).
2. 약관 동의(App Store Connect), **App Store Connect API 키** 발급·보관.
3. **EAS 소유 계정 결정**(팀 계정 권장).
4. **첫 iOS 빌드 때 Apple 계정 로그인**(터미널에서 직접 입력).
5. App Store Connect 앱 이름 확정(중복 시 대안).
6. **개인정보처리방침 내용 확정·게시 승인**, 피드백 이메일, 심사 연락처.
7. 심사용 데모 계정 승인(비밀번호는 App Store Connect에만 입력, 저장소·채팅에 쓰지 않음).
8. 테스트 정보 입력·Beta App Review 제출·공개 링크 배포.
9. 참가자 모집 조건: iPhone, iOS 16.4 이상, 18세 이상, TestFlight 앱.
10. 최종 브랜드 아이콘(1024×1024 PNG) 전달(지금은 임시 아이콘).

## 8. 결정 필요

| # | 결정 | 권장 |
|---|---|---|
| D-T1 | 7일 사용 기록(선택 참여)을 받을지 → 받으면 서버 이벤트 저장(⛔ 조사 DB 테이블) | 1차 세션은 대면 내보내기만, 7일 기록은 결정 후 |
| D-T2 | 진행자 화면 PIN | 1차는 없이(코드 검증으로 충분), 필요 시 추가 |
| D-T3 | Apple 개인/조직 | 법인·D-U-N-S가 준비돼 있지 않으면 개인 |
| D-T4 | 첫 외부 심사 제출일 | **11/04** |
