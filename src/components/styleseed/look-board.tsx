import { StyleSheet, Text, View } from "react-native";

import { palette } from "../../constants/ui";

import type { Clothing } from "../../types";

import { ClothingImage } from "./clothing-image";

type LookBoardProps = {
  items: Clothing[];
  height?: number;

  // "editorial": 대표 아이템을 크게, 나머지를 오른쪽에 쌓아서 표시
  // "row": 모든 아이템을 같은 크기로 한 줄에 표시
  layout?: "editorial" | "row";

  // 코디에서 비어 있는 자리 (예: "SHOES")
  missingLabel?: string | null;
};

const GAP = 8;

export function LookBoard({
  items,
  height = 240,
  layout = "editorial",
  missingLabel = null,
}: LookBoardProps) {
  if (items.length === 0) {
    return null;
  }

  if (layout === "row" || items.length <= 2) {
    return (
      <View style={styles.row}>
        {items.map((item) => (
          <ClothingImage
            key={item.id}
            clothing={item}
            style={[styles.flexTile, { height }]}
            padding={items.length > 3 ? 6 : 10}
          />
        ))}

        {missingLabel ? (
          <View style={[styles.flexTile, styles.missingTile, { height }]}>
            <Text style={styles.missingPlus}>+</Text>

            <Text style={styles.missingText} numberOfLines={2}>
              {missingLabel}
            </Text>
          </View>
        ) : null}
      </View>
    );
  }

  const [mainItem, ...restItems] = items;

  // 부족한 아이템이 있으면 빈 자리도 한 칸으로 함께 보여준다.
  const slotCount = restItems.length + (missingLabel ? 1 : 0);

  const restHeight = (height - GAP * (slotCount - 1)) / slotCount;

  return (
    <View style={styles.row}>
      <ClothingImage
        clothing={mainItem}
        style={[styles.mainTile, { height }]}
        padding={14}
      />

      <View style={styles.restColumn}>
        {restItems.map((item) => (
          <ClothingImage
            key={item.id}
            clothing={item}
            style={{ height: restHeight }}
            padding={6}
          />
        ))}

        {missingLabel ? (
          <View style={[styles.missingTile, { height: restHeight }]}>
            <Text style={styles.missingPlus}>+</Text>

            <Text style={styles.missingText} numberOfLines={2}>
              {missingLabel}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: GAP,
  },

  flexTile: {
    flex: 1,
  },

  mainTile: {
    flex: 1.4,
  },

  restColumn: {
    flex: 1,
    gap: GAP,
  },

  missingTile: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: palette.ink,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },

  missingPlus: {
    fontSize: 24,
    fontWeight: "300",
    color: palette.ink,
  },

  missingText: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    textAlign: "center",
    color: palette.ink,
  },
});
