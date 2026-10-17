import { router, useLocalSearchParams } from "expo-router";

import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { ScoreBars } from "../components/styleseed/score-bars";

import { LookBoard } from "../components/styleseed/look-board";

import {
  Badge,
  Button,
  EmptyState,
  Label,
  Screen,
  ScreenHeader,
  ScoreDisplay,
} from "../components/styleseed/ui";

import { palette } from "../constants/ui";

import { useClosetLoader } from "../hooks/use-closet-loader";

import { useClosetStore } from "../store/useClosetStore";

import { getClothingName, toTitle, toUpperLabel } from "../utils/format";

import { evaluateOutfit } from "../utils/outfitScore";

import {
  getMissingItemSuggestion,
  getRecommendedOutfit,
} from "../utils/recommendation";

export default function StylingScreen() {
  const { clothingId } = useLocalSearchParams<{
    clothingId: string;
  }>();

  // 현재 Digital Closet에 저장된 전체 옷
  const clothes = useClosetStore((state) => state.clothes);

  const { status } = useClosetLoader();

  // Closet에서 사용자가 선택한 옷 찾기
  const selectedClothing = clothes.find(
    (clothing) => clothing.id === Number(clothingId),
  );

  // 선택한 옷을 찾을 수 없는 경우
  if (!selectedClothing) {
    return (
      <Screen>
        <ScreenHeader eyebrow="STYLING" title="베스트 코디" />

        {status === "loading" ? (
          <ActivityIndicator color={palette.ink} />
        ) : (
          <EmptyState
            title="선택한 옷을 찾을 수 없습니다."
            action={
              <Button
                label="내 옷장으로 가기"
                onPress={() => router.replace("/closet")}
              />
            }
          />
        )}
      </Screen>
    );
  }

  const recommendation = getRecommendedOutfit(selectedClothing, clothes);

  // Color / Fit·Silhouette / Material / Season / TPO / Preference 6개 지표
  const evaluation = evaluateOutfit(recommendation.items, clothes);

  const hasMatches = recommendation.matches.length > 0;

  const firstMissingCategory = recommendation.missingCategories[0];

  const missingItemSuggestion = firstMissingCategory
    ? getMissingItemSuggestion(firstMissingCategory, recommendation.items)
    : null;

  const missingCount = recommendation.missingCategories.length;

  return (
    <Screen
      footer={
        <>
          {missingItemSuggestion ? null : (
            <Text style={styles.footerHint} numberOfLines={1}>
              내 옷장만으로 완성된 코디예요
            </Text>
          )}

          <View style={styles.footerRow}>
            <Button
              label="TOP 3 코디"
              variant="secondary"
              onPress={() =>
                router.push({
                  pathname: "/looks",
                  params: {
                    clothingId: String(selectedClothing.id),
                  },
                })
              }
              style={styles.footerButton}
            />

            <Button
              label="코디 완성하기"
              disabled={!missingItemSuggestion}
              onPress={() =>
                router.push({
                  pathname: "/missing",
                  params: {
                    clothingId: String(selectedClothing.id),
                  },
                })
              }
              style={styles.footerButton}
            />
          </View>
        </>
      }
    >
      <ScreenHeader
        eyebrow="STYLING"
        title="베스트 코디"
        description={`${getClothingName(selectedClothing)} 기준으로 만든 코디예요.`}
        right={
          <Pressable onPress={() => router.push("/ideal-style")} hitSlop={8}>
            <Badge label="IDEAL STYLE · BETA" />
          </Pressable>
        }
      />

      <LookBoard
        items={recommendation.items}
        height={180}
        missingLabel={
          missingItemSuggestion
            ? toUpperLabel(missingItemSuggestion.category)
            : null
        }
      />

      <Text style={styles.itemNames} numberOfLines={2}>
        {recommendation.items.map(getClothingName).join("  ·  ")}
      </Text>

      <View style={styles.scoreRow}>
        <ScoreDisplay
          value={hasMatches ? evaluation.total : null}
          caption="MATCH"
        />

        <Text style={styles.scoreNote}>
          {hasMatches
            ? "색상·실루엣·소재·계절·TPO·취향 6개 지표로 계산했어요"
            : "옷을 더 등록하면 코디 점수를 계산할 수 있어요."}
        </Text>
      </View>

      {missingItemSuggestion ? (
        <View style={styles.missingBox}>
          <View style={styles.missingSlot}>
            <Text style={styles.missingPlus}>+</Text>
          </View>

          <View style={styles.missingInfo}>
            <Label style={styles.missingLabel}>
              MISSING ITEM {missingCount}
            </Label>

            <Text style={styles.missingName} numberOfLines={1}>
              {getClothingName(missingItemSuggestion).toUpperCase()}
            </Text>

            <Text style={styles.missingMeta} numberOfLines={2}>
              {toTitle(missingItemSuggestion.category)} ·{" "}
              {toTitle(missingItemSuggestion.style)} · 이 아이템만 더하면 코디가
              완성돼요
            </Text>
          </View>
        </View>
      ) : null}

      {hasMatches ? (
        <ScoreBars title="OUTFIT EVALUATION" details={evaluation.details} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  itemNames: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    color: palette.ink,
  },

  scoreRow: {
    marginTop: 14,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 16,
  },

  scoreNote: {
    flex: 1,
    paddingBottom: 4,
    fontSize: 12,
    lineHeight: 17,
    color: palette.subtle,
  },

  missingBox: {
    marginTop: 4,
    marginBottom: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderColor: palette.ink,
  },

  missingSlot: {
    width: 52,
    height: 62,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: palette.ink,
  },

  missingPlus: {
    fontSize: 22,
    fontWeight: "300",
    color: palette.ink,
  },

  missingInfo: {
    flex: 1,
  },

  missingLabel: {
    color: palette.ink,
    letterSpacing: 1.5,
  },

  missingName: {
    marginTop: 4,
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 0.3,
    color: palette.ink,
  },

  missingMeta: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    color: palette.subtle,
  },

  footerRow: {
    flexDirection: "row",
    gap: 10,
  },

  footerButton: {
    flex: 1,
    paddingHorizontal: 8,
  },

  footerHint: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0,
    color: palette.muted,
  },
});
