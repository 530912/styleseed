import { router, useLocalSearchParams } from "expo-router";

import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";

import {
  Button,
  EmptyState,
  Label,
  Screen,
  ScreenHeader,
} from "../components/styleseed/ui";

import { palette } from "../constants/ui";

import {
  POETCORE_DEMO_RULE,
  POETCORE_RECOMMENDED_PRODUCT_IDS,
} from "../data/coreDemo";

import { mockProducts } from "../data/mockProducts";

import { useClosetLoader } from "../hooks/use-closet-loader";

import { useClosetStore } from "../store/useClosetStore";

import { getClothingName, toUpperLabel } from "../utils/format";

import {
  buildPrototypeCoreLook,
  getCoreUpgradeSuggestions,
} from "../utils/prototypeCore";

// CORE ENGINE — BETA: 코어 적합도를 높여주는 아이템 추천 (프로토타입 점수)
export default function CoreShopScreen() {
  const { replaceId } = useLocalSearchParams<{
    replaceId?: string;
  }>();

  const clothes = useClosetStore((state) => state.clothes);

  const { status } = useClosetLoader();

  const rule = POETCORE_DEMO_RULE;

  const look = buildPrototypeCoreLook(clothes, rule);

  // 교체 대상: 전달받은 아이템, 없으면 코디 안의 하의
  const replacedItem =
    look?.items.find((item) => item.id === Number(replaceId)) ??
    look?.items.find((item) => item.category === "bottom");

  const candidates = mockProducts.filter(
    (product) =>
      POETCORE_RECOMMENDED_PRODUCT_IDS.includes(product.id) &&
      (!replacedItem || product.category === replacedItem.category),
  );

  const suggestions =
    look && replacedItem
      ? getCoreUpgradeSuggestions(look, replacedItem.id, candidates, rule)
      : [];

  if (!look || !replacedItem || suggestions.length === 0) {
    return (
      <Screen>
        <ScreenHeader
          eyebrow="CORE SHOP"
          badge="CORE ENGINE — BETA"
          title="적합도를 높이는 아이템"
        />

        {status === "loading" ? (
          <ActivityIndicator color={palette.ink} />
        ) : (
          <EmptyState
            title="추천할 아이템이 없어요"
            description="옷장에 코디가 만들어져야 교체 추천을 계산할 수 있어요."
            action={
              <Button
                label="내 코디 보기"
                onPress={() => router.replace("/core-look")}
              />
            }
          />
        )}
      </Screen>
    );
  }

  return (
    <Screen footer={<Button label="코디로 돌아가기" onPress={() => router.back()} />}>
      <ScreenHeader
        eyebrow="CORE SHOP"
        badge="CORE ENGINE — BETA"
        title={`${rule.name} 적합도를 높이는 하의`}
        description={`지금 코디의 ${getClothingName(replacedItem)}를 바꾸면 코어 적합도가 올라가요.`}
      />

      <View style={styles.currentBox}>
        <Label>현재 CORE ALIGNMENT</Label>

        <Text style={styles.currentScore}>{look.prototypeAlignment}%</Text>
      </View>

      {suggestions.map(
        ({ product, productScore, alignmentAfter, alignmentDelta }) => (
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

              <View style={styles.upgradeRow}>
                <Text style={styles.upgradeCaption}>구매 시 CORE ALIGNMENT</Text>

                <Text style={styles.upgradeScore}>
                  {alignmentAfter}%
                  {alignmentDelta > 0 ? (
                    <Text style={styles.upgradeDelta}> +{alignmentDelta}</Text>
                  ) : null}
                </Text>
              </View>

              <Text style={styles.itemScore}>
                이 아이템 {rule.name} 점수 {productScore}%
              </Text>
            </View>
          </View>
        ),
      )}

      <Text style={styles.disclaimer}>
        고정된 데모 규칙으로 계산한 프로토타입 점수예요. ML 예측이 아니며,
        실제 구매나 재고와 연결되지 않은 샘플 상품입니다.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  currentBox: {
    marginBottom: 16,
    padding: 16,
    gap: 6,
    backgroundColor: palette.surface,
  },

  currentScore: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.5,
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
    width: 104,
    height: 132,
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
    marginTop: 6,
    fontSize: 15,
    fontWeight: "700",
    color: palette.ink,
  },

  upgradeRow: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.line,
  },

  upgradeCaption: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    color: palette.muted,
  },

  upgradeScore: {
    marginTop: 2,
    fontSize: 22,
    fontWeight: "700",
    color: palette.ink,
  },

  upgradeDelta: {
    fontSize: 13,
    fontWeight: "700",
    color: palette.subtle,
  },

  itemScore: {
    marginTop: 6,
    fontSize: 11,
    color: palette.subtle,
  },

  disclaimer: {
    marginTop: 8,
    fontSize: 11,
    lineHeight: 16,
    color: palette.muted,
  },
});
