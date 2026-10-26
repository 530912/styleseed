import Constants, { ExecutionEnvironment } from "expo-constants";

import { Platform } from "react-native";

import { CAMERA_ENABLED_IN_BUILD } from "./featureFlags";

// 카메라 촬영을 보여줄지: 웹은 숨기고(사진 선택만), Expo Go는 항상, 빌드는 권한 문구를 넣었을 때만
export const isCameraCaptureAvailable = () => {
  if (Platform.OS === "web") {
    return false;
  }

  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return true;
  }

  return CAMERA_ENABLED_IN_BUILD;
};
