import { router } from "expo-router";

import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { CoreAlignment } from "../components/styleseed/core-alignment";

import { LookBoard } from "../components/styleseed/look-board";

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

import {
  buildPrototypeCoreLook,
  getPrototypeCoreScore,
} from "../utils/prototypeCore";

// CORE ENGINE — BETA: 영상용 prototype 화면 (점수는 저장하지 않음)
export default function CoreLookScreen() {
  const clothes = useClosetStore((state) => state.clothes);

  const { status } = useClosetLoader();

  const rule = POETCORE_DEMO_RULE;

  const look = buildPrototypeCoreLook(clothes, rule);

  // 코디 안의 하의가 코어 적합도를 낮추고 있으면 교체를 제안한다.
  const bottomItem = look?.items.find((item) => item.category === "bottom");

  const bottomScore = bottomItem
    ? getPrototypeCoreScore(bottomItem, rule).prototypeCoreScore
    : null;

  const shouldSuggestBottom =
    look !== null &&
    bottomItem !== undefined &&
    bottomScore !== null &&
    bottomScore < look.prototypeAlignment;

  return (
    <Screen>
      <ScreenHeader
        eyebrow="CORE LOOK"
        badge="CORE ENGINE — BETA"
        title={`나의 ${rule.name} 코디`}
      />

      {!look ? (
        status === "loading" ? (
          <ActivityIndicator color={palette.ink} />
        ) : (
          <EmptyState
            title="아직 등록된 옷이 없어요"
            description="옷을 등록하면 내 옷장으로 코디를 만들어드려요."
          />
        )
      ) : (
        <>
          <LookBoard items={look.items} height={250} />

          <Text style={styles.itemNames} numberOfLines={2}>
            {look.items.map(getClothingName).join("  ·  ")}
          </Text>

          <View style={styles.alignmentRow}>
            <CoreAlignment
              coreName={rule.name}
              score={look.prototypeAlignment}
              isPrototype
            />

            <View style={styles.checks}>
              <CheckRow
                label="코디 궁합"
                passed={look.checks.compatibility}
              />

              <CheckRow label="코어 무드" passed={look.checks.coreMood} />

              <CheckRow
                label="내 옷장 아이템"
                passed={look.checks.personalCloset}
              />
            </View>
          </View>

          {shouldSuggestBottom && bottomItem && bottomScore !== null ? (
            <View style={styles.upgradeBox}>
              <Label style={styles.upgradeLabel}>CORE ALIGNMENT UP</Label>

              <Text style={styles.upgradeText}>
                {getClothingName(bottomItem)}의 코어 점수가 {bottomScore}%로
                가장 낮아요. 하의를 바꾸면 이 코디의 적합도가 올라갑니다.
              </Text>

              <Button
                label="추천 하의 보기"
                variant="secondary"
                onPress={() =>
                  router.push({
                    pathname: "/core-shop",
                    params: {
                      replaceId: String(bottomItem.id),
                    },
                  })
                }
              />
            </View>
          ) : null}

          <Text style={styles.closing}>
            내 옷장에서{"\n"}내가 되고 싶은 나에게.
          </Text>

          <Text style={styles.disclaimer}>
            고정된 데모 규칙으로 계산한 프로토타입 점수예요. ML 예측이 아니에요.
          </Text>
        </>
      )}
    </Screen>
  );
}

type CheckRowProps = {
  label: string;
  passed: boolean;
};

function CheckRow({ label, passed }: CheckRowProps) {
  return (
    <View style={styles.checkRow}>
      <Text style={[styles.checkMark, !passed && styles.checkMuted]}>
        {passed ? "✓" : "—"}
      </Text>

      <Text style={[styles.checkLabel, !passed && styles.checkMuted]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  itemNames: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    color: palette.ink,
  },

  alignmentRow: {
    marginTop: 18,
    paddingTop: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.line,
  },

  checks: {
    gap: 6,
    paddingBottom: 4,
  },

  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  checkMark: {
    width: 14,
    fontSize: 14,
    fontWeight: "700",
    color: palette.ink,
  },

  checkLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: palette.ink,
  },

  checkMuted: {
    color: palette.muted,
  },

  upgradeBox: {
    marginTop: 20,
    padding: 16,
    gap: 10,
    backgroundColor: palette.surface,
  },

  upgradeLabel: {
    color: palette.ink,
    letterSpacing: 1.5,
  },

  upgradeText: {
    fontSize: 14,
    lineHeight: 20,
    color: palette.body,
  },

  closing: {
    marginTop: 28,
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "700",
    letterSpacing: 1,
    color: palette.ink,
  },

  disclaimer: {
    marginTop: 14,
    fontSize: 11,
    lineHeight: 16,
    color: palette.muted,
  },
});
