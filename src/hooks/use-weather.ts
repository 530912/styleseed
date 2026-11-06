import { useEffect } from "react";

import { useWeatherStore } from "../store/useWeatherStore";

export function useWeather() {
  const weather = useWeatherStore((state) => state.weather);

  const loadWeather = useWeatherStore((state) => state.loadWeather);

  useEffect(() => {
    loadWeather();
  }, [loadWeather]);

  return {
    weather,
    reload: () => loadWeather(true),
  };
}
