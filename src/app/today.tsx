import { router } from "expo-router";

import { useMemo, useState } from "react";

import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { ScoreBars } from "../components/styleseed/score-bars";

import { LookBoard } from "../components/styleseed/look-board";

import {
  Button,
  EmptyState,
  Screen,
  ScreenHeader,
  ScoreDisplay,
} from "../components/styleseed/ui";

import { palette } from "../constants/ui";

import { useClosetLoader } from "../hooks/use-closet-loader";

import { useWeather } from "../hooks/use-weather";

import { formatTemperature } from "../lib/weather";

import { useClosetStore } from "../store/useClosetStore";

import { getClothingName } from "../utils/format";

import {
  getTodaysLooks,
  getTodaysWeatherNotes,
} from "../utils/weatherRecommendation";

export default function TodayLookScreen() {
  const clothes = useClosetStore((state) => state.clothes);

  const { status: closetStatus } = useClosetLoader();

  const { weather } = useWeather();

  const [lookIndex, setLookIndex] = useState(0);

  // Home과 같은 계산 (Top 3 Looks)
  const looks = useMemo(
    () =>
      getTodaysLooks(
        clothes,
        weather.status === "ready" ? weather.weather : null,
      ),
    [clothes, weather],
  );

  const weatherNotes = useMemo(
    () =>
      getTodaysWeatherNotes(
        clothes,
        weather.status === "ready" ? weather.weather : null,
      ),
    [clothes, weather],
  );

  const look = looks.length > 0 ? looks[lookIndex % looks.length] : null;

  const cityLabel =
    weather.status === "ready" && weather.weather.city
      ? `TODAY'S LOOK · ${weather.weather.city}`
      : "TODAY'S LOOK";

  const weatherLine =
    weather.status === "ready"
      ? `${formatTemperature(weather.weather.temperature)} · ${weather.weather.label.toUpperCase()}`
      : weather.status === "loading"
        ? "날씨 확인 중..."
        : "날씨 정보 없음";

  if (!look) {
    return (
      <Screen>
        <ScreenHeader eyebrow={cityLabel} title="오늘의 코디" />

        <View style={styles.weatherBlock}>
          <Text style={styles.weatherLine}>{weatherLine}</Text>

          <Text style={styles.weatherSub}>내 옷장에서 고른 추천 코디</Text>
        </View>

        {closetStatus === "loading" ? (
          <ActivityIndicator color={palette.ink} />
        ) : (
          <EmptyState
            title={
              closetStatus === "signed-out"
                ? "로그인하고 오늘의 코디를 확인하세요"
                : "옷을 등록하고 오늘의 코디를 받아보세요"
            }
            description="오늘의 코디는 내 옷장에 등록된 옷으로만 만들어져요."
            action={
              closetStatus === "signed-out" ? (
                <Button label="로그인" onPress={() => router.push("/login")} />
              ) : (
                <Button
                  label="옷 등록하기"
                  onPress={() => router.push("/upload")}
                />
              )
            }
          />
        )}
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <View style={styles.footerRow}>
          <Button
            label="다른 코디 보기"
            variant="secondary"
            disabled={looks.length < 2}
            onPress={() => setLookIndex((index) => index + 1)}
            style={styles.footerButton}
          />

          <Button
            label="이 옷으로 코디하기"
            onPress={() =>
              router.push({
                pathname: "/styling",
                params: {
                  clothingId: String(look.base.id),
                },
              })
            }
            style={styles.footerButton}
          />
        </View>
      }
    >
      <ScreenHeader
        eyebrow={cityLabel}
        title="오늘의 코디"
        right={
          looks.length > 1 ? (
            <Text style={styles.counter}>
              코디 {(lookIndex % looks.length) + 1} / {looks.length}
            </Text>
          ) : undefined
        }
      />

      <View style={styles.weatherBlock}>
        <Text style={styles.weatherLine}>{weatherLine}</Text>

        <Text style={styles.weatherSub}>내 옷장에서 고른 추천 코디</Text>
      </View>

      <LookBoard items={look.recommendation.items} height={210} />

      <Text style={styles.itemNames} numberOfLines={2}>
        {look.recommendation.items.map(getClothingName).join("  ·  ")}
      </Text>

      <View style={styles.scoreRow}>
        <ScoreDisplay value={look.score} caption="MATCH" />

        <View style={styles.breakdown}>
          <Text style={styles.breakdownText}>
            날씨 적합도 {look.weatherScore ?? "—"}
          </Text>

          <Text style={styles.breakdownText}>코디 궁합 {look.styleScore}</Text>
        </View>
      </View>

      <ScoreBars
        title="OUTFIT EVALUATION"
        details={look.evaluation.details}
      />

      {look.weatherLabel ? (
        <Text style={styles.weatherNote}>· {look.weatherLabel}</Text>
      ) : null}

      {/* 실제 기온·날씨를 반영한 추천 이유 (규칙 기반). 첫 줄(기온·날씨)은 위 label과 같아 아이템별 이유만 */}
      {look.weatherReasons.slice(1).map((reason) => (
        <Text key={reason} style={styles.reasonLine}>
          · {reason}
        </Text>
      ))}

      {weatherNotes.map((note) => (
        <Text key={note.category} style={styles.shortageNote}>
          {note.message}
        </Text>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  weatherBlock: {
    marginTop: -12,
    marginBottom: 16,
  },

  weatherLine: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 1,
    color: palette.ink,
  },

  weatherSub: {
    marginTop: 4,
    fontSize: 13,
    color: palette.body,
  },

  counter: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
    color: palette.muted,
  },

  itemNames: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    color: palette.ink,
  },

  scoreRow: {
    marginTop: 14,
    marginBottom: 12,
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
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0,
    color: palette.subtle,
  },

  weatherNote: {
    marginTop: 10,
    fontSize: 12,
    color: palette.subtle,
  },

  reasonLine: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    color: palette.body,
  },

  shortageNote: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 17,
    color: palette.danger,
  },

  footerRow: {
    flexDirection: "row",
    gap: 10,
  },

  footerButton: {
    flex: 1,
    paddingHorizontal: 8,
  },
});
