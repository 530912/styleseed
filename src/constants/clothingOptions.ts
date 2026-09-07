export const CLOTHING_CATEGORIES = [
  "top",
  "bottom",
  "outer",
  "dress",
  "shoes",
  "bag",
  "accessory",
] as const;

export const CLOTHING_SUBCATEGORIES = {
  top: [
    "tshirt",
    "shirt",
    "blouse",
    "knit",
    "sweatshirt",
    "hoodie",
    "sleeveless",
  ],

  bottom: ["jeans", "slacks", "trousers", "shorts", "skirt", "leggings"],

  outer: ["jacket", "coat", "cardigan", "blazer", "padding", "vest"],

  dress: ["mini-dress", "midi-dress", "maxi-dress", "jumpsuit"],

  shoes: ["sneakers", "loafer", "boots", "heels", "sandals", "flats"],

  bag: ["shoulder-bag", "crossbody-bag", "tote-bag", "backpack", "clutch"],

  accessory: [
    "hat",
    "belt",
    "scarf",
    "necklace",
    "bracelet",
    "earrings",
    "glasses",
  ],
} as const;

export const CLOTHING_COLORS = [
  "black",
  "white",
  "gray",
  "beige",
  "brown",
  "navy",
  "blue",
  "red",
  "pink",
  "orange",
  "yellow",
  "green",
  "purple",
  "multi",
] as const;

export const COLOR_TONES = [
  "bright",
  "light",
  "muted",
  "dark",
  "vivid",
] as const;

export const CLOTHING_FITS = [
  "slim",
  "regular",
  "relaxed",
  "oversized",
  "straight",
  "wide",
] as const;

export const CLOTHING_MATERIALS = [
  "cotton",
  "denim",
  "leather",
  "wool",
  "linen",
  "polyester",
  "nylon",
  "silk",
  "knit",
  "other",
] as const;

export const CLOTHING_SEASONS = ["spring", "summer", "fall", "winter"] as const;

export const CLOTHING_TPOS = [
  "casual",
  "office",
  "date",
  "formal",
  "travel",
  "party",
] as const;

export const CLOTHING_STYLES = [
  "minimal",
  "classic",
  "casual",
  "street",
  "sporty",
  "feminine",
  "vintage",
] as const;
