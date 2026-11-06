import { Ionicons } from "@expo/vector-icons";

import { router } from "expo-router";

import {
  Children,
  cloneElement,
  isValidElement,
  type ReactNode,
} from "react";

import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { size, type } from "../../constants/tokens";

import { useHasTabBar } from "./tab-bar-context";

import { fonts, layout, palette } from "../../constants/ui";

type ScreenProps = {
  children: ReactNode;

  // 화면 하단에 고정되는 CTA 영역
  footer?: ReactNode;

  scroll?: boolean;

  // 좌측 상단 < 버튼 (HOME처럼 첫 화면에서는 false)
  showBack?: boolean;

  // 기본 동작: 이전 화면으로, 이전 화면이 없으면 HOME으로
  onBack?: () => void;
};

type HeaderMeta = Pick<ScreenHeaderProps, "eyebrow" | "badge" | "right">;

/**
 * 화면의 ScreenHeader에서 eyebrow / badge / right를 꺼내
 * < 버튼과 같은 줄의 상단 고정 바로 옮긴다.
 * 제목과 설명은 기존처럼 스크롤 영역에 남는다.
 */
const liftHeaderMeta = (children: ReactNode) => {
  let meta: HeaderMeta = {};

  const content = Children.map(children, (child) => {
    if (
      !isValidElement<ScreenHeaderProps>(child) ||
      child.type !== ScreenHeader
    ) {
      return child;
    }

    meta = {
      eyebrow: child.props.eyebrow,
      badge: child.props.badge,
      right: child.props.right,
    };

    return cloneElement(child, {
      eyebrow: undefined,
      badge: undefined,
      right: undefined,
    });
  });

  return { content, meta };
};

export function Screen({
  children,
  footer,
  scroll = true,
  showBack = true,
  onBack,
}: ScreenProps) {
  const insets = useSafeAreaInsets();

  const hasTabBar = useHasTabBar();

  const { content, meta } = liftHeaderMeta(children);

  const hasTopBar =
    showBack || Boolean(meta.eyebrow || meta.badge || meta.right);

  const paddingTop = hasTopBar ? 6 : insets.top + 16;

  // 앱 하단 탭바가 있으면 하단 안전 영역은 탭바가 맡는다
  const bottomInset = hasTabBar ? 0 : insets.bottom;

  const paddingBottom = footer ? 16 : bottomInset + 24;

  return (
    <View style={styles.screen}>
      {hasTopBar ? (
        <TopBar showBack={showBack} onBack={onBack} {...meta} />
      ) : null}

      {scroll ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[
            styles.content,
            { paddingTop, paddingBottom },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {content}
        </ScrollView>
      ) : (
        <View
          style={[
            styles.flex,
            styles.content,
            { paddingTop, paddingBottom: footer ? 0 : bottomInset },
          ]}
        >
          {content}
        </View>
      )}

      {footer ? (
        <View style={[styles.footer, { paddingBottom: bottomInset + 12 }]}>
          {footer}
        </View>
      ) : null}

    </View>
  );
}

type TopBarProps = HeaderMeta & {
  showBack?: boolean;
  onBack?: () => void;

  // Screen을 쓰지 않는 화면(로그인 등)에서 내용 위에 겹쳐 배치
  floating?: boolean;
};

// 좌측 상단 < 버튼 + eyebrow + 오른쪽 액션이 있는 상단 고정 바
export function TopBar({
  eyebrow,
  badge,
  right,
  showBack = true,
  onBack,
  floating = false,
}: TopBarProps) {
  const insets = useSafeAreaInsets();

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }

    // 딥링크 등으로 바로 열려 이전 화면이 없으면 HOME으로
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/");
  };

  return (
    <View
      style={[
        styles.topBar,
        { paddingTop: insets.top },
        floating && styles.topBarFloating,
      ]}
    >
      <View style={styles.topBarRow}>
        {showBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="이전 화면으로"
            hitSlop={10}
            onPress={handleBack}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="chevron-back" size={26} color={palette.ink} />
          </Pressable>
        ) : null}

        <Text style={[styles.label, styles.topBarEyebrow]} numberOfLines={1}>
          {eyebrow ?? ""}
        </Text>

        <View style={styles.headerRight}>
          {badge ? <Badge label={badge} /> : null}
          {right}
        </View>
      </View>
    </View>
  );
}

type ScreenHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  badge?: string;
  right?: ReactNode;
};

export function ScreenHeader({
  eyebrow,
  title,
  description,
  badge,
  right,
}: ScreenHeaderProps) {
  const hasTopRow = Boolean(eyebrow || badge || right);

  return (
    <View style={styles.header}>
      {hasTopRow && (
        <View style={styles.headerTopRow}>
          {eyebrow ? <Label>{eyebrow}</Label> : <View />}

          <View style={styles.headerRight}>
            {badge ? <Badge label={badge} /> : null}
            {right}
          </View>
        </View>
      )}

      <Text style={styles.title}>{title}</Text>

      {description ? (
        <Text style={styles.description}>{description}</Text>
      ) : null}
    </View>
  );
}

type LabelProps = {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
};

export function Label({ children, style }: LabelProps) {
  return <Text style={[styles.label, style]}>{children}</Text>;
}

type BadgeProps = {
  label: string;
  inverted?: boolean;
};

// BETA / DEMO / PREVIEW / SAMPLE 등 상태 표시
export function Badge({ label, inverted = false }: BadgeProps) {
  return (
    <View style={[styles.badge, inverted && styles.badgeInverted]}>
      <Text style={[styles.badgeText, inverted && styles.badgeTextInverted]}>
        {label}
      </Text>
    </View>
  );
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary";
  style?: StyleProp<ViewStyle>;
};

export function Button({
  label,
  onPress,
  disabled = false,
  loading = false,
  variant = "primary",
  style,
}: ButtonProps) {
  const isPrimary = variant === "primary";

  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        isPrimary ? styles.primaryButton : styles.secondaryButton,
        pressed && !isDisabled && isPrimary && styles.primaryButtonPressed,
        pressed && !isDisabled && !isPrimary && styles.pressed,
        disabled && !loading && styles.disabledButton,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.onPrimary} />
      ) : null}

      <Text
        style={[
          styles.buttonText,
          isPrimary ? styles.primaryButtonText : styles.secondaryButtonText,
          isDisabled && !loading && styles.disabledButtonText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

type ScoreDisplayProps = {
  value: number | null;
  caption: string;
  size?: "large" | "medium";
  suffix?: string;
};

// 91% / MATCH 처럼 숫자를 크게 보여주는 블록
export function ScoreDisplay({
  value,
  caption,
  size = "large",
  suffix = "%",
}: ScoreDisplayProps) {
  const isMedium = size === "medium";

  return (
    <View>
      <View style={styles.scoreRow}>
        <Text style={[styles.scoreValue, isMedium && styles.scoreValueMedium]}>
          {value === null ? "—" : value}
        </Text>

        {value !== null && suffix ? (
          <Text
            style={[styles.scoreSuffix, isMedium && styles.scoreSuffixMedium]}
          >
            {suffix}
          </Text>
        ) : null}
      </View>

      <Text style={styles.scoreCaption}>{caption}</Text>
    </View>
  );
}

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>{title}</Text>

      {description ? (
        <Text style={styles.emptyDescription}>{description}</Text>
      ) : null}

      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },

  flex: {
    flex: 1,
  },

  content: {
    paddingHorizontal: layout.gutter,
  },

  topBar: {
    backgroundColor: palette.background,
    zIndex: 10,
  },

  topBarFloating: {
    position: "absolute",
    top: 0,
    right: 0,
    left: 0,
  },

  topBarRow: {
    height: 44,
    paddingHorizontal: layout.gutter,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  backButton: {
    width: 36,
    height: 44,
    marginLeft: -10,
    justifyContent: "center",
    alignItems: "center",
  },

  topBarEyebrow: {
    flex: 1,
  },

  footer: {
    paddingHorizontal: layout.gutter,
    paddingTop: 12,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.line,
    backgroundColor: palette.background,
  },

  header: {
    marginBottom: 20,
  },

  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },

  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  title: {
    fontFamily: fonts.sans,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "700",
    letterSpacing: 0.3,
    color: palette.ink,
  },

  description: {
    marginTop: 8,
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    color: palette.body,
  },

  label: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.2,
    color: palette.muted,
  },

  badge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: palette.ink,
  },

  badgeInverted: {
    backgroundColor: palette.ink,
  },

  badgeText: {
    fontFamily: fonts.sans,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    color: palette.ink,
  },

  badgeTextInverted: {
    color: palette.background,
  },

  button: {
    minHeight: size.button,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },

  // Figma 04 Button: primary = action/primary(Coral), secondary = action/secondary(검정), disabled = action/disabled
  primaryButton: {
    backgroundColor: palette.primary,
  },

  primaryButtonPressed: {
    backgroundColor: palette.primaryPressed,
  },

  secondaryButton: {
    backgroundColor: palette.secondary,
  },

  disabledButton: {
    backgroundColor: palette.disabled,
  },

  disabledButtonText: {
    color: palette.disabledText,
  },

  pressed: {
    opacity: 0.8,
  },

  buttonText: {
    fontFamily: fonts.sans,
    fontSize: type.labelButton.fontSize,
    lineHeight: type.labelButton.lineHeight,
    fontWeight: "600",
  },

  primaryButtonText: {
    color: palette.onPrimary,
  },

  secondaryButtonText: {
    color: palette.onPrimary,
  },

  scoreRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },

  scoreValue: {
    fontFamily: fonts.sans,
    fontSize: 60,
    lineHeight: 64,
    fontWeight: "700",
    letterSpacing: -1.5,
    color: palette.ink,
  },

  scoreValueMedium: {
    fontFamily: fonts.sans,
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: -1,
  },

  scoreSuffix: {
    marginLeft: 2,
    marginBottom: 9,
    fontFamily: fonts.sans,
    fontSize: 24,
    fontWeight: "700",
    color: palette.ink,
  },

  scoreSuffixMedium: {
    marginBottom: 6,
    fontFamily: fonts.sans,
    fontSize: 18,
  },

  scoreCaption: {
    marginTop: 2,
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
    color: palette.ink,
  },

  emptyState: {
    padding: 20,
    gap: 8,
    backgroundColor: palette.surface,
  },

  emptyTitle: {
    fontFamily: fonts.sans,
    fontSize: 16,
    fontWeight: "600",
    color: palette.ink,
  },

  emptyDescription: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    color: palette.body,
  },

  emptyAction: {
    marginTop: 8,
  },
});
