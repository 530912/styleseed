import {
  Image,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { fonts, palette } from "../../constants/ui";

import { useClothingImagePreference } from "../../store/useImagePreferenceStore";

import type { Clothing } from "../../types";

import { toUpperLabel } from "../../utils/format";

type ClothingImageProps = {
  clothing: Pick<
    Clothing,
    "id" | "imageUri" | "originalImageUri" | "cutoutImageUri" | "subCategory"
  >;
  style?: StyleProp<ViewStyle>;
  padding?: number;
};

// 옷장 이미지를 회색 박스 안에 보여준다.
// 기본은 배경 제거 이미지이고, 사진 수정 화면에서 원본으로 바꾼 옷은 원본을 쓴다.
// 이미지가 없으면 sub category 이름으로 대체한다.
export function ClothingImage({
  clothing,
  style,
  padding = 10,
}: ClothingImageProps) {
  const preference = useClothingImagePreference(clothing.id);

  const imageUri =
    preference === "original"
      ? (clothing.originalImageUri ?? clothing.imageUri)
      : (clothing.cutoutImageUri ?? clothing.imageUri);

  return (
    <View style={[styles.box, { padding }, style]}>
      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          style={styles.image}
          resizeMode="contain"
        />
      ) : (
        <Text style={styles.fallback} numberOfLines={2}>
          {toUpperLabel(clothing.subCategory)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: palette.placeholder,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },

  image: {
    width: "100%",
    height: "100%",
  },

  fallback: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
    textAlign: "center",
    color: palette.muted,
  },
});
