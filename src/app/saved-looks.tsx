import { router } from "expo-router";

import { useEffect, useMemo, useRef } from "react";

import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { LookBoard } from "../components/styleseed/look-board";

import { Button, EmptyState, Screen, ScreenHeader } from "../components/styleseed/ui";

import { fonts, palette } from "../constants/ui";

import { useClosetLoader } from "../hooks/use-closet-loader";

import { logResearchEvent } from "../lib/researchEvents";

import { resolveSavedLooks } from "../lib/savedLooksPolicy";

import { useClosetStore } from "../store/useClosetStore";

import { useSavedLooksStore } from "../store/useSavedLooksStore";

import { getClothingName } from "../utils/format";

// 저장한 추천 코디 목록 (기기 저장). 지금 옷장에 있는 옷으로 된 코디만 보여준다
export default function SavedLooksScreen() {
  const clothes = useClosetStore((state) => state.clothes);

  const looks = useSavedLooksStore((state) => state.looks);

  const removeLook = useSavedLooksStore((state) => state.removeLook);

  const { status } = useClosetLoader();

  const savedLooks = useMemo(() => resolveSavedLooks(looks, clothes), [looks, clothes]);

  // 사용자 조사: 저장한 코디 다시 보기(화면당 1번)
  const logged = useRef(false);

  useEffect(() => {
    if (status !== "ready" || logged.current) {
      return;
    }

    logged.current = true;

    logResearchEvent("saved_outfits_viewed", { saved_count: savedLooks.length });
  }, [status, savedLooks.length]);

  const handleRemove = (key: string) => {
    removeLook(key);

    logResearchEvent("outfit_unsaved", { screen: "saved" });
  };

  return (
    <Screen>
      <ScreenHeader
        eyebrow={`SAVED LOOKS · ${savedLooks.length}`}
        title="저장한 코디"
        description="마음에 든 추천 코디를 이 기기에 모아둬요."
      />

      {status === "loading" ? (
        <ActivityIndicator color={palette.ink} />
      ) : status === "signed-out" ? (
        <EmptyState
          title="로그인하고 저장한 코디를 확인하세요"
          action={<Button label="로그인" onPress={() => router.push("/login")} />}
        />
      ) : savedLooks.length === 0 ? (
        <EmptyState
          title="아직 저장한 코디가 없어요"
          description="코디 화면에서 [이 코디 저장]을 누르면 여기에 모여요."
          action={
            <Button
              label="내 옷장으로 가기"
              variant="secondary"
              onPress={() => router.replace("/closet")}
            />
          }
        />
      ) : (
        savedLooks.map(({ look, items }) => (
          <View key={look.key} style={styles.card}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="저장한 코디 상세 보기"
              onPress={() =>
                router.push({
                  pathname: "/saved-look",
                  params: { lookKey: look.key },
                })
              }
            >
              <LookBoard items={items} layout="row" height={120} />

              <Text style={styles.names} numberOfLines={2}>
                {items.map(getClothingName).join("  ·  ")}
              </Text>
            </Pressable>

            <View style={styles.actions}>
              {look.baseItemId !== null ? (
                <Pressable
                  hitSlop={8}
                  onPress={() =>
                    router.push({
                      pathname: "/styling",
                      params: { clothingId: String(look.baseItemId) },
                    })
                  }
                >
                  <Text style={styles.link}>코디 다시 보기</Text>
                </Pressable>
              ) : null}

              <Pressable hitSlop={8} onPress={() => handleRemove(look.key)}>
                <Text style={styles.remove}>저장 해제</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: palette.surface,
  },

  names: {
    marginTop: 10,
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    color: palette.ink,
  },

  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },

  link: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: "600",
    color: palette.ink,
    textDecorationLine: "underline",
  },

  remove: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: palette.subtle,
  },
});
