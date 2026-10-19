import * as ImagePicker from "expo-image-picker";

import { router } from "expo-router";

import { useState } from "react";

import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Button, Screen, ScreenHeader } from "../components/styleseed/ui";

import { palette } from "../constants/ui";

import { useAnalysisStore } from "../store/useAnalysisStore";

import { hasAiConsent } from "../lib/aiConsent";

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

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.7,
        base64: true,
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets[0];

      if (!asset.base64) {
        return;
      }

      setImage(asset.uri, asset.base64);
    } finally {
      setPickingImage(false);
    }
  };

  const handleAnalyze = async () => {
    if (!imageUri) {
      return;
    }

    // 첫 분석 전 사진 AI 전송 동의(Beta Launch). 동의 화면이 분석 화면으로 이어준다
    if (!(await hasAiConsent())) {
      router.push({ pathname: "/ai-consent", params: { next: "analyze" } });

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
