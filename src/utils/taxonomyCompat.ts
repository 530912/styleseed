import {
  CLOTHING_CATEGORIES,
  CLOTHING_SUBCATEGORIES,
} from "../constants/clothingOptions";

import type { ClothingCategory } from "../types";

/**
 * 분류 호환 계층 (Knowledge Lab 연구 분류 ↔ STYLESEED 앱 분류)
 *
 * - 앱 대분류는 7개로 고정한다(1라운드 PO 결정). Lab의 연구용 대분류 jumpsuit는 앱 dress로 바꾼다.
 * - 앱 목록(41개)에 없는 Lab 세부분류는 가까운 값으로 바꾸지 않고 원래 값을 그대로 둔다(preserved).
 *   엔진은 세부분류 대신 "코디 역할"을 보고 처리한다.
 * - 원래 값은 source에 남는다. 같은 값을 여러 번 넣어도 결과가 같다(멱등).
 * - 상세 명세: docs/handoff/knowledge-lab-engine-compat.md
 */

export type TaxonomyStatus =
  | "exact" // 앱 목록 값 그대로
  | "converted" // 앱 값으로 바뀜(예: 대분류 jumpsuit → dress)
  | "preserved" // 앱 목록에는 없지만 역할을 아는 Lab 값을 그대로 둠(예: knit-vest)
  | "unsupported"; // 대분류를 정할 수 없음 → 코디에 쓰지 않음

export type TaxonomySource = {
  category: string;
  subCategory: string;
};

export type TaxonomyResolution = {
  // 앱·엔진이 쓰는 대분류(앱 7개 중 하나). 정할 수 없으면 null
  category: ClothingCategory | null;

  // 저장·엔진에 쓰는 세부분류. 원래 값을 바꾸지 않는다
  subCategory: string;

  // 앱 목록(41개) 안의 대응값. 없으면 null(가까운 값으로 억지로 채우지 않음)
  appListSubCategory: string | null;

  status: TaxonomyStatus;

  source: TaxonomySource;

  notes: string[];
};

// Lab의 연구용 대분류 → 앱 대분류
const LAB_CATEGORY_TO_APP: Record<string, ClothingCategory> = {
  jumpsuit: "dress",
};

/**
 * 앱 목록에 없지만 엔진이 역할을 아는 Lab 세부분류.
 * labCategory = Lab 상위 대분류(유지), appListValue = 앱 목록 안에서 안전하게 대응하는 값(없으면 null)
 */
export const LAB_EXTRA_SUBCATEGORIES: Record<
  string,
  { labCategory: string; appListValue: string | null; note: string }
> = {
  romper: {
    labCategory: "jumpsuit",
    appListValue: null,
    note: "일체형(짧은 기장). 앱 목록에 대응값 없음 — jumpsuit·mini-dress로 바꾸지 않음",
  },
  "knit-vest": {
    labCategory: "top",
    appListValue: null,
    note: "상의 겸 레이어(셔츠 위). 앱 vest는 아우터라 대응하지 않음",
  },
  "tailored-vest": {
    labCategory: "top",
    appListValue: null,
    note: "상의 겸 레이어(셔츠 위). 앱 vest는 아우터라 대응하지 않음",
  },
  "padded-vest": {
    labCategory: "outer",
    appListValue: "vest",
    note: "아우터. 앱 목록 대응값 vest(충전재 정보는 원래 값으로 유지)",
  },
};

const isAppCategory = (value: string): value is ClothingCategory =>
  (CLOTHING_CATEGORIES as readonly string[]).includes(value);

const appSubcategoriesOf = (category: ClothingCategory): readonly string[] =>
  CLOTHING_SUBCATEGORIES[category];

// 앱 41개 세부분류 → 앱 대분류(각 값은 한 대분류에만 속한다)
export const appParentOfSubCategory = (
  subCategory: string,
): ClothingCategory | null => {
  for (const category of CLOTHING_CATEGORIES) {
    if (appSubcategoriesOf(category).includes(subCategory)) {
      return category;
    }
  }

  return null;
};

const toAppCategory = (category: string): ClothingCategory | null => {
  if (isAppCategory(category)) {
    return category;
  }

  return LAB_CATEGORY_TO_APP[category] ?? null;
};

/**
 * 대분류·세부분류 한 쌍을 앱·엔진 값으로 정리한다.
 * - 세부분류가 앱 목록 값이면 그 값이 속한 앱 대분류를 따른다(대분류와 어긋나면 바로잡고 notes에 남김)
 * - 앱 목록에 없는 알려진 Lab 값은 Lab 상위 대분류를 앱 대분류로 바꾸고 세부분류는 그대로 둔다
 * - 둘 다 모르면 대분류만 앱 값으로 바꿔 보고, 그것도 안 되면 unsupported
 */
export const resolveTaxonomy = (
  rawCategory: string,
  rawSubCategory: string,
  previousSource?: TaxonomySource,
): TaxonomyResolution => {
  const category = String(rawCategory ?? "").trim();
  const subCategory = String(rawSubCategory ?? "").trim();
  const source = previousSource ?? { category, subCategory };
  const notes: string[] = [];

  const appParent = appParentOfSubCategory(subCategory);

  if (appParent) {
    const fromCategory = toAppCategory(category);

    if (fromCategory !== appParent) {
      notes.push(
        fromCategory
          ? `대분류 ${category}(→${fromCategory})와 세부분류 ${subCategory}(앱 ${appParent})가 어긋나 세부분류 기준으로 맞춤`
          : `대분류 ${category || "(없음)"}를 세부분류 ${subCategory} 기준 ${appParent}로 정함`,
      );
    }

    const changed = appParent !== source.category || subCategory !== source.subCategory;

    return {
      category: appParent,
      subCategory,
      appListSubCategory: subCategory,
      status: changed ? "converted" : "exact",
      source,
      notes,
    };
  }

  const extra = LAB_EXTRA_SUBCATEGORIES[subCategory];

  if (extra) {
    const appCategory = toAppCategory(extra.labCategory);

    if (category && category !== extra.labCategory && toAppCategory(category) !== appCategory) {
      notes.push(`대분류 ${category}를 ${subCategory}의 Lab 상위 ${extra.labCategory} 기준으로 맞춤`);
    }

    notes.push(extra.note);

    return {
      category: appCategory,
      subCategory,
      appListSubCategory: extra.appListValue,
      status: "preserved",
      source,
      notes,
    };
  }

  const appCategory = toAppCategory(category);

  if (appCategory && subCategory) {
    notes.push(`세부분류 ${subCategory}는 앱·엔진이 모르는 값 — 대분류 역할로만 처리`);

    return {
      category: appCategory,
      subCategory,
      appListSubCategory: null,
      status: "preserved",
      source,
      notes,
    };
  }

  notes.push("대분류를 정할 수 없어 코디에 쓰지 않음");

  return {
    category: null,
    subCategory,
    appListSubCategory: null,
    status: "unsupported",
    source,
    notes,
  };
};

/* ---------------- 엔진 코디 역할 ---------------- */

export type OutfitRole =
  | "onePiece" // 상의+하의를 대체(원피스·점프수트·롬퍼)
  | "top"
  | "topLayer" // 상의 자리를 채우고, 다른 상의 위에도 입는 옷(니트·테일러드 베스트)
  | "bottom"
  | "outer"
  | "shoes"
  | "bag"
  | "accessory"
  | "unknown";

const TOP_LAYER_SUBCATEGORIES = ["knit-vest", "tailored-vest"];

type RoleInput = { category: string; subCategory: string };

/**
 * 저장된 값(구버전 포함)을 엔진이 쓰는 앱 대분류로. 모르면 null
 * 대분류가 이미 앱 7개 중 하나면 그대로 믿는다(기존 사용자 데이터의 엔진 결과를 바꾸지 않기 위해).
 * 앱 대분류가 아닐 때만(예: Lab jumpsuit, 빈 값) 세부분류·Lab 규칙으로 정한다.
 */
export const getEngineCategory = (clothing: RoleInput): ClothingCategory | null =>
  isAppCategory(String(clothing.category ?? ""))
    ? (clothing.category as ClothingCategory)
    : resolveTaxonomy(clothing.category, clothing.subCategory).category;

export const getOutfitRole = (clothing: RoleInput): OutfitRole => {
  const category = getEngineCategory(clothing);

  if (!category) {
    return "unknown";
  }

  if (category === "dress") {
    return "onePiece";
  }

  if (category === "top" && TOP_LAYER_SUBCATEGORIES.includes(clothing.subCategory)) {
    return "topLayer";
  }

  return category;
};

export const isUpperRole = (role: OutfitRole) => role === "top" || role === "topLayer";

/** 레이어 상의(베스트) 안에 입을 수 있는 상의 */
export const isInnerTopCandidate = (clothing: RoleInput) =>
  getOutfitRole(clothing) === "top";

/* ---------------- 분석 결과·수정 화면 ---------------- */

/**
 * 사진 분석 결과의 대분류·세부분류를 앱 값으로 정리한다(새로 들어오는 값에만 적용).
 * - 대분류 jumpsuit 같은 Lab 값은 앱 대분류로, 어긋난 쌍은 세부분류 기준으로 맞춘다
 * - 정리했으면 원래 값을 taxonomySource에 남긴다. 이미 정리된 값을 다시 넣어도 그대로다
 * - 대분류를 정할 수 없으면 원래 값을 그대로 두고 unsupported로 알린다(수정 화면에서 사용자가 고른다)
 */
export const normalizeAnalysisTaxonomy = <
  T extends { category: string; subCategory: string; taxonomySource?: TaxonomySource },
>(
  analysis: T,
): { analysis: T; resolution: TaxonomyResolution } => {
  const resolution = resolveTaxonomy(
    analysis.category,
    analysis.subCategory,
    analysis.taxonomySource,
  );

  if (!resolution.category) {
    return { analysis, resolution };
  }

  const changed =
    resolution.category !== analysis.category ||
    resolution.subCategory !== analysis.subCategory;

  if (!changed) {
    return { analysis, resolution };
  }

  return {
    analysis: {
      ...analysis,
      category: resolution.category,
      subCategory: resolution.subCategory,
      taxonomySource: analysis.taxonomySource ?? {
        category: analysis.category,
        subCategory: analysis.subCategory,
      },
    },
    resolution,
  };
};

/**
 * 수정 화면의 세부분류 선택지. 앱 대분류가 아니면 빈 목록(오류 대신),
 * 현재 값이 앱 목록 밖(예: knit-vest)이면 그 값을 맨 뒤에 남겨 지워지지 않게 한다.
 */
export const getSubcategoryOptions = (
  category: string,
  currentSubCategory?: string | null,
): string[] => {
  const options: string[] = isAppCategory(String(category ?? ""))
    ? [...appSubcategoriesOf(category as ClothingCategory)]
    : [];

  if (currentSubCategory && !options.includes(currentSubCategory)) {
    options.push(currentSubCategory);
  }

  return options;
};

/**
 * 앱에 저장된 값 → Lab 연구 분류(되돌리기). 정보 보존 확인과 Lab 비교에 쓴다.
 * 세부분류에 Lab 값이 남아 있으면 Lab 대분류를 되살린다(예: dress/jumpsuit → jumpsuit/jumpsuit).
 */
export const toLabTaxonomy = (
  category: string,
  subCategory: string,
): TaxonomySource => {
  if (subCategory === "jumpsuit") {
    return { category: "jumpsuit", subCategory };
  }

  const extra = LAB_EXTRA_SUBCATEGORIES[subCategory];

  return { category: extra ? extra.labCategory : category, subCategory };
};
