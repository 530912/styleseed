import { Platform } from "react-native";

// 카메라 촬영 버튼을 보여줄지
// - iOS·Android 앱: 보여준다. 빌드에는 app.json expo-image-picker cameraPermission 문구가 꼭 있어야 한다
//   (없으면 iOS에서 카메라를 열 때 앱 종료). src/lib/__tests__/appConfig.test.mjs가 문구를 확인한다.
// - 웹: 터치 화면(휴대폰·태블릿)에서만 보여준다. 모바일 Safari·Chrome은 capture 속성으로 카메라를 바로 연다.
//   데스크톱 브라우저는 파일 선택 창만 열리므로 숨긴다(사진 선택 버튼과 같아짐).
export const isCameraCaptureAvailable = () => {
  if (Platform.OS !== "web") {
    return true;
  }

  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia("(pointer: coarse)").matches;
};
