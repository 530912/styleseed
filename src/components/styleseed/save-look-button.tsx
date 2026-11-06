import { Pressable, StyleSheet, Text } from "react-native";

import { fonts, palette } from "../../constants/ui";

import { logResearchEvent } from "../../lib/researchEvents";

import { isLookSaved, type SavedLookSource } from "../../lib/savedLooksPolicy";

import { useSavedLooksStore } from "../../store/useSavedLooksStore";

type SaveLookButtonProps = {
  itemIds: number[];
  baseItemId: number | null;
  source: SavedLookSource;
};

// 추천 코디 저장 토글 (기기 저장). 저장한 코디는 옷장 → [저장한 코디]에서 다시 본다
export function SaveLookButton({ itemIds, baseItemId, source }: SaveLookButtonProps) {
  const saved = useSavedLooksStore((state) => isLookSaved(state.looks, itemIds));

  const toggleLook = useSavedLooksStore((state) => state.toggleLook);

  // 옷이 1벌뿐인 코디는 저장할 의미가 없다
  if (itemIds.length < 2) {
    return null;
  }

  const handlePress = () => {
    const nowSaved = toggleLook({
      itemIds,
      baseItemId,
      source,
      savedAt: new Date().toISOString(),
    });

    if (nowSaved) {
      logResearchEvent("outfit_saved", { screen: source, items_count: itemIds.length });
    } else {
      logResearchEvent("outfit_unsaved", { screen: source });
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: saved }}
      onPress={handlePress}
      hitSlop={8}
      style={({ pressed }) => [styles.button, saved && styles.saved, pressed && styles.pressed]}
    >
      <Text style={[styles.label, saved && styles.savedLabel]}>
        {saved ? "♥ 저장한 코디" : "♡ 이 코디 저장"}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: "flex-start",
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: palette.ink,
  },

  saved: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },

  pressed: {
    opacity: 0.7,
  },

  label: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: "600",
    color: palette.ink,
  },

  savedLabel: {
    color: palette.background,
  },
});
