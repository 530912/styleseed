// 웹에서 Alert.alert를 브라우저 대화상자로 바꾸는 규칙 (2026-11 모바일 웹 MVP)
// 외부 모듈을 import하지 않는 순수 함수만 둔다(Node 테스트에서 직접 불러온다).
//
// react-native-web의 Alert.alert는 아무것도 하지 않는다(빈 함수). 그래서 웹에서는
// 로그인 오류·저장 실패 안내가 보이지 않고, 옷 삭제·계정 삭제처럼 확인 버튼이 있는 동작은 실행할 수 없다.
// - 버튼이 0~1개: window.alert로 알리고, 버튼이 있으면 그 onPress 실행
// - 버튼이 2개 이상: window.confirm. [확인] = 마지막 "취소 아닌" 버튼, [취소] = 취소 스타일 버튼(없으면 첫 버튼)

export type AlertButtonLike = {
  text?: string;
  style?: string;
  // onPress는 인자 없이 부른다(프롬프트 입력값은 웹 확인 창에서 지원하지 않음)
  onPress?: (...args: never[]) => void;
};

export type WebAlertPlan =
  | { kind: "alert"; text: string; onClose?: () => void }
  | { kind: "confirm"; text: string; onConfirm?: () => void; onCancel?: () => void };

const joinText = (title?: string, message?: string) =>
  [title, message].filter((part) => typeof part === "string" && part.length > 0).join("\n\n");

export const planWebAlert = (
  title?: string,
  message?: string,
  buttons?: AlertButtonLike[] | null,
): WebAlertPlan => {
  const list = Array.isArray(buttons) ? buttons.filter(Boolean) : [];

  const text = joinText(title, message);

  if (list.length <= 1) {
    const only = list[0];

    return { kind: "alert", text, onClose: only?.onPress ? () => only.onPress?.() : undefined };
  }

  const actions = list.filter((button) => button.style !== "cancel");

  const positive = actions[actions.length - 1] ?? list[list.length - 1];

  const negative = list.find((button) => button.style === "cancel") ?? list.find((button) => button !== positive);

  // 브라우저 확인 창의 버튼은 [확인]/[취소]로만 보이므로 어떤 동작인지 덧붙인다
  const hint =
    positive?.text && negative?.text ? `\n\n[확인] ${positive.text} · [취소] ${negative.text}` : "";

  return {
    kind: "confirm",
    text: `${text}${hint}`,
    onConfirm: positive?.onPress ? () => positive.onPress?.() : undefined,
    onCancel: negative?.onPress ? () => negative.onPress?.() : undefined,
  };
};
