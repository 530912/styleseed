import { router } from "expo-router";

import { useCallback, useMemo, useState } from "react";

import { StyleSheet, Text, View } from "react-native";

import { SplashIntro } from "../components/SplashIntro";

import { TodayLookCard } from "../components/styleseed/today-look-card";

import { Button, Screen } from "../components/styleseed/ui";

import { palette } from "../constants/ui";

import { useClosetLoader } from "../hooks/use-closet-loader";

import { useWeather } from "../hooks/use-weather";

import { supabase } from "../lib/supabase";

import { useClosetStore } from "../store/useClosetStore";

import { getTodaysLooks } from "../utils/weatherRecommendation";

// 앱 실행 후 한 번만 인트로를 보여준다.
// (로그아웃 등으로 HOME이 다시 마운트될 때는 재생하지 않음)
let hasPlayedIntro = false;

export default function IndexScreen() {
  const [showIntro, setShowIntro] = useState(!hasPlayedIntro);

  const handleIntroFinish = useCallback(() => {
    hasPlayedIntro = true;

    setShowIntro(false);
  }, []);

  if (showIntro) {
    return <SplashIntro onFinish={handleIntroFinish} />;
  }

  return <HomeScreen />;
}

function HomeScreen() {
  const clothes = useClosetStore((state) => state.clothes);

  const { status: closetStatus } = useClosetLoader();

  const { weather, reload: reloadWeather } = useWeather();

  // 현재 날씨 + 내 Digital Closet + 기존 코디 추천 로직
  const todaysLooks = useMemo(
    () =>
      getTodaysLooks(
        clothes,
        weather.status === "ready" ? weather.weather : null,
      ),
    [clothes, weather],
  );

  const handleOpenCloset = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push({
        pathname: "/login",
        params: {
          redirectTo: "closet",
        },
      });

      return;
    }

    router.push("/closet");
  };

  return (
    <Screen showBack={false}>
      <View style={styles.brand}>
        <Text style={styles.logo}>STYLESEED</Text>

        <Text style={styles.description}>내 옷에서 시작하는 스타일링</Text>
      </View>

      <TodayLookCard
        weather={weather}
        look={todaysLooks[0] ?? null}
        closetStatus={closetStatus}
        onViewLook={() => router.push("/today")}
        onAddItem={() => router.push("/upload")}
        onSignIn={() => router.push("/login")}
        onRetryWeather={reloadWeather}
      />

      <View style={styles.buttonGroup}>
        <Button
          label="옷 등록하기"
          onPress={() => router.push("/upload")}
          style={styles.groupButton}
        />

        <Button
          label="내 옷장 보기"
          variant="secondary"
          onPress={handleOpenCloset}
          style={styles.groupButton}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: {
    marginBottom: 16,
  },

  logo: {
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: 1,
    color: palette.ink,
  },

  description: {
    marginTop: 6,
    fontSize: 14,
    color: palette.body,
  },

  buttonGroup: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },

  groupButton: {
    flex: 1,
  },
});
