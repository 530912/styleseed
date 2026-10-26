// iOS TestFlight 우선 배포(2026-11): 빌드 설정이 앱 기능과 맞는지 확인한다
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const readJson = (relative) => JSON.parse(fs.readFileSync(new URL(relative, import.meta.url), "utf8"));

const app = readJson("../../../app.json").expo;
const eas = readJson("../../../eas.json");

const pluginOptions = (name) => {
  const entry = app.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === name);
  return entry ? entry[1] : null;
};

test("앱이 쓰는 권한마다 한국어 사용 목적 문구가 있다(없으면 iOS에서 권한 요청 시 앱 종료)", () => {
  const picker = pluginOptions("expo-image-picker");
  assert.ok(typeof picker.photosPermission === "string" && picker.photosPermission.length > 10, "사진");
  assert.ok(typeof picker.cameraPermission === "string" && picker.cameraPermission.length > 10, "카메라(src/lib/camera.ts가 iOS·Android에서 촬영 버튼을 보여줌)");
  assert.equal(picker.microphonePermission, false, "마이크는 쓰지 않음");

  const location = pluginOptions("expo-location");
  assert.ok(location.locationWhenInUsePermission.length > 10, "위치(사용 중)");
  assert.equal(location.locationAlwaysPermission, false, "항상 위치는 쓰지 않음");
});

test("iOS 앱 이름·식별자·아이콘·수출 규정·개인정보 매니페스트", () => {
  assert.equal(app.name, "STYLESEED");
  assert.equal(app.ios.bundleIdentifier, "com.styleseed.app");
  assert.equal(app.ios.config.usesNonExemptEncryption, false);
  assert.ok(fs.existsSync(new URL(`../../../${app.ios.icon}`, import.meta.url)), "아이콘 파일");

  const reasons = Object.fromEntries(
    app.ios.privacyManifests.NSPrivacyAccessedAPITypes.map((t) => [t.NSPrivacyAccessedAPIType.replace("NSPrivacyAccessedAPICategory", ""), t.NSPrivacyAccessedAPITypeReasons]),
  );
  // 사용하는 라이브러리(react-native, expo-*, async-storage)의 PrivacyInfo.xcprivacy를 모은 값
  assert.deepEqual(Object.keys(reasons).sort(), ["DiskSpace", "FileTimestamp", "SystemBootTime", "UserDefaults"]);
  assert.equal(app.ios.privacyManifests.NSPrivacyTracking, false);
});

test("TestFlight 조사 빌드 프로필: 스토어 배포 + 조사 환경변수(preview), Android 내부 APK 유지", () => {
  assert.equal(eas.build.testflight.distribution, "store");
  assert.equal(eas.build.testflight.environment, "preview");
  assert.equal(eas.build.preview.distribution, "internal");
  assert.equal(eas.build.preview.android.buildType, "apk");
  assert.ok(eas.submit.testflight.ios, "eas submit --profile testflight");
});
