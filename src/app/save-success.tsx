import { router, useLocalSearchParams } from "expo-router";

import { StyleSheet, Text, View } from "react-native";

import { ClothingImage } from "../components/styleseed/clothing-image";

import {
  Button,
  EmptyState,
  Screen,
  ScreenHeader,
} from "../components/styleseed/ui";

import { fonts, palette } from "../constants/ui";

import { useClosetStore } from "../store/useClosetStore";

import { getClothingName, toTitle } from "../utils/format";

// 옷 저장 직후 확인 화면. Figma 06 Screens "SAVE SUCCESS"
export default function SaveSuccessScreen() {
  const { clothingId } = useLocalSearchParams<{
    clothingId?: string;
  }>();

  const clothing = useClosetStore((state) =>
    state.clothes.find((item) => String(item.id) === clothingId),
  );

  if (!clothing) {
    return (
      <Screen showBack={false}>
        <ScreenHeader eyebrow="SAVED" title="옷장에 저장했어요" />

        <EmptyState
          title="저장한 옷 정보를 찾을 수 없어요."
          action={
            <Button
              label="내 옷장 보기"
              onPress={() => router.replace("/closet")}
            />
          }
        />
      </Screen>
    );
  }

  return (
    <Screen
      showBack={false}
      footer={
        <>
          <Button
            label="옷 더 등록하기"
            onPress={() => router.replace("/upload")}
          />

          <Button
            label="내 옷장 보기"
            variant="secondary"
            onPress={() => router.replace("/closet")}
          />
        </>
      }
    >
      <ScreenHeader
        eyebrow="SAVED"
        title="옷장에 저장했어요"
        description="이제 이 옷으로 코디를 추천받을 수 있어요."
      />

      <View style={styles.block}>
        <ClothingImage clothing={clothing} style={styles.image} padding={12} />

        <Text style={styles.name}>
          {getClothingName(clothing).toUpperCase()}
        </Text>

        <Text style={styles.meta}>
          {toTitle(clothing.subCategory)} · {toTitle(clothing.category)}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: {
    padding: 24,
    alignItems: "center",
    gap: 8,
    backgroundColor: palette.mintSurface,
  },

  image: {
    width: 168,
    height: 210,
    marginBottom: 8,
  },

  name: {
    fontFamily: fonts.sans,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "700",
    color: palette.ink,
  },

  meta: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 22,
    color: palette.mintText,
  },
});
