import { Ionicons } from "@expo/vector-icons";

import type { ComponentProps } from "react";

import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { palette } from "../../constants/ui";

import {
  formatTemperature,
  type WeatherKind,
  type WeatherState,
  type WeatherUnavailableReason,
} from "../../lib/weather";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

const getWeatherIcon = (kind: WeatherKind, isDay: boolean): IoniconName => {
  switch (kind) {
    case "clear":
      return isDay ? "sunny-outline" : "moon-outline";

    case "partly-cloudy":
      return isDay ? "partly-sunny-outline" : "cloudy-night-outline";

    case "rain":
      return "rainy-outline";

    case "snow":
      return "snow-outline";

    case "storm":
      return "thunderstorm-outline";

    default:
      return "cloud-outline";
  }
};

const UNAVAILABLE_COPY: Record<WeatherUnavailableReason, string> = {
  "permission-denied": "위치 권한이 꺼져 있어 기본 코디를 보여드려요.",
  "location-error": "현재 위치를 찾지 못해 기본 코디를 보여드려요.",
  "weather-error": "날씨를 불러오지 못해 기본 코디를 보여드려요.",
};

type WeatherSummaryProps = {
  state: WeatherState;
  onRetry?: () => void;
};

export function WeatherSummary({ state, onRetry }: WeatherSummaryProps) {
  if (state.status === "loading") {
    return (
      <View style={styles.row}>
        <ActivityIndicator size="small" color={palette.ink} />

        <Text style={styles.muted}>현재 위치의 날씨를 확인하고 있어요...</Text>
      </View>
    );
  }

  if (state.status === "unavailable") {
    return (
      <View style={styles.row}>
        <Ionicons name="cloud-offline-outline" size={26} color={palette.muted} />

        <View style={styles.flex}>
          <Text style={styles.unavailableTitle}>날씨 정보를 불러오지 못했어요</Text>

          <Text style={styles.muted}>{UNAVAILABLE_COPY[state.reason]}</Text>
        </View>

        {onRetry ? (
          <Pressable onPress={onRetry} hitSlop={8}>
            <Text style={styles.retry}>다시 시도</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  const { weather } = state;

  return (
    <View style={styles.row}>
      <Ionicons
        name={getWeatherIcon(weather.kind, weather.isDay)}
        size={30}
        color={palette.ink}
      />

      <Text style={styles.temperature}>
        {formatTemperature(weather.temperature)}
      </Text>

      <View style={styles.flex}>
        <Text style={styles.city} numberOfLines={1}>
          {(weather.city ?? "현재 위치").toUpperCase()}
        </Text>

        <Text style={styles.condition} numberOfLines={1}>
          {weather.label}
          {weather.apparentTemperature !== null
            ? ` · 체감 ${formatTemperature(weather.apparentTemperature)}`
            : ""}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 44,
  },

  flex: {
    flex: 1,
  },

  temperature: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "700",
    letterSpacing: -1,
    color: palette.ink,
  },

  city: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: palette.ink,
  },

  condition: {
    marginTop: 2,
    fontSize: 13,
    color: palette.body,
  },

  unavailableTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: palette.ink,
  },

  muted: {
    fontSize: 12,
    lineHeight: 17,
    color: palette.subtle,
  },

  retry: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    color: palette.ink,
  },
});
