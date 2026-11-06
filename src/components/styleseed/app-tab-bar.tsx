import { router, usePathname } from "expo-router";

import { create } from "zustand";

import { isSignedIn } from "../../lib/sessionPolicy";

import { supabase } from "../../lib/supabase";

import { BottomTabBar, type HomeTab } from "./home-blocks";

// 앱 전체 하단 탭바 (오늘 / 옷장 / 코디 / 마이)
// 탭 구조는 아직 확정 전이라 "탭바가 있다"는 전제로 모든 화면에 먼저 붙인다.
// 코디·마이 탭 루트 화면은 아직 없어 비슷한 기존 화면(/looks, /account)으로 연결한다.

// 인트로가 재생되는 동안에는 탭바를 숨긴다 (index.tsx가 갱신)
type IntroStore = {
  introActive: boolean;
  setIntroActive: (active: boolean) => void;
};

export const useIntroStore = create<IntroStore>((set) => ({
  introActive: true,
  setIntroActive: (introActive) => set({ introActive }),
}));

// 탭바를 숨기는 경로: 첫 실행 안내, 진행자 화면, 데모·프로토타입 전용 화면
const HIDDEN_PATHS = [
  "/onboarding",
  "/prototype",
  "/research",
  "/demo",
  "/ideal-style",
  "/core-look",
  "/core-match",
  "/core-shop",
];

// 화면이 어느 탭에 속하는지. 목록에 없으면 "오늘"
const TAB_BY_PATH: Record<string, HomeTab> = {
  "/": "today",
  "/today": "today",
  "/closet": "closet",
  "/item": "closet",
  "/edit-item": "closet",
  "/upload": "closet",
  "/analyze": "closet",
  "/ai-consent": "closet",
  "/save-success": "closet",
  "/styling": "styling",
  "/looks": "styling",
  "/missing": "styling",
  "/shop": "styling",
  "/saved-looks": "styling",
  "/saved-look": "styling",
  "/account": "my",
  "/delete-account": "my",
  "/account-deleted": "my",
  "/login": "my",
  "/signup": "my",
};

export function useTabBarVisible() {
  const pathname = usePathname();

  const introActive = useIntroStore((state) => state.introActive);

  if (HIDDEN_PATHS.includes(pathname)) {
    return false;
  }

  return !(pathname === "/" && introActive);
}

const openCloset = async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!isSignedIn(session)) {
    router.push({ pathname: "/login", params: { redirectTo: "closet" } });

    return;
  }

  router.navigate("/closet");
};

export function AppTabBar() {
  const pathname = usePathname();

  const active = TAB_BY_PATH[pathname] ?? "today";

  const handleSelect = (tab: HomeTab) => {
    if (tab === "today") {
      router.navigate("/");
    } else if (tab === "closet") {
      openCloset();
    } else if (tab === "styling") {
      router.navigate("/looks");
    } else {
      router.navigate("/account");
    }
  };

  return <BottomTabBar active={active} onSelect={handleSelect} />;
}
