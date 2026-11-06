import AsyncStorage from "@react-native-async-storage/async-storage";

import { create } from "zustand";

import { createJSONStorage, persist } from "zustand/middleware";

import {
  toggleSavedLook,
  type SavedLook,
} from "../lib/savedLooksPolicy";

/**
 * 저장한 추천 코디 (2026-11 사용자 조사 1차 범위)
 *
 * DB 구조를 바꾸지 않도록 기기에만 저장한다. 다른 기기와 동기화되지 않는다.
 * 계정 구분은 옷 ID로 한다(src/lib/savedLooksPolicy.ts의 resolveSavedLooks).
 */
type SavedLooksStore = {
  looks: SavedLook[];

  // 반환값: 저장됐으면 true, 저장 해제됐으면 false
  toggleLook: (input: Omit<SavedLook, "key">) => boolean;

  removeLook: (key: string) => void;

  clearLooks: () => void;
};

export const useSavedLooksStore = create<SavedLooksStore>()(
  persist(
    (set, get) => ({
      looks: [],

      toggleLook: (input) => {
        const result = toggleSavedLook(get().looks, input);

        set({ looks: result.looks });

        return result.saved;
      },

      removeLook: (key) =>
        set((state) => ({
          looks: state.looks.filter((look) => look.key !== key),
        })),

      clearLooks: () => set({ looks: [] }),
    }),

    {
      name: "styleseed-saved-looks-v1",

      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
