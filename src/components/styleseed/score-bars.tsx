import { StyleSheet, Text, View } from "react-native";

import { palette } from "../../constants/ui";

import type { OutfitScoreDetail } from "../../utils/outfitScore";

import { Label } from "./ui";

type ScoreBarsProps = {
  title?: string;
  details: OutfitScoreDetail[];

  // 지표 설명(note)까지 보여줄지
  showNotes?: boolean;
};

// OUTFIT EVALUATION: 지표별 0~100 점수를 막대로 보여준다.
export function ScoreBars({
  title,
  details,
  showNotes = false,
}: ScoreBarsProps) {
  return (
    <View>
      {title ? <Label style={styles.title}>{title}</Label> : null}

      {details.map((detail) => (
        <View key={detail.key} style={styles.row}>
          <Text style={styles.label} numberOfLines={1}>
            {detail.label}
          </Text>

          <View style={styles.track}>
            <View style={[styles.fill, { width: `${detail.score}%` }]} />
          </View>

          <Text style={styles.score}>{detail.score}</Text>

          {showNotes ? (
            <Text style={styles.note} numberOfLines={1}>
              {detail.note}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    marginBottom: 8,
    letterSpacing: 0,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
  },

  label: {
    width: 98,
    fontSize: 12,
    fontWeight: "600",
    color: palette.body,
  },

  track: {
    flex: 1,
    height: 6,
    backgroundColor: palette.hairline,
    overflow: "hidden",
  },

  fill: {
    height: "100%",
    backgroundColor: palette.ink,
  },

  score: {
    width: 34,
    textAlign: "right",
    fontSize: 13,
    fontWeight: "700",
    color: palette.ink,
  },

  note: {
    flex: 1,
    marginLeft: 10,
    fontSize: 11,
    color: palette.subtle,
  },
});
