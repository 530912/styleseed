import { router } from "expo-router";

import { PrototypeGate } from "../components/styleseed/prototype-gate";

import { Pressable, StyleSheet, Text, View } from "react-native";

import { Badge, Screen, ScreenHeader } from "../components/styleseed/ui";

import { palette } from "../constants/ui";

import { useClosetLoader } from "../hooks/use-closet-loader";

import { useAnalysisStore } from "../store/useAnalysisStore";

import { useClosetStore } from "../store/useClosetStore";

import type { Clothing } from "../types";

import { getClothingName } from "../utils/format";

import {
  getMissingItemSuggestion,
  getRecommendedOutfit,
  type OutfitRecommendation,
} from "../utils/recommendation";

/**
 * STYLESEED VIDEO DEMO (내부용)
 *
 * 영상 촬영 시 원하는 장면부터 바로 열기 위한 route.
 * 앱의 일반 navigation에서는 링크하지 않는다. → /demo 로 직접 접근
 */

type DemoEntry = {
  clothing: Clothing;
  recommendation: OutfitRecommendation;
};

// Styling → Missing Item → Shop이 한 흐름으로 이어지도록
// 코디 매칭이 있으면서 부족한 아이템도 있는 옷을 우선 선택
const pickDemoEntry = (clothes: Clothing[]): DemoEntry | null => {
  const entries = clothes.map((clothing) => ({
    clothing,
    recommendation: getRecommendedOutfit(clothing, clothes),
  }));

  const byScore = (a: DemoEntry, b: DemoEntry) =>
    b.recommendation.score - a.recommendation.score;

  const withMatchesAndMissing = entries
    .filter(
      (entry) =>
        entry.recommendation.matches.length > 0 &&
        entry.recommendation.missingCategories.length > 0,
    )
    .sort(byScore);

  const withMatches = entries
    .filter((entry) => entry.recommendation.matches.length > 0)
    .sort(byScore);

  return withMatchesAndMissing[0] ?? withMatches[0] ?? entries[0] ?? null;
};

type DemoScene = {
  number: string;
  title: string;
  note: string;
  tag?: string;
  disabled?: boolean;
  onPress: () => void;
};

function DemoScreen() {
  const clothes = useClosetStore((state) => state.clothes);

  const imageUri = useAnalysisStore((state) => state.imageUri);

  const { status } = useClosetLoader();

  const demoEntry = pickDemoEntry(clothes);

  const firstMissingCategory = demoEntry?.recommendation.missingCategories[0];

  const suggestion =
    demoEntry && firstMissingCategory
      ? getMissingItemSuggestion(
          firstMissingCategory,
          demoEntry.recommendation.items,
        )
      : null;

  const clothingId = demoEntry ? String(demoEntry.clothing.id) : null;

  const closetNote =
    status === "loading"
      ? "Loading closet..."
      : status === "signed-out"
        ? "Log in first"
        : "Add closet items first";

  const scenes: DemoScene[] = [
    {
      number: "0",
      title: "Home / Today's Look",
      note: "Weather + closet recommendation",
      onPress: () => router.navigate("/"),
    },
    {
      number: "1",
      title: "Upload",
      note: "Pick one clothing photo",
      onPress: () => router.push("/upload"),
    },
    {
      number: "2",
      title: "Analysis",
      note: imageUri
        ? "Uses the photo picked in Upload"
        : "Pick a photo in Upload first",
      onPress: () => router.push("/analyze"),
    },
    {
      number: "3",
      title: "Closet",
      note: `${clothes.length} items`,
      onPress: () => router.push("/closet"),
    },
    {
      number: "4",
      title: "Styling",
      note: demoEntry ? getClothingName(demoEntry.clothing) : closetNote,
      disabled: !clothingId,
      onPress: () => {
        if (!clothingId) {
          return;
        }

        router.push({ pathname: "/styling", params: { clothingId } });
      },
    },
    {
      number: "5",
      title: "Missing Item",
      note: suggestion
        ? getClothingName(suggestion)
        : demoEntry
          ? "This look has no missing item"
          : closetNote,
      disabled: !clothingId || !suggestion,
      onPress: () => {
        if (!clothingId) {
          return;
        }

        router.push({ pathname: "/missing", params: { clothingId } });
      },
    },
    {
      number: "6",
      title: "Shop",
      note: suggestion
        ? `For ${getClothingName(suggestion)}`
        : demoEntry
          ? "Needs a missing item"
          : closetNote,
      disabled: !clothingId || !suggestion,
      onPress: () => {
        if (!clothingId || !suggestion) {
          return;
        }

        router.push({
          pathname: "/shop",
          params: {
            clothingId,
            missingCategory: suggestion.category,
            missingSubCategory: suggestion.subCategory,
            missingColor: suggestion.color,
            missingStyle: suggestion.style,
          },
        });
      },
    },
    {
      number: "7",
      title: "Ideal Style",
      note: "Select Poetcore",
      tag: "BETA",
      onPress: () => router.push("/ideal-style"),
    },
    {
      number: "8",
      title: "Core Match",
      note: "→ Poetcore Look",
      tag: "BETA",
      onPress: () => router.push("/core-match"),
    },
    {
      number: "9",
      title: "Top 3 Look",
      note: "MATCH SCORE 순 코디 3개",
      onPress: () => router.push("/looks"),
    },
  ];

  return (
    <Screen>
      <ScreenHeader
        eyebrow="INTERNAL"
        title="STYLESEED VIDEO DEMO"
        description="Shortcuts for filming. Not linked from the app."
      />

      {scenes.map((scene) => (
        <Pressable
          key={scene.number}
          disabled={scene.disabled}
          onPress={scene.onPress}
          style={({ pressed }) => [
            styles.row,
            scene.disabled && styles.rowDisabled,
            pressed && styles.rowPressed,
          ]}
        >
          <Text style={styles.number}>{scene.number}</Text>

          <View style={styles.info}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{scene.title}</Text>

              {scene.tag ? <Badge label={scene.tag} /> : null}
            </View>

            <Text style={styles.note} numberOfLines={1}>
              {scene.note}
            </Text>
          </View>

          <Text style={styles.arrow}>→</Text>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.line,
  },

  rowDisabled: {
    opacity: 0.35,
  },

  rowPressed: {
    opacity: 0.6,
  },

  number: {
    width: 22,
    fontSize: 22,
    fontWeight: "700",
    color: palette.ink,
  },

  info: {
    flex: 1,
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  title: {
    fontSize: 16,
    fontWeight: "700",
    color: palette.ink,
  },

  note: {
    marginTop: 3,
    fontSize: 12,
    color: palette.subtle,
  },

  arrow: {
    fontSize: 18,
    color: palette.ink,
  },
});

// 사용자 조사·배포 빌드에서는 숨김(src/lib/featureFlags.ts)
export default function DemoScreenRoute() {
  return (
    <PrototypeGate>
      <DemoScreen />
    </PrototypeGate>
  );
}
