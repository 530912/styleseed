import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { fonts, palette } from "../../constants/ui";

import type { ClosetLoadStatus } from "../../hooks/use-closet-loader";

import type { WeatherState } from "../../lib/weather";

import { getClothingName } from "../../utils/format";

import type {
  TodayLook,
  WeatherClosetNote,
} from "../../utils/weatherRecommendation";

import { CoreAlignment, type CoreAlignmentData } from "./core-alignment";

import { LookBoard } from "./look-board";

import { WeatherSummary } from "./weather-summary";

import { Button, Label, ScoreDisplay } from "./ui";

type TodayLookCardProps = {
  weather: WeatherState;
  look: TodayLook | null;

  // 오늘 날씨에 맞는 옷이 부족한 카테고리 안내
  weatherNotes?: WeatherClosetNote[];
  closetStatus: ClosetLoadStatus;
  onViewLook: () => void;
  onAddItem: () => void;
  onSignIn: () => void;
  onRetryWeather?: () => void;

  // 실제 Core Engine 연결 이후를 위한 자리.
  // 현재 Home에서는 전달하지 않는다. (prototype 점수를 섞지 않음)
  coreAlignment?: CoreAlignmentData;
};

export function TodayLookCard({
  weather,
  look,
  weatherNotes = [],
  closetStatus,
  onViewLook,
  onAddItem,
  onSignIn,
  onRetryWeather,
  coreAlignment,
}: TodayLookCardProps) {
  return (
    <View style={styles.card}>
      <Label style={styles.cardLabel}>TODAY&apos;S LOOK</Label>

      <WeatherSummary state={weather} onRetry={onRetryWeather} />

      <View style={styles.divider} />

      {look ? (
        <>
          <Text style={styles.caption}>
            {weather.status === "ready"
              ? "오늘 날씨에 맞춘 추천 코디"
              : "내 옷장에서 고른 추천 코디"}
          </Text>

          <LookBoard
            items={look.recommendation.items.slice(0, 4)}
            layout="row"
            height={112}
          />

          <Text style={styles.itemNames} numberOfLines={2}>
            {look.recommendation.items.map(getClothingName).join("  ·  ")}
          </Text>

          {/* 첫 줄(오늘 기온·날씨)은 위 날씨 요약과 겹치므로 아이템별 이유 하나만 */}
          {look.weatherReasons[1] ? (
            <Text style={styles.weatherReason}>· {look.weatherReasons[1]}</Text>
          ) : null}

          {weatherNotes.slice(0, 2).map((note) => (
            <Text key={note.category} style={styles.weatherNote}>
              {note.message}
            </Text>
          ))}

          <View style={styles.scoreRow}>
            <ScoreDisplay value={look.score} caption="MATCH" size="medium" />

            <View style={styles.breakdown}>
              <Text style={styles.breakdownText}>
                날씨 적합도 {look.weatherScore ?? "—"}
              </Text>

              <Text style={styles.breakdownText}>코디 궁합 {look.styleScore}</Text>
            </View>
          </View>

          {coreAlignment ? (
            <CoreAlignment {...coreAlignment} variant="compact" />
          ) : null}

          <Button label="오늘의 코디 보기" onPress={onViewLook} />
        </>
      ) : (
        <TodayLookEmpty
          closetStatus={closetStatus}
          onAddItem={onAddItem}
          onSignIn={onSignIn}
        />
      )}
    </View>
  );
}

type TodayLookEmptyProps = {
  closetStatus: ClosetLoadStatus;
  onAddItem: () => void;
  onSignIn: () => void;
};

function TodayLookEmpty({
  closetStatus,
  onAddItem,
  onSignIn,
}: TodayLookEmptyProps) {
  if (closetStatus === "loading") {
    return (
      <View style={styles.emptyRow}>
        <ActivityIndicator size="small" color={palette.ink} />

        <Text style={styles.emptyText}>옷장을 불러오고 있어요...</Text>
      </View>
    );
  }

  if (closetStatus === "signed-out") {
    return (
      <>
        <Text style={styles.emptyText}>
          로그인하면 내 옷장으로 오늘의 코디를 추천해드려요.
        </Text>

        <Button label="로그인" variant="secondary" onPress={onSignIn} />
      </>
    );
  }

  if (closetStatus === "error") {
    return (
      <Text style={styles.emptyText}>
        지금은 옷장을 불러오지 못했어요.
      </Text>
    );
  }

  return (
    <>
      <Text style={styles.emptyText}>
        옷을 몇 벌 등록하면 오늘의 코디를 추천해드려요.
      </Text>

      <Button label="옷 등록하기" variant="secondary" onPress={onAddItem} />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: palette.ink,
    backgroundColor: palette.background,
  },

  cardLabel: {
    color: palette.ink,
    letterSpacing: 2,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.line,
  },

  caption: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: palette.subtle,
  },

  itemNames: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    color: palette.ink,
  },

  weatherReason: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 17,
    color: palette.body,
  },

  weatherNote: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 17,
    color: palette.danger,
  },

  scoreRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },

  breakdown: {
    alignItems: "flex-end",
    gap: 4,
    paddingBottom: 2,
  },

  breakdownText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0,
    color: palette.subtle,
  },

  emptyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  emptyText: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    color: palette.body,
  },
});
