import { create } from "zustand";

import { loadLocalWeather, type WeatherState } from "../lib/weather";

// Home과 Today's Look 상세 화면이 같은 날씨 값을 쓰도록 메모리에만 보관
const WEATHER_TTL_MS = 10 * 60 * 1000;

type WeatherStore = {
  weather: WeatherState;

  loadedAt: number | null;

  isLoading: boolean;

  loadWeather: (force?: boolean) => Promise<void>;
};

export const useWeatherStore = create<WeatherStore>((set, get) => ({
  weather: { status: "loading" },

  loadedAt: null,

  isLoading: false,

  loadWeather: async (force = false) => {
    const { isLoading, loadedAt, weather } = get();

    if (isLoading) {
      return;
    }

    const isFresh = loadedAt !== null && Date.now() - loadedAt < WEATHER_TTL_MS;

    if (!force && isFresh) {
      return;
    }

    set({
      isLoading: true,

      // 이미 표시 중인 날씨가 있으면 새로고침 중에도 유지
      weather: weather.status === "ready" ? weather : { status: "loading" },
    });

    const nextWeather = await loadLocalWeather();

    set({
      weather: nextWeather,
      loadedAt: Date.now(),
      isLoading: false,
    });
  },
}));
