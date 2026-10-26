import { router, useLocalSearchParams } from "expo-router";

import { useEffect, useRef } from "react";

import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { LookBoard } from "../components/styleseed/look-board";

import {
  Button,
  EmptyState,
  Label,
  Screen,
  ScreenHeader,
} from "../components/styleseed/ui";

import { palette } from "../constants/ui";

import { useClosetLoader } from "../hooks/use-closet-loader";

import { logResearchEvent } from "../lib/researchEvents";

import { useClosetStore } from "../store/useClosetStore";

import { getClothingName, toTitle, toUpperLabel } from "../utils/format";

import {
  getMissingItemSuggestion,
  getRecommendedOutfit,
} from "../utils/recommendation";

export default function MissingItemScreen() {
  const { clothingId } = useLocalSearchParams<{
    clothingId: string;
  }>();

  const clothes = useClosetStore((state) => state.clothes);

  const { status } = useClosetLoader();

  const selectedClothing = clothes.find(
    (clothing) => clothing.id === Number(clothingId),
  );

  // 사용자 조사: Missing Item 결과 조회(화면당 1번)
  const loggedMissing = useRef(false);

  useEffect(() => {
    if (!selectedClothing || loggedMissing.current) {
      return;
    }

    loggedMissing.current = true;

    const outfit = getRecommendedOutfit(selectedClothing, clothes);

    const category = outfit.missingCategories[0];

    logResearchEvent("missing_item_viewed", {
      missing_category: category,
      has_suggestion: Boolean(
        category && getMissingItemSuggestion(category, outfit.items),
      ),
    });
  }, [selectedClothing, clothes]);

  if (!selectedClothing) {
    return (
      <Screen>
        <ScreenHeader eyebrow="MISSING ITEM" title="이 코디를 완성해보세요" />

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

  // Styling 화면과 같은 추천 결과 + 기존 Missing Item 탐지 로직
  const recommendation = getRecommendedOutfit(selectedClothing, clothes);

  const [firstMissingCategory, ...otherMissingCategories] =
    recommendation.missingCategories;

  const suggestion = firstMissingCategory
    ? getMissingItemSuggestion(firstMissingCategory, recommendation.items)
    : null;

  if (!suggestion) {
    return (
      <Screen>
        <ScreenHeader eyebrow="MISSING ITEM" title="이 코디를 완성해보세요" />

        <LookBoard items={recommendation.items} layout="row" height={150} />

        <View style={styles.spacer} />

        <EmptyState
          title="이미 완성된 코디예요."
          description="추천 코디의 모든 아이템이 내 옷장에 있어요."
          action={
            <Button
              label="스타일링으로 돌아가기"
              variant="secondary"
              onPress={() => router.back()}
            />
          }
        />
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <Button
          label="예시 상품 보기"
          onPress={() => {
            logResearchEvent("missing_products_clicked", {
              missing_category: suggestion.category,
            });

            router.push({
              pathname: "/shop",

              params: {
                clothingId: String(selectedClothing.id),

                missingCategory: suggestion.category,

                missingSubCategory: suggestion.subCategory,

                missingColor: suggestion.color,

                missingStyle: suggestion.style,
              },
            });
          }}
        />
      }
    >
      <ScreenHeader
        eyebrow="MISSING ITEM"
        title="이 코디를 완성해보세요"
        description="나머지 아이템은 이미 내 옷장에 있어요."
      />

      <LookBoard
        items={recommendation.items}
        layout="row"
        height={150}
        missingLabel={toUpperLabel(suggestion.category)}
      />

      <View style={styles.missingCard}>
        <Label style={styles.missingLabel}>MISSING ITEM</Label>

        <Text style={styles.missingName}>
          {getClothingName(suggestion).toUpperCase()}
        </Text>

        <Text style={styles.missingMeta}>
          {toTitle(suggestion.category)} · {toTitle(suggestion.style)}
        </Text>

        <Text style={styles.missingDescription}>
          이 아이템 하나로 추천 코디가 완성돼요.
        </Text>
      </View>

      {otherMissingCategories.length > 0 ? (
        <Text style={styles.otherMissing}>
          함께 부족한 아이템: {otherMissingCategories.map(toTitle).join(", ")}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  spacer: {
    height: 16,
  },

  missingCard: {
    marginTop: 16,
    padding: 22,
    backgroundColor: palette.surface,
  },

  missingLabel: {
    color: palette.ink,
    letterSpacing: 2,
  },

  missingName: {
    marginTop: 12,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "700",
    letterSpacing: 0.3,
    color: palette.ink,
  },

  missingMeta: {
    marginTop: 6,
    fontSize: 13,
    color: palette.subtle,
  },

  missingDescription: {
    marginTop: 16,
    fontSize: 15,
    lineHeight: 21,
    color: palette.body,
  },

  otherMissing: {
    marginTop: 12,
    fontSize: 12,
    color: palette.subtle,
  },
});
