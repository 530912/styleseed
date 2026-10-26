import { router } from "expo-router";

import { useState } from "react";

import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button, Label, Screen } from "../components/styleseed/ui";

import { palette } from "../constants/ui";

import { RESEARCH_MODE } from "../lib/featureFlags";

import { markOnboardingSeen } from "../lib/onboarding";

import { logResearchEvent } from "../lib/researchEvents";

// 첫 실행 안내 3단계 (2026-11 사용자 조사 1차 범위). 앱이 하는 일만 짧게 알리고, 건너뛸 수 있다.
// 상품이 예시라는 점과 사진이 AI 분석에 쓰인다는 점은 여기서도 미리 알린다(동의는 첫 분석 전 동의 화면에서 받음).
const STEPS = [
  {
    eyebrow: "01 · 옷 등록",
    title: "옷 사진 한 장이면\n옷장에 정리돼요",
    body: "사진을 올리면 AI가 카테고리·색·핏·소재·스타일을 분석해요. 결과가 틀리면 저장 전이나 저장 후에 직접 고칠 수 있어요.",
  },
  {
    eyebrow: "02 · 코디 추천",
    title: "가진 옷으로\n코디를 만들어요",
    body: "등록한 옷끼리 조합해 코디와 점수, 추천 이유를 보여줘요. 마음에 드는 코디는 저장해 두고 다시 볼 수 있어요.",
  },
  {
    eyebrow: "03 · Missing Item",
    title: "하나만 더 있으면\n코디가 완성돼요",
    body: "코디에 부족한 아이템을 알려드려요. 지금 보여드리는 상품은 연구용 예시이고 구매 링크는 없어요.",
  },
] as const;

export default function OnboardingScreen() {
  const [step, setStep] = useState(0);

  const current = STEPS[step];

  const isLast = step === STEPS.length - 1;

  const finish = async (skipped: boolean) => {
    logResearchEvent("onboarding_completed", {
      skipped,
      steps_viewed: step + 1,
    });

    await markOnboardingSeen().catch(() => undefined);

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  };

  return (
    <Screen
      showBack={false}
      footer={
        <Button
          label={isLast ? "시작하기" : "다음"}
          onPress={() => (isLast ? finish(false) : setStep(step + 1))}
        />
      }
    >
      <View style={styles.topRow}>
        <View style={styles.dots}>
          {STEPS.map((item, index) => (
            <View
              key={item.eyebrow}
              style={[styles.dot, index === step && styles.dotActive]}
            />
          ))}
        </View>

        {isLast ? null : (
          <Pressable onPress={() => finish(true)} hitSlop={12}>
            <Text style={styles.skip}>건너뛰기</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.body}>
        <Label>{current.eyebrow}</Label>

        <Text style={styles.title}>{current.title}</Text>

        <Text style={styles.text}>{current.body}</Text>

        {/* 연구 모드: 참가자에게 무엇이 기록되는지 알린다(동의는 연구 동의서로 받음) */}
        {RESEARCH_MODE && isLast ? (
          <View style={styles.researchNote}>
            <Label>사용자 조사 참여 안내</Label>

            <Text style={styles.researchText}>
              조사 동안 앱 사용 기록(누른 화면과 시각, AI 분석 결과를 고쳤는지, 등록한 옷의 종류)이 이 기기의
              브라우저에 저장되고, 세션이 끝나면 진행자가 참가 코드로 받아 갑니다. 사진·이메일·위치·계정 정보는
              기록에 넣지 않아요. 원하지 않으면 진행자에게 기록 삭제를 요청할 수 있어요.
            </Text>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  dots: {
    flexDirection: "row",
    gap: 6,
  },

  dot: {
    width: 6,
    height: 6,
    backgroundColor: palette.line,
  },

  dotActive: {
    width: 18,
    backgroundColor: palette.ink,
  },

  skip: {
    fontSize: 13,
    color: palette.subtle,
  },

  body: {
    marginTop: 64,
  },

  title: {
    marginTop: 14,
    fontSize: 30,
    lineHeight: 38,
    fontWeight: "700",
    color: palette.ink,
  },

  researchNote: {
    marginTop: 28,
    padding: 16,
    backgroundColor: palette.surface,
    gap: 8,
  },

  researchText: {
    fontSize: 13,
    lineHeight: 20,
    color: palette.body,
  },

  text: {
    marginTop: 18,
    fontSize: 15,
    lineHeight: 23,
    color: palette.body,
  },
});
