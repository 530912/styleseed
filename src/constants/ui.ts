import { Platform } from "react-native";

// STYLESEED 화면에서 공통으로 쓰는 색상과 여백 값
// 값의 출처는 constants/tokens.ts(Figma Foundations v0.3). 기존 이름(ink, body …)은 화면 코드 호환을 위해 유지한다.
import { color, space } from "./tokens";

export const palette = {
  ink: color.text.primary,
  body: color.text.secondary,
  muted: color.text.tertiary,
  subtle: color.text.tertiary,
  line: color.border.default,
  hairline: color.border.subtle,
  surface: color.bg.surface,
  placeholder: color.bg.surface,
  background: color.bg.canvas,
  danger: color.text.error,

  // 신규(Foundations v0.3)
  // CTA는 Coral(action.primary), 보조 버튼은 검정(action.secondary)
  primary: color.action.primary,
  primaryPressed: color.action.primaryPressed,
  secondary: color.action.secondary,
  // 선택 상태: 테두리는 action.selected, 흰 글자가 올라가는 면은 대비를 위해 action.primary
  selected: color.action.selected,
  selectedSubtle: color.action.selectedSubtle,
  onPrimary: color.text.onBrand,
  disabled: color.action.disabled,
  disabledText: color.text.disabled,
  // 홈 날씨 블록(Coral × Green): 면 위 글자는 on-brand-vivid(검정)
  coralBlock: color.bg.brand,
  greenBlock: color.bg.accentGreenStrong,
  onVivid: color.text.onBrandVivid,
  mintSurface: color.bg.accentMint,
  mintStrong: color.bg.accentMintStrong,
  mintText: color.text.accentMint,
  indigoDeep: color.bg.editorialIndigo,
  onIndigo: color.text.inverse,
  brandSoft: color.bg.brandSoft,
  errorBorder: color.border.error,
  errorSurface: color.bg.error,
} as const;

export const layout = {
  gutter: space[6],
} as const;

// 본문 폰트: Pretendard (디자인 시스템 Typography v1, UI/Body)
// - 웹: public/fonts/pretendard의 공식 가변 폰트(동적 서브셋)를 +html.tsx에서 불러온다.
//   웨이트는 각 스타일의 fontWeight를 그대로 쓴다(가변 폰트라 200~700 모두 지원)
// - iOS·Android 앱: 폰트 파일을 아직 넣지 않았으므로 시스템 폰트 그대로
export const fonts = {
  sans: Platform.select({
    web: '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, "Apple SD Gothic Neo", sans-serif',
    default: undefined,
  }),
} as const;
