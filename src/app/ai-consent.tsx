import { router, useLocalSearchParams } from "expo-router";

import { useEffect, useState } from "react";

import { Alert, StyleSheet, Text, View } from "react-native";

import { Button, Screen, ScreenHeader } from "../components/styleseed/ui";

import { GEMINI_FREE_TIER_NOTICE } from "../constants/legal";

import { fonts, palette } from "../constants/ui";

import { hasAiConsent, saveAiConsent, withdrawAiConsent } from "../lib/aiConsent";

// 사진 AI 처리 안내·동의 (Beta Launch, Apple 5.1.2(i) · PRD SEC-11)
// - next=analyze: 업로드 화면에서 첫 분석 전에 열린다. 동의하면 분석 화면으로 간다
// - 그 외(계정 화면): 내용 다시 보기 + 동의 철회
// 처리 흐름의 근거는 docs/launch/PRIVACY_DATA_FLOW.md

type Recipient = {
  name: string;
  purpose: string;
  when: string;
};

const RECIPIENTS: Recipient[] = [
  {
    name: "Google (Gemini API)",
    purpose: "옷 종류·색상·소재·계절 등 분석",
    when: "분석할 때마다",
  },
  {
    name: "Supabase",
    purpose: "옷장 사진과 분석 결과 저장",
    when: "로그인 후 옷장에 저장할 때",
  },
  {
    name: "BRIA AI",
    purpose: "옷 배경 제거",
    when: "저장할 때, STYLESEED 서버의 배경 제거가 실패한 경우에만",
  },
];

export default function AiConsentScreen() {
  const { next } = useLocalSearchParams<{ next?: string }>();

  const isGate = next === "analyze";

  const [consented, setConsented] = useState<boolean | null>(null);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    hasAiConsent().then(setConsented);
  }, []);

  const handleAccept = async () => {
    try {
      setSaving(true);

      await saveAiConsent();

      router.replace("/analyze");
    } catch (error) {
      console.warn("동의 저장 실패:", error);

      Alert.alert("저장하지 못했어요", "잠시 후 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  };

  const handleDecline = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  };

  const handleWithdraw = async () => {
    await withdrawAiConsent();

    setConsented(false);

    Alert.alert(
      "동의를 철회했어요",
      "다음에 사진을 분석할 때 다시 동의를 요청해요. 이미 옷장에 저장한 사진은 계정 화면의 회원 탈퇴 또는 옷 삭제로 지울 수 있어요.",
    );
  };

  const footer = isGate ? (
    <View style={styles.footerRow}>
      <Button
        label="동의하지 않음"
        variant="secondary"
        onPress={handleDecline}
        disabled={saving}
        style={styles.footerButton}
      />

      <Button
        label="동의하고 분석하기"
        onPress={handleAccept}
        loading={saving}
        style={styles.footerButton}
      />
    </View>
  ) : consented ? (
    <Button label="동의 철회" variant="secondary" onPress={handleWithdraw} />
  ) : undefined;

  return (
    <Screen footer={footer} onBack={isGate ? handleDecline : undefined}>
      <ScreenHeader
        eyebrow="PHOTO & AI"
        title="사진 AI 분석 안내"
        description="옷을 분석하고 옷장에 저장하려면 사진을 아래 외부 서비스로 보내야 해요."
      />

      <Text style={styles.sectionTitle}>보내는 정보</Text>

      <Text style={styles.body}>
        선택한 옷 사진 1장. 사진에 얼굴, 주소, 문서처럼 다른 정보가 보이면 함께
        전송되므로 옷만 보이게 찍어주세요.
      </Text>

      <Text style={styles.sectionTitle}>받는 곳과 목적</Text>

      {RECIPIENTS.map((recipient) => (
        <View key={recipient.name} style={styles.recipient}>
          <Text style={styles.recipientName}>{recipient.name}</Text>

          <Text style={styles.body}>{recipient.purpose}</Text>

          <Text style={styles.when}>{recipient.when}</Text>
        </View>
      ))}

      <Text style={styles.body}>
        위 서비스는 국외 서버에서 사진을 처리할 수 있어요. 분석만 하고 저장하지
        않으면 STYLESEED는 사진을 보관하지 않아요.
      </Text>

      {GEMINI_FREE_TIER_NOTICE ? (
        <Text style={[styles.body, styles.notice]}>
          현재 Google Gemini API 무료 등급을 사용하고 있어요. 무료 등급에서는
          Google이 서비스 개선을 위해 보낸 사진과 결과를 사용하고, 사람이 검토할
          수 있어요.
        </Text>
      ) : null}

      <Text style={styles.sectionTitle}>동의하지 않으면</Text>

      <Text style={styles.body}>
        사진 분석과 옷 등록을 쓸 수 없어요. 다른 기능은 그대로 쓸 수 있고,
        동의는 언제든 내 옷장 → 계정에서 철회할 수 있어요.
      </Text>

      {!isGate && consented !== null ? (
        <Text style={styles.status}>
          {consented ? "현재 상태: 동의함" : "현재 상태: 동의하지 않음"}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    marginTop: 28,
    marginBottom: 8,
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: "700",
    color: palette.ink,
  },

  body: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 21,
    color: palette.body,
  },

  notice: {
    marginTop: 12,
    padding: 12,
    backgroundColor: palette.surface,
  },

  recipient: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: palette.hairline,
  },

  recipientName: {
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: "700",
    color: palette.ink,
    marginBottom: 2,
  },

  when: {
    marginTop: 2,
    fontFamily: fonts.sans,
    fontSize: 12,
    color: palette.muted,
  },

  status: {
    marginTop: 24,
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: "700",
    color: palette.ink,
  },

  footerRow: {
    flexDirection: "row",
    gap: 10,
  },

  footerButton: {
    flex: 1,
  },
});
