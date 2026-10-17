import { StatusBar } from "expo-status-bar";

import { useEffect, useRef } from "react";

import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  useWindowDimensions,
} from "react-native";

const LOGO_SOURCE = require("../../assets/images/styleseed-logo.png");

// styleseed-logo.png의 배경색과 같은 색 (PNG에 투명 영역이 없어 배경을 맞춰야 경계가 보이지 않음)
export const INTRO_BACKGROUND = "#FEFCFA";

// PNG 안에서 실제 로고 마크가 차지하는 가로 비율 (여백 제외)
const LOGO_CONTENT_RATIO = 0.51;

// 화면에 보이는 로고 마크 너비 = 화면 너비의 약 42%
const VISIBLE_LOGO_WIDTH_RATIO = 0.42;

const MAX_LOGO_IMAGE_WIDTH = 520;

// 이미지 onLoad가 늦거나 호출되지 않아도 인트로가 멈추지 않도록
const LOGO_LOAD_TIMEOUT_MS = 1000;

// 전체 약 1800ms
const ENTER_OPACITY_MS = 600;
const ENTER_TRANSLATE_MS = 700;
const SCALE_UP_MS = 650;
const SCALE_SETTLE_MS = 300;
const HOLD_MS = 600;
const FADE_OUT_MS = 250;

const easeOut = Easing.bezier(0.22, 1, 0.36, 1);

const easeInOut = Easing.bezier(0.45, 0, 0.55, 1);

type SplashIntroProps = {
  onFinish: () => void;
};

export function SplashIntro({ onFinish }: SplashIntroProps) {
  const { width, height } = useWindowDimensions();

  const opacity = useRef(new Animated.Value(0)).current;

  const scale = useRef(new Animated.Value(0.82)).current;

  const translateY = useRef(new Animated.Value(8)).current;

  const hasStarted = useRef(false);

  const logoImageWidth = Math.min(
    (width * VISIBLE_LOGO_WIDTH_RATIO) / LOGO_CONTENT_RATIO,
    MAX_LOGO_IMAGE_WIDTH,
  );

  // 로고 이미지가 준비된 뒤에 시작해야 등장 애니메이션 도중 이미지가 늦게 뜨는 flicker가 없다.
  const startAnimation = () => {
    if (hasStarted.current) {
      return;
    }

    hasStarted.current = true;

    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: ENTER_OPACITY_MS,
          easing: easeOut,
          useNativeDriver: true,
        }),

        Animated.timing(translateY, {
          toValue: 0,
          duration: ENTER_TRANSLATE_MS,
          easing: easeOut,
          useNativeDriver: true,
        }),

        // 0.82 → 1.04 → 1
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.04,
            duration: SCALE_UP_MS,
            easing: easeOut,
            useNativeDriver: true,
          }),

          Animated.timing(scale, {
            toValue: 1,
            duration: SCALE_SETTLE_MS,
            easing: easeInOut,
            useNativeDriver: true,
          }),
        ]),
      ]),

      Animated.delay(HOLD_MS),

      Animated.timing(opacity, {
        toValue: 0,
        duration: FADE_OUT_MS,
        easing: easeInOut,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        onFinish();
      }
    });
  };

  useEffect(() => {
    const fallbackTimer = setTimeout(startAnimation, LOGO_LOAD_TIMEOUT_MS);

    return () => {
      clearTimeout(fallbackTimer);

      opacity.stopAnimation();
      scale.stopAnimation();
      translateY.stopAnimation();
    };
  }, []);

  return (
    <Animated.View style={[styles.container, { paddingBottom: height * 0.04 }]}>
      <StatusBar style="dark" />

      {/* 로고 박스 크기를 명시해야 PNG 원본 크기(1254px)로 늘어나지 않는다 */}
      <Animated.View
        style={{
          width: logoImageWidth,
          height: logoImageWidth,
          opacity,
          transform: [{ translateY }, { scale }],
        }}
      >
        <Image
          source={LOGO_SOURCE}
          style={styles.logo}
          resizeMode="contain"
          // Android 기본 이미지 fade(300ms)가 등장 애니메이션과 겹치지 않도록
          fadeDuration={0}
          onLoad={startAnimation}
          accessibilityRole="image"
          accessibilityLabel="STYLESEED"
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: INTRO_BACKGROUND,
    justifyContent: "center",
    alignItems: "center",
  },

  logo: {
    width: "100%",
    height: "100%",
  },
});
