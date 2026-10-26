import { router, useFocusEffect } from "expo-router";

import { useCallback, useMemo, useState } from "react";

import { Pressable, StyleSheet, Text, View } from "react-native";

import { SplashIntro } from "../components/SplashIntro";

import { TodayLookCard } from "../components/styleseed/today-look-card";

import { Button, Screen } from "../components/styleseed/ui";

import { palette } from "../constants/ui";

import { useClosetLoader } from "../hooks/use-closet-loader";

import { useWeather } from "../hooks/use-weather";

import { RESEARCH_MODE } from "../lib/featureFlags";

import { takeOnboardingTurn } from "../lib/onboarding";

import { getResearchSession } from "../lib/researchEvents";

import { isSignedIn } from "../lib/sessionPolicy";

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

  // 연구 모드에서 참가 코드를 아직 정하지 않았으면 진행자에게 안내한다
  const [needsResearchSetup, setNeedsResearchSetup] = useState(false);

  // 첫 실행 안내: 연구 모드에서는 진행자가 참가 코드를 정한 뒤(참가자에게 기기를 건넨 뒤)에만 띄운다
  useFocusEffect(
    useCallback(() => {
      let active = true;

      (async () => {
        const session = RESEARCH_MODE ? await getResearchSession() : null;

        if (!active) {
          return;
        }

        if (RESEARCH_MODE) {
          setNeedsResearchSetup(!session);
        }

        if ((!RESEARCH_MODE || session) && (await takeOnboardingTurn()) && active) {
          router.push("/onboarding");
        }
      })();

      return () => {
        active = false;
      };
    }, []),
  );

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

    if (!isSignedIn(session)) {
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
        {/* 연구 모드: 진행자가 로고를 길게 눌러 조사 세션 화면을 연다 */}
        <Pressable
          disabled={!RESEARCH_MODE}
          onLongPress={() => router.push("/research")}
          delayLongPress={800}
        >
          <Text style={styles.logo}>STYLESEED</Text>
        </Pressable>

        <Text style={styles.description}>내 옷에서 시작하는 스타일링</Text>

        {needsResearchSetup ? (
          <Text style={styles.researchHint}>
            진행자: 로고를 길게 눌러 참가 코드를 설정하세요
          </Text>
        ) : null}
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

  researchHint: {
    marginTop: 10,
    fontSize: 12,
    color: palette.danger,
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
