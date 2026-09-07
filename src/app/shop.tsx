import { StyleSheet, Text, View } from "react-native";

import { useLocalSearchParams } from "expo-router";

import { mockOutfits } from "../data/mockOutfits";
import { mockProducts } from "../data/mockProducts";

export default function ShopScreen() {
  const { outfitId } = useLocalSearchParams<{
    outfitId: string;
  }>();

  const selectedOutfit = mockOutfits.find(
    (outfit) => outfit.id === Number(outfitId),
  );

  const capitalize = (text: string) => {
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  if (!selectedOutfit) {
    return (
      <View style={styles.container}>
        <Text>추천 코디를 찾을 수 없습니다.</Text>
      </View>
    );
  }

  const missingItem = selectedOutfit.missingItem;

  if (!missingItem) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Recommended Item</Text>

        <Text style={styles.description}>
          현재 옷장만으로 코디를 완성할 수 있어요.
        </Text>
      </View>
    );
  }

  const recommendedProducts = mockProducts.filter(
    (product) =>
      product.category === missingItem.category &&
      product.subCategory === missingItem.subCategory &&
      product.color === missingItem.color,
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Recommended Item</Text>

      <Text style={styles.description}>
        코디를 완성하기 위해 필요한 아이템이에요.
      </Text>

      <View style={styles.missingBox}>
        <Text style={styles.label}>MISSING ITEM</Text>

        <Text style={styles.missingItem}>
          {capitalize(missingItem.color)} {capitalize(missingItem.subCategory)}
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Recommended Products</Text>

      <View style={styles.productGrid}>
        {recommendedProducts.map((product) => (
          <View key={product.id} style={styles.productCard}>
            <View style={styles.imageBox}>
              <Text style={styles.imageText}>Product Image</Text>
            </View>

            <Text style={styles.productName}>{product.name}</Text>

            <Text style={styles.productInfo}>
              {capitalize(product.color)}
              {" · "}
              {capitalize(product.material)}
              {" · "}
              {capitalize(product.style)}
            </Text>

            <Text style={styles.price}>{product.price.toLocaleString()}원</Text>
          </View>
        ))}
      </View>
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

  missingBox: {
    marginTop: 40,
    padding: 20,
    backgroundColor: "#f4f4f4",
  },

  label: {
    fontSize: 12,
    color: "#888888",
  },

  missingItem: {
    marginTop: 8,
    fontSize: 22,
    fontWeight: "600",
    color: "#111111",
  },

  sectionTitle: {
    marginTop: 32,
    fontSize: 18,
    fontWeight: "600",
    color: "#111111",
  },

  productGrid: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  productCard: {
    width: "48%",
    marginBottom: 28,
  },

  imageBox: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: "#eeeeee",
    justifyContent: "center",
    alignItems: "center",
  },

  imageText: {
    color: "#999999",
  },

  productName: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "600",
    color: "#111111",
  },

  productInfo: {
    marginTop: 4,
    fontSize: 13,
    color: "#777777",
  },

  price: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: "600",
    color: "#111111",
  },
});
