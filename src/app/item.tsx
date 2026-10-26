import * as ImagePicker from "expo-image-picker";

import { router, useLocalSearchParams } from "expo-router";

import { useState } from "react";

import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ClothingImage } from "../components/styleseed/clothing-image";

import {
  Button,
  EmptyState,
  Label,
  Screen,
  ScreenHeader,
} from "../components/styleseed/ui";

import { palette } from "../constants/ui";

import { useClosetLoader } from "../hooks/use-closet-loader";

import { replaceClothingImage } from "../lib/clothes";

import { isSignedIn } from "../lib/sessionPolicy";

import { supabase } from "../lib/supabase";

import { getUserErrorMessage } from "../lib/userErrors";

import { useClosetStore } from "../store/useClosetStore";

import {
  useClothingImagePreference,
  useImagePreferenceStore,
  type ClothingImagePreference,
} from "../store/useImagePreferenceStore";

import { getClothingName, toTitle } from "../utils/format";

export default function ClothingImageScreen() {
  const { clothingId } = useLocalSearchParams<{
    clothingId: string;
  }>();

  const clothes = useClosetStore((state) => state.clothes);

  const updateClothing = useClosetStore((state) => state.updateClothing);

  const { status } = useClosetLoader();

  const setPreference = useImagePreferenceStore(
    (state) => state.setPreference,
  );

  const clearPreference = useImagePreferenceStore(
    (state) => state.clearPreference,
  );

  const [replacing, setReplacing] = useState(false);

  const clothing = clothes.find((item) => item.id === Number(clothingId));

  const preference = useClothingImagePreference(Number(clothingId));

  if (!clothing) {
    return (
      <Screen>
        <ScreenHeader eyebrow="ITEM" title="옷 수정" />

        {status === "loading" ? (
          <ActivityIndicator color={palette.ink} />
        ) : (
          <EmptyState
            title="선택한 옷을 찾을 수 없습니다."
            action={
              <Button
                label="내 옷장으로 가기"
                onPress={() => router.replace("/closet")}
              />
            }
          />
        )}
      </Screen>
    );
  }

  const hasCutout = Boolean(clothing.cutoutImageUri);

  // 배경 제거 이미지가 없으면 항상 원본을 보여준다.
  const activePreference: ClothingImagePreference = !hasCutout
    ? "original"
    : (preference ?? "cutout");

  // 직접 자른 사진을 그대로 사용한다. (자동 배경 제거를 다시 돌리지 않음)
  const handleReplaceImage = async () => {
    if (replacing) {
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.9,
      });

      if (result.canceled) {
        return;
      }

      setReplacing(true);

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (!isSignedIn(session)) {
        Alert.alert("로그인 필요", "다시 로그인한 뒤 시도해주세요.");

        return;
      }

      const patch = await replaceClothingImage(
        clothing.id,
        session.user.id,
        result.assets[0].uri,
      );

      updateClothing(clothing.id, patch);

      // 새 사진에는 배경 제거본이 없으므로 이전 선택값을 지운다.
      clearPreference(clothing.id);
    } catch (error) {
      console.error("옷 사진 교체 실패:", error);

      Alert.alert(
        "사진 변경 실패",
        getUserErrorMessage(
          error,
          "사진을 바꾸지 못했어요. 잠시 후 다시 시도해주세요.",
        ),
      );
    } finally {
      setReplacing(false);
    }
  };

  return (
    <Screen footer={<Button label="완료" onPress={() => router.back()} />}>
      <ScreenHeader
        eyebrow="ITEM"
        title="옷 수정"
        description={`${getClothingName(clothing)} · ${toTitle(clothing.subCategory)}`}
      />

      <Button
        label="옷 정보 수정 (카테고리·색·핏·소재·스타일)"
        onPress={() =>
          router.push({
            pathname: "/edit-item",
            params: { clothingId: String(clothing.id) },
          })
        }
        style={styles.editInfoButton}
      />

      <ClothingImage
        clothing={clothing}
        style={styles.preview}
        padding={20}
      />

      <Label style={styles.sectionLabel}>이미지</Label>

      <View style={styles.optionRow}>
        <ImageOption
          label="배경 제거"
          description={
            hasCutout ? "AI가 옷만 남긴 사진" : "이 옷에는 배경 제거본이 없어요"
          }
          selected={activePreference === "cutout"}
          disabled={!hasCutout}
          onPress={() => setPreference(clothing.id, "cutout")}
        />

        <ImageOption
          label="원본"
          description="촬영·선택한 사진 그대로"
          selected={activePreference === "original"}
          disabled={!clothing.originalImageUri}
          onPress={() => setPreference(clothing.id, "original")}
        />
      </View>

      <Button
        label={replacing ? "사진 바꾸는 중..." : "사진 다시 선택"}
        variant="secondary"
        loading={replacing}
        onPress={handleReplaceImage}
      />

      <Text style={styles.note}>
        사진을 다시 선택하면 자르기 화면에서 직접 맞춘 그대로 저장돼요. 배경
        제거는 다시 실행하지 않습니다.
      </Text>
    </Screen>
  );
}

type ImageOptionProps = {
  label: string;
  description: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
};

function ImageOption({
  label,
  description,
  selected,
  disabled = false,
  onPress,
}: ImageOptionProps) {
  return (
    <Pressable
      style={[
        styles.option,
        selected && styles.optionSelected,
        disabled && styles.optionDisabled,
      ]}
      disabled={disabled}
      onPress={onPress}
    >
      <Text style={[styles.optionLabel, selected && styles.optionLabelActive]}>
        {label}
      </Text>

      <Text
        style={[
          styles.optionDescription,
          selected && styles.optionDescriptionActive,
        ]}
      >
        {description}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  editInfoButton: {
    marginBottom: 16,
  },

  preview: {
    width: "100%",
    height: 300,
  },

  sectionLabel: {
    marginTop: 20,
    marginBottom: 8,
  },

  optionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },

  option: {
    flex: 1,
    padding: 14,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.background,
  },

  optionSelected: {
    borderColor: palette.ink,
    backgroundColor: palette.ink,
  },

  optionDisabled: {
    opacity: 0.4,
  },

  optionLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: palette.ink,
  },

  optionLabelActive: {
    color: palette.background,
  },

  optionDescription: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 17,
    color: palette.subtle,
  },

  optionDescriptionActive: {
    color: "#dddddd",
  },

  note: {
    marginTop: 12,
    fontSize: 12,
    lineHeight: 18,
    color: palette.muted,
  },
});
