// Knowledge Lab 속성 사전 로더(비파괴). 앱 코드가 아니다.
// - 값 목록·정의·판단 기준은 인계 JSON(Lab attribute_values 행)에서 읽는다. 여기서 값을 하드코딩하지 않는다
// - 판단 기준(guide)의 "포함: / 제외: / 판단 원칙:"을 나누고, 제외 문장이 가리키는 다른 값을 찾는다
// - 경계가 한쪽에만 적힌 쌍(비대칭)과 없는 값 참조(skater 같은)를 찾아 Lab 검토 결과와 대조할 수 있게 한다
// - 승인 전 수정안(find/replace)을 메모리에서만 덧씌워 비교한다(원본 파일은 바꾸지 않음)

const LABELS = { include: "포함:", exclude: "제외:", principle: "판단 원칙:" };

/** guide 문자열 → { include, exclude, principle, structured } (라벨이 없으면 전체를 principle로) */
export const parseGuide = (guide = "") => {
  const text = String(guide).replace(/\r\n/g, "\n");
  const marks = Object.entries(LABELS)
    .map(([part, label]) => ({ part, label, at: text.indexOf(label) }))
    .filter((m) => m.at >= 0)
    .sort((a, b) => a.at - b.at);
  if (marks.length === 0) return { include: "", exclude: "", principle: text.trim(), structured: false };
  const out = { include: "", exclude: "", principle: "", structured: true };
  marks.forEach((m, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].at : text.length;
    out[m.part] = text.slice(m.at + m.label.length, end).trim();
  });
  return out;
};

const isAsciiWord = (ch) => /[A-Za-z0-9_-]/.test(ch ?? "");

/**
 * 문장에서 키를 찾는다. 백틱(`A`)은 그대로, 맨 글자는 영문 단어 경계로.
 * 한 글자 대문자 키(A·X·Y)는 "A라인"처럼 한국어명 일부로 쓰인 경우를 빼기 위해 바로 뒤가 "라인"이면 세지 않는다.
 */
export const findKeyRefs = (text, keys) => {
  const found = new Set();
  for (const key of keys) {
    if (text.includes("`" + key + "`")) { found.add(key); continue; }
    let from = 0;
    while (true) {
      const at = text.indexOf(key, from);
      if (at < 0) break;
      from = at + key.length;
      if (isAsciiWord(text[at - 1]) || isAsciiWord(text[at + key.length])) continue;
      if (key.length === 1 && text.startsWith("라인", at + 1)) continue;
      found.add(key);
      break;
    }
  }
  return [...found];
};

/** 문장 속 영문 낱말 중 알려진 키가 아닌 것(없는 값 참조 후보) */
export const findUnknownRefs = (text, knownWords) => {
  const words = text.match(/[A-Za-z][A-Za-z-]{2,}/g) ?? [];
  return [...new Set(words.filter((w) => !knownWords.has(w)))];
};

/**
 * rows: Lab attribute_values 행 배열(인계 JSON의 active/retired 또는 백업 행)
 * opts.otherKeys: 다른 속성의 키(예: 핏 값) — 실루엣 문장이 핏 값을 언급해도 '없는 값'으로 세지 않는다
 */
export const buildDictionary = (rows, { otherKeys = [] } = {}) => {
  const usable = rows.filter((r) => r.data_origin !== "example" && r.value_key !== "example");
  const active = usable.filter((r) => r.status !== "retired");
  const retired = usable.filter((r) => r.status === "retired");
  const activeKeys = active.map((r) => r.value_key);
  const retiredKeys = retired.map((r) => r.value_key);
  const known = new Set([...activeKeys, ...retiredKeys, ...otherKeys]);

  const entries = active.map((r) => {
    const guide = parseGuide(r.guide);
    const scan = guide.structured ? guide.exclude : guide.principle;
    return {
      key: r.value_key,
      ko: r.value_ko,
      status: r.status,
      dataOrigin: r.data_origin,
      definition: (r.definition ?? "").trim(),
      example: (r.example ?? "").trim(),
      note: (r.note ?? "").trim(),
      guide,
      excludes: findKeyRefs(scan, activeKeys.filter((k) => k !== r.value_key)),
      mentionsRetired: findKeyRefs(`${r.guide ?? ""} ${r.note ?? ""}`, retiredKeys),
      unknownRefs: findUnknownRefs(`${r.guide ?? ""}`, known),
    };
  });
  return { activeKeys, retiredKeys, entries, byKey: Object.fromEntries(entries.map((e) => [e.key, e])) };
};

/** a의 제외 기준이 b를 가리키는데 b의 판단 기준 어디에도 a가 없으면 비대칭 */
export const asymmetricBoundaries = (dict) => {
  const out = [];
  for (const e of dict.entries) {
    for (const other of e.excludes) {
      const o = dict.byKey[other];
      const otherText = `${o.guide.include} ${o.guide.exclude} ${o.guide.principle}`;
      if (!findKeyRefs(otherText, [e.key]).length) out.push({ from: e.key, to: other });
    }
  }
  return out;
};

/**
 * 승인 전 수정안(Lab scripts/data/*-fixes-*.json의 fixes 형식)을 메모리에서만 적용.
 * find 문장이 정확히 한 번 나와야 한다(0번이면 원문이 바뀐 것 → 오류로 알림)
 */
export const applyFixes = (rows, fixes) => {
  const copy = rows.map((r) => ({ ...r }));
  const problems = [];
  for (const f of fixes) {
    const row = copy.find((r) => r.value_key === f.value_key);
    const text = row?.[f.field];
    const count = typeof text === "string" ? text.split(f.find).length - 1 : 0;
    if (count !== 1) { problems.push({ id: f.id, value_key: f.value_key, count }); continue; }
    row[f.field] = text.replace(f.find, f.replace);
  }
  return { rows: copy, problems };
};
