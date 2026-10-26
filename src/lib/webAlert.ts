import { Alert, Platform, type AlertButton } from "react-native";

import { planWebAlert } from "./webAlertPolicy";

let installed = false;

// 웹에서만 Alert.alert를 브라우저 alert·confirm으로 바꾼다(규칙: webAlertPolicy.ts).
// 앱 시작 시 한 번 호출한다(src/app/_layout.tsx). 네이티브에서는 아무것도 하지 않는다
export const installWebAlert = () => {
  if (installed || Platform.OS !== "web" || typeof window === "undefined") {
    return;
  }

  installed = true;

  Alert.alert = (title: string, message?: string, buttons?: AlertButton[]) => {
    const plan = planWebAlert(title, message, buttons);

    if (plan.kind === "alert") {
      window.alert(plan.text);

      plan.onClose?.();

      return;
    }

    if (window.confirm(plan.text)) {
      plan.onConfirm?.();
    } else {
      plan.onCancel?.();
    }
  };
};
