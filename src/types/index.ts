import type { ImageSourcePropType } from "react-native";

import {
  CLOTHING_CATEGORIES,
  CLOTHING_COLORS,
  CLOTHING_FITS,
  CLOTHING_MATERIALS,
  CLOTHING_SEASONS,
  CLOTHING_STYLES,
  CLOTHING_TPOS,
  COLOR_TONES,
} from "../constants/clothingOptions";

export type ClothingCategory = (typeof CLOTHING_CATEGORIES)[number];

export type ClothingColor = (typeof CLOTHING_COLORS)[number];

export type ColorTone = (typeof COLOR_TONES)[number];

export type ClothingFit = (typeof CLOTHING_FITS)[number];

export type ClothingMaterial = (typeof CLOTHING_MATERIALS)[number];

export type ClothingSeason = (typeof CLOTHING_SEASONS)[number];

export type ClothingTPO = (typeof CLOTHING_TPOS)[number];

export type ClothingStyle = (typeof CLOTHING_STYLES)[number];

export type Clothing = {
  id: number;

  category: ClothingCategory;

  subCategory: string;

  color: ClothingColor;

  colorTone: ColorTone;

  fit: ClothingFit;

  material: ClothingMaterial;

  season: ClothingSeason[];

  tpo: ClothingTPO[];

  style: ClothingStyle[];

  imageUri?: string;

  // 옷장 조회 시 함께 내려오는 두 가지 이미지 (사진 수정 화면에서 전환)
  originalImageUri?: string;

  cutoutImageUri?: string;

  box2d?: ClothingBox2D;

  mask?: ClothingMaskPoint[];

  // 분류 호환 계층(src/utils/taxonomyCompat.ts)이 값을 바꿨을 때의 원래 분류. DB에는 열이 없어 저장하지 않는다
  taxonomySource?: { category: string; subCategory: string };
};

export type Outfit = {
  id: number;

  name: string;

  clothingIds: number[];

  score: number;

  missingItem: {
    category: ClothingCategory;
    subCategory: string;
    color: ClothingColor;
  } | null;
};

export type Product = {
  id: number;

  name: string;

  brand: string;

  category: ClothingCategory;

  subCategory: string;

  color: ClothingColor;

  material: ClothingMaterial;

  style: ClothingStyle;

  price: number;

  // Core 점수 계산에 쓰는 계절 정보 (없으면 계절 점수 0)
  season?: ClothingSeason[];

  // assets/images/products 의 상품 사진 (없으면 품목 이름으로 대체 표시)
  image?: ImageSourcePropType;
};

export type ClothingAnalysis = {
  category: ClothingCategory;
  subCategory: string;
  color: ClothingColor;
  colorTone: ColorTone;
  fit: ClothingFit;
  material: ClothingMaterial;
  season: ClothingSeason[];
  tpo: ClothingTPO[];
  style: ClothingStyle[];
  box2d: ClothingBox2D;
  mask: ClothingMaskPoint[];

  // 분석 결과의 분류를 앱 값으로 정리했을 때의 원래 분류(정리하지 않았으면 없음)
  taxonomySource?: { category: string; subCategory: string };
};

export type ClothingBox2D = [number, number, number, number];

export type ClothingMaskPoint = [number, number];
