import { Redirect, router } from "expo-router";

import { useCallback, useEffect, useState } from "react";

import { Platform, Share, StyleSheet, Text, TextInput, View } from "react-native";

import { Button, Label, Screen, ScreenHeader } from "../components/styleseed/ui";

import { palette } from "../constants/ui";

import { resetClosetSync } from "../hooks/use-closet-loader";

import { withdrawAiConsent } from "../lib/aiConsent";

import { RESEARCH_MODE } from "../lib/featureFlags";

import { resetOnboarding } from "../lib/onboarding";

import {
  beginResearchSession,
  clearResearchEvents,
  endResearchSession,
  exportResearchEvents,
  getResearchEvents,
  getResearchSession,
} from "../lib/researchEvents";

import type { ResearchSession } from "../lib/researchEventsPolicy";

import { supabase } from "../lib/supabase";

import { useClosetStore } from "../store/useClosetStore";

// 진행자 전용 화면: 참가 코드 설정, 기록 내보내기, 세션 종료
// 연구 모드 빌드에서만 열린다(홈 로고 길게 누르기). 참가자에게 보여주는 화면이 아니다.

const START_ERRORS: Record<string, string> = {
  E_CODE_PATTERN: "참가 코드 형식이 아니에요. 예: R1-P01, 리허설은 R1-T01",
  E_UNKNOWN_CODE: "배정표에 없는 참가 코드예요.",
  E_TEST_ENV: "기록 환경 값이 올바르지 않아요.",
};

// 웹: 모바일 Safari는 파일 공유(AirDrop·메일)를 지원하면 공유 시트로, 아니면 파일로 내려받는다
const shareText = async (fileName: string, text: string) => {
  if (Platform.OS === "web") {
    const file = new File([text], fileName, { type: "text/plain" });

    if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: fileName });

      return;
    }

    const blob = new Blob([text], { type: "application/x-ndjson" });

    const url = URL.createObjectURL(blob);

    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = fileName;
    anchor.click();

    URL.revokeObjectURL(url);

    return;
  }

  await Share.share({ title: fileName, message: text });
};

function ResearchScreen() {
  const clearClothes = useClosetStore((state) => state.clearClothes);

  const [session, setSession] = useState<ResearchSession | null>(null);

  const [eventCount, setEventCount] = useState(0);

  const [sessionEventCount, setSessionEventCount] = useState(0);

  const [code, setCode] = useState("");

  const [message, setMessage] = useState<string | null>(null);

  // 세션 종료·기록 삭제는 실수 방지를 위해 두 번 눌러야 한다
  const [confirming, setConfirming] = useState<"end" | "clear" | null>(null);

  const refresh = useCallback(async () => {
    const current = await getResearchSession();

    const events = await getResearchEvents();

    setSession(current);

    setEventCount(events.length);

    setSessionEventCount(
      current ? events.filter((event) => event.session_id === current.sessionId).length : 0,
    );
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleStart = async (testEnv: "research" | "rehearsal") => {
    const result = await beginResearchSession(code, testEnv);

    if (!result.ok) {
      setMessage(START_ERRORS[result.error] ?? "세션을 시작하지 못했어요.");

      return;
    }

    setMessage(null);

    // 참가자가 첫 실행 안내를 보도록 기기 기록을 지운다(진행자가 미리 넘겼어도 다시 나옴)
    await resetOnboarding().catch(() => undefined);

    await refresh();
  };

  // 세션 중에는 이번 세션 기록만, 세션이 없으면 이 기기 전체
  const handleExport = async (scope: "session" | "all") => {
    const { text, count, fileName } = await exportResearchEvents(scope);

    if (!text) {
      setMessage("내보낼 기록이 없어요.");

      return;
    }

    try {
      await shareText(fileName, text);

      setMessage(`${count}개 기록을 ${fileName}로 내보냈어요. 진행자 PC에 도착했는지 확인한 뒤 세션을 종료하세요.`);

      await refresh();
    } catch (error) {
      console.warn("이벤트 내보내기 실패:", error);

      setMessage("내보내지 못했어요. 다시 시도해주세요.");
    }
  };

  const handleEnd = async () => {
    if (confirming !== "end") {
      setConfirming("end");

      return;
    }

    setConfirming(null);

    await endResearchSession();

    // 같은 기기를 다음 참가자가 쓰므로 계정과 기기 옷장 캐시도 비운다
    await supabase.auth.signOut().catch(() => undefined);

    resetClosetSync();

    clearClothes();

    // 사진 AI 동의·첫 실행 안내는 기기 단위 기록이라 참가자마다 다시 받도록 지운다(BUG-31)
    await withdrawAiConsent().catch(() => undefined);

    await resetOnboarding().catch(() => undefined);

    setMessage(
      "세션을 종료했어요. 로그아웃하고 사진 AI 동의·첫 실행 안내를 초기화했어요. 기록은 지우기 전까지 이 기기에 남아 있어요.",
    );

    await refresh();
  };

  const handleClear = async () => {
    if (confirming !== "clear") {
      setConfirming("clear");

      return;
    }

    setConfirming(null);

    await clearResearchEvents();

    setMessage("이 기기의 이벤트 기록을 지웠어요.");

    await refresh();
  };

  return (
    <Screen>
      <ScreenHeader
        eyebrow="RESEARCH"
        badge="진행자 전용"
        title="사용자 조사 세션"
        description="이 기기(브라우저)에만 저장되는 행동 기록이에요. 사진·이메일·위치·계정 정보는 기록하지 않아요."
      />

      <View style={styles.card}>
        <Label>현재 세션</Label>

        <Text style={styles.value}>
          {session
            ? `${session.participantCode} · ${session.testEnv === "rehearsal" ? "리허설" : "본 조사"}`
            : "시작 전"}
        </Text>

        <Text style={styles.meta}>
          {session ? `이번 세션 기록 ${sessionEventCount}개 · ` : ""}이 기기에 쌓인 기록 {eventCount}개
        </Text>
      </View>

      <Text style={styles.notice}>
        세션이 끝나면 반드시 [이번 세션 기록 내보내기]로 진행자에게 보내 주세요. 웹(Safari)에서는 개인정보 보호
        브라우징이면 탭을 닫을 때, 7일 넘게 방문하지 않으면 브라우저가 기록을 지울 수 있어요.
      </Text>

      {session ? null : (
        <>
          <TextInput
            style={styles.input}
            placeholder="참가 코드 (예: R1-P01)"
            autoCapitalize="characters"
            autoCorrect={false}
            value={code}
            onChangeText={setCode}
          />

          <View style={styles.row}>
            <Button label="본 조사 시작" onPress={() => handleStart("research")} style={styles.rowButton} />

            <Button
              label="리허설 시작"
              variant="secondary"
              onPress={() => handleStart("rehearsal")}
              style={styles.rowButton}
            />
          </View>
        </>
      )}

      {message ? <Text style={styles.message}>{message}</Text> : null}

      <View style={styles.actions}>
        {session ? (
          <Button label="이번 세션 기록 내보내기" onPress={() => handleExport("session")} />
        ) : null}

        <Button
          label="이 기기 전체 기록 내보내기"
          variant="secondary"
          onPress={() => handleExport("all")}
        />

        {session ? (
          <Button
            label={confirming === "end" ? "한 번 더 눌러 세션 종료·로그아웃" : "세션 종료"}
            onPress={handleEnd}
          />
        ) : null}

        <Button
          label={confirming === "clear" ? "한 번 더 눌러 기록 삭제" : "이 기기 기록 삭제(내보낸 뒤)"}
          variant="secondary"
          onPress={handleClear}
        />

        <Button label="홈으로" variant="secondary" onPress={() => router.replace("/")} />
      </View>
    </Screen>
  );
}

export default function ResearchScreenRoute() {
  if (!RESEARCH_MODE) {
    return <Redirect href="/" />;
  }

  return <ResearchScreen />;
}

const styles = StyleSheet.create({
  card: {
    padding: 20,
    marginBottom: 16,
    backgroundColor: palette.surface,
  },

  value: {
    marginTop: 8,
    fontSize: 20,
    fontWeight: "700",
    color: palette.ink,
  },

  meta: {
    marginTop: 6,
    fontSize: 13,
    color: palette.subtle,
  },

  input: {
    height: 54,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 16,
    marginBottom: 12,
    fontSize: 16,
    color: palette.ink,
  },

  row: {
    flexDirection: "row",
    gap: 10,
  },

  rowButton: {
    flex: 1,
  },

  notice: {
    marginBottom: 8,
    fontSize: 13,
    lineHeight: 19,
    color: palette.danger,
  },

  message: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 20,
    color: palette.body,
  },

  actions: {
    marginTop: 24,
    gap: 10,
  },
});
