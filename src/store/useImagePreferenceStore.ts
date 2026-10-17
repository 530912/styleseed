import AsyncStorage from "@react-native-async-storage/async-storage";

import { create } from "zustand";

import { createJSONStorage, persist } from "zustand/middleware";

export type ClothingImagePreference = "cutout" | "original";

/**
 * 옷마다 어떤 사진을 보여줄지 저장한다.
 *
 * 배경 제거가 이상하게 된 경우 원본 사진으로 되돌릴 수 있게 하기 위한 값이며,
 * DB 구조를 바꾸지 않도록 기기에만 저장한다.
 */
type ImagePreferenceStore = {
  preferences: Record<string, ClothingImagePreference>;

  setPreference: (
    clothingId: number,
    preference: ClothingImagePreference,
  ) => void;

  clearPreference: (clothingId: number) => void;
};

export const useImagePreferenceStore = create<ImagePreferenceStore>()(
  persist(
    (set) => ({
      preferences: {},

      setPreference: (clothingId, preference) =>
        set((state) => ({
          preferences: {
            ...state.preferences,
            [String(clothingId)]: preference,
          },
        })),

      clearPreference: (clothingId) =>
        set((state) => {
          const nextPreferences = { ...state.preferences };

          delete nextPreferences[String(clothingId)];

          return { preferences: nextPreferences };
        }),
    }),

    {
      name: "styleseed-image-preference",

      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export const useClothingImagePreference = (clothingId: number) => {
  return useImagePreferenceStore(
    (state) => state.preferences[String(clothingId)],
  );
};
