import {
    Alert,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import { router } from "expo-router";
import { useState } from "react";

import { supabase } from "../lib/supabase";

import { TopBar } from "../components/styleseed/ui";

import { useSavePendingClothing } from "../hooks/use-save-pending-clothing";

export default function SignupScreen() {
  const { pendingClothing, savePendingClothing } = useSavePendingClothing();

  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (!email || !password) {
      Alert.alert("입력 확인", "이메일과 비밀번호를 입력해주세요.");

      return;
    }

    let userId: string;

    // 1) 가입: 여기서 실패한 경우만 "회원가입 실패"
    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      // 이메일 인증이 필요한 경우(보류 중인 옷은 로그인 후 저장된다)
      if (!data.session) {
        setLoading(false);

        Alert.alert("회원가입 완료", "이메일 인증 후 로그인해주세요.");

        router.replace("/login");

        return;
      }

      userId = data.session.user.id;
    } catch (error) {
      setLoading(false);

      Alert.alert(
        "회원가입 실패",
        error instanceof Error
          ? error.message
          : "회원가입 중 오류가 발생했습니다.",
      );

      return;
    }

    // 2) 이메일 인증 없이 바로 세션이 생긴 경우: 분석한 옷 저장(실패해도 가입은 유지)
    if (pendingClothing) {
      const saved = await savePendingClothing(userId, "회원가입");

      setLoading(false);

      if (saved) {
        Alert.alert("회원가입 완료", "분석한 옷을 옷장에 저장했어요.");

        router.replace("/closet");
      }

      return;
    }

    setLoading(false);

    Alert.alert("회원가입 완료", "로그인되었습니다.");

    router.replace("/");
  };

  return (
    <View style={styles.container}>
      <TopBar floating />

      <Text style={styles.title}>회원가입</Text>

      <Text style={styles.description}>STYLESEED 옷장을 만들어보세요.</Text>

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
        style={styles.button}
        onPress={handleSignup}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? "가입 중..." : "회원가입"}
        </Text>
      </Pressable>

      <Pressable
        style={styles.linkButton}
        onPress={() => router.push("/login")}
      >
        <Text style={styles.linkText}>이미 계정이 있나요? 로그인</Text>
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
});
