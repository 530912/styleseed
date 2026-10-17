import { create } from "zustand";

import type { ClothingAnalysis } from "../types";

type AnalysisStore = {
  imageUri: string | null;
  imageBase64: string | null;

  // 현재 이미지의 Gemini 분석 결과 (같은 이미지를 다시 열 때 재요청하지 않음)
  analysisResult: ClothingAnalysis | null;

  setImage: (imageUri: string, imageBase64: string) => void;

  setAnalysisResult: (analysisResult: ClothingAnalysis) => void;

  clearImage: () => void;
};

export const useAnalysisStore = create<AnalysisStore>((set) => ({
  imageUri: null,
  imageBase64: null,
  analysisResult: null,

  setImage: (imageUri, imageBase64) =>
    set({
      imageUri,
      imageBase64,
      analysisResult: null,
    }),

  setAnalysisResult: (analysisResult) =>
    set({
      analysisResult,
    }),

  clearImage: () =>
    set({
      imageUri: null,
      imageBase64: null,
      analysisResult: null,
    }),
}));
