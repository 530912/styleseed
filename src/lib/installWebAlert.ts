import { Alert, Platform } from "react-native";

import { runWebAlert, type AlertButtonLike } from "./webAlertPolicy";

// 웹에서만 Alert.alert를 브라우저 대화상자로 바꾼다(앱 시작 시 한 번). 네이티브는 그대로
export const installWebAlert = () => {
  if (Platform.OS !== "web" || typeof window === "undefined") {
    return;
  }

  Alert.alert = (title: string, message?: string, buttons?: AlertButtonLike[]) =>
    runWebAlert(title, message, buttons, {
      alert: (text) => window.alert(text),
      confirm: (text) => window.confirm(text),
    });
};
