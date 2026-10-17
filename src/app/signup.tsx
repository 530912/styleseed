import { saveClothingToSupabase } from "../lib/clothes";

import { usePendingClothingStore } from "../store/usePendingClothingStore";

import { useClosetStore } from "../store/useClosetStore";

import {
    Alert,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useAnalysisStore } from "../store/useAnalysisStore";

import { router } from "expo-router";
import { useState } from "react";

import { supabase } from "../lib/supabase";

import { TopBar } from "../components/styleseed/ui";

export default function SignupScreen() {
  const pendingClothing = usePendingClothingStore(
    (state) => state.pendingClothing,
  );

  const clearPendingClothing = usePendingClothingStore(
    (state) => state.clearPendingClothing,
  );

  const addClothing = useClosetStore((state) => state.addClothing);

  const clearImage = useAnalysisStore((state) => state.clearImage);

  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (!email || !password) {
      Alert.alert("입력 확인", "이메일과 비밀번호를 입력해주세요.");

      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      // 이메일 인증이 필요한 경우
      if (!data.session) {
        Alert.alert("회원가입 완료", "이메일 인증 후 로그인해주세요.");

        router.replace("/login");

        return;
      }

      // 이메일 인증 없이 바로 세션이 생성된 경우
      Alert.alert("회원가입 완료", "로그인되었습니다.");

      if (data.session && pendingClothing) {
        const savedClothing = await saveClothingToSupabase(
          pendingClothing,
          data.session.user.id,
        );

        addClothing(savedClothing);

        clearPendingClothing();

        clearImage();

        router.replace("/closet");

        return;
      }

      router.replace("/");
    } catch (error) {
      Alert.alert(
        "회원가입 실패",
        error instanceof Error
          ? error.message
          : "회원가입 중 오류가 발생했습니다.",
      );
    } finally {
      setLoading(false);
    }
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
