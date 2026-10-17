import AsyncStorage from "@react-native-async-storage/async-storage";

import { create } from "zustand";

import { createJSONStorage, persist } from "zustand/middleware";

import type { Clothing } from "../types";

type ClosetStore = {
  clothes: Clothing[];

  addClothing: (clothing: Clothing) => void;

  removeClothing: (clothingId: number) => void;

  updateClothing: (clothingId: number, patch: Partial<Clothing>) => void;

  setClothes: (clothes: Clothing[]) => void;

  clearClothes: () => void;
};

export const useClosetStore = create<ClosetStore>()(
  persist(
    (set) => ({
      // 이제 mockClothes를 기본값으로 넣지 않음
      clothes: [],

      addClothing: (clothing) =>
        set((state) => ({
          clothes: [clothing, ...state.clothes],
        })),

      removeClothing: (clothingId) =>
        set((state) => ({
          clothes: state.clothes.filter(
            (clothing) => clothing.id !== clothingId,
          ),
        })),

      updateClothing: (clothingId, patch) =>
        set((state) => ({
          clothes: state.clothes.map((clothing) =>
            clothing.id === clothingId ? { ...clothing, ...patch } : clothing,
          ),
        })),

      setClothes: (clothes) =>
        set({
          clothes,
        }),

      clearClothes: () =>
        set({
          clothes: [],
        }),
    }),

    {
      // 기존 mock 데이터가 남아있지 않도록
      // 저장소 이름도 새로 사용
      name: "styleseed-closet-v2",

      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
