import { router } from "expo-router";

import { PrototypeGate } from "../components/styleseed/prototype-gate";

import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { ClothingImage } from "../components/styleseed/clothing-image";

import {
  Button,
  EmptyState,
  Label,
  Screen,
  ScreenHeader,
} from "../components/styleseed/ui";

import { palette } from "../constants/ui";

import { POETCORE_DEMO_RULE } from "../data/coreDemo";

import { useClosetLoader } from "../hooks/use-closet-loader";

import { useClosetStore } from "../store/useClosetStore";

import { getClothingName } from "../utils/format";

import { rankClosetByPrototypeCore } from "../utils/prototypeCore";

const VISIBLE_MATCHES = 4;

// CORE ENGINE — BETA: 영상용 prototype 화면 (점수는 저장하지 않음)
function CoreMatchScreen() {
  const clothes = useClosetStore((state) => state.clothes);

  const { status } = useClosetLoader();

  // 이번 데모에서는 POETCORE만 지원
  const rule = POETCORE_DEMO_RULE;

  const matches = rankClosetByPrototypeCore(clothes, rule).slice(
    0,
    VISIBLE_MATCHES,
  );

  const ruleRows = [
    { label: "COLOR", values: rule.colors.labels },
    { label: "MATERIAL", values: rule.materials.labels },
    { label: "ITEM", values: rule.items.labels },
    { label: "MOOD", values: rule.moods },
  ];

  return (
    <Screen
      footer={
        <Button
          label={`나의 ${rule.name} 코디 보기`}
          disabled={matches.length === 0}
          onPress={() => router.push("/core-look")}
        />
      }
    >
      <ScreenHeader
        eyebrow="CORE MATCH"
        badge="CORE ENGINE — BETA"
        title={`나의 ${rule.name} 매칭`}
        description="내 옷장에서 이 코어와 연결되는 아이템이에요."
      />

      <View style={styles.ruleBox}>
        {ruleRows.map((row) => (
          <View key={row.label} style={styles.ruleRow}>
            <Text style={styles.ruleLabel}>{row.label}</Text>

            <Text style={styles.ruleValue} numberOfLines={1}>
              {row.values.join(" · ")}
            </Text>
          </View>
        ))}
      </View>

      {matches.length === 0 ? (
        status === "loading" ? (
          <ActivityIndicator color={palette.ink} />
        ) : (
          <EmptyState
            title="아직 등록된 옷이 없어요"
            description="옷을 등록하면 내 옷장이 이 코어와 어떻게 연결되는지 볼 수 있어요."
          />
        )
      ) : (
        matches.map((match) => (
          <View key={match.clothing.id} style={styles.matchRow}>
            <ClothingImage
              clothing={match.clothing}
              style={styles.thumb}
              padding={6}
            />

            <View style={styles.matchInfo}>
              <Text style={styles.matchName} numberOfLines={1}>
                {getClothingName(match.clothing)}
              </Text>

              <Text style={styles.matchSignals} numberOfLines={1}>
                {match.matchedSignals.length > 0
                  ? match.matchedSignals.join(" · ")
                  : "겹치는 요소가 적어요"}
              </Text>

              <Label style={styles.matchCaption}>{rule.name} MATCH</Label>
            </View>

            <Text style={styles.matchScore}>
              {match.prototypeCoreScore}
              <Text style={styles.matchPercent}>%</Text>
            </Text>
          </View>
        ))
      )}

      <Text style={styles.disclaimer}>
        고정된 데모 규칙으로 계산한 프로토타입 점수예요. ML 예측이 아니며
        저장되지 않아요.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  ruleBox: {
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 4,
    backgroundColor: palette.surface,
  },

  ruleRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  ruleLabel: {
    width: 72,
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1,
    color: palette.muted,
  },

  ruleValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: palette.ink,
  },

  matchRow: {
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.line,
  },

  thumb: {
    width: 64,
    height: 78,
  },

  matchInfo: {
    flex: 1,
  },

  matchName: {
    fontSize: 15,
    fontWeight: "700",
    color: palette.ink,
  },

  matchSignals: {
    marginTop: 3,
    fontSize: 12,
    color: palette.subtle,
  },

  matchCaption: {
    marginTop: 8,
    fontSize: 10,
    color: palette.ink,
  },

  matchScore: {
    fontSize: 40,
    fontWeight: "700",
    letterSpacing: -1,
    color: palette.ink,
  },

  matchPercent: {
    fontSize: 18,
  },

  disclaimer: {
    marginTop: 14,
    fontSize: 11,
    lineHeight: 16,
    color: palette.muted,
  },
});

// 사용자 조사·배포 빌드에서는 숨김(src/lib/featureFlags.ts)
export default function CoreMatchScreenRoute() {
  return (
    <PrototypeGate>
      <CoreMatchScreen />
    </PrototypeGate>
  );
}
