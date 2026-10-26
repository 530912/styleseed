// 사용자 조사(Round 1) 이벤트 규칙 — 저장소·화면과 분리한 순수 함수 (R1-02-03)
// 계약: data/round1/contract/research-events-v0.3.json, 분석: scripts/round1/events.mjs
// 이벤트에는 참가 코드만 담는다. 계정 ID·이메일·사진·위치·자유 입력은 담지 않는다.

export type ResearchContract = {
  experiment_id: string;
  groups: Record<string, number>;
  participant_code_pattern: string;
  test_env: string[];
  events: Record<string, { properties: Record<string, string> }>;
  enums: Record<string, string[]>;
  forbidden_fields: string[];
};

export type ResearchAssignment = {
  assignments: Record<string, string>;
};

export type ResearchSession = {
  participantCode: string;
  testEnv: string;
  sessionId: string;
  experimentGroup: string;
  displayedPriceKrw: number;
  startedAt: string;
};

export type ResearchEvent = {
  event_id: string;
  experiment_id: string;
  event_name: string;
  participant_code: string;
  experiment_group: string;
  displayed_price_krw: number;
  occurred_at: string;
  feature_version: string;
  app_version: string;
  test_env: string;
  platform: string;
  session_id: string;
  properties: Record<string, string | number | boolean>;
};

// 앱 이벤트 형식 버전. 기록 항목을 바꾸면 올린다
export const RESEARCH_FEATURE_VERSION = "r1-core-0.3";

// 기기에 쌓아 둘 최대 개수(세션 1회 수십~수백 개 예상). 넘으면 오래된 것부터 버린다
export const MAX_STORED_EVENTS = 5000;

// 0~255 값 16개 → UUID v4 문자열
export const createUuid = (randomByte: () => number) => {
  const bytes = Array.from({ length: 16 }, () => randomByte() & 0xff);

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.map((value) => value.toString(16).padStart(2, "0")).join("");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

// 진행자가 입력한 참가 코드로 세션을 연다. 형식이 틀리거나 배정표에 없으면 오류 코드
export const startResearchSession = ({
  contract,
  assignment,
  participantCode,
  testEnv,
  sessionId,
  startedAt,
}: {
  contract: ResearchContract;
  assignment: ResearchAssignment;
  participantCode: string;
  testEnv: string;
  sessionId: string;
  startedAt: string;
}):
  | { ok: true; session: ResearchSession }
  | { ok: false; error: "E_CODE_PATTERN" | "E_UNKNOWN_CODE" | "E_TEST_ENV" } => {
  const code = participantCode.trim().toUpperCase();

  if (!new RegExp(contract.participant_code_pattern).test(code)) {
    return { ok: false, error: "E_CODE_PATTERN" };
  }

  if (!contract.test_env.includes(testEnv)) {
    return { ok: false, error: "E_TEST_ENV" };
  }

  const group = assignment.assignments[code];

  if (!group || contract.groups[group] === undefined) {
    return { ok: false, error: "E_UNKNOWN_CODE" };
  }

  return {
    ok: true,
    session: {
      participantCode: code,
      testEnv,
      sessionId,
      experimentGroup: group,
      displayedPriceKrw: contract.groups[group],
      startedAt,
    },
  };
};

// 계약에 정의된 속성만 남기고, 금지 필드·허용값 밖의 값은 버린다
export const sanitizeProperties = (
  contract: ResearchContract,
  eventName: string,
  properties: Record<string, unknown>,
) => {
  const spec = contract.events[eventName]?.properties ?? {};

  const clean: Record<string, string | number | boolean> = {};

  for (const [key, type] of Object.entries(spec)) {
    const value = properties[key];

    if (value === undefined || value === null) {
      continue;
    }

    if (contract.forbidden_fields.includes(key.toLowerCase())) {
      continue;
    }

    if (type === "int") {
      if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
        clean[key] = Math.round(value);
      }
    } else if (type === "bool") {
      if (typeof value === "boolean") {
        clean[key] = value;
      }
    } else if (type === "string") {
      if (typeof value === "string" && value.length > 0) {
        clean[key] = value.slice(0, 120);
      }
    } else if (contract.enums[type]) {
      if (typeof value === "string" && contract.enums[type].includes(value)) {
        clean[key] = value;
      }
    }
  }

  return clean;
};

// 세션이 없거나 계약에 없는 이벤트면 null(기록하지 않음)
export const buildResearchEvent = ({
  contract,
  session,
  eventName,
  properties = {},
  eventId,
  occurredAt,
  appVersion,
  platform,
}: {
  contract: ResearchContract;
  session: ResearchSession | null;
  eventName: string;
  properties?: Record<string, unknown>;
  eventId: string;
  occurredAt: string;
  appVersion: string;
  platform: string;
}): ResearchEvent | null => {
  if (!session || !contract.events[eventName]) {
    return null;
  }

  return {
    event_id: eventId,
    experiment_id: contract.experiment_id,
    event_name: eventName,
    participant_code: session.participantCode,
    experiment_group: session.experimentGroup,
    displayed_price_krw: session.displayedPriceKrw,
    occurred_at: occurredAt,
    feature_version: RESEARCH_FEATURE_VERSION,
    app_version: appVersion,
    test_env: session.testEnv,
    platform,
    session_id: session.sessionId,
    properties: sanitizeProperties(contract, eventName, properties),
  };
};

export const appendResearchEvent = (
  events: ResearchEvent[],
  event: ResearchEvent,
  max = MAX_STORED_EVENTS,
) => {
  const next = [...events, event];

  return next.length > max ? next.slice(next.length - max) : next;
};

// scripts/round1/events.mjs가 읽는 JSON Lines
export const toJsonLines = (events: ResearchEvent[]) =>
  events.map((event) => JSON.stringify(event)).join("\n");

type ReviewedAttributes = {
  category: string;
  subCategory: string;
  color: string;
  fit: string;
  material: string;
  style: string[];
};

const REVIEWED_FIELDS = [
  "category",
  "subCategory",
  "color",
  "fit",
  "material",
  "style",
] as const;

// AI 분석 결과와 사용자가 저장한 값을 비교해 고친 속성 키 목록을 돌려준다(스타일은 순서 무관)
export const getEditedFields = (
  original: ReviewedAttributes,
  final: ReviewedAttributes,
) =>
  REVIEWED_FIELDS.filter((field) => {
    if (field === "style") {
      const before = [...original.style].sort().join("|");
      const after = [...final.style].sort().join("|");

      return before !== after;
    }

    return original[field] !== final[field];
  });

// 앱 ApiError 코드 → 계약의 analysis_error 값
export const toAnalysisErrorCode = (code: string | undefined) => {
  switch (code) {
    case "NETWORK":
    case "TIMEOUT":
    case "AI_TIMEOUT":
    case "AI_BUSY":
    case "AI_RATE_LIMITED":
    case "PAYLOAD_TOO_LARGE":
    case "INVALID_IMAGE":
      return code;
    case "USER_RATE_LIMITED":
    case "GUEST_RATE_LIMITED":
      return "RATE_LIMITED";
    case "AUTH_REQUIRED":
    case "AUTH_INVALID":
    case "AUTH_UNAVAILABLE":
    case "ANONYMOUS_NOT_ALLOWED":
      return "AUTH";
    default:
      return "OTHER";
  }
};
