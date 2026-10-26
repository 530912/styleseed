// 2026-11 모바일 웹: Alert.alert → 브라우저 alert·confirm 변환 규칙(WA-01 ~ 04)
import test from "node:test";
import assert from "node:assert/strict";

import { planWebAlert } from "../webAlertPolicy.ts";

test("WA-01 버튼 없음: 제목·내용을 alert로", () => {
  const plan = planWebAlert("저장 실패", "잠시 후 다시 시도해주세요.");

  assert.equal(plan.kind, "alert");
  assert.equal(plan.text, "저장 실패\n\n잠시 후 다시 시도해주세요.");
  assert.equal(plan.onClose, undefined);
});

test("WA-02 버튼 1개: alert 닫은 뒤 그 동작 실행", () => {
  let pressed = 0;

  const plan = planWebAlert("완료", undefined, [{ text: "확인", onPress: () => (pressed += 1) }]);

  assert.equal(plan.kind, "alert");
  assert.equal(plan.text, "완료");
  plan.onClose?.();
  assert.equal(pressed, 1);
});

test("WA-03 취소 + 삭제(옷장·계정 삭제): confirm, 확인=삭제, 취소=취소", () => {
  const calls = [];

  const plan = planWebAlert("옷장에서 삭제할까요?", "되돌릴 수 없어요.", [
    { text: "취소", style: "cancel", onPress: () => calls.push("cancel") },
    { text: "삭제", style: "destructive", onPress: () => calls.push("delete") },
  ]);

  assert.equal(plan.kind, "confirm");
  assert.match(plan.text, /\[확인\] 삭제 · \[취소\] 취소/);
  plan.onConfirm?.();
  plan.onCancel?.();
  assert.deepEqual(calls, ["delete", "cancel"]);
});

test("WA-04 나중에(cancel) + 다시 시도: 확인=다시 시도", () => {
  const calls = [];

  const plan = planWebAlert("로그인은 완료됐어요", "옷을 저장하지 못했어요.", [
    { text: "나중에", style: "cancel", onPress: () => calls.push("later") },
    { text: "다시 시도", onPress: () => calls.push("retry") },
  ]);

  plan.onConfirm?.();
  assert.deepEqual(calls, ["retry"]);

  const noCancelStyle = planWebAlert("선택", "", [
    { text: "A", onPress: () => calls.push("A") },
    { text: "B", onPress: () => calls.push("B") },
  ]);

  noCancelStyle.onConfirm?.();
  noCancelStyle.onCancel?.();
  assert.deepEqual(calls, ["retry", "B", "A"]);
});
