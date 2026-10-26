import { Stack } from "expo-router";

import { useEffect } from "react";

import { startAiConsentSignOutSync } from "../lib/aiConsent";

import { logResearchEvent } from "../lib/researchEvents";

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
