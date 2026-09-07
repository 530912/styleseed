import { create } from "zustand";

type AnalysisStore = {
  imageUri: string | null;
  imageBase64: string | null;

  setImage: (imageUri: string, imageBase64: string) => void;

  clearImage: () => void;
};

export const useAnalysisStore = create<AnalysisStore>((set) => ({
  imageUri: null,
  imageBase64: null,

  setImage: (imageUri, imageBase64) =>
    set({
      imageUri,
      imageBase64,
    }),

  clearImage: () =>
    set({
      imageUri: null,
      imageBase64: null,
    }),
}));
