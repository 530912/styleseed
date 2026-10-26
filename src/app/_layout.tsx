import { Stack } from "expo-router";

import { useEffect } from "react";

import { startAiConsentSignOutSync } from "../lib/aiConsent";

import { installWebAlert } from "../lib/installWebAlert";

import { logResearchEvent } from "../lib/researchEvents";

// 웹: react-native-web의 Alert.alert는 아무 동작도 하지 않아 삭제 확인·오류 안내가 보이지 않는다 → 브라우저 대화상자로
installWebAlert();

export default function RootLayout() {
  // 사용자 조사: 앱 실행(재실행 포함) 기록. 연구 모드가 아니면 아무것도 하지 않는다
  useEffect(() => {
    logResearchEvent("app_opened");
  }, []);

  // 로그아웃하면 사진 AI 동의 기록을 지운다(BUG-31: 진행자 기기에서 참가자마다 동의)
  useEffect(() => {
    startAiConsentSignOutSync();
  }, []);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}
