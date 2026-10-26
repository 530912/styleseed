import AsyncStorage from "@react-native-async-storage/async-storage";

import Constants from "expo-constants";

import { Platform } from "react-native";

import assignmentTable from "../../data/round1/experiment/assignment-r1-plus-price-v1.json";

import eventsContract from "../../data/round1/contract/research-events-v0.3.json";

import { RESEARCH_MODE } from "./featureFlags";

import {
  appendResearchEvent,
  buildResearchEvent,
  createUuid,
  startResearchSession,
  toJsonLines,
  type ResearchContract,
  type ResearchEvent,
  type ResearchSession,
} from "./researchEventsPolicy";

// 사용자 조사 이벤트 기록기 (R1-02-03, 저장소 D1 = 기기 기록 + 진행자 내보내기)
// - 연구 모드(RESEARCH_MODE)이고 진행자가 참가 코드를 설정했을 때만 기록한다.
// - 기록은 이 기기 AsyncStorage에만 있다. 서버·운영 DB로 보내지 않는다.
// - 기록 실패는 앱 동작에 영향을 주지 않는다(조용히 무시).

const SESSION_KEY = "styleseed-research-session";

const EVENTS_KEY = "styleseed-research-events";

const contract = eventsContract as unknown as ResearchContract;

let sessionCache: ResearchSession | null | undefined;

let eventsCache: ResearchEvent[] | undefined;

// 저장을 차례로 처리해 동시에 기록해도 이벤트가 빠지지 않게 한다
let writeChain: Promise<unknown> = Promise.resolve();

const enqueue = <T>(task: () => Promise<T>) => {
  const run = writeChain.then(task, task);

  writeChain = run.catch(() => undefined);

  return run;
};

const randomByte = () => Math.floor(Math.random() * 256);

const readJson = async <T>(key: string, fallback: T): Promise<T> => {
  try {
    const raw = await AsyncStorage.getItem(key);

    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const loadSession = async () => {
  if (sessionCache === undefined) {
    sessionCache = await readJson<ResearchSession | null>(SESSION_KEY, null);
  }

  return sessionCache;
};

const loadEvents = async () => {
  if (eventsCache === undefined) {
    eventsCache = await readJson<ResearchEvent[]>(EVENTS_KEY, []);
  }

  return eventsCache;
};

export const getResearchSession = () =>
  RESEARCH_MODE ? loadSession() : Promise.resolve(null);

export const getResearchEvents = () =>
  RESEARCH_MODE ? loadEvents() : Promise.resolve([] as ResearchEvent[]);

export const beginResearchSession = (
  participantCode: string,
  testEnv: "research" | "rehearsal",
) =>
  enqueue(async () => {
    const result = startResearchSession({
      contract,
      assignment: assignmentTable,
      participantCode,
      testEnv,
      sessionId: createUuid(randomByte),
      startedAt: new Date().toISOString(),
    });

    if (result.ok) {
      sessionCache = result.session;

      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(result.session));
    }

    return result;
  });

// 세션만 닫는다. 기록은 내보낸 뒤 clearResearchEvents로 따로 지운다
export const endResearchSession = () =>
  enqueue(async () => {
    sessionCache = null;

    await AsyncStorage.removeItem(SESSION_KEY);
  });

export const clearResearchEvents = () =>
  enqueue(async () => {
    eventsCache = [];

    await AsyncStorage.removeItem(EVENTS_KEY);
  });

export const exportResearchEvents = async () => toJsonLines(await loadEvents());

// 화면·흐름에서 부르는 기록 함수. 기다릴 필요 없다(await 하지 않아도 됨)
export const logResearchEvent = (
  eventName: string,
  properties: Record<string, unknown> = {},
) => {
  if (!RESEARCH_MODE) {
    return;
  }

  const occurredAt = new Date().toISOString();

  enqueue(async () => {
    const event = buildResearchEvent({
      contract,
      session: await loadSession(),
      eventName,
      properties,
      eventId: createUuid(randomByte),
      occurredAt,
      appVersion: Constants.expoConfig?.version ?? "unknown",
      platform: Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : "web",
    });

    if (!event) {
      return;
    }

    eventsCache = appendResearchEvent(await loadEvents(), event);

    await AsyncStorage.setItem(EVENTS_KEY, JSON.stringify(eventsCache));
  }).catch((error) => {
    console.warn("연구 이벤트 기록 실패:", error);
  });
};
