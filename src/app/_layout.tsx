import { Stack } from "expo-router";

import { useEffect } from "react";

import { View } from "react-native";

import {
  AppTabBar,
  useTabBarVisible,
} from "../components/styleseed/app-tab-bar";

import { TabBarContext } from "../components/styleseed/tab-bar-context";

import { startAiConsentSignOutSync } from "../lib/aiConsent";

import { logResearchEvent } from "../lib/researchEvents";

import { installWebAlert } from "../lib/webAlert";

// 웹에서는 Alert.alert가 아무것도 하지 않으므로 브라우저 대화상자로 바꾼다(2026-11 모바일 웹)
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

  const showTabBar = useTabBarVisible();

  return (
    <TabBarContext.Provider value={showTabBar}>
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          <Stack
            screenOptions={{
              headerShown: false,
            }}
          />
        </View>

        {/* 앱 전체 하단 탭바. 탭 구조 확정 전 임시 적용(components/styleseed/app-tab-bar.tsx) */}
        {showTabBar ? <AppTabBar /> : null}
      </View>
    </TabBarContext.Provider>
  );
}
