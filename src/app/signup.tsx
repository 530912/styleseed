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

import { signUpWithEmail } from "../lib/authActions";

import { Button, TopBar } from "../components/styleseed/ui";

import { size } from "../constants/tokens";

import { fonts, palette } from "../constants/ui";

import { useSavePendingClothing } from "../hooks/use-save-pending-clothing";

import { getAuthErrorMessage } from "../lib/authErrors";

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

      // 로그인 전 분석으로 생긴 익명 세션이 있으면 같은 사용자 ID로 정식 계정 전환
      const { session } = await signUpWithEmail(email, password);

      // 이메일 인증이 필요한 경우(보류 중인 옷은 로그인 후 저장된다)
      if (!session) {
        setLoading(false);

        Alert.alert("회원가입 완료", "이메일 인증 후 로그인해주세요.");

        router.replace("/login");

        return;
      }

      userId = session.user.id;
    } catch (error) {
      setLoading(false);

      Alert.alert(
        "회원가입 실패",
        getAuthErrorMessage(error, "회원가입 중 오류가 발생했어요. 잠시 후 다시 시도해주세요."),
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

      <Button
        label={loading ? "가입 중..." : "회원가입"}
        onPress={handleSignup}
        loading={loading}
        style={styles.submit}
      />

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
    backgroundColor: palette.background,
    paddingHorizontal: 24,
    paddingTop: 120,
  },

  title: {
    fontFamily: fonts.sans,
    fontSize: 28,
    fontWeight: "700",
    color: palette.ink,
  },

  description: {
    marginTop: 12,
    marginBottom: 36,
    fontFamily: fonts.sans,
    fontSize: 15,
    color: palette.body,
  },

  input: {
    height: size.input,
    borderWidth: 1,
    borderColor: palette.line,
    color: palette.ink,
    paddingHorizontal: 16,
    marginBottom: 12,
    fontFamily: fonts.sans,
    fontSize: 16,
  },

  submit: {
    marginTop: 12,
  },

  linkButton: {
    marginTop: 24,
    alignItems: "center",
  },

  linkText: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: palette.body,
  },
});
