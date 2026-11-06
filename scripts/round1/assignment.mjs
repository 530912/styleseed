// PLUS 가격 실험 고정 배정표 — 블록 무작위 배정(블록 크기 3, A·B·C)
//   node scripts/round1/assignment.mjs           배정표 생성(이미 있으면 같은지 확인만)
//   node scripts/round1/assignment.mjs --check   파일이 시드로 다시 만든 결과와 같은지 확인
// 실험 시작 후에는 시드·블록 수를 바꾸지 않는다(PLUS_PRICING_EXPERIMENT.md 2장)

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { ROOT } from "../fkd/lib.mjs";

export const EVENTS_CONTRACT_PATH = path.join(ROOT, "data/round1/contract/research-events-v0.3.json");
export const ASSIGNMENT_PATH = path.join(ROOT, "data/round1/experiment/assignment-r1-plus-price-v1.json");
export const ASSIGNMENT_SEED = "styleseed/r1-plus-price-v1/2026-10-19";
export const BLOCKS = 7;

export const loadEventsContract = (file = EVENTS_CONTRACT_PATH) => JSON.parse(fs.readFileSync(file, "utf8"));

// 시드 문자열 → 결정적 난수(mulberry32)
const seededRandom = (seed) => {
  let state = crypto.createHash("sha256").update(seed).digest().readUInt32LE(0);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const shuffle = (items, random) => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

export const assignmentHash = (assignments) =>
  crypto
    .createHash("sha256")
    .update(JSON.stringify(Object.entries(assignments).sort(([a], [b]) => a.localeCompare(b))))
    .digest("hex")
    .slice(0, 16);

export const generateAssignment = (contract, { seed = ASSIGNMENT_SEED, blocks = BLOCKS } = {}) => {
  const groups = Object.keys(contract.groups);
  const random = seededRandom(seed);
  const assignments = {};
  let n = 1;
  for (let b = 0; b < blocks; b += 1) {
    for (const group of shuffle(groups, random)) {
      assignments[`R1-P${String(n).padStart(2, "0")}`] = group;
      n += 1;
    }
  }
  // 리허설 코드는 무작위가 아니라 A·B·C 순서(분석에서 제외)
  groups.forEach((group, i) => {
    assignments[`R1-T${String(i + 1).padStart(2, "0")}`] = group;
  });

  return {
    experiment_id: contract.experiment_id,
    method: `블록 무작위 배정(블록 크기 ${groups.length}, ${blocks}블록), 시드 고정`,
    seed,
    groups: contract.groups,
    assignments,
    hash: assignmentHash(assignments),
  };
};

export const loadAssignment = (file = ASSIGNMENT_PATH) => JSON.parse(fs.readFileSync(file, "utf8"));

// 그룹·가격은 참가 코드로만 결정한다(앱 실행 중 무작위 사용 금지)
export const groupFor = (assignment, code) => {
  const group = assignment.assignments[code];
  return group ? { group, priceKrw: assignment.groups[group] } : null;
};

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const next = `${JSON.stringify(generateAssignment(loadEventsContract()), null, 1)}\n`;
  const current = fs.existsSync(ASSIGNMENT_PATH) ? fs.readFileSync(ASSIGNMENT_PATH, "utf8") : null;
  if (process.argv.includes("--check")) {
    if (current !== next) {
      console.error("배정표가 시드로 만든 결과와 다릅니다");
      process.exit(1);
    }
    console.log(`배정표 일치 (hash ${JSON.parse(next).hash})`);
  } else if (current && current !== next) {
    console.error("배정표가 이미 있고 내용이 다릅니다. 실험 시작 후에는 바꾸지 않습니다");
    process.exit(1);
  } else {
    fs.mkdirSync(path.dirname(ASSIGNMENT_PATH), { recursive: true });
    fs.writeFileSync(ASSIGNMENT_PATH, next);
    console.log(`생성: ${path.relative(ROOT, ASSIGNMENT_PATH)} (hash ${JSON.parse(next).hash})`);
  }
}
