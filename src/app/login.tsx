import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";

import { supabase } from "../lib/supabase";

import { TopBar } from "../components/styleseed/ui";

import { useSavePendingClothing } from "../hooks/use-save-pending-clothing";

import { getAuthErrorMessage } from "../lib/authErrors";

export default function LoginScreen() {
  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  type LoginStatus = "idle" | "loggingIn" | "processingImage";

  const [loginStatus, setLoginStatus] = useState<LoginStatus>("idle");

  const isLoading = loginStatus !== "idle";

  const getLoginButtonText = () => {
    switch (loginStatus) {
      case "loggingIn":
        return "로그인 중...";

      case "processingImage":
        return "옷 이미지를 정리하고 있어요...";

      default:
        return "로그인";
    }
  };

  const { redirectTo } = useLocalSearchParams<{
    redirectTo?: string;
  }>();

  const { pendingClothing, savePendingClothing } = useSavePendingClothing();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("입력 확인", "이메일과 비밀번호를 입력해주세요.");

      return;
    }

    let userId: string;

    // 1) 인증: 여기서 실패한 경우만 "로그인 실패"
    try {
      setLoginStatus("loggingIn");

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      userId = data.user.id;
    } catch (error) {
      setLoginStatus("idle");

      Alert.alert(
        "로그인 실패",
        getAuthErrorMessage(error, "로그인 중 오류가 발생했어요. 잠시 후 다시 시도해주세요."),
      );

      return;
    }

    // 2) 로그인 전에 분석한 옷 저장: 실패해도 로그인은 유지되고 따로 안내한다
    if (pendingClothing) {
      setLoginStatus("processingImage");

      const saved = await savePendingClothing(userId, "로그인");

      setLoginStatus("idle");

      if (saved) {
        Alert.alert("로그인 완료", "분석한 옷을 옷장에 저장했어요.");

        router.replace("/closet");
      }

      return;
    }

    setLoginStatus("idle");

    Alert.alert("로그인 완료", "STYLESEED에 로그인했어요.");

    if (redirectTo === "closet") {
      router.replace("/closet");

      return;
    }

    router.replace("/");
  };

  return (
    <View style={styles.container}>
      <TopBar floating />

      <Text style={styles.title}>로그인</Text>

      <Text style={styles.description}>내 STYLESEED 옷장으로 돌아오세요.</Text>

      <TextInput
        style={styles.input}
        placeholder="이메일"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        style={styles.input}
        placeholder="비밀번호"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Pressable
        style={[styles.button, isLoading && styles.disabledButton]}
        onPress={handleLogin}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>{getLoginButtonText()}</Text>
      </Pressable>

      <Pressable
        style={styles.linkButton}
        onPress={() => router.push("/signup")}
      >
        <Text style={styles.linkText}>계정이 없나요? 회원가입</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
    paddingHorizontal: 24,
    paddingTop: 120,
  },

  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111111",
  },

  description: {
    marginTop: 12,
    marginBottom: 36,
    fontSize: 15,
    color: "#666666",
  },

  input: {
    height: 54,
    borderWidth: 1,
    borderColor: "#dddddd",
    paddingHorizontal: 16,
    marginBottom: 12,
    fontSize: 16,
  },

  button: {
    marginTop: 12,
    paddingVertical: 18,
    backgroundColor: "#111111",
    alignItems: "center",
  },

  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },

  linkButton: {
    marginTop: 24,
    alignItems: "center",
  },

  linkText: {
    fontSize: 14,
    color: "#666666",
  },

  disabledButton: {
    opacity: 0.3,
  },
});
