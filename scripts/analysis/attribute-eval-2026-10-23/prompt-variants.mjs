// Gemini 의류 분석 프롬프트·응답 스키마 실험안(비파괴). 운영 서버(backend/server.js, Claude B 영역)는 바꾸지 않는다.
// 실험 팔(arm):
//   A0 운영 그대로: 운영 프롬프트 + 운영 스키마(앱 enum). 기존 필드의 기준선
//   A1 스키마만: 운영 프롬프트 + 새 스키마(Lab 핏·실루엣 키, undetermined). 판단 기준 문장 없음
//   A2 기준 선택 제공: A1 + 의류 묶음별 실루엣 후보와 판단 기준(정의·제외 기준·판단 원칙)
//   A3 기준 전체 제공: A1 + 모든 값의 정의·포함·제외·판단 원칙·예시
// 판단 기준의 효과 = A2·A3 vs A1(같은 스키마). 스키마 변경의 영향(회귀) = A1 vs A0
// 값·문장은 모두 인계 사전(buildDictionary)에서 온다.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { allowedSilhouettes } from "./silhouette-compat.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
export const BASELINE_PROMPT = fs.readFileSync(path.join(here, "prompts/baseline.txt"), "utf8");

export const ARMS = ["A0", "A1", "A2", "A3"];
export const UNDETERMINED = "undetermined";
export const NOT_APPLICABLE = "not_applicable";

const GROUP_LABEL = {
  pants: "pants / trousers / jeans / shorts / leggings / jumpsuit",
  skirt: "skirts",
  one_piece: "dresses and jumpsuits",
  outer: "outerwear",
  top: "tops",
};

const entryBlock = (e, mode) => {
  const lines = [`- ${e.key} (${e.ko}): ${e.definition}`];
  if (mode === "full") {
    if (e.guide.include) lines.push(`  포함: ${e.guide.include}`);
    if (e.guide.exclude) lines.push(`  제외: ${e.guide.exclude}`);
    if (e.guide.principle) lines.push(`  판단 원칙: ${e.guide.principle}`);
    if (e.example) lines.push(`  예시: ${e.example}`);
  } else if (mode === "boundary") {
    if (e.guide.exclude) lines.push(`  제외: ${e.guide.exclude}`);
    if (e.guide.principle) lines.push(`  판단 원칙: ${e.guide.principle}`);
  }
  return lines.join("\n");
};

/** 텍스트로만 확인할 수 있는 값(예: compression)은 사진 분석 enum에서 뺀다 */
export const photoFitKeys = (fitDict, cfg) => fitDict.activeKeys.filter((k) => !cfg.observability.fit_values_requiring_text.includes(k));

const ABSTAIN_RULES = `
Uncertainty rules (fit and silhouette):
- If the photo does not show enough evidence, answer "${UNDETERMINED}". Do not guess.
- Fit describes ease relative to the body. If the garment is not worn (flat lay, hanger, ghost mannequin) and the ease cannot be judged, answer "${UNDETERMINED}" for fit.
- Never infer compression or other functional claims from tightness alone. Compression is not an allowed answer from a photo.
- Silhouette is "${NOT_APPLICABLE}" only for shoes, bags and accessories.
- Fit and silhouette are separate: fit is ease, silhouette is the outline shape. Leg shapes such as straight or wide are silhouettes, not fits.
`;

/**
 * arm별 프롬프트 텍스트
 * dicts: { fit: buildDictionary(...), silhouette: buildDictionary(...) }
 */
export const buildPrompt = (arm, dicts, cfg) => {
  if (arm === "A0") return BASELINE_PROMPT;
  if (arm === "A1") return `${BASELINE_PROMPT}\n${ABSTAIN_RULES}`;

  const fitMode = "full"; // 핏은 7개뿐이라 두 안 모두 전체 기준을 준다
  const fitBlock = dicts.fit.entries.filter((e) => photoFitKeys(dicts.fit, cfg).includes(e.key)).map((e) => entryBlock(e, fitMode)).join("\n");

  let silBlock;
  if (arm === "A3") {
    silBlock = dicts.silhouette.entries.map((e) => entryBlock(e, "full")).join("\n");
  } else {
    // A2: 묶음별 후보 목록 + 값마다 정의·제외 기준·판단 원칙은 한 번만(예시·포함 문장은 뺌)
    const groups = Object.keys(cfg.garment_groups).map((g) => {
      const keys = dicts.silhouette.activeKeys.filter((k) => (cfg.silhouette_scope[k] ?? []).includes(g));
      return `- ${GROUP_LABEL[g] ?? g}: ${keys.join(", ")}`;
    });
    silBlock = [
      "Candidate silhouettes by garment type (choose within the matching group first):",
      ...groups,
      "",
      ...dicts.silhouette.entries.map((e) => entryBlock(e, "boundary")),
    ].join("\n");
  }
  const priority = cfg.precedence
    .map((p) => `- ${p.win} over ${[].concat(p.over).join("/")}${p.when === "always" ? "" : " (only for one-piece garments where upper-body width and waist contraction form the outline)"}`)
    .join("\n");

  return `${BASELINE_PROMPT}
${ABSTAIN_RULES}
The following criteria come from the STYLESEED Knowledge Lab attribute dictionary (Korean, quoted verbatim). Apply the 제외 (exclusion) rules before choosing a value.

[FIT]
${fitBlock}

[SILHOUETTE]
${silBlock}

When two silhouettes both seem to apply, use this priority:
${priority}
`;
};

/** 2단계 방식(대분류를 먼저 알고 있을 때)의 실루엣 기준 — 해당 묶음 후보만 */
export const buildScopedSilhouetteBlock = (item, dicts, cfg) => {
  const keys = allowedSilhouettes(item, cfg, dicts.silhouette.activeKeys);
  return keys.map((k) => entryBlock(dicts.silhouette.byKey[k], "full")).join("\n");
};

/** arm별 응답 스키마. A0은 운영 스키마와 같은 필드·enum(appEnums로 받음) */
export const buildSchema = (arm, dicts, cfg, appEnums, { withRunnerUp = true } = {}) => {
  const base = {
    category: { type: "string", enum: appEnums.category },
    subCategory: { type: "string", enum: appEnums.subCategory },
    color: { type: "string", enum: appEnums.color },
    colorTone: { type: "string", enum: appEnums.colorTone },
    material: { type: "string", enum: appEnums.material },
    box_2d: { type: "array", items: { type: "integer" } },
  };
  if (arm === "A0") {
    return { type: "object", properties: { ...base, fit: { type: "string", enum: appEnums.fit } }, required: [...Object.keys(base), "fit"] };
  }
  const props = {
    ...base,
    fit: { type: "string", enum: [...photoFitKeys(dicts.fit, cfg), UNDETERMINED] },
    silhouette: { type: "string", enum: [...dicts.silhouette.activeKeys, UNDETERMINED, NOT_APPLICABLE] },
  };
  if (withRunnerUp) props.silhouette_runner_up = { type: "string", enum: [...dicts.silhouette.activeKeys, "none"] };
  return { type: "object", properties: props, required: Object.keys(props) };
};

export const promptStats = (text) => ({
  chars: text.length,
  hangul: (text.match(/[가-힣]/g) ?? []).length,
  lines: text.split("\n").length,
});
