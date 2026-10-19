import AsyncStorage from "@react-native-async-storage/async-storage";

import { AI_CONSENT_VERSION } from "../constants/legal";

import {
  createAiConsentRecord,
  isAiConsentValid,
  parseAiConsent,
} from "./aiConsentPolicy";

// 사진 AI 처리 동의 기록 (기기 단위)
// 첫 분석 전에 동의 화면(/ai-consent)을 보여주고, 동의하면 버전·시각을 기기에 저장한다.
// 서버 측 동의 기록은 DB 변경이 필요해 Beta 이후 결정(docs/launch/PRIVACY_DATA_FLOW.md)

const STORAGE_KEY = "styleseed-ai-consent";

export const hasAiConsent = async () => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);

    return isAiConsentValid(parseAiConsent(raw), AI_CONSENT_VERSION);
  } catch {
    // 저장소를 읽지 못하면 동의를 다시 받는다
    return false;
  }
};

export const saveAiConsent = async () => {
  await AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(createAiConsentRecord(AI_CONSENT_VERSION)),
  );
};

export const withdrawAiConsent = async () => {
  await AsyncStorage.removeItem(STORAGE_KEY);
};
