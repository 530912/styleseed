// 추천 코디 저장(2026-11 사용자 조사 1차 범위): 같은 조합 판정, 토글, 다른 계정·삭제된 옷 숨김
import test from "node:test";
import assert from "node:assert/strict";

import {
  getLookKey,
  isLookSaved,
  resolveSavedLooks,
  toggleSavedLook,
} from "../savedLooksPolicy.ts";

const input = (itemIds, source = "styling") => ({
  itemIds,
  baseItemId: itemIds[0],
  source,
  savedAt: "2026-11-09T10:00:00.000Z",
});

test("옷 순서가 달라도 같은 코디로 본다", () => {
  assert.equal(getLookKey([3, 1, 2]), getLookKey([1, 2, 3]));
  assert.notEqual(getLookKey([1, 2]), getLookKey([1, 2, 3]));
});

test("저장 → 다시 누르면 해제, 다른 화면에서 저장해도 같은 조합이면 하나", () => {
  let result = toggleSavedLook([], input([1, 2, 3]));
  assert.equal(result.saved, true);
  assert.equal(isLookSaved(result.looks, [3, 2, 1]), true);

  result = toggleSavedLook(result.looks, input([2, 1, 3], "looks"));
  assert.equal(result.saved, false);
  assert.equal(result.looks.length, 0);
});

test("최대 개수를 넘으면 오래된 것부터 버린다", () => {
  let looks = [];
  for (let i = 0; i < 5; i += 1) looks = toggleSavedLook(looks, input([i, 100 + i]), 3).looks;
  assert.equal(looks.length, 3);
  assert.equal(looks[0].key, getLookKey([4, 104]));
});

test("지금 옷장에 없는 옷이 섞인 코디(삭제·다른 계정)는 보여주지 않는다", () => {
  let looks = toggleSavedLook([], input([1, 2])).looks;
  looks = toggleSavedLook(looks, input([1, 9])).looks;

  const closet = [{ id: 1, name: "a" }, { id: 2, name: "b" }];
  const resolved = resolveSavedLooks(looks, closet);

  assert.equal(resolved.length, 1);
  assert.deepEqual(resolved[0].items.map((item) => item.id), [1, 2]);

  const otherAccount = [{ id: 50 }, { id: 51 }];
  assert.equal(resolveSavedLooks(looks, otherAccount).length, 0);
});
