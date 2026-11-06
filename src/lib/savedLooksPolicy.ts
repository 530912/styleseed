// 추천 코디 저장 규칙 — 저장소와 분리한 순수 함수 (2026-11 사용자 조사 1차 범위)
// 기기에만 저장한다(DB 변경 없음). 코디는 옷 ID 조합으로 구분하고,
// 지금 옷장에 모든 옷이 있는 코디만 보여준다 → 같은 기기를 다른 계정이 써도 서로의 코디가 보이지 않는다.

export type SavedLookSource = "styling" | "looks";

export type SavedLook = {
  key: string;
  itemIds: number[];
  baseItemId: number | null;
  source: SavedLookSource;
  savedAt: string;
};

// 기기에 남길 최대 개수. 넘으면 오래된 것부터 버린다
export const MAX_SAVED_LOOKS = 50;

// 같은 옷 조합이면 순서와 상관없이 같은 코디
export const getLookKey = (itemIds: number[]) =>
  [...itemIds].sort((a, b) => a - b).join("-");

export const isLookSaved = (looks: SavedLook[], itemIds: number[]) => {
  const key = getLookKey(itemIds);

  return looks.some((look) => look.key === key);
};

// 저장돼 있으면 지우고, 없으면 맨 앞에 추가한다
export const toggleSavedLook = (
  looks: SavedLook[],
  input: Omit<SavedLook, "key">,
  max = MAX_SAVED_LOOKS,
): { looks: SavedLook[]; saved: boolean } => {
  const key = getLookKey(input.itemIds);

  if (looks.some((look) => look.key === key)) {
    return { looks: looks.filter((look) => look.key !== key), saved: false };
  }

  return {
    looks: [{ ...input, key, itemIds: [...input.itemIds] }, ...looks].slice(0, max),
    saved: true,
  };
};

// 저장한 코디 → 지금 옷장의 옷. 옷이 하나라도 없으면(삭제·다른 계정) 빼고 보여준다
export const resolveSavedLooks = <T extends { id: number }>(
  looks: SavedLook[],
  clothes: T[],
) => {
  const byId = new Map(clothes.map((clothing) => [clothing.id, clothing]));

  return looks.flatMap((look) => {
    const items = look.itemIds.map((id) => byId.get(id));

    return items.every((item): item is T => item !== undefined)
      ? [{ look, items }]
      : [];
  });
};
