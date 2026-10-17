import type {
  ClothingColor,
  ClothingMaterial,
  ClothingSeason,
  ClothingStyle,
} from "../types";

/**
 * CORE ENGINE — BETA 데모 데이터
 *
 * 영상 촬영용 UI prototype을 위한 고정 규칙이다.
 * 실제 ML 모델의 예측 결과가 아니며,
 * 사용자 옷 데이터(Supabase clothes)와 분리해서 관리한다.
 */

export type CoreId =
  | "poetcore"
  | "dark-academia"
  | "romantic-vintage"
  | "minimal";

export type DemoCoreOption = {
  id: CoreId;
  name: string;
  keywords: string[];

  // 이번 데모에서는 POETCORE만 선택 가능
  availableInDemo: boolean;
};

export const DEMO_CORE_OPTIONS: DemoCoreOption[] = [
  {
    id: "poetcore",
    name: "POETCORE",
    keywords: ["문학적인", "빈티지", "따뜻한", "레이어드"],
    availableInDemo: true,
  },
  {
    id: "dark-academia",
    name: "DARK ACADEMIA",
    keywords: ["지적인", "차분한", "테일러드"],
    availableInDemo: false,
  },
  {
    id: "romantic-vintage",
    name: "ROMANTIC VINTAGE",
    keywords: ["부드러운", "섬세한", "향수 어린"],
    availableInDemo: false,
  },
  {
    id: "minimal",
    name: "MINIMAL",
    keywords: ["깔끔한", "뉴트럴", "기본에 충실한"],
    availableInDemo: false,
  },
];

export type DemoCoreRule = {
  id: CoreId;
  name: string;

  colors: {
    primary: ClothingColor[];
    secondary: ClothingColor[];
    labels: string[];
  };

  materials: {
    primary: ClothingMaterial[];
    secondary: ClothingMaterial[];
    labels: string[];
  };

  // Clothing.subCategory 기준
  items: {
    primary: string[];
    secondary: string[];
    labels: string[];
  };

  styleWeights: Partial<Record<ClothingStyle, number>>;

  seasons: ClothingSeason[];

  // 현재 옷 분석 데이터에는 pattern 필드가 없어 점수 계산에는 사용하지 않는다.
  patterns: string[];

  moods: string[];
};

// CORE SHOP 데모에서 교체 추천으로 보여줄 샘플 상품 id (mockProducts 기준)
export const POETCORE_RECOMMENDED_PRODUCT_IDS = [15, 16];

export const POETCORE_DEMO_RULE: DemoCoreRule = {
  id: "poetcore",
  name: "POETCORE",

  colors: {
    // STYLESEED 색상 분류에는 burgundy / olive가 없어
    // red / green 계열로 매칭한다.
    primary: ["brown", "red", "green"],
    // black은 빈티지/레이어드 계열 아이템에서 흔해 보조 색상으로 둔다.
    secondary: ["beige", "white", "navy", "gray", "black"],
    labels: ["Brown", "Burgundy", "Olive"],
  },

  materials: {
    // corduroy는 아직 소재 분류에 없어 wool / knit 기준으로 매칭한다.
    primary: ["wool", "knit"],
    secondary: ["cotton", "linen", "leather"],
    labels: ["Wool", "Knit"],
  },

  items: {
    primary: ["blazer", "skirt", "shirt", "loafer"],
    secondary: [
      "cardigan",
      "knit",
      "coat",
      "trousers",
      "slacks",
      "jeans",
      "blouse",
      "boots",
      "scarf",
    ],
    labels: ["Blazer", "Skirt", "Shirt", "Loafer"],
  },

  styleWeights: {
    vintage: 15,
    classic: 12,
    feminine: 6,
    minimal: 5,
  },

  seasons: ["fall", "winter"],

  patterns: ["check"],

  moods: ["빈티지", "문학적인", "따뜻한", "레이어드"],
};
