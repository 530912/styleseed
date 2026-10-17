import { router } from "expo-router";

import { Alert } from "react-native";

import { getSaveAfterAuthFailureAlert } from "../lib/apiErrors";

import { saveClothingToSupabase } from "../lib/clothes";

import { useAnalysisStore } from "../store/useAnalysisStore";

import { useClosetStore } from "../store/useClosetStore";

import { usePendingClothingStore } from "../store/usePendingClothingStore";

// 로그인·회원가입 직후 "로그인 전에 분석한 옷"을 저장한다.
// 인증 성공과 저장 실패를 구분해서 안내한다(PRD FR-AUTH-03).
export const useSavePendingClothing = () => {
  const pendingClothing = usePendingClothingStore(
    (state) => state.pendingClothing,
  );

  const clearPendingClothing = usePendingClothingStore(
    (state) => state.clearPendingClothing,
  );

  const addClothing = useClosetStore((state) => state.addClothing);

  const clearImage = useAnalysisStore((state) => state.clearImage);

  // 반환값: 저장했으면 true. 실패하면 안내를 띄우고 false.
  // authLabel: "로그인" 또는 "회원가입"
  const savePendingClothing = async (
    userId: string,
    authLabel: string,
  ): Promise<boolean> => {
    const clothing = usePendingClothingStore.getState().pendingClothing;

    if (!clothing) {
      return true;
    }

    try {
      const savedClothing = await saveClothingToSupabase(clothing, userId);

      addClothing(savedClothing);

      clearPendingClothing();

      clearImage();

      return true;
    } catch (error) {
      console.warn("로그인 후 옷 저장 실패:", error);

      const alert = getSaveAfterAuthFailureAlert(authLabel, error);

      Alert.alert(
        alert.title,
        alert.message,
        [
          {
            text: alert.laterLabel,
            style: "cancel",
            onPress: () => {
              // 분석 화면으로 돌아가 저장 버튼으로 다시 저장한다(이미 로그인 상태).
              // 남겨두면 다음 로그인 때 중복 저장될 수 있어 보류 항목은 비운다.
              clearPendingClothing();

              router.dismissTo("/analyze");
            },
          },
          {
            text: alert.retryLabel,
            onPress: async () => {
              if (await savePendingClothing(userId, authLabel)) {
                router.replace("/closet");
              }
            },
          },
        ],
      );

      return false;
    }
  };

  return { pendingClothing, savePendingClothing };
};
