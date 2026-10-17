import { router, useLocalSearchParams } from "expo-router";

import { useMemo } from "react";

import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { LookBoard } from "../components/styleseed/look-board";

import { ScoreBars } from "../components/styleseed/score-bars";

import {
  Badge,
  Button,
  EmptyState,
  Screen,
  ScreenHeader,
  ScoreDisplay,
} from "../components/styleseed/ui";

import { palette } from "../constants/ui";

import { useClosetLoader } from "../hooks/use-closet-loader";

import { useClosetStore } from "../store/useClosetStore";

import { getClothingName } from "../utils/format";

import {
  getRankedLooks,
  getRankedLooksForItem,
} from "../utils/outfitScore";

// TOP 3 LOOK: 코디를 MATCH SCORE 순으로 보여준다.
// clothingId가 있으면 그 옷을 반드시 포함하는 코디만 계산한다.
export default function TopLooksScreen() {
  const { clothingId } = useLocalSearchParams<{
    clothingId?: string;
  }>();

  const clothes = useClosetStore((state) => state.clothes);

  const { status } = useClosetLoader();

  const selectedClothing = clothes.find(
    (clothing) => clothing.id === Number(clothingId),
  );

  const looks = useMemo(
    () =>
      selectedClothing
        ? getRankedLooksForItem(selectedClothing, clothes, 3)
        : getRankedLooks(clothes, 3),
    [selectedClothing, clothes],
  );

  const [bestLook, ...otherLooks] = looks;

  if (!bestLook) {
    return (
      <Screen>
        <ScreenHeader eyebrow="TOP 3 LOOK" title="가장 잘 어울리는 코디" />

        {status === "loading" ? (
          <ActivityIndicator color={palette.ink} />
        ) : (
          <EmptyState
            title="코디를 만들 옷이 부족해요"
            description="상의와 하의를 포함해 2벌 이상 등록하면 코디를 계산할 수 있어요."
            action={
              <Button
                label="옷 등록하기"
                onPress={() => router.push("/upload")}
              />
            }
          />
        )}
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <Button
          label="이 코디로 스타일링 보기"
          onPress={() =>
            router.push({
              pathname: "/styling",
              params: {
                clothingId: String(bestLook.base.id),
              },
            })
          }
        />
      }
    >
      <ScreenHeader
        eyebrow="TOP 3 LOOK"
        title={
          selectedClothing
            ? `${getClothingName(selectedClothing)} 코디`
            : "가장 잘 어울리는 코디"
        }
        description={
          selectedClothing
            ? "이 옷을 활용한 코디를 점수순으로 추천했어요."
            : "분석 결과를 바탕으로 코디를 점수순으로 추천했어요."
        }
      />

      <View style={styles.bestCard}>
        <View style={styles.bestHeader}>
          <View style={styles.bestTitleRow}>
            <Text style={styles.lookName}>LOOK 01</Text>

            <Badge label="BEST MATCH" inverted />
          </View>

          <ScoreDisplay value={bestLook.total} caption="MATCH" size="medium" />
        </View>

        <LookBoard items={bestLook.items} height={132} />

        <Text style={styles.itemNames} numberOfLines={1}>
          {bestLook.items.map(getClothingName).join("  ·  ")}
        </Text>

        {bestLook.reasons.slice(0, 2).map((reason) => (
          <Text key={reason} style={styles.reason} numberOfLines={1}>
            · {reason}
          </Text>
        ))}

        {bestLook.tags.length > 0 ? (
          <View style={styles.tagRow}>
            {bestLook.tags.map((tag) => (
              <Text key={tag} style={styles.tag}>
                {tag}
              </Text>
            ))}
          </View>
        ) : null}
      </View>

      {otherLooks.length > 0 ? (
        <View style={styles.otherRow}>
          {otherLooks.map((look, index) => (
            <Pressable
              key={look.items.map((item) => item.id).join("-")}
              style={styles.otherCard}
              onPress={() =>
                router.push({
                  pathname: "/styling",
                  params: {
                    clothingId: String(look.base.id),
                  },
                })
              }
            >
              <View style={styles.otherHeader}>
                <Text style={styles.otherName}>LOOK 0{index + 2}</Text>

                <Text style={styles.otherScore}>
                  {look.total}
                  <Text style={styles.otherMax}> / 100</Text>
                </Text>
              </View>

              <LookBoard items={look.items} layout="row" height={86} />

              <Text style={styles.otherItems} numberOfLines={2}>
                {look.items.map(getClothingName).join(" · ")}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <ScoreBars title="OUTFIT EVALUATION" details={bestLook.details} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  bestCard: {
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: palette.ink,
  },

  bestHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },

  bestTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 4,
  },

  lookName: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 1,
    color: palette.ink,
  },

  itemNames: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "600",
    color: palette.ink,
  },

  reason: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    color: palette.body,
  },

  tagRow: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },

  tag: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    fontSize: 10,
    color: palette.subtle,
    backgroundColor: palette.surface,
  },

  otherRow: {
    marginBottom: 14,
    flexDirection: "row",
    gap: 10,
  },

  otherCard: {
    flex: 1,
    padding: 10,
    borderWidth: 1,
    borderColor: palette.line,
  },

  otherHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 8,
  },

  otherName: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: palette.ink,
  },

  otherScore: {
    fontSize: 17,
    fontWeight: "700",
    color: palette.ink,
  },

  otherMax: {
    fontSize: 10,
    fontWeight: "400",
    color: palette.muted,
  },

  otherItems: {
    marginTop: 6,
    fontSize: 10,
    lineHeight: 14,
    color: palette.body,
  },
});
