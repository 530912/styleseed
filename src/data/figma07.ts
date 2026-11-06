// Figma 07 Prototype 화면 목록과 연결표 (원본: Figma YFpNLekCsjrHTuE4HRrDvC, 07 Prototype 페이지)
// 이미지: public/figma07/<id>.png (프레임 3배 내보내기). 좌표는 프레임 기준(393 폭).
// 기능 없이 화면만 보는 미리보기다. 실제 앱 화면·데이터와 연결되어 있지 않다.
//
// 연결 표기: [x, y, 폭, 높이, 목적지]
// - 목적지가 화면 id면 이동, "BACK"이면 뒤로, "NONE"이면 "아직 연결된 화면이 없어요" 안내
// - figma: Figma에 연결된 것 / added: Figma에는 연결이 없어 미리보기를 끊기지 않게 추가한 것

export type HotspotTarget = string;

export type Hotspot = [number, number, number, number, HotspotTarget];

export type FigmaScreen = {
  title: string;
  group: string;
  height: number;
  // 이 y부터 아래는 화면 하단에 고정(CTA·탭바). 없으면 전체가 스크롤
  pin?: number;
  // Figma "시간 지나면 이동"
  auto?: { to: string; ms: number };
  // 비교용 화면 전환
  alt?: { to: string; label: string };
  figma?: Hotspot[];
  added?: Hotspot[];
};

const tabs = (y: number): Hotspot[] => [
  [0, y, 98, 56, "H"],
  [98, y, 98, 56, "CL"],
  [197, y, 98, 56, "SR"],
  [295, y, 98, 56, "MY"],
];

const homeLinks: Hotspot[] = [
  [25, 420, 343, 48, "TD"],
  [25, 488, 168, 140, "EN"],
  [201, 488, 168, 140, "L1"],
  ...tabs(761),
];

const back: Hotspot = [4, 65, 44, 44, "BACK"];

export const FIGMA_START = "H";

export const FIGMA_ONBOARDING_START = "OB1";

export const FIGMA_SCREENS: Record<string, FigmaScreen> = {
  OB1: {
    title: "온보딩 1 · 디지털 옷장",
    group: "온보딩",
    height: 852,
    pin: 729,
    figma: [[24, 742, 345, 48, "OB2"]],
  },
  OB2: {
    title: "온보딩 2 · 코디 방법",
    group: "온보딩",
    height: 852,
    pin: 729,
    figma: [[24, 742, 345, 48, "OB3"]],
  },
  OB3: {
    title: "온보딩 3 · 스마트 쇼핑",
    group: "온보딩",
    height: 852,
    pin: 729,
    figma: [[24, 742, 345, 48, "OBH"]],
  },
  OBH: {
    title: "온보딩 후 홈",
    group: "온보딩",
    height: 852,
    pin: 745,
    added: homeLinks,
  },

  H: { title: "홈", group: "홈·탭", height: 852, pin: 745, figma: homeLinks },
  SR: {
    title: "코디 탭",
    group: "홈·탭",
    height: 852,
    pin: 745,
    figma: [
      [0, 253, 393, 159, "TD"],
      [0, 420, 393, 159, "SEL"],
      [0, 586, 393, 159, "SV"],
      ...tabs(762),
    ],
  },
  MY: {
    title: "마이 탭",
    group: "홈·탭",
    height: 852,
    pin: 745,
    figma: [[24, 247, 345, 52, "SV"], [24, 315, 345, 52, "AC"], ...tabs(762)],
    added: [
      [24, 383, 345, 52, "NONE"],
      [24, 451, 345, 52, "NONE"],
    ],
  },
  AC: {
    title: "계정",
    group: "홈·탭",
    height: 852,
    figma: [[5, 66, 44, 44, "MY"]],
    added: [
      [25, 254, 343, 52, "NONE"],
      [25, 322, 343, 52, "NONE"],
      [25, 390, 343, 52, "NONE"],
      [25, 458, 343, 52, "NONE"],
    ],
  },

  EN: {
    title: "옷장 시작 · 비어 있음",
    group: "옷 등록",
    height: 852,
    pin: 745,
    figma: [[25, 544, 343, 48, "UP"], ...tabs(761)],
  },
  UP: {
    title: "사진 등록 · 원본",
    group: "옷 등록",
    height: 852,
    pin: 728,
    alt: { to: "UPR", label: "수정안 보기" },
    figma: [
      [5, 66, 44, 44, "EN"],
      [25, 402, 343, 48, "SE"],
    ],
    added: [[25, 741, 343, 48, "NONE"]],
  },
  UPR: {
    title: "사진 등록 · 수정안(Mint × Coral)",
    group: "옷 등록",
    height: 852,
    pin: 728,
    alt: { to: "UP", label: "원본 보기" },
    figma: [[5, 66, 44, 44, "EN"]],
    added: [
      [25, 130, 343, 300, "SE"],
      [25, 524, 343, 48, "SE"],
      [25, 741, 343, 48, "NONE"],
    ],
  },
  SE: {
    title: "사진 선택됨",
    group: "옷 등록",
    height: 852,
    pin: 728,
    figma: [
      [5, 66, 44, 44, "UP"],
      [25, 741, 343, 48, "AN"],
    ],
    added: [
      [25, 653, 166, 32, "UP"],
      [203, 653, 166, 32, "UP"],
    ],
  },
  AN: {
    title: "분석 중",
    group: "옷 등록",
    height: 852,
    auto: { to: "RE", ms: 1500 },
    added: [[5, 66, 44, 44, "BACK"]],
  },
  RE: {
    title: "분석 결과",
    group: "옷 등록",
    height: 852,
    pin: 728,
    figma: [[25, 741, 343, 48, "SS"]],
    added: [[5, 66, 44, 44, "BACK"]],
  },
  SS: {
    title: "저장 성공",
    group: "옷 등록",
    height: 852,
    pin: 729,
    figma: [
      [24, 742, 169, 48, "UP"],
      [201, 742, 169, 48, "CL"],
    ],
  },

  CL: {
    title: "내 옷장",
    group: "옷장",
    height: 852,
    pin: 702,
    added: [
      [5, 66, 44, 44, "H"],
      [25, 741, 168, 48, "NONE"],
      [201, 741, 168, 48, "ST"],
    ],
  },

  TD: {
    title: "오늘의 코디",
    group: "오늘의 코디",
    height: 852,
    figma: [[25, 390, 157, 274, "TDD"]],
    added: [
      [194, 390, 157, 252, "TDD"],
      [100, 64, 190, 48, "H"],
    ],
  },
  TDD: {
    title: "오늘의 코디 상세",
    group: "오늘의 코디",
    height: 852,
    pin: 729,
    figma: [
      [4, 65, 44, 44, "TD"],
      [201, 742, 169, 48, "TDW"],
    ],
    added: [[24, 742, 169, 48, "TD"]],
  },
  TDW: {
    title: "오늘 입음 기록됨",
    group: "오늘의 코디",
    height: 852,
    pin: 729,
    added: [back],
  },

  SEL: {
    title: "옷 선택",
    group: "코디 만들기",
    height: 852,
    pin: 702,
    figma: [[201, 741, 168, 48, "ST"]],
    added: [
      [5, 66, 44, 44, "BACK"],
      [25, 741, 168, 48, "NONE"],
    ],
  },
  ST: {
    title: "AI 스타일링",
    group: "코디 만들기",
    height: 1034,
    pin: 911,
    figma: [
      [4, 65, 44, 44, "SEL"],
      [24, 924, 169, 48, "T3"],
    ],
    added: [[201, 924, 169, 48, "MI"]],
  },
  T3: {
    title: "TOP 3 · 빠진 아이템",
    group: "코디 만들기",
    height: 1198,
    pin: 1075,
    figma: [
      [4, 65, 44, 44, "ST"],
      [41, 978, 311, 48, "MI"],
    ],
    added: [[24, 1088, 345, 48, "ST"]],
  },
  MI: {
    title: "빠진 아이템",
    group: "코디 만들기",
    height: 852,
    figma: [
      [4, 65, 44, 44, "T3"],
      [48, 467, 297, 48, "SH"],
    ],
  },
  SH: {
    title: "상품 보기",
    group: "코디 만들기",
    height: 852,
    figma: [[4, 65, 44, 44, "MI"]],
    added: [
      [24, 223, 345, 52, "NONE"],
      [24, 291, 345, 52, "NONE"],
      [24, 359, 345, 52, "NONE"],
    ],
  },

  SV: {
    title: "저장한 코디",
    group: "저장한 코디",
    height: 852,
    figma: [[41, 514, 244, 32, "SVD"]],
    added: [
      [4, 65, 44, 44, "BACK"],
      [285, 514, 67, 32, "NONE"],
    ],
  },
  SVD: {
    title: "저장한 코디 상세",
    group: "저장한 코디",
    height: 852,
    pin: 729,
    figma: [
      [4, 65, 44, 44, "SV"],
      [201, 742, 169, 48, "ST"],
    ],
    added: [[24, 742, 169, 48, "SV"]],
  },

  L0: {
    title: "링크 코디 시작 홈",
    group: "상품 링크로 코디하기",
    height: 852,
    pin: 745,
    figma: [[201, 488, 168, 140, "L1"]],
    added: homeLinks.filter((link) => link[4] !== "L1"),
  },
  L1: {
    title: "링크 입력",
    group: "상품 링크로 코디하기",
    height: 852,
    pin: 729,
    figma: [[24, 742, 345, 48, "L2"]],
    added: [back, [44, 427, 91, 40, "NONE"]],
  },
  L2: {
    title: "상품 확인",
    group: "상품 링크로 코디하기",
    height: 852,
    pin: 729,
    figma: [[24, 742, 345, 48, "L3"]],
    added: [back, [24, 665, 345, 48, "L1"]],
  },
  L3: {
    title: "코디 만드는 중",
    group: "상품 링크로 코디하기",
    height: 852,
    auto: { to: "L4", ms: 1200 },
    added: [back, [24, 788, 345, 48, "H"]],
  },
  L4: {
    title: "코디 결과",
    group: "상품 링크로 코디하기",
    height: 2030,
    pin: 1907,
    figma: [[24, 1920, 345, 48, "L5"]],
    added: [back, [24, 1835, 345, 48, "L1"]],
  },
  L5: {
    title: "판매처 이동 확인",
    group: "상품 링크로 코디하기",
    height: 852,
    figma: [[82, 452, 111, 40, "L4"]],
    added: [[201, 452, 111, 40, "NONE"]],
  },
};
