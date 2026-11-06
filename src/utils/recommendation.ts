import type {
  Clothing,
  ClothingCategory,
  ClothingColor,
  ClothingStyle,
} from "../types";

import { joinTitles } from "./format";

import { getEngineCategory, getOutfitRole } from "./taxonomyCompat";

export type CompatibilityResult = {
  total: number;

  seasonScore: number;
  styleScore: number;
  tpoScore: number;
  colorScore: number;
  categoryScore: number;

  reasons: string[];
};

const NEUTRAL_COLORS: ClothingColor[] = [
  "black",
  "white",
  "gray",
  "beige",
  "brown",
  "navy",
];

const CATEGORY_PAIRS: [ClothingCategory, ClothingCategory][] = [
  ["top", "bottom"],
  ["top", "outer"],
  ["top", "shoes"],
  ["bottom", "shoes"],
  ["bottom", "outer"],
  ["dress", "outer"],
  ["dress", "shoes"],
];

const hasOverlap = <T>(first: T[], second: T[]) => {
  return first.some((item) => second.includes(item));
};

const getColorScore = (
  firstColor: ClothingColor,
  secondColor: ClothingColor,
) => {
  if (firstColor === secondColor) {
    return 18;
  }

  const firstIsNeutral = NEUTRAL_COLORS.includes(firstColor);

  const secondIsNeutral = NEUTRAL_COLORS.includes(secondColor);

  if (firstIsNeutral && secondIsNeutral) {
    return 20;
  }

  if (firstColor === "multi" || secondColor === "multi") {
    return 12;
  }

  if (firstIsNeutral || secondIsNeutral) {
    return 16;
  }

  return 10;
};

const getCategoryScore = (
  firstCategory: ClothingCategory | null,
  secondCategory: ClothingCategory | null,
) => {
  if (firstCategory === secondCategory) {
    return 0;
  }

  const isRecommendedPair = CATEGORY_PAIRS.some(
    ([first, second]) =>
      (first === firstCategory && second === secondCategory) ||
      (first === secondCategory && second === firstCategory),
  );

  if (isRecommendedPair) {
    return 10;
  }

  if (
    firstCategory === "bag" ||
    secondCategory === "bag" ||
    firstCategory === "accessory" ||
    secondCategory === "accessory"
  ) {
    return 7;
  }

  return 5;
};

export const getCompatibilityScore = (
  firstClothing: Clothing,
  secondClothing: Clothing,
): CompatibilityResult => {
  if (firstClothing.id === secondClothing.id) {
    return {
      total: 0,

      seasonScore: 0,
      styleScore: 0,
      tpoScore: 0,
      colorScore: 0,
      categoryScore: 0,

      reasons: [],
    };
  }

  const reasons: string[] = [];

  const seasonScore = hasOverlap(firstClothing.season, secondClothing.season)
    ? 25
    : 0;

  if (seasonScore > 0) {
    reasons.push("함께 입기 좋은 계절이 겹쳐요.");
  }

  const styleScore = hasOverlap(firstClothing.style, secondClothing.style)
    ? 25
    : 0;

  if (styleScore > 0) {
    reasons.push("스타일 방향이 잘 맞아요.");
  }

  const tpoScore = hasOverlap(firstClothing.tpo, secondClothing.tpo) ? 20 : 0;

  if (tpoScore > 0) {
    reasons.push("비슷한 상황에서 활용하기 좋아요.");
  }

  const colorScore = getColorScore(firstClothing.color, secondClothing.color);

  if (colorScore >= 16) {
    reasons.push("색상 조합이 안정적이에요.");
  }

  // Lab 연구 분류(예: 대분류 jumpsuit)도 앱 대분류로 바꿔 비교한다(taxonomyCompat)
  const categoryScore = getCategoryScore(
    getEngineCategory(firstClothing),
    getEngineCategory(secondClothing),
  );

  const total =
    seasonScore + styleScore + tpoScore + colorScore + categoryScore;

  return {
    total,

    seasonScore,
    styleScore,
    tpoScore,
    colorScore,
    categoryScore,

    reasons,
  };
};

export type OutfitMatch = {
  clothing: Clothing;
  compatibility: CompatibilityResult;
};

export type OutfitRecommendation = {
  items: Clothing[];
  score: number;
  missingCategories: ClothingCategory[];
  reasons: string[];

  // 선택한 옷과 각 추천 아이템의 실제 궁합 점수
  matches: OutfitMatch[];
};

const OUTFIT_CATEGORY_PLAN: Partial<
  Record<ClothingCategory, ClothingCategory[]>
> = {
  top: ["bottom", "shoes"],

  bottom: ["top", "shoes"],

  outer: ["top", "bottom", "shoes"],

  dress: ["shoes"],

  shoes: ["top", "bottom"],

  bag: ["top", "bottom", "shoes"],

  accessory: ["top", "bottom", "shoes"],
};

const findBestMatchWhere = (
  selectedClothing: Clothing,
  clothes: Clothing[],
  isCandidate: (clothing: Clothing) => boolean,
): OutfitMatch | null => {
  const candidates = clothes.filter(
    (clothing) => clothing.id !== selectedClothing.id && isCandidate(clothing),
  );

  if (candidates.length === 0) {
    return null;
  }

  const scoredCandidates = candidates.map((clothing) => ({
    clothing,

    compatibility: getCompatibilityScore(selectedClothing, clothing),
  }));

  scoredCandidates.sort(
    (a, b) => b.compatibility.total - a.compatibility.total,
  );

  return scoredCandidates[0];
};

export const findBestMatch = (
  selectedClothing: Clothing,
  clothes: Clothing[],
  targetCategory: ClothingCategory,
): OutfitMatch | null =>
  findBestMatchWhere(
    selectedClothing,
    clothes,
    (clothing) => getEngineCategory(clothing) === targetCategory,
  );

/**
 * 니트·테일러드 베스트(상의 겸 레이어)만 상의로 들어간 코디에 안에 입을 상의를 찾는다.
 * 일반 상의가 이미 있거나 베스트가 없으면 null. (앱 41개 값만 쓰는 옷장에서는 항상 null)
 */
export const findInnerTopForLayer = (
  items: Clothing[],
  clothes: Clothing[],
): OutfitMatch | null => {
  const layer = items.find((item) => getOutfitRole(item) === "topLayer");

  if (!layer || items.some((item) => getOutfitRole(item) === "top")) {
    return null;
  }

  return findBestMatchWhere(
    layer,
    clothes.filter((clothing) => !items.some((item) => item.id === clothing.id)),
    (clothing) => getOutfitRole(clothing) === "top",
  );
};

/** 일반 상의 하나만 있는 코디에 겹쳐 입을 베스트(상의 겸 레이어)를 찾는다. 없으면 null */
export const findTopLayerFor = (
  items: Clothing[],
  clothes: Clothing[],
): OutfitMatch | null => {
  const tops = items.filter((item) => getOutfitRole(item) === "top");

  if (tops.length !== 1 || items.some((item) => getOutfitRole(item) === "topLayer")) {
    return null;
  }

  return findBestMatchWhere(
    tops[0],
    clothes.filter((clothing) => !items.some((item) => item.id === clothing.id)),
    (clothing) => getOutfitRole(clothing) === "topLayer",
  );
};

export const getRecommendedOutfit = (
  selectedClothing: Clothing,
  clothes: Clothing[],
): OutfitRecommendation => {
  const engineCategory = getEngineCategory(selectedClothing);

  const targetCategories =
    (engineCategory && OUTFIT_CATEGORY_PLAN[engineCategory]) ?? [];

  const recommendedItems: Clothing[] = [selectedClothing];

  const matches: OutfitMatch[] = [];

  const reasons = new Set<string>();

  const missingCategories: ClothingCategory[] = [];

  targetCategories.forEach((category) => {
    const match = findBestMatch(selectedClothing, clothes, category);

    if (!match) {
      missingCategories.push(category);
      return;
    }

    recommendedItems.push(match.clothing);

    matches.push(match);

    match.compatibility.reasons.forEach((reason) => {
      reasons.add(reason);
    });
  });

  // 베스트(상의 겸 레이어)만 상의로 들어가면 안에 입을 상의를 더한다
  const innerTop = findInnerTopForLayer(recommendedItems, clothes);

  if (innerTop) {
    recommendedItems.push(innerTop.clothing);

    matches.push(innerTop);

    innerTop.compatibility.reasons.forEach((reason) => {
      reasons.add(reason);
    });
  }

  const scores = matches.map((match) => match.compatibility.total);

  const score =
    scores.length > 0
      ? Math.round(
          scores.reduce((sum, current) => sum + current, 0) / scores.length,
        )
      : 0;

  return {
    items: recommendedItems,
    score,
    missingCategories,
    reasons: Array.from(reasons),
    matches,
  };
};
export type MissingItemSuggestion = {
  category: ClothingCategory;
  subCategory: string;
  color: ClothingColor;
  style: ClothingStyle;
};

const getDominantStyle = (clothes: Clothing[]): ClothingStyle => {
  const styleCount = {} as Record<ClothingStyle, number>;

  clothes.forEach((clothing) => {
    clothing.style.forEach((style) => {
      styleCount[style] = (styleCount[style] ?? 0) + 1;
    });
  });

  const sortedStyles = Object.entries(styleCount).sort((a, b) => b[1] - a[1]);

  return (sortedStyles[0]?.[0] as ClothingStyle | undefined) ?? "minimal";
};

const hasDressyTpo = (clothes: Clothing[]) => {
  return clothes.some((clothing) =>
    clothing.tpo.some((tpo) => tpo === "office" || tpo === "formal"),
  );
};

export const getMissingItemSuggestion = (
  category: ClothingCategory,
  outfitItems: Clothing[],
): MissingItemSuggestion => {
  const dominantStyle = getDominantStyle(outfitItems);

  const isDressy = hasDressyTpo(outfitItems);

  if (category === "shoes") {
    if (
      isDressy ||
      dominantStyle === "minimal" ||
      dominantStyle === "classic"
    ) {
      return {
        category: "shoes",
        subCategory: "loafer",
        color: "brown",
        style: dominantStyle === "classic" ? "classic" : "minimal",
      };
    }

    return {
      category: "shoes",
      subCategory: "sneakers",
      color: "white",
      style: dominantStyle === "sporty" ? "sporty" : "casual",
    };
  }

  if (category === "bottom") {
    if (
      isDressy ||
      dominantStyle === "minimal" ||
      dominantStyle === "classic"
    ) {
      return {
        category: "bottom",
        subCategory: "slacks",
        color: "black",
        style: dominantStyle === "classic" ? "classic" : "minimal",
      };
    }

    return {
      category: "bottom",
      subCategory: "jeans",
      color: "blue",
      style: dominantStyle,
    };
  }

  if (category === "top") {
    if (
      isDressy ||
      dominantStyle === "minimal" ||
      dominantStyle === "classic"
    ) {
      return {
        category: "top",
        subCategory: "shirt",
        color: "white",
        style: dominantStyle === "classic" ? "classic" : "minimal",
      };
    }

    return {
      category: "top",
      subCategory: "tshirt",
      color: "white",
      style: dominantStyle,
    };
  }

  if (category === "outer") {
    return {
      category: "outer",
      subCategory: isDressy ? "blazer" : "jacket",
      color: "black",
      style: dominantStyle,
    };
  }

  if (category === "dress") {
    return {
      category: "dress",
      subCategory: "midi-dress",
      color: "black",
      style: dominantStyle,
    };
  }

  if (category === "bag") {
    return {
      category: "bag",
      subCategory: "shoulder-bag",
      color: "black",
      style: dominantStyle,
    };
  }

  return {
    category: "accessory",
    subCategory: "belt",
    color: "black",
    style: dominantStyle,
  };
};

export type LookInsight = {
  key: "color" | "style" | "season" | "tpo";
  label: string;
  value: string;
  score: number;
  maxScore: number;
};

const averageScore = (values: number[]) => {
  if (values.length === 0) {
    return 0;
  }

  return Math.round(
    values.reduce((sum, value) => sum + value, 0) / values.length,
  );
};

// 선택한 옷의 값 중 추천 아이템과 실제로 겹치는 값
const getSharedValues = <T extends string>(base: T[], others: T[][]) => {
  return base.filter((value) => others.some((list) => list.includes(value)));
};

const describePalette = (averageColorScore: number) => {
  if (averageColorScore >= 18) {
    return "조화로운 색 조합";
  }

  if (averageColorScore >= 16) {
    return "균형 잡힌 대비";
  }

  if (averageColorScore >= 12) {
    return "포인트 컬러 조합";
  }

  return "강한 색 대비";
};

/**
 * 추천 코디의 근거를 화면용 항목으로 정리한다.
 * getCompatibilityScore에서 실제로 계산된 점수만 사용한다.
 */
export const getLookInsights = (
  recommendation: OutfitRecommendation,
): LookInsight[] => {
  const [selectedClothing] = recommendation.items;

  const { matches } = recommendation;

  if (!selectedClothing || matches.length === 0) {
    return [];
  }

  const matchedClothes = matches.map((match) => match.clothing);

  const colorScore = averageScore(
    matches.map((match) => match.compatibility.colorScore),
  );

  const sharedStyles = getSharedValues(
    selectedClothing.style,
    matchedClothes.map((clothing) => clothing.style),
  );

  const sharedSeasons = getSharedValues(
    selectedClothing.season,
    matchedClothes.map((clothing) => clothing.season),
  );

  const sharedTpos = getSharedValues(
    selectedClothing.tpo,
    matchedClothes.map((clothing) => clothing.tpo),
  );

  return [
    {
      key: "color",
      label: "COLOR",
      value: describePalette(colorScore),
      score: colorScore,
      maxScore: 20,
    },
    {
      key: "style",
      label: "STYLE",
      value:
        sharedStyles.length > 0
          ? joinTitles(sharedStyles)
          : "스타일 방향이 달라요",
      score: averageScore(
        matches.map((match) => match.compatibility.styleScore),
      ),
      maxScore: 25,
    },
    {
      key: "season",
      label: "SEASON",
      value:
        sharedSeasons.length > 0
          ? joinTitles(sharedSeasons)
          : "계절이 달라요",
      score: averageScore(
        matches.map((match) => match.compatibility.seasonScore),
      ),
      maxScore: 25,
    },
    {
      key: "tpo",
      label: "TPO",
      value:
        sharedTpos.length > 0 ? joinTitles(sharedTpos) : "활용 상황이 달라요",
      score: averageScore(matches.map((match) => match.compatibility.tpoScore)),
      maxScore: 20,
    },
  ];
};
