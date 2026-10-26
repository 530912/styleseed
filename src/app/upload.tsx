import * as ImagePicker from "expo-image-picker";

import { router } from "expo-router";

import { useState } from "react";

import { logResearchEvent } from "../lib/researchEvents";

import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Button, Screen, ScreenHeader } from "../components/styleseed/ui";

import { palette } from "../constants/ui";

import { prepareClothingImage } from "../lib/imagePrep";

import { useAnalysisStore } from "../store/useAnalysisStore";

export default function UploadScreen() {
  const [pickingImage, setPickingImage] = useState(false);

  const imageUri = useAnalysisStore((state) => state.imageUri);

  const setImage = useAnalysisStore((state) => state.setImage);

  const pickImage = async () => {
    if (pickingImage) {
      return;
    }

    try {
      setPickingImage(true);

      // 원본은 압축 없이 받고, 아래 prepareClothingImage에서 한 번만 줄이고 압축한다(KI-9)
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 1,
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets[0];

      // 분석과 저장에 같은 처리 이미지를 쓴다(긴 변 최대 1600px, JPEG)
      const prepared = await prepareClothingImage(asset.uri);

      setImage(prepared.uri, prepared.base64);

      // 사용자 조사: 의류 등록 시작 = 등록할 사진을 고름
      logResearchEvent("register_started");
    } catch (error) {
      console.warn("사진 준비 실패:", error);

      Alert.alert(
        "사진을 불러오지 못했어요",
        error instanceof Error && error.name === "ImageTooLargeError"
          ? error.message
          : "다른 사진을 선택해주세요.",
      );
    } finally {
      setPickingImage(false);
    }
  };

  const handleAnalyze = () => {
    if (!imageUri) {
      return;
    }

    router.push("/analyze");
  };

  return (
    <Screen
      footer={
        <Button
          label="분석하기"
          onPress={handleAnalyze}
          disabled={!imageUri || pickingImage}
        />
      }
    >
      <ScreenHeader
        eyebrow="UPLOAD"
        title="내 옷장에 옷 추가하기"
        description="옷 한 벌을 올리면 STYLESEED가 분석해드려요."
      />

      <Pressable
        style={styles.imageBox}
        onPress={pickImage}
        disabled={pickingImage}
        accessibilityRole="button"
        accessibilityLabel="옷 사진 선택"
      >
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.plus}>+</Text>

            <Text style={styles.placeholderTitle}>탭해서 사진 올리기</Text>

            <Text style={styles.placeholderText}>
              사진 한 장에 옷 한 벌만 담으면 가장 정확해요.
            </Text>
          </View>
        )}

        {pickingImage ? (
          <View style={styles.overlay}>
            <ActivityIndicator color={palette.ink} />
          </View>
        ) : null}
      </Pressable>

      {imageUri ? (
        <Pressable
          style={styles.changeButton}
          onPress={pickImage}
          disabled={pickingImage}
          hitSlop={8}
        >
          <Text style={styles.changeText}>사진 바꾸기</Text>
        </Pressable>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  imageBox: {
    width: "100%",
    aspectRatio: 0.9,
    backgroundColor: palette.placeholder,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },

  image: {
    width: "100%",
    height: "100%",
  },

  placeholder: {
    alignItems: "center",
    paddingHorizontal: 24,
  },

  plus: {
    fontSize: 44,
    fontWeight: "200",
    color: palette.ink,
  },

  placeholderTitle: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0,
    color: palette.ink,
  },

  placeholderText: {
    marginTop: 8,
    fontSize: 13,
    color: palette.body,
  },

  overlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(255, 255, 255, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },

  changeButton: {
    marginTop: 14,
    alignSelf: "center",
  },

  changeText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: palette.subtle,
  },
});
