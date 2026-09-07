import AsyncStorage from "@react-native-async-storage/async-storage";

import { create } from "zustand";

import { createJSONStorage, persist } from "zustand/middleware";

import { mockClothes } from "../data/mockClothes";
import { Clothing } from "../types";

type ClosetStore = {
  clothes: Clothing[];

  addClothing: (clothing: Clothing) => void;
};

export const useClosetStore = create<ClosetStore>()(
  persist(
    (set) => ({
      clothes: mockClothes,

      addClothing: (clothing) =>
        set((state) => ({
          clothes: [clothing, ...state.clothes],
        })),
    }),

    {
      name: "styleseed-closet",

      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
