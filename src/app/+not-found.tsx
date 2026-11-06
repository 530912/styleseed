import { router } from "expo-router";

import { StyleSheet, Text, View } from "react-native";

import { Button, EmptyState, Screen } from "../components/styleseed/ui";

import { fonts, palette } from "../constants/ui";

// 없는 주소로 들어왔을 때(Expo 기본 영어 화면 대신). Figma 06 Screens "404" 설계
export default function NotFoundScreen() {
  return (
    <Screen showBack={false}>
      <View style={styles.brand}>
        <Text style={styles.logo}>STYLESEED</Text>
      </View>

      <EmptyState
        title="페이지를 찾을 수 없어요"
        description="주소가 바뀌었거나 없는 페이지예요."
        action={<Button label="홈으로" onPress={() => router.replace("/")} />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: {
    marginBottom: 24,
  },

  logo: {
    fontFamily: fonts.sans,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 1.5,
    color: palette.ink,
  },
});
