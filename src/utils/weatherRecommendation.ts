import type { WeatherSnapshot } from "../lib/weather";

import type { Clothing, ClothingMaterial, ClothingSeason } from "../types";

import { evaluateOutfit, type OutfitEvaluation } from "./outfitScore";

import {
  findBestMatch,
  getRecommendedOutfit,
  type OutfitRecommendation,
} from "./recommendation";

/**
 * 날씨 기반 오늘의 코디 (TODAY'S LOOK)
 *
 * 새로운 추천 모델을 만들지 않고 기존 추천 로직에 weather context만 더한다.
 *
 * 1. 기온/날씨 → WeatherRule (계절, 선호/회피 아이템·소재, 아우터 필요 여부)
 * 2. 옷마다 weather fit(0~100) 계산 → 날씨에 맞지 않는 옷은 후보에서 제외
 *    (같은 카테고리에 맞는 옷이 하나도 없으면 제외하지 않음)
 * 3. 남은 옷으로 기존 getRecommendedOutfit 실행
 * 4. 최종 점수 = 기존 코디 점수 70% + weather fit 평균 30%
 */

export type TemperatureBand = "cold" | "cool" | "mild" | "warm" | "hot";

export type WeatherRule = {
  band: TemperatureBand;
  label: string;
  seasons: ClothingSeason[];
  preferredItems: string[];
  avoidedItems: string[];
  preferredMaterials: ClothingMaterial[];
  avoidedMaterials: ClothingMaterial[];
  needsOuter: boolean;
};

type BandRule = Omit<WeatherRule, "band" | "label"> & {
  labelPrefix: string;
};

const BAND_RULES: Record<TemperatureBand, BandRule> = {
  // 5°C 이하: winter / outerwear 우선
  cold: {
    labelPrefix: "따뜻한 레이어드",
    seasons: ["winter"],
    preferredItems: [
      "coat",
      "padding",
      "knit",
      "sweatshirt",
      "hoodie",
      "boots",
      "scarf",
      "trousers",
    ],
    avoidedItems: ["sleeveless", "shorts", "sandals"],
    preferredMaterials: ["wool", "knit", "leather"],
    avoidedMaterials: ["linen"],
    needsOuter: true,
  },

  // 6 ~ 15°C: jacket / knit / layering 우선
  cool: {
    labelPrefix: "레이어링",
    seasons: ["fall", "spring"],
    preferredItems: [
      "jacket",
      "blazer",
      "cardigan",
      "coat",
      "knit",
      "sweatshirt",
      "hoodie",
      "shirt",
      "jeans",
      "slacks",
      "trousers",
      "boots",
      "loafer",
    ],
    avoidedItems: ["sleeveless", "shorts", "sandals", "padding"],
    preferredMaterials: ["wool", "knit", "denim"],
    avoidedMaterials: ["linen"],
    needsOuter: true,
  },

  // 16 ~ 22°C: light outer / shirt / long sleeve
  mild: {
    labelPrefix: "가벼운 겉옷",
    seasons: ["spring", "fall"],
    preferredItems: [
      "shirt",
      "blouse",
      "cardigan",
      "jacket",
      "blazer",
      "sweatshirt",
      "jeans",
      "slacks",
      "trousers",
      "skirt",
      "loafer",
      "sneakers",
    ],
    avoidedItems: ["padding", "coat"],
    preferredMaterials: ["cotton", "denim"],
    avoidedMaterials: [],
    needsOuter: false,
  },

  // 23 ~ 27°C: shirt / tee / light bottom
  warm: {
    labelPrefix: "통기성 좋은 옷차림",
    seasons: ["spring", "summer"],
    preferredItems: [
      "tshirt",
      "shirt",
      "blouse",
      "skirt",
      "shorts",
      "slacks",
      "sneakers",
      "loafer",
      "sandals",
      "flats",
    ],
    avoidedItems: ["padding", "coat", "knit", "hoodie", "sweatshirt", "boots"],
    preferredMaterials: ["cotton", "linen"],
    avoidedMaterials: ["wool"],
    needsOuter: false,
  },

  // 28°C 이상: summer / lightweight material 우선
  hot: {
    labelPrefix: "가벼운 옷차림",
    seasons: ["summer"],
    preferredItems: [
      "tshirt",
      "sleeveless",
      "shorts",
      "skirt",
      "mini-dress",
      "sandals",
      "sneakers",
    ],
    avoidedItems: [
      "padding",
      "coat",
      "knit",
      "hoodie",
      "sweatshirt",
      "boots",
      "jacket",
      "blazer",
      "cardigan",
    ],
    preferredMaterials: ["linen", "cotton"],
    avoidedMaterials: ["wool", "leather", "knit"],
    needsOuter: false,
  },
};

// 비/눈: 젖으면 곤란한 소재와 아이템의 우선순위를 낮춤
const WET_AVOIDED_MATERIALS: ClothingMaterial[] = ["silk", "linen"];

const RAIN_AVOIDED_ITEMS = ["sandals", "heels"];

const SNOW_AVOIDED_ITEMS = ["sandals", "heels", "flats"];

const WEATHER_WEIGHT = 0.3;

const MIN_WEATHER_FIT = 40;

export const getTemperatureBand = (temperature: number): TemperatureBand => {
  const rounded = Math.round(temperature);

  if (rounded <= 5) {
    return "cold";
  }

  if (rounded <= 15) {
    return "cool";
  }

  if (rounded <= 22) {
    return "mild";
  }

  if (rounded <= 27) {
    return "warm";
  }

  return "hot";
};

export const getWeatherRule = (weather: WeatherSnapshot): WeatherRule => {
  const band = getTemperatureBand(weather.temperature);

  const { labelPrefix, ...rule } = BAND_RULES[band];

  const isSnow = weather.kind === "snow";

  const isWet = isSnow || weather.kind === "rain" || weather.kind === "storm";

  const temperatureLabel = `${Math.round(weather.temperature)}°C에 맞는 ${labelPrefix}`;

  if (!isWet) {
    return {
      ...rule,
      band,
      label: temperatureLabel,
    };
  }

  const wetAvoidedItems = isSnow ? SNOW_AVOIDED_ITEMS : RAIN_AVOIDED_ITEMS;

  return {
    ...rule,
    band,
    label: `${temperatureLabel} · ${weather.label} 대비`,
    preferredItems: rule.preferredItems.filter(
      (item) => !wetAvoidedItems.includes(item),
    ),
    avoidedItems: [...rule.avoidedItems, ...wetAvoidedItems],
    preferredMaterials: rule.preferredMaterials.filter(
      (material) => !WET_AVOIDED_MATERIALS.includes(material),
    ),
    avoidedMaterials: [...rule.avoidedMaterials, ...WET_AVOIDED_MATERIALS],
  };
};

/**
 * 옷 한 벌이 오늘 날씨에 얼마나 맞는지 (0~100)
 *
 * SEASON   50: 날씨 계절과 겹침 (계절 정보 없음 25)
 * MATERIAL 25: 선호 소재 25 / 보통 15 / 회피 0
 * ITEM     25: 선호 아이템 25 / 보통 15 / 회피 0
 *
 * 가방·액세서리는 날씨 영향이 적어 계산하지 않는다(null).
 */
export const getWeatherFitScore = (
  clothing: Clothing,
  rule: WeatherRule,
): number | null => {
  if (clothing.category === "bag" || clothing.category === "accessory") {
    return null;
  }

  const seasonPoints =
    clothing.season.length === 0
      ? 25
      : clothing.season.some((season) => rule.seasons.includes(season))
        ? 50
        : 0;

  const materialPoints = rule.avoidedMaterials.includes(clothing.material)
    ? 0
    : rule.preferredMaterials.includes(clothing.material)
      ? 25
      : 15;

  const itemPoints = rule.avoidedItems.includes(clothing.subCategory)
    ? 0
    : rule.preferredItems.includes(clothing.subCategory)
      ? 25
      : 15;

  return seasonPoints + materialPoints + itemPoints;
};

const filterClosetForWeather = (clothes: Clothing[], rule: WeatherRule) => {
  const isSuitable = (clothing: Clothing) => {
    const fit = getWeatherFitScore(clothing, rule);

    return fit === null || fit >= MIN_WEATHER_FIT;
  };

  const categoriesWithSuitableItems = new Set(
    clothes.filter(isSuitable).map((clothing) => clothing.category),
  );

  return clothes.filter(
    (clothing) =>
      isSuitable(clothing) ||
      !categoriesWithSuitableItems.has(clothing.category),
  );
};

const averageScore = (values: number[]) => {
  if (values.length === 0) {
    return 0;
  }

  return Math.round(
    values.reduce((sum, value) => sum + value, 0) / values.length,
  );
};

export type TodayLook = {
  base: Clothing;

  recommendation: OutfitRecommendation;

  // 기존 코디 궁합 점수 (0~100)
  styleScore: number;

  // 날씨 적합도 평균 (날씨 정보가 없으면 null)
  weatherScore: number | null;

  // 화면에 표시하는 MATCH 점수
  score: number;

  weatherLabel: string | null;

  // Color / Fit·Silhouette / Material / Season / TPO / Preference 평가
  evaluation: OutfitEvaluation;
};

export const getTodaysLooks = (
  clothes: Clothing[],
  weather: WeatherSnapshot | null,
  limit = 3,
): TodayLook[] => {
  if (clothes.length === 0) {
    return [];
  }

  const rule = weather ? getWeatherRule(weather) : null;

  const pool = rule ? filterClosetForWeather(clothes, rule) : clothes;

  // 상의/원피스를 기준으로 코디를 만들고, 없으면 다른 의류를 기준으로 사용
  const anchors = pool.filter(
    (clothing) => clothing.category === "top" || clothing.category === "dress",
  );

  const wearables = pool.filter(
    (clothing) =>
      clothing.category !== "bag" && clothing.category !== "accessory",
  );

  const bases =
    anchors.length > 0 ? anchors : wearables.length > 0 ? wearables : pool;

  const looks = bases.map((base): TodayLook => {
    const outfit = getRecommendedOutfit(base, pool);

    let items = outfit.items;

    let matches = outfit.matches;

    // 쌀쌀한 날씨에는 옷장에 아우터가 있을 때 코디에 추가
    if (
      rule?.needsOuter &&
      base.category !== "outer" &&
      !items.some((item) => item.category === "outer")
    ) {
      const outerMatch = findBestMatch(base, pool, "outer");

      if (outerMatch) {
        items = [...items, outerMatch.clothing];

        matches = [...matches, outerMatch];
      }
    }

    // 코디 자체 점수는 6개 지표 평가(MATCH SCORE)를 사용한다.
    const evaluation = evaluateOutfit(items, clothes);

    const styleScore = evaluation.total;

    const recommendation: OutfitRecommendation = {
      ...outfit,
      items,
      matches,
      score: styleScore,
    };

    const weatherFits = rule
      ? items
          .map((item) => getWeatherFitScore(item, rule))
          .filter((fit): fit is number => fit !== null)
      : [];

    const weatherScore =
      rule && weatherFits.length > 0 ? averageScore(weatherFits) : null;

    const score =
      weatherScore === null
        ? styleScore
        : Math.round(
            styleScore * (1 - WEATHER_WEIGHT) + weatherScore * WEATHER_WEIGHT,
          );

    return {
      base,
      recommendation,
      styleScore,
      weatherScore,
      score,
      weatherLabel: rule ? rule.label : null,
      evaluation,
    };
  });

  const seenOutfits = new Set<string>();

  return looks
    .sort((a, b) => {
      const aHasMatches = a.recommendation.matches.length > 0 ? 1 : 0;

      const bHasMatches = b.recommendation.matches.length > 0 ? 1 : 0;

      return bHasMatches - aHasMatches || b.score - a.score;
    })
    .filter((look) => {
      const outfitKey = look.recommendation.items
        .map((item) => item.id)
        .sort((a, b) => a - b)
        .join("-");

      if (seenOutfits.has(outfitKey)) {
        return false;
      }

      seenOutfits.add(outfitKey);

      return true;
    })
    .slice(0, limit);
};
