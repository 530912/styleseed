// 모바일 웹 MVP: react-native-web Alert.alert 대체(삭제 확인·로그인 오류가 웹에서도 보이게)
import test from "node:test";
import assert from "node:assert/strict";

import { formatAlertText, runWebAlert } from "../webAlertPolicy.ts";

const fakeDialogs = (confirmResult) => {
  const shown = [];
  return {
    shown,
    alert: (text) => shown.push(["alert", text]),
    confirm: (text) => {
      shown.push(["confirm", text]);
      return confirmResult;
    },
  };
};

test("버튼이 없거나 1개면 알림 창, 버튼 동작도 실행", () => {
  const dialogs = fakeDialogs(true);
  let pressed = 0;

  runWebAlert("로그인 실패", "이메일 또는 비밀번호가 올바르지 않아요.", undefined, dialogs);
  runWebAlert("완료", undefined, [{ text: "확인", onPress: () => (pressed += 1) }], dialogs);

  assert.deepEqual(dialogs.shown.map(([kind]) => kind), ["alert", "alert"]);
  assert.equal(dialogs.shown[0][1], "로그인 실패\n\n이메일 또는 비밀번호가 올바르지 않아요.");
  assert.equal(pressed, 1);
});

test("취소 + 삭제: 확인을 누르면 삭제, 취소를 누르면 취소 버튼 동작", () => {
  for (const [answer, expected] of [[true, "delete"], [false, "cancel"]]) {
    const dialogs = fakeDialogs(answer);
    const calls = [];

    runWebAlert(
      "옷장에서 삭제할까요?",
      "삭제하면 저장된 옷 정보와 이미지가 모두 삭제됩니다.",
      [
        { text: "취소", style: "cancel", onPress: () => calls.push("cancel") },
        { text: "삭제", style: "destructive", onPress: () => calls.push("delete") },
      ],
      dialogs,
    );

    assert.deepEqual(calls, [expected]);
    assert.match(dialogs.shown[0][1], /\[확인\] 삭제 · \[취소\] 취소/);
  }
});

test("취소 스타일이 없으면 첫 버튼을 취소로 본다(나중에 / 다시 시도)", () => {
  const dialogs = fakeDialogs(true);
  const calls = [];

  runWebAlert("저장 실패", "다시 시도할까요?", [
    { text: "나중에", onPress: () => calls.push("later") },
    { text: "다시 시도", onPress: () => calls.push("retry") },
  ], dialogs);

  assert.deepEqual(calls, ["retry"]);
  assert.equal(formatAlertText("제목"), "제목");
});
