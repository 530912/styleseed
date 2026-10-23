// 프롬프트 실험안·실행기 안전장치 검증(외부 호출 없음)
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { loadInputs, planRun, runArms } from "./gemini-runner.mjs";
import { BASELINE_PROMPT, buildPrompt, buildSchema, photoFitKeys } from "./prompt-variants.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const fx = (p) => path.join(here, "fixtures", p);
const inputs = loadInputs({ fitJson: fx("fit-rows.sample.json"), silhouetteJson: fx("silhouette-rows.sample.json") });
const { dicts, cfg, appEnums } = inputs;
const server = fs.readFileSync(path.join(here, "../../../backend/server.js"), "utf8");

test("A0 기준 프롬프트는 운영 서버 프롬프트 사본과 같다(서버가 바뀌면 이 테스트가 알려줌)", () => {
  for (const line of BASELINE_PROMPT.split("\n").map((l) => l.trim()).filter(Boolean)) assert.ok(server.includes(line), line);
  assert.equal(buildPrompt("A0", dicts, cfg), BASELINE_PROMPT);
});

test("A0 스키마 enum은 계약 app_values(=앱 상수·운영 스키마)와 같고, 실루엣 필드가 없다", () => {
  const s = buildSchema("A0", dicts, cfg, appEnums);
  assert.deepEqual(s.properties.fit.enum, appEnums.fit);
  assert.deepEqual(s.properties.color.enum, appEnums.color);
  assert.equal(s.properties.silhouette, undefined);
});

test("A1·A2·A3는 같은 스키마 → 판단 기준 문장의 효과만 비교된다", () => {
  const [a1, a2, a3] = ["A1", "A2", "A3"].map((a) => JSON.stringify(buildSchema(a, dicts, cfg, appEnums)));
  assert.equal(a1, a2);
  assert.equal(a2, a3);
});

test("사진으로 확인할 수 없는 핏 값(compression)은 enum에서 빠지고, 미확정(undetermined)이 있다", () => {
  const s = buildSchema("A1", dicts, cfg, appEnums);
  assert.ok(!s.properties.fit.enum.includes("compression"));
  assert.ok(s.properties.fit.enum.includes("undetermined"));
  assert.ok(!s.properties.fit.enum.includes("straight"), "폐기된 핏 값은 없음");
  assert.deepEqual(photoFitKeys(dicts.fit, cfg), dicts.fit.activeKeys.filter((k) => k !== "compression"));
  assert.ok(s.properties.silhouette.enum.includes("not_applicable"));
});

test("값과 문장은 사전에서만 온다: A3에는 모든 실루엣 키와 각 제외 기준이, A2에는 예시 문장이 없다", () => {
  const a3 = buildPrompt("A3", dicts, cfg);
  const a2 = buildPrompt("A2", dicts, cfg);
  for (const e of dicts.silhouette.entries) {
    assert.ok(a3.includes(`- ${e.key} (`), e.key);
    assert.ok(a2.includes(e.guide.exclude), `${e.key} 제외 기준`);
  }
  assert.ok(!a2.includes("예시:"));
  const a1 = buildPrompt("A1", dicts, cfg).length;
  assert.ok(a2.length > a1 && a3.length > a1); // 실제 사전에서는 A3 > A2(예시 문장). 자리표시 행에는 예시가 없다
  assert.ok(!a2.includes("compression ("), "사진으로 판단 못 하는 핏 값의 기준은 넣지 않음");
});

test("계획: 사진 수 × 팔 수 × 반복 = 호출 수, 이미지는 읽지 않는다", () => {
  const p = planRun({ manifest: Array.from({ length: 300 }, (_, i) => ({ garment_id: `G${i}`, image: "없는파일.jpg" })), arms: ["A1", "A2"], repeat: 2, inputs });
  assert.equal(p.plannedCalls, 1200);
});

test("주입한 모델 호출기로 실행 흐름 확인(실제 네트워크 없음)", async () => {
  const plan = planRun({ manifest: [{ garment_id: "P01", image: "p01.jpg" }], arms: ["A1"], inputs });
  const calls = [];
  const res = await runArms({ plan, manifest: [{ garment_id: "P01", image: "p01.jpg" }], imageDir: "/nowhere", callModel: async (req) => { calls.push(req.imagePath); return { ok: true, response: { fit: "slim" } }; } });
  assert.deepEqual(calls, ["/nowhere/p01.jpg"]);
  assert.equal(res["A1#1"].run.mode, "live");
});

const cli = (...extra) =>
  spawnSync(process.execPath, [path.join(here, "gemini-runner.mjs"), "--manifest", fx("pilot-manifest.csv"), "--fit-json", fx("fit-rows.sample.json"), "--silhouette-json", fx("silhouette-rows.sample.json"), "--arms", "A1,A2", ...extra], {
    encoding: "utf8",
    env: { ...process.env, GEMINI_API_KEY: "" },
  });

test("실행기 안전장치: 기본은 계획만 출력하고 끝난다", () => {
  const r = cli();
  assert.equal(r.status, 0);
  assert.equal(JSON.parse(r.stdout).plannedCalls, 24);
});

test("실행기 안전장치: --execute는 --max-calls가 없거나 예상 호출보다 작으면 거부(호출 전에 종료)", () => {
  assert.equal(cli("--execute").status, 2);
  const r = cli("--execute", "--max-calls", "10");
  assert.equal(r.status, 2);
  assert.match(r.stderr, /예상 호출 24회/);
  assert.equal(cli("--execute", "--max-calls", "24").status, 2, "키가 없으면 호출하지 않음");
});
