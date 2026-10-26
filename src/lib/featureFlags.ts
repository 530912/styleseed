// 화면 노출 설정 (2026-11 사용자 조사 MVP)
// 외부 모듈을 import하지 않는 순수 값만 둔다(Node 테스트에서 직접 불러온다).
//
// 프로토타입 화면: /demo(영상 촬영용), IDEAL STYLE · BETA(/ideal-style → /core-match → /core-look → /core-shop).
// 고정 데모 규칙(src/data/coreDemo.ts)과 샘플 상품으로 동작하므로 사용자 조사·배포 빌드에서는 숨긴다.
// 영상 촬영처럼 필요할 때만 EXPO_PUBLIC_SHOW_PROTOTYPES=true로 켠다(Expo는 이 값을 번들에 넣는다).
export const isPrototypeEnabled = (value: string | undefined) => value === "true";

export const SHOW_PROTOTYPES = isPrototypeEnabled(
  process.env.EXPO_PUBLIC_SHOW_PROTOTYPES,
);
