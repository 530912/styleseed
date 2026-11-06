import { createContext, useContext } from "react";

// 앱 하단 탭바가 보이는지. Screen이 하단 안전 영역을 탭바에 맡길 때 쓴다
// (ui.tsx ↔ app-tab-bar.tsx 순환 참조를 피하려고 따로 둔다)
export const TabBarContext = createContext(false);

export const useHasTabBar = () => useContext(TabBarContext);
