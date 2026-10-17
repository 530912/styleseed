import { useFocusEffect } from "expo-router";

import { useCallback, useState } from "react";

import { fetchClothesFromSupabase } from "../lib/clothes";

import { supabase } from "../lib/supabase";

import { useClosetStore } from "../store/useClosetStore";

export type ClosetLoadStatus = "loading" | "ready" | "signed-out" | "error";

// 여러 화면(Home, Closet, Styling...)이 동시에 옷장을 필요로 하므로
// 같은 사용자에 대해 짧은 시간 안에는 Supabase를 다시 조회하지 않는다.
const SYNC_TTL_MS = 5 * 60 * 1000;

let lastSync: { userId: string; syncedAt: number } | null = null;

export const resetClosetSync = () => {
  lastSync = null;
};

/**
 * 로그인한 사용자의 Digital Closet을 Supabase에서 불러와
 * useClosetStore에 반영한다. (기존 Closet 화면의 불러오기 로직)
 */
export function useClosetLoader() {
  const setClothes = useClosetStore((state) => state.setClothes);

  const [status, setStatus] = useState<ClosetLoadStatus>("loading");

  const load = useCallback(
    async (force = false) => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        // 로그인하지 않았다면 개인 옷장을 비워둠
        if (!session) {
          lastSync = null;

          setClothes([]);

          setStatus("signed-out");

          return;
        }

        const isFresh =
          !force &&
          lastSync?.userId === session.user.id &&
          Date.now() - lastSync.syncedAt < SYNC_TTL_MS;

        if (isFresh) {
          setStatus("ready");

          return;
        }

        const savedClothes = await fetchClothesFromSupabase();

        lastSync = {
          userId: session.user.id,
          syncedAt: Date.now(),
        };

        setClothes(savedClothes);

        setStatus("ready");
      } catch (error) {
        console.error("옷장 불러오기 실패:", error);

        setStatus("error");
      }
    },
    [setClothes],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return {
    status,
    reload: load,
  };
}
