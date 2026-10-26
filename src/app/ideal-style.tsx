import { router } from "expo-router";

import { PrototypeGate } from "../components/styleseed/prototype-gate";

import { useState } from "react";

import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button, Screen, ScreenHeader } from "../components/styleseed/ui";

import { palette } from "../constants/ui";

import { DEMO_CORE_OPTIONS, type CoreId } from "../data/coreDemo";

// NEXT / BETA: 다음 고도화 기능의 UI prototype
function IdealStyleScreen() {
  const [selectedCoreId, setSelectedCoreId] = useState<CoreId | null>(null);

  const selectedCore =
    DEMO_CORE_OPTIONS.find((option) => option.id === selectedCoreId) ?? null;

  return (
    <Screen
      footer={
        <Button
          label={
            selectedCore ? `${selectedCore.name}로 계속하기` : "스타일 코어를 선택하세요"
          }
          disabled={!selectedCore}
          onPress={() =>
            router.push({
              pathname: "/core-match",
              params: {
                core: selectedCoreId ?? "",
              },
            })
          }
        />
      }
    >
      <ScreenHeader
        eyebrow="NEXT"
        badge="BETA"
        title="나의 이상적인 스타일"
        description="스타일을 통해 어떤 사람이 되고 싶나요?"
      />

      <View style={styles.grid}>
        {DEMO_CORE_OPTIONS.map((option) => {
          const isSelected = option.id === selectedCoreId;

          return (
            <Pressable
              key={option.id}
              disabled={!option.availableInDemo}
              onPress={() => setSelectedCoreId(option.id)}
              style={[
                styles.card,
                isSelected && styles.cardSelected,
                !option.availableInDemo && styles.cardDisabled,
              ]}
            >
              <Text style={[styles.cardName, isSelected && styles.inverted]}>
                {option.name}
              </Text>

              <View style={styles.keywords}>
                {option.keywords.map((keyword) => (
                  <Text
                    key={keyword}
                    style={[
                      styles.keyword,
                      isSelected && styles.keywordInverted,
                    ]}
                  >
                    {keyword}
                  </Text>
                ))}
              </View>

              <Text style={[styles.cardStatus, isSelected && styles.inverted]}>
                {!option.availableInDemo
                  ? "준비 중"
                  : isSelected
                    ? "선택됨"
                    : "탭해서 선택"}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
  },

  card: {
    width: "48%",
    minHeight: 200,
    padding: 16,
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.background,
  },

  cardSelected: {
    borderColor: palette.ink,
    backgroundColor: palette.ink,
  },

  cardDisabled: {
    opacity: 0.4,
  },

  cardName: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: palette.ink,
  },

  keywords: {
    marginTop: 12,
    gap: 2,
  },

  keyword: {
    fontSize: 14,
    lineHeight: 20,
    color: palette.body,
  },

  keywordInverted: {
    color: "#dddddd",
  },

  cardStatus: {
    marginTop: 12,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0,
    color: palette.muted,
  },

  inverted: {
    color: palette.background,
  },
});

// 사용자 조사·배포 빌드에서는 숨김(src/lib/featureFlags.ts)
export default function IdealStyleScreenRoute() {
  return (
    <PrototypeGate>
      <IdealStyleScreen />
    </PrototypeGate>
  );
}
