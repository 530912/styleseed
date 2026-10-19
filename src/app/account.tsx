import { Ionicons } from "@expo/vector-icons";

import { router, useFocusEffect } from "expo-router";

import * as WebBrowser from "expo-web-browser";

import { useCallback, useState } from "react";

import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  Button,
  EmptyState,
  Screen,
  ScreenHeader,
} from "../components/styleseed/ui";

import { PRIVACY_POLICY_URL, TERMS_URL } from "../constants/legal";

import { palette } from "../constants/ui";

import { isSignedIn } from "../lib/sessionPolicy";

import { supabase } from "../lib/supabase";

// 계정 화면 (Beta Launch): 정책 문서, 사진 AI 동의 확인, 회원 탈퇴 진입점

type MenuRowProps = {
  label: string;
  detail?: string;
  onPress?: () => void;
  danger?: boolean;
};

function MenuRow({ label, detail, onPress, danger = false }: MenuRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Text style={[styles.rowLabel, danger && styles.danger]}>{label}</Text>

      <View style={styles.rowRight}>
        {detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}

        {onPress ? (
          <Ionicons name="chevron-forward" size={16} color={palette.muted} />
        ) : null}
      </View>
    </Pressable>
  );
}

const openDocument = (url: string | null) =>
  url ? () => WebBrowser.openBrowserAsync(url) : undefined;

export default function AccountScreen() {
  const [email, setEmail] = useState<string | null>(null);

  const [status, setStatus] = useState<"loading" | "signed-in" | "signed-out">(
    "loading",
  );

  useFocusEffect(
    useCallback(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (isSignedIn(session)) {
          setEmail(session.user.email ?? null);
          setStatus("signed-in");
        } else {
          setStatus("signed-out");
        }
      });
    }, []),
  );

  return (
    <Screen>
      <ScreenHeader eyebrow="ACCOUNT" title="계정" description={email ?? undefined} />

      {status === "signed-out" ? (
        <EmptyState
          title="로그인이 필요해요"
          description="계정 관리는 로그인한 뒤 이용할 수 있어요."
          action={<Button label="로그인" onPress={() => router.push("/login")} />}
        />
      ) : null}

      <Text style={styles.section}>정책</Text>

      <MenuRow
        label="개인정보처리방침"
        detail={PRIVACY_POLICY_URL ? undefined : "준비 중"}
        onPress={openDocument(PRIVACY_POLICY_URL)}
      />

      <MenuRow
        label="이용약관"
        detail={TERMS_URL ? undefined : "준비 중"}
        onPress={openDocument(TERMS_URL)}
      />

      <MenuRow
        label="사진 AI 분석 안내·동의"
        onPress={() => router.push("/ai-consent")}
      />

      {status === "signed-in" ? (
        <>
          <Text style={styles.section}>계정 관리</Text>

          <MenuRow
            label="회원 탈퇴"
            danger
            onPress={() => router.push("/delete-account")}
          />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 28,
    marginBottom: 4,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: palette.subtle,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: palette.hairline,
  },

  pressed: {
    opacity: 0.6,
  },

  rowLabel: {
    fontSize: 15,
    color: palette.ink,
  },

  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  rowDetail: {
    fontSize: 13,
    color: palette.muted,
  },

  danger: {
    color: palette.danger,
  },
});
