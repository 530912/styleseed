import { Clothing } from "../types";

export const mockClothes: Clothing[] = [
  {
    id: 1,

    category: "top",
    subCategory: "shirt",

    color: "white",
    colorTone: "bright",

    fit: "oversized",

    material: "cotton",

    season: ["spring", "fall"],

    tpo: ["casual", "office"],

    style: ["minimal", "classic"],
  },

  {
    id: 2,

    category: "bottom",
    subCategory: "slacks",

    color: "black",
    colorTone: "dark",

    fit: "straight",

    material: "polyester",

    season: ["spring", "fall", "winter"],

    tpo: ["casual", "office", "formal"],

    style: ["minimal", "classic"],
  },

  {
    id: 3,

    category: "shoes",
    subCategory: "sneakers",

    color: "white",
    colorTone: "bright",

    fit: "regular",

    material: "leather",

    season: ["spring", "summer", "fall"],

    tpo: ["casual", "travel"],

    style: ["casual", "sporty"],
  },
];
