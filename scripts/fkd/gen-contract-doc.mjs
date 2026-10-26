// Data Contract 문서의 표(필드·고정 목록·오류 코드)를 계약 JSON에서 만든다.
//   node scripts/fkd/gen-contract-doc.mjs          문서의 생성 구간을 갱신
//   node scripts/fkd/gen-contract-doc.mjs --check  문서가 계약과 같은지 확인(다르면 종료 코드 1)

import fs from "node:fs";
import path from "node:path";

import { ROOT, loadContract } from "./lib.mjs";

export const DOC_PATH = path.join(ROOT, "docs/handoff/fkd-data-contract-v0.1/README.md");
const BEGIN = "<!-- BEGIN GENERATED: scripts/fkd/gen-contract-doc.mjs -->";
const END = "<!-- END GENERATED -->";

const cell = (text) => String(text ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");

const typeText = (f) => {
  if (f.list) return `${f.type} · 목록 \`${f.list}\``;
  if (f.taxonomy) return `${f.type} · 속성 사전 \`${f.taxonomy}\`${f.allow ? ` (+${f.allow.join(", ")})` : ""}`;
  if (f.ref) return `${f.type} → \`${f.ref}\``;
  if (f.type === "taxonomy_values") return `taxonomy_values · \`${f.attribute_field}\`의 값`;
  return f.type;
};

const ruleText = (f) =>
  [
    f.pattern && `형식 \`${f.pattern}\``,
    f.min !== undefined && `최소 ${f.min}`,
    f.max !== undefined && `최대 ${f.max}`,
    f.min_length && `${f.min_length}자 이상`,
    f.max_length && `${f.max_length}자 이하`,
    f.min_items && `${f.min_items}~${f.max_items ?? ""}개`,
    f.display_only && "표시용(가져올 때 무시)",
  ]
    .filter(Boolean)
    .join(" · ");

const requiredText = (required) => (required === true ? "필수" : required ? `조건부: ${required}` : "선택");

export const renderGenerated = (contract) => {
  const out = [BEGIN, "", `계약 버전 \`${contract.contract_version}\` (상태: ${contract.status})`, ""];

  for (const [name, entity] of Object.entries(contract.entities)) {
    out.push(`### ${entity.title_ko} — \`${name}\``, "", `파일 \`${entity.file}\` · 기본 키 \`${entity.key.join(" + ")}\``, "");
    out.push("| 필드 | 이름 | 타입·허용값 | 필수 | 검증 | 예시 | 설명 |", "|---|---|---|---|---|---|---|");
    for (const f of entity.fields) {
      out.push(`| \`${f.key}\` | ${cell(f.label)} | ${cell(typeText(f))} | ${cell(requiredText(f.required))} | ${cell(ruleText(f))} | ${cell(f.example ? `\`${f.example}\`` : "")} | ${cell(f.desc)} |`);
    }
    out.push("");
  }

  out.push("### 점수 차원", "", "| 키 | 이름 | 평가 필드 | 규칙 ID 약자 | Match Score 항목 | 가중치 가설 | 보는 것 |", "|---|---|---|---|---|---|---|");
  for (const d of contract.score_dimensions) {
    out.push(`| \`${d.key}\` | ${cell(d.label)} | \`${d.evaluation_field}\` | ${d.rule_prefix ? `\`${d.rule_prefix}\`` : "—"} | ${cell(d.match_score_slot)} | ${d.weight_hypothesis ?? "—"} | ${cell(d.looks_at)} |`);
  }
  out.push("", `척도 ${contract.score_scale.min}~${contract.score_scale.max}, 0~100 환산 \`${contract.score_scale.to_100}\` (상태: ${contract.score_scale.status}, ${contract.score_scale.decision}). 가중치는 **가설**이며 공동창업자 승인 전에는 확정값이 아니다.`, "");

  out.push(`### 평가 기준 문장(rubric) — ${cell(contract.rubric.status)}`, "", "| 차원 | 1 | 2 | 3 | 4 | 5 |", "|---|---|---|---|---|---|");
  for (const [dim, anchors] of Object.entries(contract.rubric).filter(([k]) => k !== "status")) {
    out.push(`| \`${dim}\` | ${anchors.map(cell).join(" | ")} |`);
  }
  out.push("");

  out.push("### 고정 목록 (정식 값 = 영어 키, 한국어 라벨도 같은 값으로 받음)", "", "| 목록 | 값 (키 = 라벨) |", "|---|---|");
  for (const [name, pairs] of Object.entries(contract.lists)) {
    out.push(`| \`${name}\` | ${cell(pairs.map(([k, l]) => (k === l ? `\`${k}\`` : `\`${k}\` = ${l}`)).join(", "))} |`);
  }

  out.push("", "### 오류·경고 코드", "", "| 코드 | 수준 | 의미 |", "|---|---|---|");
  for (const [code, text] of Object.entries(contract.error_codes)) {
    out.push(`| \`${code}\` | ${code.startsWith("E_") ? "오류(가져오기 중단)" : "경고"} | ${cell(text)} |`);
  }

  out.push("", "### 공동창업자 승인이 필요한 패션 판단 (확정 전)", "", "| ID | 주제 | 결정할 것 | 영향 |", "|---|---|---|---|");
  for (const d of contract.pending_cofounder_decisions) {
    out.push(`| ${d.id} | ${cell(d.topic)} | ${cell(d.question)} | ${cell(d.affects.join(", "))} |`);
  }

  out.push("", END);
  return out.join("\n");
};

export const syncDoc = (text, contract) => {
  const start = text.indexOf(BEGIN);
  const end = text.indexOf(END);
  if (start < 0 || end < 0) throw new Error("생성 구간 표시가 문서에 없음");
  return text.slice(0, start) + renderGenerated(contract) + text.slice(end + END.length);
};

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const contract = loadContract();
  const current = fs.readFileSync(DOC_PATH, "utf8");
  const next = syncDoc(current, contract);
  if (process.argv.includes("--check")) {
    if (next !== current) {
      console.error("DATA_CONTRACT 문서가 계약 JSON과 다릅니다. node scripts/fkd/gen-contract-doc.mjs 실행");
      process.exit(1);
    }
    console.log("문서와 계약 일치");
  } else {
    fs.writeFileSync(DOC_PATH, next);
    console.log(`갱신: ${path.relative(ROOT, DOC_PATH)} (전달 패키지는 node scripts/fkd/gen-handoff.mjs)`);
  }
}
