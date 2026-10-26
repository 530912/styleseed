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

// 연구 모드: 사용자 조사 빌드에서만 켠다(EXPO_PUBLIC_RESEARCH_MODE=true).
// 켜지면 진행자 화면(/research, 홈 로고 길게 누르기)과 기기 내 이벤트 기록이 동작한다.
// 꺼져 있으면 이벤트를 전혀 남기지 않는다.
export const RESEARCH_MODE = isPrototypeEnabled(
  process.env.EXPO_PUBLIC_RESEARCH_MODE,
);

// 카메라 촬영 버튼: 빌드(EAS)에서는 카메라 권한 문구(app.json expo-image-picker cameraPermission)를
// 넣은 빌드에서만 EXPO_PUBLIC_CAMERA_ENABLED=true로 켠다. 문구 없이 카메라를 열면 iOS 앱이 종료된다.
// Expo Go는 자체 권한 문구가 있어 이 값과 상관없이 쓸 수 있다(src/lib/camera.ts).
export const CAMERA_ENABLED_IN_BUILD = isPrototypeEnabled(
  process.env.EXPO_PUBLIC_CAMERA_ENABLED,
);
