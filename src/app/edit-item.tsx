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

import {
  CLOTHING_CATEGORIES,
  CLOTHING_COLORS,
  CLOTHING_FITS,
  CLOTHING_MATERIALS,
  CLOTHING_STYLES,
  CLOTHING_SUBCATEGORIES,
} from "../constants/clothingOptions";

import { palette } from "../constants/ui";

import { useClosetLoader } from "../hooks/use-closet-loader";

import {
  updateClothingAttributes,
  type EditableClothingAttributes,
} from "../lib/clothes";

import { logResearchEvent } from "../lib/researchEvents";

import { getEditedFields } from "../lib/researchEventsPolicy";

import { getUserErrorMessage } from "../lib/userErrors";

import { useClosetStore } from "../store/useClosetStore";

import type { Clothing } from "../types";

import { getClothingName, toTitle } from "../utils/format";

import { getSubcategoryOptions } from "../utils/taxonomyCompat";

const pickAttributes = (clothing: Clothing): EditableClothingAttributes => ({
  category: clothing.category,
  subCategory: clothing.subCategory,
  color: clothing.color,
  fit: clothing.fit,
  material: clothing.material,
  style: clothing.style,
});

// 저장한 옷의 속성 수정 (2026-11 사용자 조사 1차 범위)
export default function EditItemScreen() {
  const { clothingId } = useLocalSearchParams<{
    clothingId: string;
  }>();

  const clothes = useClosetStore((state) => state.clothes);

  const updateClothing = useClosetStore((state) => state.updateClothing);

  const { status } = useClosetLoader();

  const clothing = clothes.find((item) => item.id === Number(clothingId));

  if (!clothing) {
    return (
      <Screen>
        <ScreenHeader eyebrow="ITEM" title="옷 정보 수정" />

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

  return <AttributeForm clothing={clothing} onSaved={updateClothing} />;
}

function AttributeForm({
  clothing,
  onSaved,
}: {
  clothing: Clothing;
  onSaved: (clothingId: number, patch: Partial<Clothing>) => void;
}) {
  const [draft, setDraft] = useState(() => pickAttributes(clothing));

  const [saving, setSaving] = useState(false);

  const editedFields = getEditedFields(pickAttributes(clothing), draft);

  const set = (patch: Partial<EditableClothingAttributes>) =>
    setDraft((current) => ({ ...current, ...patch }));

  const toggleStyle = (style: Clothing["style"][number]) => {
    const exists = draft.style.includes(style);

    // STYLE은 최소 하나 남긴다(분석 화면과 같은 규칙)
    if (exists && draft.style.length === 1) {
      return;
    }

    set({
      style: exists
        ? draft.style.filter((item) => item !== style)
        : [...draft.style, style],
    });
  };

  const handleSave = async () => {
    if (saving || editedFields.length === 0) {
      return;
    }

    try {
      setSaving(true);

      const saved = await updateClothingAttributes(clothing.id, draft);

      onSaved(clothing.id, saved);

      logResearchEvent("attribute_edited", {
        edited_count: editedFields.length,
        edited_fields: editedFields.join("|"),
        category: saved.category,
      });

      router.back();
    } catch (error) {
      console.error("옷 정보 수정 실패:", error);

      Alert.alert(
        "수정 실패",
        getUserErrorMessage(
          error,
          "옷 정보를 바꾸지 못했어요. 잠시 후 다시 시도해주세요.",
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      footer={
        <Button
          label={editedFields.length === 0 ? "바뀐 내용이 없어요" : "수정 내용 저장"}
          disabled={editedFields.length === 0}
          loading={saving}
          onPress={handleSave}
        />
      }
    >
      <ScreenHeader
        eyebrow="ITEM"
        title="옷 정보 수정"
        description={`${getClothingName(clothing)} · AI가 잘못 분석한 항목을 고쳐주세요.`}
      />

      <ClothingImage clothing={clothing} style={styles.preview} padding={16} />

      <Label style={styles.sectionLabel}>CATEGORY</Label>

      <View style={styles.optionRow}>
        {CLOTHING_CATEGORIES.map((item) => (
          <OptionChip
            key={item}
            label={toTitle(item)}
            selected={draft.category === item}
            onPress={() =>
              set({
                category: item,
                subCategory:
                  item === draft.category
                    ? draft.subCategory
                    : CLOTHING_SUBCATEGORIES[item][0],
              })
            }
          />
        ))}
      </View>

      <Label style={styles.sectionLabel}>SUB CATEGORY</Label>

      <View style={styles.optionRow}>
        {getSubcategoryOptions(draft.category, draft.subCategory).map((item) => (
          <OptionChip
            key={item}
            label={toTitle(item)}
            selected={draft.subCategory === item}
            onPress={() => set({ subCategory: item })}
          />
        ))}
      </View>

      <Label style={styles.sectionLabel}>COLOR</Label>

      <View style={styles.optionRow}>
        {CLOTHING_COLORS.map((item) => (
          <OptionChip
            key={item}
            label={toTitle(item)}
            selected={draft.color === item}
            onPress={() => set({ color: item })}
          />
        ))}
      </View>

      <Label style={styles.sectionLabel}>FIT</Label>

      <View style={styles.optionRow}>
        {CLOTHING_FITS.map((item) => (
          <OptionChip
            key={item}
            label={toTitle(item)}
            selected={draft.fit === item}
            onPress={() => set({ fit: item })}
          />
        ))}
      </View>

      <Label style={styles.sectionLabel}>MATERIAL</Label>

      <View style={styles.optionRow}>
        {CLOTHING_MATERIALS.map((item) => (
          <OptionChip
            key={item}
            label={toTitle(item)}
            selected={draft.material === item}
            onPress={() => set({ material: item })}
          />
        ))}
      </View>

      <Label style={styles.sectionLabel}>STYLE (여러 개 선택)</Label>

      <View style={styles.optionRow}>
        {CLOTHING_STYLES.map((item) => (
          <OptionChip
            key={item}
            label={toTitle(item)}
            selected={draft.style.includes(item)}
            onPress={() => toggleStyle(item)}
          />
        ))}
      </View>

      <Text style={styles.note}>
        계절·TPO는 AI 분석값을 그대로 써요. 바꾼 내용은 코디 추천에 바로 반영돼요.
      </Text>
    </Screen>
  );
}

type OptionChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

function OptionChip({ label, selected, onPress }: OptionChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.optionButton, selected && styles.selectedOption]}
      onPress={onPress}
    >
      <Text style={[styles.optionText, selected && styles.selectedOptionText]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  preview: {
    width: "100%",
    height: 200,
  },

  sectionLabel: {
    marginTop: 20,
    marginBottom: 8,
  },

  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  optionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#cccccc",
  },

  selectedOption: {
    backgroundColor: palette.ink,
    borderColor: palette.ink,
  },

  optionText: {
    fontSize: 13,
    color: palette.ink,
  },

  selectedOptionText: {
    color: palette.background,
  },

  note: {
    marginTop: 20,
    fontSize: 12,
    lineHeight: 18,
    color: palette.subtle,
  },
});
