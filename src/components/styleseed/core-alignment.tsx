import { StyleSheet, Text, View } from "react-native";

import { palette } from "../../constants/ui";

import { Badge, Label, ScoreDisplay } from "./ui";

/**
 * Core Alignment 표시 컴포넌트
 *
 * 지금은 CORE ENGINE — BETA 데모 화면에서만 prototype 점수와 함께 사용한다.
 * 실제 Core Engine이 연결되면 TodayLookCard의 coreAlignment prop으로
 * 같은 컴포넌트를 재사용할 수 있다.
 */
export type CoreAlignmentData = {
  coreName: string;
  score: number;

  // prototype 점수인 경우 BETA 표시
  isPrototype: boolean;
};

type CoreAlignmentProps = CoreAlignmentData & {
  variant?: "large" | "compact";
};

export function CoreAlignment({
  coreName,
  score,
  isPrototype,
  variant = "large",
}: CoreAlignmentProps) {
  if (variant === "compact") {
    return (
      <View style={styles.compactRow}>
        <Label style={styles.compactLabel}>{coreName} ALIGNMENT</Label>

        <Text style={styles.compactScore}>{score}%</Text>

        {isPrototype ? <Badge label="BETA" /> : null}
      </View>
    );
  }

  return (
    <View>
      <ScoreDisplay value={score} caption="CORE ALIGNMENT" />

      {isPrototype ? (
        <Text style={styles.prototypeNote}>프로토타입 점수</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  compactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  compactLabel: {
    flex: 1,
    color: palette.ink,
  },

  compactScore: {
    fontSize: 18,
    fontWeight: "700",
    color: palette.ink,
  },

  prototypeNote: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1,
    color: palette.muted,
  },
});
