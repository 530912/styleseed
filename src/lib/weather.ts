import * as Location from "expo-location";

/**
 * 실제 날씨 데이터
 *
 * 위치 권한 → 현재 좌표 → (가능하면) 도시 이름 → Open-Meteo 현재 날씨
 *
 * Open-Meteo Forecast API는 API key 없이 사용할 수 있다.
 * https://open-meteo.com/en/docs
 */
const OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

const REQUEST_TIMEOUT_MS = 10_000;

export type WeatherKind =
  | "clear"
  | "partly-cloudy"
  | "cloudy"
  | "fog"
  | "rain"
  | "snow"
  | "storm";

export type WeatherSnapshot = {
  temperature: number;
  apparentTemperature: number | null;
  kind: WeatherKind;
  label: string;
  isDay: boolean;
  city: string | null;
  observedAt: string;
};

export type WeatherUnavailableReason =
  | "permission-denied"
  | "location-error"
  | "weather-error";

export type WeatherState =
  | { status: "loading" }
  | { status: "ready"; weather: WeatherSnapshot }
  | { status: "unavailable"; reason: WeatherUnavailableReason };

type OpenMeteoCurrentResponse = {
  current?: {
    time?: string;
    temperature_2m?: number;
    apparent_temperature?: number;
    weather_code?: number;
    is_day?: number;
  };
};

export const formatTemperature = (value: number) => {
  return `${Math.round(value)}°C`;
};

// WMO weather code → 화면에 표시할 날씨 상태
const describeWeatherCode = (
  code: number,
  isDay: boolean,
): { kind: WeatherKind; label: string } => {
  if (code === 0) {
    return { kind: "clear", label: "맑음" };
  }

  if (code === 1 || code === 2) {
    return { kind: "partly-cloudy", label: "구름 조금" };
  }

  if (code === 3) {
    return { kind: "cloudy", label: "흐림" };
  }

  if (code === 45 || code === 48) {
    return { kind: "fog", label: "안개" };
  }

  if (code >= 51 && code <= 57) {
    return { kind: "rain", label: "이슬비" };
  }

  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) {
    return { kind: "rain", label: "비" };
  }

  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    return { kind: "snow", label: "눈" };
  }

  if (code >= 95) {
    return { kind: "storm", label: "천둥번개" };
  }

  return { kind: "cloudy", label: "흐림" };
};

const withTimeout = <T>(promise: Promise<T>, ms: number) => {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
};

export const fetchCurrentWeather = async (
  latitude: number,
  longitude: number,
): Promise<Omit<WeatherSnapshot, "city">> => {
  const query = [
    `latitude=${latitude.toFixed(4)}`,
    `longitude=${longitude.toFixed(4)}`,
    "current=temperature_2m,apparent_temperature,weather_code,is_day",
    "timezone=auto",
  ].join("&");

  const response = await withTimeout(
    fetch(`${OPEN_METEO_FORECAST_URL}?${query}`),
    REQUEST_TIMEOUT_MS,
  );

  if (!response.ok) {
    throw new Error(`날씨 요청에 실패했습니다. (${response.status})`);
  }

  const data = (await response.json()) as OpenMeteoCurrentResponse;

  const current = data.current;

  if (
    !current ||
    typeof current.temperature_2m !== "number" ||
    typeof current.weather_code !== "number"
  ) {
    throw new Error("날씨 데이터 형식이 올바르지 않습니다.");
  }

  const isDay = current.is_day !== 0;

  return {
    temperature: current.temperature_2m,

    apparentTemperature:
      typeof current.apparent_temperature === "number"
        ? current.apparent_temperature
        : null,

    isDay,

    observedAt: current.time ?? new Date().toISOString(),

    ...describeWeatherCode(current.weather_code, isDay),
  };
};

// 도시 이름은 부가 정보이므로 실패해도 날씨 표시는 계속한다.
// (웹에서는 reverse geocoding을 지원하지 않는다)
const getCityName = async (latitude: number, longitude: number) => {
  try {
    const [address] = await Location.reverseGeocodeAsync({
      latitude,
      longitude,
    });

    return address?.city ?? address?.district ?? address?.region ?? null;
  } catch (error) {
    console.warn("도시 이름 조회 실패:", error);

    return null;
  }
};

export const loadLocalWeather = async (): Promise<WeatherState> => {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();

    if (!permission.granted) {
      return { status: "unavailable", reason: "permission-denied" };
    }
  } catch (error) {
    console.warn("위치 권한 요청 실패:", error);

    return { status: "unavailable", reason: "location-error" };
  }

  let coords: { latitude: number; longitude: number };

  try {
    const position = await withTimeout(
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }),
      REQUEST_TIMEOUT_MS,
    );

    coords = position.coords;
  } catch (error) {
    console.warn("현재 위치 조회 실패:", error);

    return { status: "unavailable", reason: "location-error" };
  }

  try {
    const [snapshot, city] = await Promise.all([
      fetchCurrentWeather(coords.latitude, coords.longitude),
      getCityName(coords.latitude, coords.longitude),
    ]);

    return {
      status: "ready",
      weather: {
        ...snapshot,
        city,
      },
    };
  } catch (error) {
    console.warn("날씨 조회 실패:", error);

    return { status: "unavailable", reason: "weather-error" };
  }
};
