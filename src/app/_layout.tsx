import { Stack } from "expo-router";

import { useEffect } from "react";

import { logResearchEvent } from "../lib/researchEvents";

export default function RootLayout() {
  // 사용자 조사: 앱 실행(재실행 포함) 기록. 연구 모드가 아니면 아무것도 하지 않는다
  useEffect(() => {
    logResearchEvent("app_opened");
  }, []);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}
