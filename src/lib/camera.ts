import { Platform } from "react-native";

// 카메라 촬영을 보여줄지: 웹은 숨기고(사진 선택만), iOS·Android는 보여준다.
// 빌드에는 app.json expo-image-picker cameraPermission 문구가 꼭 있어야 한다(없으면 iOS에서 카메라를 열 때 앱 종료).
// src/lib/__tests__/appConfig.test.mjs가 문구가 있는지 확인한다.
export const isCameraCaptureAvailable = () => Platform.OS !== "web";
