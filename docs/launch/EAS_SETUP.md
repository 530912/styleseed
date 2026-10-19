# Expo EAS 배포 준비 (Beta Launch)

| 항목 | 내용 |
|---|---|
| 작성일 | 2026-10-19 |
| 기준 | Expo SDK 57, `eas.json`·`app.json`(이 브랜치) |
| 상태 | **설정 파일 준비 완료. 빌드·제출·식별자 등록은 하지 않았다.** |
| 참고 | [eas.json](https://docs.expo.dev/eas/json/), [app config v57](https://docs.expo.dev/versions/v57.0.0/config/app/), [expo-image-picker v57](https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/), EAS 스키마(eas-cli `eas.schema.json`, 2026-10-19 조회) |

---

## 1. 빌드 프로필 (`eas.json`)

| 프로필 | 용도 | 배포 | iOS | Android | EAS 환경 | 비고 |
|---|---|---|---|---|---|---|
| `development` | 개발 빌드(dev client) | internal | 시뮬레이터 | APK | development | **`expo-dev-client` 미설치** → 쓰기 전에 `npx expo install expo-dev-client` 필요(package.json 변경, 개발 트랙과 협의) |
| `preview` | 내부 QA(실기기) | internal(링크 설치) | 기기(Ad Hoc, 기기 UDID 등록 필요) | APK | preview | 백엔드 QA 주소 사용 |
| `production` | TestFlight·Play 제출 | store | App Store | AAB | production | `autoIncrement` + `appVersionSource: remote` → 빌드 번호는 EAS가 관리 |

- `submit.production.android`: `track: internal`, `releaseStatus: draft` — 실수로 공개 트랙에 올라가지 않게 내부 테스트·초안으로 고정. 비공개 테스트(closed)로 올릴 때 Play Console에서 승격한다.
- iOS 제출 정보(`ascAppId`, `appleTeamId`)는 Apple 계정 확정 후 추가한다(현재 없음).
- `base.node`: `24.11.1`(로컬 개발과 같은 버전).

## 2. 앱 식별자 (`app.json`) — 후보, 미등록

| 항목 | 값 | 상태 |
|---|---|---|
| iOS `bundleIdentifier` | `com.styleseed.app` | **후보.** 첫 `eas build`(iOS) 때 Apple 계정에 등록됨 → **PO 확정 전 iOS 빌드 금지** |
| Android `package` | `com.styleseed.app` | **후보.** Play Console에 첫 AAB를 올리면 영구 고정 |
| 공개 스토어 중복 | 2026-10-19 Google Play·App Store 공개 앱 검색 결과 없음 | 등록 가능 여부는 계정에서만 확인 가능 |

⚠️ 두 식별자는 **스토어에 올린 뒤 바꿀 수 없다.** `styleseed.com` 도메인 소유 여부와 관계없이 쓸 수 있지만, 조직 계정이면 회사 도메인 역순(예: `kr.<회사>.styleseed`)을 쓰는 경우가 많다 → 결정 D-1.

그 밖의 `app.json` 변경

| 항목 | 값 | 이유 |
|---|---|---|
| `ios.supportsTablet` | `false` | iPad 화면 미검증. true면 iPad 스크린샷·심사 필요 |
| `ios.config.usesNonExemptEncryption` | `false` | HTTPS만 사용 → 수출 규정 면제. 제출할 때마다 묻는 질문 생략 |
| `android.blockedPermissions` | `SYSTEM_ALERT_WINDOW` | 템플릿이 넣는 오버레이 권한. 앱이 쓰지 않음 |

표시 이름은 `"name": "styleseed"`(소문자) 그대로다. 홈 화면 이름을 `STYLESEED`로 바꿀지 결정 D-2.

## 3. 권한 문구 (한국어)

로컬 `expo prebuild`(설치 없이, 생성물 삭제)로 실제 Info.plist·AndroidManifest를 확인했다.

| 플랫폼 | 권한 | 문구 / 처리 | 쓰는 곳 |
|---|---|---|---|
| iOS | `NSPhotoLibraryUsageDescription` | 옷장에 등록할 옷 사진을 선택하기 위해 사진 보관함에 접근합니다. | 업로드·사진 교체(이미지 선택) |
| iOS | `NSLocationWhenInUseUsageDescription` | 현재 위치의 날씨에 맞는 오늘의 코디를 추천하기 위해 위치 정보를 사용합니다. 위치는 날씨 조회에만 쓰고 저장하지 않습니다. | 홈 날씨 |
| iOS | 카메라·마이크·위치(항상)·동작 | **제거**(플러그인 기본 영어 문구가 들어가던 것을 `false`로 삭제) | 사용 안 함 |
| Android | `CAMERA`, `RECORD_AUDIO`, `SYSTEM_ALERT_WINDOW` | **제거**(`tools:node="remove"`) | 사용 안 함 |
| Android | 위치(대략·정확), 저장소 읽기·쓰기(API 32 이하), 인터넷, 진동 | 유지 | 날씨, 구형 기기 사진 선택 |

- 카메라 촬영(PRD FR-UPL-02, Phase 2)을 추가하면 `expo-image-picker`의 `cameraPermission`에 한국어 문구를 넣는다(개발 트랙 인계 H-5).
- 권한 문구를 영어로도 보여야 하면 Expo `locales` 설정으로 지역화한다(현재 한국어만).
- **권장(미적용):** 날씨에는 대략 위치면 충분하므로 Android `ACCESS_FINE_LOCATION` 제거 검토. `expo-location`이 정확 위치를 요청하는 동작과 함께 실기기 확인이 필요해 이번에는 바꾸지 않았다.

## 4. EAS 환경변수 (EAS 대시보드 또는 `eas env:create`)

`EXPO_PUBLIC_*` 값은 **앱 번들에 그대로 들어간다**(공개 값만). 서버 비밀값은 넣지 않는다.

| 변수 | development | preview | production | 비고 |
|---|---|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | QA | QA | 운영 | |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | QA | QA | 운영 | Publishable key만 |
| `EXPO_PUBLIC_API_URL` | 로컬/QA | QA 백엔드 | 운영 백엔드(HTTPS) | 비우면 localhost → 실기기에서 동작 안 함 |
| `EXPO_PUBLIC_PRIVACY_POLICY_URL` | 선택 | 게시 후 | **필수** | 비우면 "준비 중" 표시. 스토어 제출에도 필요 |
| `EXPO_PUBLIC_TERMS_URL` | 선택 | 게시 후 | **필수** | |
| `EXPO_PUBLIC_GEMINI_PAID_TIER` | 비움 | 비움 | 유료 전환 후 `true` | 무료 등급 고지 문구 표시 여부 |

## 5. 필요한 에셋

현재 아이콘·스플래시는 **Expo 템플릿 기본 이미지**다(파란 "A" 모양). STYLESEED 로고(`assets/images/styleseed-logo.png`, 1254×1254)는 앱 안 인트로 화면에서만 쓴다.

| # | 에셋 | 규격 | 현재 | 상태 |
|---|---|---|---|---|
| A-1 | 앱 아이콘(공통 `icon`) | 1024×1024 PNG, 투명 없음 권장 | 템플릿 | **교체 필요** |
| A-2 | iOS 아이콘(`ios.icon` → `assets/expo.icon`, Icon Composer 형식) | `.icon` 폴더 | 템플릿(Expo 심볼) | **교체 필요** — 교체가 어려우면 `ios.icon`을 지우고 A-1 사용 |
| A-3 | Android 적응형 아이콘 전경·배경·단색 | 512×512(현재), 전경은 가운데 안전 영역 안에 | 템플릿, 배경색 `#E6F4FE` | **교체 필요** |
| A-4 | 스플래시 아이콘 + 배경색 | `expo-splash-screen` 플러그인. 현재 배경 `#FEFCFA`, 이미지 미지정 | 기본 | 로고로 지정 권장 |
| A-5 | 파비콘(웹) | 48×48 | 템플릿 | 웹 배포 시 |
| S-1 | iPhone 스크린샷 | 6.9"(1320×2868 등) 최소 1장, 최대 10장 | 없음 | **App Store 제출 필수**(TestFlight 외부 테스트는 불필요) |
| S-2 | Android 휴대폰 스크린샷 | 2~8장, 16:9 또는 9:16 | 없음 | Play 스토어 등록정보 필수 |
| S-3 | Play 그래픽 이미지(Feature graphic) | 1024×500 | 없음 | Play 등록정보 필수 |
| S-4 | Play 앱 아이콘 | 512×512 PNG | 없음(A-3에서 생성) | 필수 |

정확한 스크린샷 규격은 제출 시점의 App Store Connect·Play Console 안내를 따른다.

## 6. 첫 빌드까지 순서 (승인 필요 단계 ⛔)

1. ⛔ PO: Apple Developer·Google Play 개발자 계정 등록(결제), 식별자 확정(D-1)
2. ⛔ `npx eas-cli login` → `eas init`(EAS 프로젝트 생성, `app.json`에 `extra.eas.projectId`가 추가됨)
3. EAS 환경변수 등록(4장)
4. ⛔ `eas build --profile preview --platform android` → 실기기 설치 QA (iOS preview는 기기 UDID 등록 필요)
5. ⛔ `eas build --profile production --platform ios` → `eas submit -p ios` → TestFlight
6. ⛔ `eas build --profile production --platform android` → Play Console 내부 테스트 → 비공개 테스트

## 7. 확인하지 못한 것 (Not Tested)

| 항목 | 이유 |
|---|---|
| 실제 EAS 빌드 성공 여부 | 빌드 금지(승인 범위 밖), EAS 계정 없음 |
| iOS 개인정보 매니페스트(PrivacyInfo.xcprivacy) 최종 내용 | 빌드 산출물에서 확인 필요(Expo·AsyncStorage 모듈이 각자 선언) |
| `eas.json` CLI 검증(`eas build --profile … --dry-run` 등) | 로그인 필요. 키 이름은 공식 스키마로 대조함 |
