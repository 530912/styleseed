import { useLocalSearchParams } from "expo-router";

import { Image, StyleSheet, Text, View } from "react-native";

import { ClothingImage } from "../components/styleseed/clothing-image";

import {
  EmptyState,
  Label,
  Screen,
  ScreenHeader,
} from "../components/styleseed/ui";

import { CLOTHING_CATEGORIES } from "../constants/clothingOptions";

import { palette } from "../constants/ui";

import { mockProducts } from "../data/mockProducts";

import { useClosetLoader } from "../hooks/use-closet-loader";

import { useClosetStore } from "../store/useClosetStore";

import type { ClothingCategory } from "../types";

import { getClothingName, toTitle, toUpperLabel } from "../utils/format";

export default function ShopScreen() {
  const {
    clothingId,
    missingCategory: missingCategoryParam,
    missingSubCategory,
    missingColor,
    missingStyle,
  } = useLocalSearchParams<{
    clothingId?: string;
    missingCategory?: string;
    missingSubCategory?: string;
    missingColor?: string;
    missingStyle?: string;
  }>();

  const clothes = useClosetStore((state) => state.clothes);

  useClosetLoader();

  // Styling 화면에서 선택했던 옷
  const selectedClothing = clothes.find(
    (clothing) => clothing.id === Number(clothingId),
  );

  // URL로 들어온 값이
  // 실제 ClothingCategory인지 확인
  const missingCategory = CLOTHING_CATEGORIES.includes(
    missingCategoryParam as ClothingCategory,
  )
    ? (missingCategoryParam as ClothingCategory)
    : null;

  // 부족한 카테고리에 해당하는
  // 상품만 추천
  const recommendedProducts = missingCategory
    ? mockProducts
        .filter((product) => product.category === missingCategory)
        .map((product) => {
          let matchScore = 0;

          const matchedAttributes: string[] = [];

          if (product.subCategory === missingSubCategory) {
            matchScore += 40;
            matchedAttributes.push(toTitle(product.subCategory));
          }

          if (product.color === missingColor) {
            matchScore += 35;
            matchedAttributes.push(toTitle(product.color));
          }

          if (product.style === missingStyle) {
            matchScore += 25;
            matchedAttributes.push(toTitle(product.style));
          }

          return {
            product,
            matchScore,
            matchedAttributes,
          };
        })
        .sort((a, b) => b.matchScore - a.matchScore)
    : [];

  const missingItemName = missingCategory
    ? [missingColor, missingSubCategory ?? missingCategory]
        .filter((value): value is string => Boolean(value))
        .map(toTitle)
        .join(" ")
    : null;

  return (
    <Screen>
      <ScreenHeader
        eyebrow="SHOP"
        badge="샘플 상품"
        title="내 옷장을 위한 추천 상품"
        description="이미 가진 옷으로 만든 코디를 완성해줄 아이템이에요."
      />

      {missingCategory && missingItemName ? (
        <View style={styles.contextBox}>
          {selectedClothing ? (
            <ClothingImage
              clothing={selectedClothing}
              style={styles.contextThumb}
              padding={4}
            />
          ) : null}

          <View style={styles.contextInfo}>
            <Label>코디를 완성하는 아이템</Label>

            <Text style={styles.contextText} numberOfLines={2}>
              {selectedClothing
                ? `${getClothingName(selectedClothing)} + `
                : ""}
              <Text style={styles.contextMissing}>{missingItemName}</Text>
            </Text>
          </View>
        </View>
      ) : null}

      {!missingCategory ? (
        <EmptyState title="부족한 아이템 정보를 찾을 수 없어요." />
      ) : recommendedProducts.length === 0 ? (
        <EmptyState title="해당 카테고리의 추천 상품이 아직 없어요." />
      ) : (
        recommendedProducts.map(({ product, matchedAttributes }) => {
          const matchesMissingItem =
            product.subCategory === missingSubCategory;

          return (
            <View key={product.id} style={styles.productCard}>
              <View style={styles.productImage}>
                {product.image ? (
                  <Image
                    source={product.image}
                    style={styles.productPhoto}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={styles.productImageText} numberOfLines={2}>
                    {toUpperLabel(product.subCategory)}
                  </Text>
                )}
              </View>

              <View style={styles.productInfo}>
                <Text style={styles.productBrand}>
                  {product.brand.toUpperCase()}
                </Text>

                <Text style={styles.productName} numberOfLines={2}>
                  {product.name}
                </Text>

                <Text style={styles.productPrice}>
                  {product.price.toLocaleString()}원
                </Text>

                <Text style={styles.reason} numberOfLines={1}>
                  {matchesMissingItem
                    ? "부족한 아이템과 딱 맞아요"
                    : "이 코디에 추천해요"}
                  {matchedAttributes.length > 0
                    ? ` · ${matchedAttributes.join(", ")}`
                    : ""}
                </Text>
              </View>
            </View>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  contextBox: {
    marginBottom: 16,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: palette.surface,
  },

  contextThumb: {
    width: 52,
    height: 64,
    backgroundColor: palette.background,
  },

  contextInfo: {
    flex: 1,
    gap: 4,
  },

  contextText: {
    fontSize: 15,
    lineHeight: 21,
    color: palette.body,
  },

  contextMissing: {
    fontWeight: "700",
    color: palette.ink,
  },

  productCard: {
    marginBottom: 12,
    padding: 12,
    flexDirection: "row",
    gap: 14,
    borderWidth: 1,
    borderColor: palette.line,
  },

  productImage: {
    width: 96,
    height: 116,
    backgroundColor: palette.placeholder,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },

  productPhoto: {
    width: "100%",
    height: "100%",
  },

  productImageText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    textAlign: "center",
    color: palette.muted,
  },

  productInfo: {
    flex: 1,
    justifyContent: "center",
  },

  productBrand: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: palette.muted,
  },

  productName: {
    marginTop: 4,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "600",
    color: palette.ink,
  },

  productPrice: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: "700",
    color: palette.ink,
  },

  reason: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: "600",
    color: palette.subtle,
  },
});
