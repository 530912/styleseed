import AsyncStorage from "@react-native-async-storage/async-storage";

// 첫 실행 안내(온보딩)를 본 기기인지 (2026-11 사용자 조사 1차 범위)
// 기기 단위 기록이라, 진행자 기기를 여러 참가자가 쓰면 연구 세션 종료 때 resetOnboarding으로 지운다.

const STORAGE_KEY = "styleseed-onboarding-v1";

// 저장에 실패해도 한 번 실행하는 동안 같은 안내를 반복해서 띄우지 않는다
let shownThisLaunch = false;

export const hasSeenOnboarding = async () => {
  try {
    return (await AsyncStorage.getItem(STORAGE_KEY)) !== null;
  } catch {
    // 저장소를 읽지 못하면 안내를 다시 보여주지 않는다(앱 사용을 막지 않음)
    return true;
  }
};

// 아직 안 봤고 이번 실행에서도 띄우지 않았으면 true. true를 돌려주면 띄운 것으로 기록한다
export const takeOnboardingTurn = async () => {
  if (shownThisLaunch || (await hasSeenOnboarding())) {
    return false;
  }

  shownThisLaunch = true;

  return true;
};

export const markOnboardingSeen = async () => {
  await AsyncStorage.setItem(STORAGE_KEY, new Date().toISOString());
};

export const resetOnboarding = async () => {
  shownThisLaunch = false;

  await AsyncStorage.removeItem(STORAGE_KEY);
};
