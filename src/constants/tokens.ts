// STYLESEED 디자인 토큰 (Figma `STYLESEED — Product Design System & UX Redesign`, Foundations v0.3)
// Figma 변수 값을 그대로 옮긴 것이다. 값을 바꿀 때는 Figma 변수와 함께 바꾼다.
// 화면에서는 직접 쓰기보다 constants/ui.ts의 palette/layout을 통해 쓴다.

// STYLESEED / Semantic Colors (Light)
export const color = {
  bg: {
    canvas: "#FFFFFF",
    subtle: "#F8F6F3",
    surface: "#F1EEEA",
    inverse: "#111111",
    brand: "#FE5418",
    brandSoft: "#FFF1EB",
    success: "#EAF8EF",
    warning: "#FFF7E6",
    error: "#FFF1F1",
    info: "#F1F2FA",
    accentGreen: "#EAF8EF",
    accentIndigo: "#F1F2FA",
    accentYellow: "#FFF4B8",
    accentPink: "#FFF1F6",
    accentGreenStrong: "#019F4B",
    accentMint: "#EBFEF7",
    accentMintStrong: "#A9E0CD",
    accentIndigoStrong: "#5D639F",
    editorialIndigo: "#373C64",
  },
  text: {
    primary: "#111111",
    secondary: "#5B5550",
    tertiary: "#7D756D",
    inverse: "#FFFFFF",
    brand: "#C63E10",
    onBrand: "#FFFFFF",
    onBrandVivid: "#111111",
    success: "#016A34",
    warning: "#805A00",
    error: "#A30000",
    info: "#434973",
    accentMint: "#276B58",
    disabled: "#7D756D",
  },
  border: {
    default: "#E2DDD6",
    subtle: "#F1EEEA",
    strong: "#A89F95",
    control: "#7D756D",
    error: "#D90000",
    success: "#019F4B",
    focus: "#434973",
  },
  icon: {
    default: "#3F3B38",
    subtle: "#7D756D",
    inverse: "#FFFFFF",
  },
  action: {
    primary: "#C63E10",
    primaryHover: "#9E320D",
    primaryPressed: "#732408",
    primarySubtle: "#FFF1EB",
    selected: "#FE5418",
    selectedSubtle: "#FFF1EB",
    secondary: "#111111",
    secondaryHover: "#242220",
    disabled: "#E2DDD6",
    destructive: "#A30000",
  },
} as const;

// Spacing 컬렉션 (px)
export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const size = {
  touchTarget: 44,
  topBar: 44,
  button: 52,
  input: 52,
  iconSm: 16,
  iconMd: 20,
  iconLg: 24,
  contentMax: 480,
  tabBar: 48,
} as const;

// Typography 텍스트 스타일 중 앱에서 쓰는 값(크기/행간/자간).
// 폰트(Bricolage Grotesque·Pretendard)는 아직 앱에 싣지 않았다 → 크기·굵기만 맞춘다.
export const type = {
  titleLg: { fontSize: 24, lineHeight: 32, letterSpacing: -0.5 },
  titleMd: { fontSize: 20, lineHeight: 28, letterSpacing: -0.3 },
  bodyMd: { fontSize: 14, lineHeight: 22 },
  labelButton: { fontSize: 16, lineHeight: 24 },
  captionMd: { fontSize: 12, lineHeight: 18 },
  eyebrow: { fontSize: 11, lineHeight: 16, letterSpacing: 1.5 },
  badge: { fontSize: 11, lineHeight: 16, letterSpacing: 1 },
} as const;
