import type { DemoCoreRule } from "../data/coreDemo";

import type { Clothing, ClothingCategory, Product } from "../types";

import { toTitle } from "./format";

import { getCompatibilityScore } from "./recommendation";

/**
 * CORE ENGINE — BETA prototype scoring
 *
 * 고정된 demo rule(src/data/coreDemo.ts)과 옷장 속성을 비교하는
 * 영상용 deterministic 점수이다.
 *
 * - ML prediction이 아니다.
 * - Supabase나 store에 저장하지 않고 화면에서만 계산한다.
 * - 기존 코디 추천 결과를 변경하지 않는다.
 *
 * COLOR 30 / ITEM 25 / MATERIAL 20 / STYLE 15 / SEASON 10 = 100
 */

export type PrototypeCoreMatch = {
  clothing: Clothing;
  prototypeCoreScore: number;
  matchedSignals: string[];
};

export const getPrototypeCoreScore = (
  clothing: Clothing,
  rule: DemoCoreRule,
): PrototypeCoreMatch => {
  const matchedSignals: string[] = [];

  let prototypeCoreScore = 0;

  if (rule.colors.primary.includes(clothing.color)) {
    prototypeCoreScore += 30;
    matchedSignals.push(toTitle(clothing.color));
  } else if (rule.colors.secondary.includes(clothing.color)) {
    prototypeCoreScore += 12;
  }

  if (rule.items.primary.includes(clothing.subCategory)) {
    prototypeCoreScore += 25;
    matchedSignals.push(toTitle(clothing.subCategory));
  } else if (rule.items.secondary.includes(clothing.subCategory)) {
    prototypeCoreScore += 12;
  }

  if (rule.materials.primary.includes(clothing.material)) {
    prototypeCoreScore += 20;
    matchedSignals.push(toTitle(clothing.material));
  } else if (rule.materials.secondary.includes(clothing.material)) {
    prototypeCoreScore += 10;
  }

  const styleWeights = clothing.style.map(
    (style) => rule.styleWeights[style] ?? 0,
  );

  const bestStyleWeight = Math.max(0, ...styleWeights);

  if (bestStyleWeight > 0) {
    prototypeCoreScore += bestStyleWeight;

    const bestStyle = clothing.style.find(
      (style) => (rule.styleWeights[style] ?? 0) === bestStyleWeight,
    );

    if (bestStyle) {
      matchedSignals.push(toTitle(bestStyle));
    }
  }

  if (clothing.season.some((season) => rule.seasons.includes(season))) {
    prototypeCoreScore += 10;
  }

  return {
    clothing,
    prototypeCoreScore: Math.min(100, prototypeCoreScore),
    matchedSignals,
  };
};

export const rankClosetByPrototypeCore = (
  clothes: Clothing[],
  rule: DemoCoreRule,
) => {
  return clothes
    .map((clothing) => getPrototypeCoreScore(clothing, rule))
    .sort((a, b) => b.prototypeCoreScore - a.prototypeCoreScore);
};

export type PrototypeCoreLook = {
  items: Clothing[];

  // 코디 아이템의 prototypeCoreScore 평균
  prototypeAlignment: number;

  // 기존 getCompatibilityScore로 계산한 대표 아이템과의 궁합 평균
  compatibilityScore: number | null;

  checks: {
    compatibility: boolean;
    coreMood: boolean;
    personalCloset: boolean;
  };
};

const LOOK_SLOTS: ClothingCategory[] = ["outer", "top", "bottom", "shoes"];

/**
 * 상품을 옷과 같은 형태로 만들어 동일한 규칙으로 점수를 계산한다.
 * (fit, tpo처럼 점수에 쓰이지 않는 값은 기본값을 넣는다)
 */
const toScorableClothing = (product: Product): Clothing => ({
  id: -product.id,
  category: product.category,
  subCategory: product.subCategory,
  color: product.color,
  colorTone: "muted",
  fit: "regular",
  material: product.material,
  season: product.season ?? [],
  tpo: [],
  style: [product.style],
});

export type CoreUpgradeSuggestion = {
  product: Product;

  // 상품 자체의 코어 점수
  productScore: number;

  // 이 상품으로 바꿨을 때의 코디 코어 적합도
  alignmentAfter: number;

  alignmentDelta: number;
};

/**
 * 코디의 특정 아이템을 상품으로 바꿨을 때 CORE ALIGNMENT가 얼마가 되는지
 * 같은 demo rule로 다시 계산한다. (ML 예측 아님, 저장하지 않음)
 */
export const getCoreUpgradeSuggestions = (
  look: PrototypeCoreLook,
  replacedClothingId: number,
  products: Product[],
  rule: DemoCoreRule,
): CoreUpgradeSuggestion[] => {
  return products
    .map((product) => {
      const productScore = getPrototypeCoreScore(
        toScorableClothing(product),
        rule,
      ).prototypeCoreScore;

      const scores = look.items.map((item) =>
        item.id === replacedClothingId
          ? productScore
          : getPrototypeCoreScore(item, rule).prototypeCoreScore,
      );

      const alignmentAfter = Math.round(
        scores.reduce((sum, score) => sum + score, 0) / scores.length,
      );

      return {
        product,
        productScore,
        alignmentAfter,
        alignmentDelta: alignmentAfter - look.prototypeAlignment,
      };
    })
    .sort((a, b) => b.alignmentAfter - a.alignmentAfter);
};

const COMPATIBILITY_PASS_SCORE = 60;

const CORE_MOOD_PASS_SCORE = 70;

export const buildPrototypeCoreLook = (
  clothes: Clothing[],
  rule: DemoCoreRule,
): PrototypeCoreLook | null => {
  const ranked = rankClosetByPrototypeCore(clothes, rule);

  const picks = LOOK_SLOTS.map((slot) =>
    ranked.find((match) => match.clothing.category === slot),
  ).filter((match): match is PrototypeCoreMatch => match !== undefined);

  const hasTopOrBottom = picks.some(
    (match) =>
      match.clothing.category === "top" || match.clothing.category === "bottom",
  );

  if (!hasTopOrBottom) {
    const dress = ranked.find((match) => match.clothing.category === "dress");

    if (dress) {
      picks.push(dress);
    }
  }

  if (picks.length === 0) {
    return null;
  }

  picks.sort((a, b) => b.prototypeCoreScore - a.prototypeCoreScore);

  const items = picks.map((match) => match.clothing);

  const prototypeAlignment = Math.round(
    picks.reduce((sum, match) => sum + match.prototypeCoreScore, 0) /
      picks.length,
  );

  const [anchor, ...others] = items;

  const compatibilityScore =
    others.length > 0
      ? Math.round(
          others.reduce(
            (sum, clothing) =>
              sum + getCompatibilityScore(anchor, clothing).total,
            0,
          ) / others.length,
        )
      : null;

  return {
    items,
    prototypeAlignment,
    compatibilityScore,
    checks: {
      compatibility:
        compatibilityScore !== null &&
        compatibilityScore >= COMPATIBILITY_PASS_SCORE,
      coreMood: prototypeAlignment >= CORE_MOOD_PASS_SCORE,
      personalCloset: items.length > 0,
    },
  };
};
