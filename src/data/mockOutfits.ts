import { Outfit } from "../types";

export const mockOutfits: Outfit[] = [
  {
    id: 1,
    name: "Minimal Daily Look",

    clothingIds: [1, 2, 3],

    score: 92,

    missingItem: {
      category: "shoes",
      subCategory: "loafer",
      color: "brown",
    },
  },
];
