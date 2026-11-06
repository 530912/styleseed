import AsyncStorage from "@react-native-async-storage/async-storage";

import { AI_CONSENT_VERSION } from "../constants/legal";

import {
  consentOwnerFromSession,
  createAiConsentRecord,
  parseAiConsent,
  resolveAiConsent,
} from "./aiConsentPolicy";

// 사진 AI 처리 동의 기록 (기기에 저장, 동의한 사용자와 함께)
// 첫 분석 전에 동의 화면(/ai-consent)을 보여주고, 동의하면 버전·시각·사용자를 기기에 저장한다.
// 판단 규칙은 aiConsentPolicy.ts(BUG-31). 로그아웃하면 지운다(startAiConsentSignOutSync).
// 서버 측 동의 기록은 DB 변경이 필요해 Beta 이후 결정(docs/launch/PRIVACY_DATA_FLOW.md)

const STORAGE_KEY = "styleseed-ai-consent";

// Supabase 클라이언트는 쓸 때 불러온다. _layout이 이 파일을 불러와도
// 웹 정적 렌더링(환경변수 없는 expo export)에서 클라이언트를 만들지 않게 하기 위해서다
const getSupabase = async () => (await import("./supabase")).supabase;

const getCurrentOwnerId = async () => {
  try {
    const { data } = await (await getSupabase()).auth.getSession();

    return consentOwnerFromSession(data.session);
  } catch {
    return null;
  }
};

const writeRecord = async (ownerId: string | null) => {
  await AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(createAiConsentRecord(AI_CONSENT_VERSION, { ownerId })),
  );
};

export const hasAiConsent = async () => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);

    const ownerId = await getCurrentOwnerId();

    const resolution = resolveAiConsent(
      parseAiConsent(raw),
      AI_CONSENT_VERSION,
      ownerId,
    );

    if (resolution === "adopt") {
      // 로그인 전에 한 동의를 지금 로그인한 사용자에게 귀속(같은 사람의 흐름)
      await writeRecord(ownerId);

      return true;
    }

    return resolution === "valid";
  } catch {
    // 저장소를 읽지 못하면 동의를 다시 받는다
    return false;
  }
};

export const saveAiConsent = async () => {
  await writeRecord(await getCurrentOwnerId());
};

export const withdrawAiConsent = async () => {
  await AsyncStorage.removeItem(STORAGE_KEY);
};

let signOutSyncStarted = false;

// 로그아웃(옷장 로그아웃, 진행자 [세션 종료], 계정 삭제, 세션 만료)이면 동의 기록을 지운다.
// 앱 시작 시 한 번 호출한다(src/app/_layout.tsx). 여러 번 불러도 한 번만 등록된다
export const startAiConsentSignOutSync = () => {
  if (signOutSyncStarted) {
    return;
  }

  signOutSyncStarted = true;

  getSupabase()
    .then((supabase) => {
      supabase.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_OUT") {
          withdrawAiConsent().catch(() => undefined);
        }
      });
    })
    .catch(() => {
      // 등록에 실패하면 다음 실행 때 다시 시도한다
      signOutSyncStarted = false;
    });
};
