# 2026-11 사용자 조사 — EAS 초기화 전 점검 (변경 사항·계정 소유권·빌드 설정)

| 항목 | 내용 |
|---|---|
| 작성 | 2026-10-27, Claude A |
| 기준 | 로컬 브랜치 `app/mvp-2026-11` = `integration/mvp-2026-11`(B, `ce5334d`) + A 1차 범위 추가 기능(`14cea07`). Push 안 함 |
| 하지 않은 것 | `eas init`, 빌드, EAS 환경변수 등록, 계정·결제 변경. 아래 명령은 모두 **읽기 전용**(`eas whoami`, `eas account:view`, `expo config`, `expo export`, `expo-doctor`) |
| 갱신 | **10/27 오후 iOS TestFlight 우선으로 변경** → `2026-11-MVP-TESTFLIGHT-PLAN.md`. A가 PO 지시로 `app.json`(이름 STYLESEED·카메라 문구·개인정보 매니페스트·임시 아이콘·light)과 `eas.json`(`testflight` 프로필)을 준비함 → 아래 B-1·B-4(이름)는 **완료**, O-2는 **iOS 우선으로 결정됨** |
| 판정 | **코드는 빌드 가능**(네이티브 번들 로컬 생성 성공). `eas init` 전에 **PO가 정할 것 3개**(소유 계정, 앱 이름·아이콘, 카메라 권한)와 **B가 고칠 설정 4개**가 있다 |

## 1. 이번 빌드에 들어가는 변경 사항

| 구분 | 내용 | 빌드 영향 |
|---|---|---|
| 새 화면 | `/onboarding`, `/edit-item`, `/saved-looks`, `/research`(연구 모드만) | JS만. 새 네이티브 모듈 없음 |
| 카메라 촬영 | `expo-image-picker`의 `launchCameraAsync`(이미 있는 모듈) | **권한 설정 필요**(4장 B-1). 설정 전 빌드에서는 버튼이 숨겨짐 |
| 저장 후 정보 수정 | `clothes` 기존 열 UPDATE(RLS) | DB 스키마 변경 없음 |
| 코디 저장 | 기기 저장(AsyncStorage) | 없음 |
| 이벤트 기록 | 기기 저장, 계약 v0.3 | 없음 |
| B 변경(통합본) | AI 동의 사용자 단위·로그아웃 시 삭제, 앱 빌드 변수 검사(`check-env --app`) | 없음 |
| `package.json`·`app.json`·`eas.json` | **이번 A 작업에서 변경 없음** | — |
| 새 앱 환경변수 | `EXPO_PUBLIC_RESEARCH_MODE`(B 표 반영됨). ~~`EXPO_PUBLIC_CAMERA_ENABLED`~~ 10/27 삭제 — 카메라 권한 문구를 `app.json`에 넣어 빌드에서 항상 사용 | EAS 환경에 등록 필요 |

## 2. 계정 소유권

| 대상 | 현재(확인한 것) | 위험 | 권장·결정 |
|---|---|---|---|
| **Expo(EAS) 계정** | 이 PC는 **개인 계정**으로 로그인. 같은 사용자가 **팀 계정**(`…-team`, Owner)도 갖고 있음. `app.json`에 `owner` 없음 → `eas init`은 기본으로 **로그인한 개인 계정 아래**에 프로젝트를 만든다 | 프로젝트·빌드 기록·**Android 서명 키**가 개인 계정에 묶임. 공동창업자 초대·인수인계가 어려움 | **⛔ PO 결정 O-1**: 팀 계정을 소유자로(`app.json`에 `"owner": "<팀 계정 이름>"`을 넣은 뒤 `eas init`). 공동창업자를 팀 멤버로 초대 |
| **Android 서명 키** | 없음(첫 빌드 때 EAS가 생성·보관) | 첫 빌드 계정에 키가 생김. 나중에 Play 스토어에 올릴 때 이 키를 계속 써야 함 | O-1 결정 후 첫 빌드. 키 백업(`eas credentials`) 담당자 지정 |
| **Apple Developer** | 미등록(B 문서) | iOS 내부 설치 불가 | O-2: 1차 조사는 **Android APK만**(권장) 또는 등록(연 $99, 개인/법인 명의 결정, 법인은 D-U-N-S 필요) |
| **Google Play Console** | 미등록 | 내부 APK 설치에는 **불필요** | 조사 후(공개 배포 때) |
| **GitHub 저장소** | `origin` = 개인 계정 저장소 | 코드 소유가 개인 계정 | 조사 후 조직 저장소로 이전 검토(이번 범위 아님) |
| 앱 식별자 | `com.styleseed.app`(iOS·Android, B 설정) | 다른 사람이 이미 쓰는지는 스토어 등록 때만 확인됨 | 도메인을 가진 경우 `<도메인 역순>.styleseed`도 검토. 첫 빌드 전에 확정(바꾸면 다른 앱이 됨) |

## 3. 빌드 설정 점검 결과

| # | 항목 | 결과 | 근거 |
|---|---|---|---|
| C-1 | `eas.json` | development(개발 클라이언트·시뮬레이터)·**preview(내부 배포, Android APK)**·production(스토어, AAB, 버전 자동 증가). `appVersionSource: remote`, node 24.11.1(로컬과 같음) | 파일 확인 |
| C-2 | 네이티브 JS 번들 | **로컬 생성 성공** — iOS 3.8MB, Android 4.1MB(Hermes 바이트코드) | `expo export --platform android --platform ios` |
| C-3 | 비밀키 | 번들에 Gemini·BRIA·fal·Supabase 비밀키 **없음**. `sb_secret_` 문자열 1건은 Supabase 라이브러리의 접두어 검사 코드(값 아님) | 번들 문자열 검사 |
| C-4 | 백엔드 코드 혼입 | 번들에 `@huggingface/transformers`·`onnxruntime`·`express` 없음 | 같음 |
| C-5 | 앱 이름 | **`styleseed`(소문자)** — 홈 화면에 이렇게 보임 | `app.json name` |
| C-6 | 아이콘 | **Expo 기본 템플릿 아이콘**(파란 배경 "A" 모양). 1024×1024, Android 적응형 512 | `assets/images/icon.png` 직접 확인 |
| C-7 | 권한 | 위치(한국어 문구, 사용 중일 때만), 사진(한국어 문구). **카메라: 꺼짐**(`cameraPermission: false`, Android `CAMERA` 제거) | `expo config` |
| C-8 | 업데이트(OTA) | 없음(`expo-updates` 미사용) → 고치면 **다시 빌드** | `runtimeVersion`·`updates` 없음 |
| C-9 | 업로드에 포함될 파일 | `.easignore` 없음 → `.gitignore` 기준. **git에 없고 무시되지도 않은 사업 문서 약 8.7MB**(사업계획서·제휴사·수익모델 .pages/.pdf 등 10개 + `docs/references`·`docs/handoff/from-knowledge-lab`)가 EAS 빌드 서버로 **함께 올라간다** | `git ls-files --others` |
| C-10 | 빌드 서버 설치 시간 | 루트 `package.json`에 백엔드 전용 패키지(`@huggingface/transformers` → `onnxruntime-node` 211MB, `sharp`, `express`, `@fal-ai/client`) → EAS가 모두 설치 | `node_modules` 크기 |
| C-11 | `.env` | git 무시 → **업로드 안 됨**(정상). 앱 값은 EAS 환경변수로만 들어감 | `.gitignore` |
| C-12 | 의존성 호환성 | `expo-doctor` 21개 중 **2개 실패**: 잠금 파일 2개, SDK 57 패치 버전 16개 뒤처짐 — 5장 | `expo-doctor` |
| C-13 | 빌드 전 변수 검사 | B의 `node backend/scripts/check-env.mjs --app --target research` 있음 | B 커밋 `9af0a65` |

## 4. `eas init` 전에 할 일

### PO 결정

| # | 결정 | 권장 |
|---|---|---|
| O-1 | EAS 프로젝트 소유 계정 | **팀 계정** |
| O-2 | iOS 포함 여부 | 1차는 Android APK만 |
| O-3 | 앱 이름·아이콘 | 이름 `STYLESEED`, 브랜드 아이콘 1024×1024 PNG(+ Android 전경 이미지) 전달 → 없으면 조사 기기 홈 화면에 Expo 기본 아이콘이 보임 |
| O-4 | 카메라를 빌드에 넣을지(1차 범위 포함 결정에 따라 **넣음**) | 넣음 → B-1 |

### B에게 요청 (B 담당 파일)

| # | 요청 | 파일 |
|---|---|---|
| B-1 | **카메라 권한 켜기**: `expo-image-picker` `cameraPermission`을 한국어 문구로(예: "옷장에 등록할 옷을 촬영하기 위해 카메라를 사용합니다."), Android `CAMERA` 제거 설정 해제, EAS `preview`에 `EXPO_PUBLIC_CAMERA_ENABLED=true`, `check-env --app`에 항목 추가(문구 없이 true면 오류) | `app.json`, `docs/launch/EAS_SETUP.md`, `check-env.mjs` |
| B-2 | `.easignore` 추가: `.gitignore` 내용 + 루트의 `*.pages`, `*.pdf`, `*.numbers`, `docs/references/`, `docs/handoff/from-knowledge-lab/`(사업 문서가 빌드 서버로 올라가지 않게) | `.easignore`(새) |
| B-3 | O-1이 팀 계정이면 `app.json`에 `owner` 추가 후 `eas init` | `app.json` |
| B-4 | O-3 결과로 `name`·아이콘 교체 | `app.json`, `assets/` |
| **B-6** | **`yarn.lock` 삭제**(프로젝트는 npm: 스크립트·Dockerfile·문서 모두 npm). 두 잠금 파일이 있으면 EAS가 yarn으로 설치해 **로컬에서 테스트한 것과 다른 버전**이 들어갈 수 있다(예: `sharp` yarn 0.34.5 / npm 0.35.4) | `yarn.lock` |
| **B-7** | SDK 57 패치 맞추기: `npx expo install --check`로 16개를 기대 버전으로(예: `expo` 57.0.21 → ~57.0.31, `expo-router` 57.0.20 → ~57.0.29, `expo-image-picker` 57.0.16 → ~57.0.20). **별도 커밋** + `verify-all.sh --export` + 웹·Expo Go 확인 후 빌드. A·B 중 한 명만 진행(공유 파일 `package.json`) | `package.json`, `package-lock.json` |
| (선택) B-5 | 루트 `package.json`의 백엔드 전용 패키지를 `backend/package.json`으로만(Docker는 이미 그쪽을 씀) → EAS 설치 시간·실패 위험 감소. 회귀 위험이 있으면 조사 후로 | `package.json` |

### 순서 (모두 ⛔ 승인 후)

1. O-1~O-4 결정 → 2. B-1~B-4, **B-6·B-7** 반영 → 3. `bash scripts/release/verify-all.sh --export` 통과 → 4. ⛔ `eas init` → 5. ⛔ EAS `preview` 환경변수 등록 + `check-env --app --target research` 통과 → 6. ⛔ `eas build --profile preview --platform android` → 7. 실기기 E2E(`DEVICE-TEST-PLAN` 5장)

## 5. expo-doctor 결과 (10/27, 읽기 전용)

- 21개 검사 중 19개 통과.
- ✖ **잠금 파일 2개**(`yarn.lock`, `package-lock.json`) → B-6.
- ✖ **SDK 57 패치 버전 불일치 16개**: `@expo/ui` 57.0.17→~57.0.26, `expo` 57.0.21→~57.0.31, `expo-constants` 57.0.17→~57.0.22, `expo-device` 57.0.1→~57.0.2, `expo-font` 57.0.3→~57.0.4, `expo-glass-effect` 57.0.2→~57.0.4, `expo-image` 57.0.4→~57.0.5, `expo-image-manipulator` 57.0.16→~57.0.21, `expo-image-picker` 57.0.16→~57.0.20, `expo-linking` 57.0.9→~57.0.13, `expo-location` 57.0.17→~57.0.22, `expo-router` 57.0.20→~57.0.29, `expo-splash-screen` 57.0.8→~57.0.10, `expo-symbols` 57.0.2→~57.0.3, `expo-system-ui` 57.0.3→~57.0.4, `expo-web-browser` 57.0.2→~57.0.3 → B-7.
- 판단: 둘 다 **빌드 전에 정리 권장**. 특히 잠금 파일은 빌드 서버가 다른 버전을 설치하는 원인이 될 수 있다. 패치 업데이트는 기능 변경이 작지만 전체 회귀와 실기기 확인을 다시 해야 하므로, 실기기 E2E **전에** 끝내야 검증 결과가 빌드와 같아진다.
