import { useAnalysisStore } from "../store/useAnalysisStore";

import { useEffect, useState } from "react";

import {
    ActivityIndicator,
    Image,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { router } from "expo-router";

import { useClosetStore } from "../store/useClosetStore";

import type { ClothingAnalysis } from "../types";

export default function AnalyzeScreen() {
  const imageUri = useAnalysisStore((state) => state.imageUri);

  const imageBase64 = useAnalysisStore((state) => state.imageBase64);

  const clearImage = useAnalysisStore((state) => state.clearImage);

  const addClothing = useClosetStore((state) => state.addClothing);

  const [analysisResult, setAnalysisResult] = useState<ClothingAnalysis | null>(
    null,
  );

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const analyzeClothing = async () => {
      if (!imageBase64) {
        setError("분석할 이미지가 없습니다.");

        setLoading(false);

        return;
      }
      try {
        setLoading(true);
        setError(null);

        const response = await fetch("http://localhost:3001/analyze-clothing", {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            imageBase64,
          }),
        });

        if (!response.ok) {
          throw new Error("분석 요청에 실패했습니다.");
        }

        const data = (await response.json()) as ClothingAnalysis;

        setAnalysisResult(data);
      } catch (error) {
        console.error(error);

        setError("옷 분석 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    };

    analyzeClothing();
  }, [imageUri]);

  const capitalize = (text: string) => {
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  const handleSave = () => {
    if (!analysisResult || !imageUri) {
      return;
    }

    const newClothing = {
      ...analysisResult,
      id: Date.now(),
      imageUri,
    };

    addClothing(newClothing);

    clearImage();

    router.replace("/closet");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>분석 결과</Text>

      <Text style={styles.description}>옷의 정보를 분석했어요.</Text>

      <View style={styles.imageBox}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.image} />
        ) : (
          <Text style={styles.imageText}>이미지 없음</Text>
        )}
      </View>

      {loading && (
        <View style={styles.statusBox}>
          <ActivityIndicator />

          <Text style={styles.statusText}>옷을 분석하고 있어요...</Text>
        </View>
      )}

      {error && (
        <View style={styles.statusBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {analysisResult && (
        <View style={styles.resultBox}>
          <Text style={styles.label}>CATEGORY</Text>

          <Text style={styles.value}>
            {capitalize(analysisResult.subCategory)}
          </Text>

          <Text style={styles.label}>COLOR</Text>

          <Text style={styles.value}>{capitalize(analysisResult.color)}</Text>

          <Text style={styles.label}>FIT</Text>

          <Text style={styles.value}>{capitalize(analysisResult.fit)}</Text>

          <Text style={styles.label}>MATERIAL</Text>

          <Text style={styles.value}>
            {capitalize(analysisResult.material)}
          </Text>

          <Text style={styles.label}>STYLE</Text>

          <Text style={styles.value}>
            {analysisResult.style.map(capitalize).join(", ")}
          </Text>
        </View>
      )}

      <Pressable
        style={[styles.button, !analysisResult && styles.disabledButton]}
        disabled={!analysisResult}
        onPress={handleSave}
      >
        <Text style={styles.buttonText}>옷장에 저장</Text>
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
    height: 220,
    marginTop: 32,
    backgroundColor: "#eeeeee",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },

  image: {
    width: "100%",
    height: "100%",
  },

  imageText: {
    color: "#999999",
  },

  statusBox: {
    marginTop: 20,
    alignItems: "center",
  },

  statusText: {
    marginTop: 10,
    color: "#666666",
  },

  errorText: {
    color: "#cc0000",
  },

  resultBox: {
    marginTop: 24,
    padding: 24,
    backgroundColor: "#f4f4f4",
  },

  label: {
    fontSize: 12,
    color: "#888888",
    marginBottom: 4,
  },

  value: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111111",
    marginBottom: 18,
  },

  button: {
    marginTop: 20,
    paddingVertical: 18,
    backgroundColor: "#111111",
    alignItems: "center",
  },

  disabledButton: {
    opacity: 0.3,
  },

  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
});
