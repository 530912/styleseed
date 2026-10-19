import { Ionicons } from "@expo/vector-icons";

import { router } from "expo-router";

import { useState } from "react";

import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Button, Screen, ScreenHeader } from "../components/styleseed/ui";

import { palette } from "../constants/ui";

import { deleteMyAccount } from "../lib/accountDeletion";

// 회원 탈퇴 (Beta Launch, PRD FR-AUTH-05 · SEC-09, Apple 5.1.1(v) · Google Play 계정 삭제 요구사항)

const DELETED_ITEMS = [
  "계정(이메일·로그인 정보)",
  "옷장에 등록한 옷 정보와 분석 결과",
  "올린 옷 사진 원본과 배경을 지운 이미지",
  "AI 분석 사용 횟수 기록",
];

export default function DeleteAccountScreen() {
  const [password, setPassword] = useState("");

  const [confirmed, setConfirmed] = useState(false);

  const [deleting, setDeleting] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const runDeletion = async () => {
    try {
      setDeleting(true);
      setError(null);

      const outcome = await deleteMyAccount(password);

      if (outcome.kind === "deleted") {
        Alert.alert("계정을 삭제했어요", "그동안 STYLESEED를 이용해주셔서 감사해요.");

        router.replace("/");

        return;
      }

      if (outcome.kind === "signed-out") {
        Alert.alert("다시 로그인해주세요", outcome.message);

        router.replace("/login");

        return;
      }

      setError(outcome.message);
    } catch (unexpected) {
      console.error("계정 삭제 요청 실패:", unexpected);

      setError("계정을 삭제하지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setDeleting(false);
    }
  };

  const handleDelete = () => {
    if (!password || !confirmed || deleting) {
      return;
    }

    Alert.alert(
      "계정을 영구 삭제할까요?",
      "삭제한 계정과 옷장 데이터는 되돌릴 수 없어요.",
      [
        { text: "취소", style: "cancel" },
        { text: "영구 삭제", style: "destructive", onPress: runDeletion },
      ],
    );
  };

  return (
    <Screen
      footer={
        <Button
          label="계정 영구 삭제"
          onPress={handleDelete}
          disabled={!password || !confirmed}
          loading={deleting}
          style={styles.deleteButton}
        />
      }
    >
      <ScreenHeader
        eyebrow="ACCOUNT"
        title="회원 탈퇴"
        description="탈퇴하면 아래 정보가 바로 삭제되고 되돌릴 수 없어요."
      />

      {DELETED_ITEMS.map((item) => (
        <View key={item} style={styles.item}>
          <Text style={styles.bullet}>·</Text>

          <Text style={styles.itemText}>{item}</Text>
        </View>
      ))}

      <Text style={styles.label}>비밀번호 확인</Text>

      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder="현재 비밀번호"
        secureTextEntry
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        editable={!deleting}
        accessibilityLabel="비밀번호 확인"
      />

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: confirmed }}
        onPress={() => setConfirmed((value) => !value)}
        style={styles.check}
        disabled={deleting}
      >
        <Ionicons
          name={confirmed ? "checkbox" : "square-outline"}
          size={20}
          color={palette.ink}
        />

        <Text style={styles.checkText}>
          계정과 모든 데이터가 삭제되며 되돌릴 수 없다는 것을 확인했어요.
        </Text>
      </Pressable>

      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 4,
  },

  bullet: {
    fontSize: 15,
    color: palette.ink,
  },

  itemText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: palette.body,
  },

  label: {
    marginTop: 28,
    marginBottom: 8,
    fontSize: 14,
    fontWeight: "700",
    color: palette.ink,
  },

  input: {
    height: 54,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 16,
    fontSize: 16,
    color: palette.ink,
  },

  check: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },

  checkText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: palette.ink,
  },

  error: {
    marginTop: 20,
    fontSize: 14,
    lineHeight: 20,
    color: palette.danger,
  },

  deleteButton: {
    backgroundColor: palette.danger,
  },
});
