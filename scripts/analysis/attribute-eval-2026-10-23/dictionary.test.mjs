// 속성 사전 로더 검증. 실행: node --test "scripts/analysis/attribute-eval-2026-10-23/*.test.mjs"
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { applyFixes, asymmetricBoundaries, buildDictionary, findKeyRefs, parseGuide } from "./dictionary.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const sample = read(path.join(here, "fixtures/silhouette-rows.sample.json"));
const rowsOf = (j) => [...j.active, ...j.retired];
const R1 = path.join(here, "../../../docs/handoff/from-knowledge-lab/2026-10-22-silhouette/knowledge-lab-silhouette-2026-10-22_r1.json");

test("판단 기준을 포함·제외·판단 원칙으로 나누고, 라벨이 없으면 전체를 판단 원칙으로 둔다", () => {
  const g = parseGuide("포함: 가.\n제외: 나는 `A`.\n판단 원칙: 다.");
  assert.deepEqual([g.include, g.exclude, g.principle, g.structured], ["가.", "나는 `A`.", "다.", true]);
  const u = parseGuide("편안한 여유가 있지만 과장된 비례는 아님");
  assert.equal(u.structured, false);
  assert.equal(u.principle, "편안한 여유가 있지만 과장된 비례는 아님");
});

test("키 찾기: 백틱·맨 글자 모두 찾고, 'A라인'처럼 한국어명 일부는 세지 않으며 다른 영단어 안의 글자도 세지 않는다", () => {
  assert.deepEqual(findKeyRefs("무릎에서 퍼지면 `mermaid`, 피트 앤 플레어는 X로 구분", ["mermaid", "X", "A"]), ["mermaid", "X"]);
  assert.deepEqual(findKeyRefs("A라인 스커트", ["A"]), []);
  assert.deepEqual(findKeyRefs("Xmas boxy", ["X", "boxy"]), ["boxy"]);
});

test("예시 행·폐기값은 활성 목록에서 빠지고, 없는 값 참조(skater)와 폐기값 언급을 따로 찾는다", () => {
  const d = buildDictionary(rowsOf(sample));
  assert.equal(d.activeKeys.length, 17);
  assert.deepEqual(d.retiredKeys, ["I", "H", "volume"]);
  assert.deepEqual(d.byKey.circle.unknownRefs, ["skater"]);
  assert.deepEqual(d.byKey.mermaid.excludes.sort(), ["A", "flared"]);
});

test("경계 비대칭: mermaid가 flared를 제외 기준에 적었는데 flared에는 mermaid가 없으면 찾아낸다", () => {
  const asym = asymmetricBoundaries(buildDictionary(rowsOf(sample)));
  assert.ok(asym.some((x) => x.from === "mermaid" && x.to === "flared"));
  assert.ok(!asym.some((x) => x.from === "mermaid" && x.to === "A"), "A는 mermaid를 언급하므로 대칭");
});

test("수정안 덧씌우기: find 문장이 정확히 한 번 있을 때만 바꾸고, 원본 배열은 바꾸지 않는다", () => {
  const rows = rowsOf(sample);
  const before = rows.find((r) => r.value_key === "circle").guide;
  const { rows: fixed, problems } = applyFixes(rows, [
    { id: "T1", value_key: "circle", field: "guide", find: "skater를 우선 검토한다.", replace: "circle을 적용한다." },
    { id: "T2", value_key: "A", field: "guide", find: "없는 문장", replace: "x" },
  ]);
  assert.deepEqual(problems, [{ id: "T2", value_key: "A", count: 0 }]);
  assert.equal(rows.find((r) => r.value_key === "circle").guide, before);
  assert.deepEqual(buildDictionary(fixed).byKey.circle.unknownRefs, []);
});

test("실제 인계 r1(있을 때만): Lab 검토 결과(B1 skater 참조, B5 circle↔A·flared 단방향)를 같은 방식으로 재현", { skip: !fs.existsSync(R1) && "인계 사본 없음(추적되지 않는 파일)" }, () => {
  const d = buildDictionary(rowsOf(read(R1)), { otherKeys: ["slim", "fitted", "regular", "relaxed", "oversized", "semi-fitted", "compression"] });
  assert.equal(d.activeKeys.length, 17);
  assert.deepEqual(d.byKey.circle.unknownRefs, ["skater"]);
  const asym = asymmetricBoundaries(d).map((x) => `${x.from}->${x.to}`);
  for (const pair of ["circle->A", "circle->flared", "jogger->balloon", "barrel->balloon"]) assert.ok(asym.includes(pair), pair);
  assert.ok(d.entries.every((e) => e.guide.structured), "실루엣 17개는 모두 포함·제외·판단 원칙 형식");
});
