import { fonts } from "../constants/ui";

import { StatusBar } from "expo-status-bar";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";

import { color } from "../constants/tokens";

// 인트로 v3 · Green × Pink (중력 반전 · 큰 오브젝트 · 타이핑 워드마크)
// Figma 06 Screens `211:3011` (393×852, 총 5.2초)의 키프레임을 그대로 옮겼다.
// - Green box가 화면 위쪽 '지면', Pink ball이 아래에서 위로 가속해 부딪히고 튀다가 box 안에 박힌다.
// - 그 뒤 STYLESEED가 글자별로 차례로 나타난다.
// 키프레임의 easing은 "그 키프레임에 도착하는 구간"에 적용된다(Figma 방식).

export const INTRO_BACKGROUND = color.bg.canvas;

const GREEN = "#019F4B"; // bg/accent-green-strong
const PINK = "#FF7CB1"; // bg/accent-pink-strong

const DESIGN_WIDTH = 393;

const BALL = 160;
const BALL_BORDER = 8;
const BOX_HEIGHT = 380;
const BALL_REST_TOP = 110; // 박힌 뒤 공의 위쪽 위치(디자인 좌표)
const WORDMARK_BOTTOM = 852 - 794; // 화면 아래에서 워드마크까지

const TOTAL_MS = 5200;
const FADE_OUT_MS = 200;
const REDUCED_MOTION_HOLD_MS = 800;

const WORD = "STYLESEED".split("");
const LETTER_START_S = 3.2;
const LETTER_GAP_S = 0.14;

// 글자 폭(디자인 px). 글자별 레이어로 만든 Figma와 같은 간격을 맞춘다
const LETTER_FONT = 56;
const LETTER_SPACING = -2;

const easeIn = Easing.bezier(0.42, 0, 1, 1);
const easeOut = Easing.bezier(0, 0, 0.58, 1);
const easeInOut = Easing.bezier(0.42, 0, 0.58, 1);
const linear = (x: number) => x;

type Key = { t: number; v: number; ease?: (x: number) => number };

const SAMPLES = 10;

// 키프레임(초) → Animated.interpolate 입력(ms)/출력. 구간마다 easing을 샘플링해 근사한다
const buildTrack = (keys: Key[], unit = 1) => {
  const inputRange: number[] = [];

  const outputRange: number[] = [];

  keys.forEach((key, index) => {
    if (index === 0) {
      inputRange.push(key.t * 1000);
      outputRange.push(key.v * unit);

      return;
    }

    const prev = keys[index - 1];

    const ease = key.ease ?? linear;

    for (let n = 1; n <= SAMPLES; n += 1) {
      const p = n / SAMPLES;

      inputRange.push((prev.t + (key.t - prev.t) * p) * 1000);
      outputRange.push((prev.v + (key.v - prev.v) * ease(p)) * unit);
    }
  });

  return { inputRange, outputRange };
};

// Pink ball: 세로 이동(0은 박힌 위치, 270은 box 아래 면에 닿는 위치)
const BALL_Y: Key[] = [
  { t: 0, v: 780 },
  { t: 0.7, v: 270, ease: easeIn },
  { t: 1.15, v: 490, ease: easeOut },
  { t: 1.6, v: 270, ease: easeIn },
  { t: 1.9, v: 380, ease: easeOut },
  { t: 2.2, v: 270, ease: easeIn },
  { t: 2.4, v: 314, ease: easeOut },
  { t: 2.6, v: 270, ease: easeIn },
  { t: 2.95, v: -16, ease: easeInOut },
  { t: 3.2, v: 0, ease: easeOut },
];

const BALL_X: Key[] = [
  { t: 0, v: 90 },
  { t: 0.7, v: 64 },
  { t: 1.6, v: 34 },
  { t: 2.2, v: 14 },
  { t: 2.6, v: 0 },
];

// [시간, X 배율, Y 배율, easing] — 접촉마다 늘어났다가 납작해졌다가 복원
const BALL_SCALE: [number, number, number, ((x: number) => number)?][] = [
  [0, 1, 1],
  [0.64, 0.94, 1.08],
  [0.7, 1.2, 0.8, easeOut],
  [0.78, 1, 1, easeOut],
  [1.54, 0.94, 1.08],
  [1.6, 1.14, 0.86, easeOut],
  [1.68, 1, 1, easeOut],
  [2.14, 0.94, 1.08],
  [2.2, 1.08, 0.92, easeOut],
  [2.28, 1, 1, easeOut],
  [2.54, 0.94, 1.08],
  [2.6, 1.06, 0.94, easeOut],
  [2.68, 1, 1, easeOut],
  [2.95, 1.1, 0.9, easeInOut],
  [3.2, 1, 1, easeOut],
];

// Green box: 공이 부딪힐 때마다 위로 눌림
const BOX_Y: Key[] = [
  { t: 0, v: 0 },
  { t: 0.69, v: 0 },
  { t: 0.76, v: -4, ease: easeOut },
  { t: 0.92, v: 0, ease: easeOut },
  { t: 1.59, v: 0 },
  { t: 1.66, v: -4, ease: easeOut },
  { t: 1.82, v: 0, ease: easeOut },
  { t: 2.19, v: 0 },
  { t: 2.26, v: -4, ease: easeOut },
  { t: 2.42, v: 0, ease: easeOut },
  { t: 2.59, v: 0 },
  { t: 2.66, v: -4, ease: easeOut },
  { t: 2.82, v: 0, ease: easeOut },
  { t: 2.94, v: 0 },
  { t: 3.02, v: -8, ease: easeOut },
  { t: 3.3, v: 0, ease: easeOut },
];

type SplashIntroProps = {
  onFinish: () => void;
};

export function SplashIntro({ onFinish }: SplashIntroProps) {
  const { width, height } = useWindowDimensions();

  // 웹처럼 화면이 넓으면 모바일 폭(480) 안에 맞춘다
  const stageWidth = Math.min(width, 480);

  const s = stageWidth / DESIGN_WIDTH;

  const time = useRef(new Animated.Value(0)).current;

  const fade = useRef(new Animated.Value(1)).current;

  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);

  const finished = useRef(false);

  const finish = () => {
    if (finished.current) {
      return;
    }

    finished.current = true;

    onFinish();
  };

  useEffect(() => {
    let cancelled = false;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (!cancelled) {
          setReduceMotion(enabled);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setReduceMotion(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion === null) {
      return undefined;
    }

    // 동작 줄이기: 완성된 장면만 잠깐 보여준다
    if (reduceMotion) {
      time.setValue(TOTAL_MS);

      const timer = setTimeout(finish, REDUCED_MOTION_HOLD_MS);

      return () => clearTimeout(timer);
    }

    const animation = Animated.sequence([
      Animated.timing(time, {
        toValue: TOTAL_MS,
        duration: TOTAL_MS,
        easing: linear,
        useNativeDriver: true,
      }),

      Animated.timing(fade, {
        toValue: 0,
        duration: FADE_OUT_MS,
        easing: easeInOut,
        useNativeDriver: true,
      }),
    ]);

    animation.start(({ finished: done }) => {
      if (done) {
        finish();
      }
    });

    return () => animation.stop();
  }, [reduceMotion]);

  const motion = useMemo(() => {
    const interp = (track: { inputRange: number[]; outputRange: number[] }) =>
      time.interpolate({ ...track, extrapolate: "clamp" });

    const scaleX = buildTrack(
      BALL_SCALE.map(([t, x, , ease]) => ({ t, v: x, ease })),
    );

    const scaleY = buildTrack(
      BALL_SCALE.map(([t, , y, ease]) => ({ t, v: y, ease })),
    );

    const letters = WORD.map((_, index) => {
      const start = LETTER_START_S + LETTER_GAP_S * index;

      return {
        opacity: interp(
          buildTrack([
            { t: 0, v: 0 },
            { t: start, v: 0 },
            { t: start + 0.12, v: 1, ease: easeOut },
          ]),
        ),
        translateY: interp(
          buildTrack(
            [
              { t: 0, v: 20 },
              { t: start, v: 20 },
              { t: start + 0.2, v: 0, ease: easeOut },
            ],
            s,
          ),
        ),
      };
    });

    return {
      ballY: interp(buildTrack(BALL_Y, s)),
      ballX: interp(buildTrack(BALL_X, s)),
      ballScaleX: interp(scaleX),
      ballScaleY: interp(scaleY),
      boxY: interp(buildTrack(BOX_Y, s)),
      letters,
    };
  }, [s, time]);

  const ballSize = (BALL + BALL_BORDER * 2) * s;

  const ballLeft = (stageWidth - ballSize) / 2;

  const ballTop = (BALL_REST_TOP - BALL_BORDER) * s;

  return (
    <Animated.View
      style={[styles.container, { opacity: fade }]}
      accessibilityRole="image"
      accessibilityLabel="STYLESEED"
    >
      <StatusBar style="dark" />

      <View style={[styles.stage, { width: stageWidth }]}>
        <Animated.View
          style={[
            styles.box,
            {
              height: BOX_HEIGHT * s,
              transform: [{ translateY: motion.boxY }],
            },
          ]}
        />

        <Animated.View
          style={[
            styles.ball,
            {
              width: ballSize,
              height: ballSize,
              borderRadius: ballSize / 2,
              borderWidth: BALL_BORDER * s,
              left: ballLeft,
              top: ballTop,
              transform: [
                { translateX: motion.ballX },
                { translateY: motion.ballY },
                { scaleX: motion.ballScaleX },
                { scaleY: motion.ballScaleY },
              ],
            },
          ]}
        />

        <View style={[styles.wordmark, { bottom: WORDMARK_BOTTOM * s }]}>
          {WORD.map((letter, index) => (
            <Animated.Text
              // eslint-disable-next-line react/no-array-index-key
              key={`${letter}-${index}`}
              style={[
                styles.letter,
                {
                  fontFamily: fonts.sans,
                  fontSize: LETTER_FONT * s,
                  lineHeight: 60 * s,
                  letterSpacing: LETTER_SPACING * s,
                  opacity: motion.letters[index].opacity,
                  transform: [{ translateY: motion.letters[index].translateY }],
                },
              ]}
            >
              {letter}
            </Animated.Text>
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    backgroundColor: INTRO_BACKGROUND,
  },

  stage: {
    flex: 1,
    overflow: "hidden",
  },

  box: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: GREEN,
  },

  ball: {
    position: "absolute",
    backgroundColor: PINK,
    borderColor: color.bg.canvas,
  },

  wordmark: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
  },

  // Bricolage Grotesque ExtraBold가 앱에 실리면 fontFamily를 지정한다(현재는 시스템 폰트 800)
  letter: {
    fontWeight: "800",
    color: color.text.primary,
  },
});
