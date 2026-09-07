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

  category: ClothingCategory;

  subCategory: string;

  color: ClothingColor;

  material: ClothingMaterial;

  style: ClothingStyle;

  price: number;
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
};
