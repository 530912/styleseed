// 프롬프트 비교 실험 실행기. 기본은 계획만 세운다(dry-run, 외부 호출 없음).
//
//   계획(기본):  node gemini-runner.mjs --manifest <images.csv> --fit-json <핏 행 JSON> --silhouette-json <실루엣 인계 JSON> --arms A1,A2 [--repeat 1]
//   기록 재생:   ... --mock <dir>        (dir/<arm>/<garment_id>.json 응답을 읽어 결과 파일을 만든다)
//   실제 호출:   ... --execute --max-calls N   (유료일 수 있음 — PO 승인 후에만. 예상 호출 수가 N을 넘으면 거부)
//
// 실제 호출은 운영 서버를 거치지 않고 Gemini에 직접 보낸다(운영 서버 프롬프트를 바꾸지 않기 위해).
// 모델·thinkingLevel은 운영 서버와 같은 환경변수(GEMINI_MODEL, GEMINI_THINKING_LEVEL)를 쓰고 기본값도 같다.
// API 키는 환경변수에서만 읽고 출력하지 않는다. 결과 파일에는 이미지 데이터를 넣지 않는다.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildDictionary } from "./dictionary.mjs";
import { parseCsv } from "./eval-core.mjs";
import { buildPrompt, buildSchema, promptStats } from "./prompt-variants.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");

export const loadInputs = ({ fitJson, silhouetteJson, cfgPath = path.join(here, "compat-draft.json"), contractPath = path.join(root, "data/fkd/contract/fkd-contract-v0.1.json") }) => {
  const rowsOf = (file) => {
    const j = JSON.parse(fs.readFileSync(file, "utf8"));
    return Array.isArray(j) ? j : [...(j.active ?? []), ...(j.retired ?? [])];
  };
  const fitRows = rowsOf(fitJson);
  const fit = buildDictionary(fitRows);
  const silhouette = buildDictionary(rowsOf(silhouetteJson), { otherKeys: [...fit.activeKeys, ...fit.retiredKeys] });
  const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
  const appValues = JSON.parse(fs.readFileSync(contractPath, "utf8")).app_compat.app_values;
  const appEnums = { ...appValues, subCategory: Object.values(appValues.subCategory).flat() };
  return { dicts: { fit, silhouette }, cfg, appEnums };
};

const sha = (text) => crypto.createHash("sha256").update(text).digest("hex").slice(0, 12);

/** 팔별 요청 계획(프롬프트·스키마 해시와 크기, 호출 수). 이미지는 읽지 않는다 */
export const planRun = ({ manifest, arms, repeat = 1, inputs }) => {
  const perArm = arms.map((arm) => {
    const prompt = buildPrompt(arm, inputs.dicts, inputs.cfg);
    const schema = buildSchema(arm, inputs.dicts, inputs.cfg, inputs.appEnums);
    return { arm, promptSha: sha(prompt), schemaSha: sha(JSON.stringify(schema)), stats: promptStats(prompt), prompt, schema };
  });
  return { images: manifest.length, arms: perArm, repeat, plannedCalls: manifest.length * arms.length * repeat };
};

// 응답 스키마 enum을 평가 필드 이름으로
export const enumsFor = (schema) => ({
  category: schema.properties.category?.enum,
  subcategory: schema.properties.subCategory?.enum,
  main_color: schema.properties.color?.enum,
  fit: schema.properties.fit?.enum,
  silhouette: schema.properties.silhouette?.enum,
});

const callGemini = async ({ prompt, schema, imagePath }) => {
  const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";
  const thinkingLevel = process.env.GEMINI_THINKING_LEVEL || "minimal";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: "image/jpeg", data: fs.readFileSync(imagePath).toString("base64") } }] }],
      generationConfig: { responseMimeType: "application/json", thinkingConfig: { thinkingLevel }, responseSchema: schema },
    }),
  });
  const data = await res.json();
  if (!res.ok) return { ok: false, status: res.status, error: data?.error?.status ?? "error" };
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  try { return { ok: true, response: JSON.parse(text), usage: data.usageMetadata ?? null, model }; }
  catch { return { ok: false, error: "parse_error" }; }
};

/** 실행(재생 또는 실제 호출). callModel을 바꿔 끼워 테스트한다 */
export const runArms = async ({ plan, manifest, imageDir, mockDir, callModel = callGemini, repeat = 1 }) => {
  const results = {};
  for (const a of plan.arms) {
    for (let r = 0; r < repeat; r++) {
      const items = [];
      for (const row of manifest) {
        if (mockDir) {
          const f = path.join(mockDir, a.arm, `${row.garment_id}.json`);
          items.push(fs.existsSync(f) ? { garment_id: row.garment_id, ok: true, response: JSON.parse(fs.readFileSync(f, "utf8")) } : { garment_id: row.garment_id, ok: false, error: "no_recording" });
        } else {
          items.push({ garment_id: row.garment_id, ...(await callModel({ prompt: a.prompt, schema: a.schema, imagePath: path.join(imageDir, row.image) })) });
        }
      }
      results[`${a.arm}#${r + 1}`] = { run: { arm: a.arm, repeat: r + 1, promptSha: a.promptSha, schemaSha: a.schemaSha, mode: mockDir ? "mock" : "live", createdAt: new Date().toISOString() }, items };
    }
  }
  return results;
};

const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? fallback : process.argv[i + 1] ?? true;
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = parseCsv(fs.readFileSync(arg("manifest"), "utf8"));
  const inputs = loadInputs({ fitJson: arg("fit-json"), silhouetteJson: arg("silhouette-json") });
  const arms = String(arg("arms", "A1,A2")).split(",");
  const repeat = Number(arg("repeat", 1));
  const plan = planRun({ manifest, arms, repeat, inputs });
  console.log(JSON.stringify({ images: plan.images, plannedCalls: plan.plannedCalls, arms: plan.arms.map(({ arm, promptSha, schemaSha, stats }) => ({ arm, promptSha, schemaSha, ...stats })) }, null, 2));

  const execute = process.argv.includes("--execute");
  const mockDir = arg("mock");
  if (!execute && !mockDir) process.exit(0); // 기본: 계획만
  if (execute) {
    const max = Number(arg("max-calls", 0));
    if (!max || plan.plannedCalls > max) {
      console.error(`거부: 예상 호출 ${plan.plannedCalls}회가 --max-calls ${max || "(없음)"}를 넘습니다. PO 승인 후 호출 수를 명시하세요.`);
      process.exit(2);
    }
    if (!process.env.GEMINI_API_KEY) { console.error("GEMINI_API_KEY가 없습니다."); process.exit(2); }
  }
  const out = arg("out", "attribute-eval-results.json");
  const results = await runArms({ plan, manifest, imageDir: arg("image-dir", "."), mockDir, repeat });
  fs.writeFileSync(out, JSON.stringify(results, null, 2));
  console.log(`결과: ${out}`);
}
