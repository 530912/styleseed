import { router, useLocalSearchParams } from "expo-router";

import { useMemo } from "react";

import { StyleSheet, Text, View } from "react-native";

import { LookBoard } from "../components/styleseed/look-board";

import { Button, EmptyState, Screen } from "../components/styleseed/ui";

import { fonts, palette } from "../constants/ui";

import { resolveSavedLooks } from "../lib/savedLooksPolicy";

import { useClosetStore } from "../store/useClosetStore";

import { useSavedLooksStore } from "../store/useSavedLooksStore";

import { getClothingName } from "../utils/format";

// 저장한 코디 한 개의 상세. Figma 06 Screens "SAVED LOOK DETAIL"
// 추천 이유는 저장하지 않아 보여주지 않는다(저장 데이터: 옷 ID 조합뿐)
export default function SavedLookDetailScreen() {
  const { lookKey } = useLocalSearchParams<{
    lookKey?: string;
  }>();

  const clothes = useClosetStore((state) => state.clothes);

  const looks = useSavedLooksStore((state) => state.looks);

  const removeLook = useSavedLooksStore((state) => state.removeLook);

  const found = useMemo(
    () =>
      resolveSavedLooks(looks, clothes).find(
        ({ look }) => look.key === lookKey,
      ),
    [looks, clothes, lookKey],
  );

  if (!found) {
    return (
      <Screen>
        <EmptyState
          title="저장한 코디를 찾을 수 없어요."
          action={
            <Button
              label="저장한 코디 목록"
              onPress={() => router.replace("/saved-looks")}
            />
          }
        />
      </Screen>
    );
  }

  const { look, items } = found;

  const handleRemove = () => {
    removeLook(look.key);

    router.replace("/saved-looks");
  };

  return (
    <Screen
      footer={
        <>
          {look.baseItemId !== null ? (
            <Button
              label="코디 다시 보기"
              onPress={() =>
                router.push({
                  pathname: "/styling",
                  params: { clothingId: String(look.baseItemId) },
                })
              }
            />
          ) : null}

          <Button label="저장 해제" variant="secondary" onPress={handleRemove} />
        </>
      }
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>저장한 코디</Text>

        <View style={styles.countRow}>
          <Text style={styles.count}>{items.length}</Text>

          <Text style={styles.countUnit}>벌</Text>
        </View>

        <Text style={styles.names}>
          {items.map(getClothingName).join("  ·  ")}
        </Text>
      </View>

      <LookBoard items={items} layout="row" height={200} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 16,
    padding: 20,
    gap: 4,
    backgroundColor: palette.indigoDeep,
  },

  eyebrow: {
    fontFamily: fonts.sans,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "600",
    letterSpacing: 1.5,
    color: palette.onIndigo,
  },

  countRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
  },

  count: {
    fontFamily: fonts.sans,
    fontSize: 40,
    lineHeight: 44,
    fontWeight: "700",
    color: palette.onIndigo,
  },

  countUnit: {
    marginBottom: 6,
    fontFamily: fonts.sans,
    fontSize: 16,
    lineHeight: 24,
    color: palette.onIndigo,
  },

  names: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 22,
    color: palette.onIndigo,
  },
});
