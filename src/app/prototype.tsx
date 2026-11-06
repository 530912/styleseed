import { router, useLocalSearchParams } from "expo-router";

import { useEffect, useMemo, useState } from "react";

import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { fonts, palette } from "../constants/ui";

import {
  FIGMA_SCREENS,
  FIGMA_START,
  type Hotspot,
} from "../data/figma07";

// Figma 07 Prototype 미리보기. 프레임 이미지 위에 투명한 터치 영역을 얹어 화면끼리 잇는다.
// 기능·데이터는 없다(화면 검토용). 화면·연결표는 src/data/figma07.ts

const FRAME_WIDTH = 393;
const MAX_WIDTH = 430;

// 프레임 가장자리 1px 선과 상태바 자리, 하단 안전 영역은 잘라서 실제 브라우저 화면에 맞춘다
const CROP_X = 1;
const CROP_TOP = 40;
const CROP_BOTTOM = 30;

const imageUri = (id: string) => `/figma07/${id}.png`;

function FrameSlice({
  id,
  from,
  to,
  scale,
  hotspots,
  onPress,
}: {
  id: string;
  from: number;
  to: number;
  scale: number;
  hotspots: Hotspot[];
  onPress: (target: string) => void;
}) {
  const screen = FIGMA_SCREENS[id];

  return (
    <View style={{ height: (to - from) * scale, overflow: "hidden" }}>
      <Image
        source={{ uri: imageUri(id) }}
        style={{
          position: "absolute",
          left: -CROP_X * scale,
          top: -from * scale,
          width: FRAME_WIDTH * scale,
          height: screen.height * scale,
        }}
      />

      {hotspots.map(([x, y, width, height, target]) => (
        <Pressable
          key={`${x}-${y}`}
          accessibilityRole="button"
          onPress={() => onPress(target)}
          style={{
            position: "absolute",
            left: (x - CROP_X) * scale,
            top: (y - from) * scale,
            width: width * scale,
            height: height * scale,
          }}
        />
      ))}
    </View>
  );
}

function ScreenMenu({
  current,
  onClose,
  onSelect,
}: {
  current: string;
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  const groups = useMemo(() => {
    const result = new Map<string, string[]>();

    Object.entries(FIGMA_SCREENS).forEach(([id, screen]) => {
      result.set(screen.group, [...(result.get(screen.group) ?? []), id]);
    });

    return [...result.entries()];
  }, []);

  return (
    <View style={styles.menu}>
      <View style={styles.menuHeader}>
        <View>
          <Text style={styles.menuTitle}>전체 화면</Text>
          <Text style={styles.menuHint}>
            디자인 미리보기예요. 기능은 동작하지 않아요.
          </Text>
        </View>

        <Pressable accessibilityRole="button" onPress={onClose} hitSlop={12}>
          <Text style={styles.menuClose}>닫기</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.menuList}>
        {groups.map(([group, ids]) => (
          <View key={group} style={styles.menuGroup}>
            <Text style={styles.menuGroupTitle}>{group}</Text>

            {ids.map((id) => (
              <Pressable
                key={id}
                accessibilityRole="button"
                onPress={() => onSelect(id)}
                style={styles.menuRow}
              >
                <Text
                  style={[
                    styles.menuRowText,
                    id === current && styles.menuRowCurrent,
                  ]}
                >
                  {FIGMA_SCREENS[id].title}
                </Text>
              </Pressable>
            ))}
          </View>
        ))}

        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.replace({ pathname: "/", params: { app: "1" } })
          }
          style={styles.menuRow}
        >
          <Text style={styles.menuRowText}>실제 앱으로 가기</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

export default function PrototypeScreen() {
  const params = useLocalSearchParams<{ s?: string }>();

  const id = params.s && FIGMA_SCREENS[params.s] ? params.s : FIGMA_START;

  const screen = FIGMA_SCREENS[id];

  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  // 정적 HTML은 창 크기 0으로 만들어지고, 구조가 같으면 브라우저에서 크기가 다시 반영되지 않는다.
  // 그래서 브라우저에 올라온 뒤에 프레임을 그린다
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  const [menuOpen, setMenuOpen] = useState(false);

  const [toast, setToast] = useState(false);

  // 화면을 넘길 때 깜박이지 않게 전체 이미지를 미리 받아 둔다(합계 약 2.4MB)
  useEffect(() => {
    Object.keys(FIGMA_SCREENS).forEach((key) => {
      Image.prefetch(imageUri(key)).catch(() => undefined);
    });
  }, []);

  useEffect(() => {
    if (!screen.auto) {
      return;
    }

    const { to, ms } = screen.auto;

    const timer = setTimeout(() => {
      router.setParams({ s: to });
    }, ms);

    return () => clearTimeout(timer);
  }, [screen]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = setTimeout(() => setToast(false), 1600);

    return () => clearTimeout(timer);
  }, [toast]);

  const goTo = (target: string) => {
    if (target === "NONE") {
      setToast(true);
    } else if (target === "BACK") {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.setParams({ s: FIGMA_START });
      }
    } else {
      router.push({ pathname: "/prototype", params: { s: target } });
    }
  };

  if (!ready) {
    return <View style={styles.page} />;
  }

  const width = Math.min(windowWidth, MAX_WIDTH);

  const scale = width / (FRAME_WIDTH - CROP_X * 2);

  const end = screen.height - CROP_BOTTOM;

  const pin = screen.pin;

  const hotspots = [...(screen.figma ?? []), ...(screen.added ?? [])];

  const isPinned = (spot: Hotspot) =>
    pin !== undefined && spot[1] + spot[3] / 2 >= pin;

  const fullHeight = (end - CROP_TOP) * scale;

  return (
    <View style={styles.page}>
      <View
        style={{
          width,
          height: Math.min(windowHeight, fullHeight),
          backgroundColor: palette.background,
          overflow: "hidden",
        }}
      >
        <ScrollView key={id} style={styles.body} showsVerticalScrollIndicator={false}>
          <FrameSlice
            id={id}
            from={CROP_TOP}
            to={pin ?? end}
            scale={scale}
            hotspots={hotspots.filter((spot) => !isPinned(spot))}
            onPress={goTo}
          />
        </ScrollView>

        {pin !== undefined ? (
          <FrameSlice
            id={id}
            from={pin}
            to={end}
            scale={scale}
            hotspots={hotspots.filter(isPinned)}
            onPress={goTo}
          />
        ) : null}

        <View style={styles.chips}>
          {screen.alt ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.setParams({ s: screen.alt?.to })}
              style={[styles.chip, styles.chipStrong]}
            >
              <Text style={[styles.chipText, styles.chipTextStrong]}>
                {screen.alt.label}
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            accessibilityRole="button"
            onPress={() => setMenuOpen(true)}
            style={styles.chip}
          >
            <Text style={styles.chipText}>전체 화면</Text>
          </Pressable>
        </View>

        {toast ? (
          <View pointerEvents="none" style={styles.toast}>
            <Text style={styles.toastText}>아직 연결된 화면이 없어요</Text>
          </View>
        ) : null}

        {menuOpen ? (
          <ScreenMenu
            current={id}
            onClose={() => setMenuOpen(false)}
            onSelect={(target) => {
              setMenuOpen(false);

              router.push({ pathname: "/prototype", params: { s: target } });
            }}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.surface,
  },

  body: {
    flex: 1,
  },

  chips: {
    position: "absolute",
    top: 6,
    right: 8,
    flexDirection: "row",
    gap: 6,
  },

  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.background,
  },

  chipStrong: {
    borderColor: palette.primary,
    backgroundColor: palette.primary,
  },

  chipText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    lineHeight: 16,
    color: palette.body,
  },

  chipTextStrong: {
    color: palette.onPrimary,
  },

  toast: {
    position: "absolute",
    left: 24,
    right: 24,
    bottom: 120,
    alignItems: "center",
    paddingVertical: 12,
    backgroundColor: palette.ink,
  },

  toastText: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    color: palette.onPrimary,
  },

  menu: {
    ...StyleSheet.absoluteFill,
    backgroundColor: palette.background,
  },

  menuHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },

  menuTitle: {
    fontFamily: fonts.sans,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "700",
    color: palette.ink,
  },

  menuHint: {
    marginTop: 2,
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 20,
    color: palette.body,
  },

  menuClose: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 28,
    color: palette.ink,
  },

  menuList: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },

  menuGroup: {
    paddingTop: 20,
  },

  menuGroupTitle: {
    marginBottom: 4,
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    color: palette.muted,
  },

  menuRow: {
    paddingVertical: 10,
  },

  menuRowText: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    color: palette.ink,
  },

  menuRowCurrent: {
    fontWeight: "700",
    color: palette.primary,
  },
});
