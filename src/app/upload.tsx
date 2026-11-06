import * as ImagePicker from "expo-image-picker";

import { router } from "expo-router";

import { useEffect, useState } from "react";

import { logResearchEvent } from "../lib/researchEvents";

import { isCameraCaptureAvailable } from "../lib/camera";

import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Button, Screen, ScreenHeader } from "../components/styleseed/ui";

import { fonts, palette } from "../constants/ui";

import { prepareClothingImage } from "../lib/imagePrep";

import { useAnalysisStore } from "../store/useAnalysisStore";

import { hasAiConsent } from "../lib/aiConsent";

export default function UploadScreen() {
  const [pickingImage, setPickingImage] = useState(false);

  const imageUri = useAnalysisStore((state) => state.imageUri);

  const setImage = useAnalysisStore((state) => state.setImage);

  // 웹은 미리 렌더링한 HTML과 첫 화면이 같아야 하므로(하이드레이션) 화면이 뜬 뒤에 판단한다
  const [canUseCamera, setCanUseCamera] = useState(false);

  useEffect(() => {
    setCanUseCamera(isCameraCaptureAvailable());
  }, []);

  // 카메라 권한이 없으면 설정으로 안내한다. 허용되면 true
  const ensureCameraPermission = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (permission.granted) {
      return true;
    }

    Alert.alert(
      "카메라 권한이 필요해요",
      "옷 사진을 찍으려면 설정에서 카메라 접근을 허용해주세요. 앨범에서 사진을 골라도 돼요.",
      [
        { text: "취소", style: "cancel" },
        { text: "설정 열기", onPress: () => Linking.openSettings() },
      ],
    );

    return false;
  };

  const pickImage = async (source: "library" | "camera" = "library") => {
    if (pickingImage) {
      return;
    }

    try {
      setPickingImage(true);

      if (source === "camera" && !(await ensureCameraPermission())) {
        return;
      }

      // 원본은 압축 없이 받고, 아래 prepareClothingImage에서 한 번만 줄이고 압축한다(KI-9)
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 1,
      };

      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);

      if (result.canceled) {
        return;
      }

      const asset = result.assets[0];

      // 분석과 저장에 같은 처리 이미지를 쓴다(긴 변 최대 1600px, JPEG)
      const prepared = await prepareClothingImage(asset.uri);

      setImage(prepared.uri, prepared.base64);

      // 사용자 조사: 의류 등록 시작 = 등록할 사진을 고름
      logResearchEvent("register_started", { source });
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
        onPress={() => pickImage("library")}
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

            <Text style={styles.placeholderTitle}>탭해서 앨범에서 사진 고르기</Text>

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
        <View style={styles.changeRow}>
          <Pressable
            style={styles.changeButton}
            onPress={() => pickImage("library")}
            disabled={pickingImage}
            hitSlop={8}
          >
            <Text style={styles.changeText}>사진 바꾸기</Text>
          </Pressable>

          {canUseCamera ? (
            <Pressable
              style={styles.changeButton}
              onPress={() => pickImage("camera")}
              disabled={pickingImage}
              hitSlop={8}
            >
              <Text style={styles.changeText}>다시 찍기</Text>
            </Pressable>
          ) : null}
        </View>
      ) : canUseCamera ? (
        <Button
          label="카메라로 찍기"
          variant="secondary"
          onPress={() => pickImage("camera")}
          disabled={pickingImage}
          style={styles.cameraButton}
        />
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
    fontFamily: fonts.sans,
    fontSize: 44,
    fontWeight: "200",
    color: palette.ink,
  },

  placeholderTitle: {
    marginTop: 4,
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0,
    color: palette.ink,
  },

  placeholderText: {
    marginTop: 8,
    fontFamily: fonts.sans,
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

  changeRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 24,
  },

  changeButton: {
    marginTop: 14,
    alignSelf: "center",
  },

  cameraButton: {
    marginTop: 14,
  },

  changeText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: palette.subtle,
  },
});
