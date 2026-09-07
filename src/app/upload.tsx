import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { router } from "expo-router";

import * as ImagePicker from "expo-image-picker";

import { useAnalysisStore } from "../store/useAnalysisStore";

export default function UploadScreen() {
  const imageUri = useAnalysisStore((state) => state.imageUri);

  const setImage = useAnalysisStore((state) => state.setImage);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled) {
      const asset = result.assets[0];

      if (!asset.base64) {
        return;
      }

      setImage(asset.uri, asset.base64);
    }
  };

  const handleAnalyze = () => {
    if (!imageUri) {
      return;
    }

    router.push("/analyze");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>옷 등록</Text>

      <Text style={styles.description}>등록할 옷 사진을 선택해주세요.</Text>

      <View style={styles.imageBox}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.image} />
        ) : (
          <Text style={styles.imageText}>옷 사진</Text>
        )}
      </View>

      <Pressable style={styles.selectButton} onPress={pickImage}>
        <Text style={styles.selectButtonText}>사진 선택하기</Text>
      </Pressable>

      <Pressable
        style={[styles.analyzeButton, !imageUri && styles.disabledButton]}
        disabled={!imageUri}
        onPress={handleAnalyze}
      >
        <Text style={styles.analyzeButtonText}>분석하기</Text>
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
  },

  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111111",
  },

  description: {
    marginTop: 12,
    fontSize: 16,
    color: "#666666",
  },

  imageBox: {
    width: "100%",
    aspectRatio: 1,
    marginTop: 40,
    backgroundColor: "#eeeeee",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },

  image: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },

  imageText: {
    color: "#999999",
  },

  selectButton: {
    marginTop: 20,
    paddingVertical: 17,
    borderWidth: 1,
    borderColor: "#111111",
    alignItems: "center",
  },

  selectButtonText: {
    fontSize: 16,
    color: "#111111",
  },

  analyzeButton: {
    marginTop: 12,
    paddingVertical: 17,
    backgroundColor: "#111111",
    alignItems: "center",
  },

  disabledButton: {
    opacity: 0.3,
  },

  analyzeButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
});
