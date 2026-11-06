import AsyncStorage from "@react-native-async-storage/async-storage";

import { create } from "zustand";

import { createJSONStorage, persist } from "zustand/middleware";

import type { Clothing } from "../types";

type PendingClothingStore = {
  pendingClothing: Clothing | null;

  setPendingClothing: (clothing: Clothing) => void;

  clearPendingClothing: () => void;
};

export const usePendingClothingStore = create<PendingClothingStore>()(
  persist(
    (set) => ({
      pendingClothing: null,

      setPendingClothing: (clothing) =>
        set({
          pendingClothing: clothing,
        }),

      clearPendingClothing: () =>
        set({
          pendingClothing: null,
        }),
    }),

    {
      name: "styleseed-pending-clothing",

      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
