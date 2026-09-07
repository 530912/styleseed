import { Pressable, StyleSheet, Text, View } from "react-native";

import { router, useLocalSearchParams } from "expo-router";

import { mockOutfits } from "../data/mockOutfits";
import { useClosetStore } from "../store/useClosetStore";

export default function StylingScreen() {
  const { clothingId } = useLocalSearchParams<{
    clothingId: string;
  }>();

  const clothes = useClosetStore((state) => state.clothes);

  const selectedClothing = clothes.find(
    (clothing) => clothing.id === Number(clothingId),
  );

  const recommendedOutfit = mockOutfits[0];

  const capitalize = (text: string) => {
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  if (!selectedClothing) {
    return (
      <View style={styles.container}>
        <Text>선택한 옷을 찾을 수 없습니다.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Styling</Text>

      <Text style={styles.description}>
        선택한 옷을 기준으로 코디를 추천했어요.
      </Text>

      <View style={styles.selectedBox}>
        <Text style={styles.label}>SELECTED ITEM</Text>

        <Text style={styles.selectedItem}>
          {capitalize(selectedClothing.color)}{" "}
          {capitalize(selectedClothing.fit)}{" "}
          {capitalize(selectedClothing.subCategory)}
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Recommended Outfit</Text>

      <View style={styles.outfitBox}>
        {recommendedOutfit.clothingIds.map((id) => {
          const clothing = clothes.find((item) => item.id === id);

          if (!clothing) {
            return null;
          }

          return (
            <Text key={clothing.id} style={styles.item}>
              {capitalize(clothing.category)}
              {" · "}
              {capitalize(clothing.color)} {capitalize(clothing.subCategory)}
            </Text>
          );
        })}

        <Text style={styles.score}>Match Score {recommendedOutfit.score}</Text>
      </View>

      <Pressable
        style={styles.button}
        onPress={() =>
          router.push({
            pathname: "/shop",
            params: {
              outfitId: String(recommendedOutfit.id),
            },
          })
        }
      >
        <Text style={styles.buttonText}>부족한 아이템 보기</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
    paddingHorizontal: 24,
    paddingTop: 100,
  },

  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111111",
  },

  description: {
    marginTop: 12,
    fontSize: 16,
    color: "#666666",
  },

  selectedBox: {
    marginTop: 40,
    padding: 20,
    backgroundColor: "#f4f4f4",
  },

  label: {
    fontSize: 12,
    color: "#888888",
  },

  selectedItem: {
    marginTop: 8,
    fontSize: 20,
    fontWeight: "600",
    color: "#111111",
  },

  sectionTitle: {
    marginTop: 32,
    fontSize: 18,
    fontWeight: "600",
    color: "#111111",
  },

  outfitBox: {
    marginTop: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#dddddd",
  },

  item: {
    fontSize: 16,
    marginBottom: 12,
    color: "#111111",
  },

  score: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "600",
    color: "#111111",
  },

  button: {
    marginTop: 24,
    paddingVertical: 18,
    backgroundColor: "#111111",
    alignItems: "center",
  },

  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});
