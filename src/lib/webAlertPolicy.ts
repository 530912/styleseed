// 웹에서 Alert.alert 대신 쓰는 규칙 (2026-11 모바일 웹 MVP)
// react-native-web의 Alert.alert는 아무것도 하지 않는다 → 웹에서는 삭제 확인·로그인 오류가 보이지 않았다.
// 브라우저 기본 대화상자(confirm·alert)로 바꾼다. 외부 모듈을 import하지 않는다(Node 테스트용).

export type AlertButtonLike = {
  text?: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
};

export const formatAlertText = (title: string, message?: string) =>
  message ? `${title}\n\n${message}` : title;

// 버튼이 2개 이상이면 확인 창: [확인] = 마지막 취소가 아닌 버튼, [취소] = 취소 버튼(없으면 첫 버튼)
export const runWebAlert = (
  title: string,
  message: string | undefined,
  buttons: AlertButtonLike[] | undefined,
  dialogs: { alert: (text: string) => void; confirm: (text: string) => boolean },
) => {
  const text = formatAlertText(title, message);

  const list = buttons ?? [];

  if (list.length <= 1) {
    dialogs.alert(text);

    list[0]?.onPress?.();

    return;
  }

  const cancel = list.find((button) => button.style === "cancel") ?? list[0];

  const actions = list.filter((button) => button !== cancel);

  const action = actions[actions.length - 1];

  const label = action?.text ? `\n\n[확인] ${action.text} · [취소] ${cancel.text ?? "취소"}` : "";

  if (dialogs.confirm(`${text}${label}`)) {
    action?.onPress?.();
  } else {
    cancel.onPress?.();
  }
};
