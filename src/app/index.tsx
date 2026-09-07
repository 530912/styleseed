import { Pressable, StyleSheet, Text, View } from "react-native";

import { router } from "expo-router";

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <View>
        <Text style={styles.logo}>STYLESEED</Text>

        <Text style={styles.description}>내 옷에서 시작하는 스타일링</Text>
      </View>

      <Pressable style={styles.button} onPress={() => router.push("/upload")}>
        <Text style={styles.buttonText}>옷 등록하기</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
    paddingHorizontal: 24,
    paddingTop: 100,
    paddingBottom: 50,
    justifyContent: "space-between",
  },

  logo: {
    fontSize: 36,
    fontWeight: "700",
    color: "#111111",
  },

  description: {
    marginTop: 12,
    fontSize: 16,
    color: "#666666",
  },

  button: {
    width: "100%",
    paddingVertical: 18,
    backgroundColor: "#111111",
    alignItems: "center",
  },

  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
});
