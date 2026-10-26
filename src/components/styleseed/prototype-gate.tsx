import { Redirect } from "expo-router";

import type { ReactNode } from "react";

import { SHOW_PROTOTYPES } from "../../lib/featureFlags";

// 프로토타입 화면을 주소(딥링크 포함)로 직접 열어도 꺼져 있으면 홈으로 보낸다
export function PrototypeGate({ children }: { children: ReactNode }) {
  if (!SHOW_PROTOTYPES) {
    return <Redirect href="/" />;
  }

  return children;
}
