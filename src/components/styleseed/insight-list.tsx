import { StyleSheet, Text, View } from "react-native";

import { palette } from "../../constants/ui";

import { Label } from "./ui";

export type InsightRowData = {
  key: string;
  label: string;
  value: string;
  score?: number;
  maxScore?: number;
};

type InsightListProps = {
  title?: string;
  rows: InsightRowData[];
};

// COLOR · Balanced contrast · 16/20 형태의 추천 근거 목록
export function InsightList({ title, rows }: InsightListProps) {
  return (
    <View>
      {title ? <Label style={styles.title}>{title}</Label> : null}

      {rows.map((row) => (
        <View key={row.key} style={styles.row}>
          <Text style={styles.rowLabel}>{row.label}</Text>

          <Text style={styles.rowValue} numberOfLines={1}>
            {row.value}
          </Text>

          {row.score !== undefined && row.maxScore !== undefined ? (
            <Text style={styles.rowScore}>
              {row.score}
              <Text style={styles.rowMax}>/{row.maxScore}</Text>
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    marginBottom: 4,
    letterSpacing: 0,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.line,
  },

  rowLabel: {
    width: 76,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
    color: palette.muted,
  },

  rowValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: palette.ink,
  },

  rowScore: {
    marginLeft: 8,
    fontSize: 13,
    fontWeight: "700",
    color: palette.ink,
  },

  rowMax: {
    fontSize: 11,
    fontWeight: "400",
    color: palette.muted,
  },
});
