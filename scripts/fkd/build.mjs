// FKD 빌드 — 검증을 통과한 "승인 + 사람" 규칙만 엔진용 JSON으로 만든다.
// 초안·검토중·보류·폐기·예시·Claude 초안 규칙은 결과에 들어가지 않는다(개수만 기록).
// 결과에는 시간 대신 입력 해시를 넣어 같은 입력이면 같은 파일이 나오게 한다.

import crypto from "node:crypto";

import { splitValues } from "./lib.mjs";

const condition = (v, side) =>
  v[`${side}_attribute`]
    ? {
        category: v[`${side}_category`] || "any",
        attribute: v[`${side}_attribute`],
        values: splitValues(v[`${side}_values`]),
      }
    : null;

export const isUsableRule = (v) =>
  v.approval_status === "승인" && v.data_origin === "사람" && !v.rule_id.startsWith("EX-");

export const buildRuleset = ({ schemaTable, rulesTable, schemaValues, sourceText }) => {
  const excluded = {};
  const rules = [];

  // 같은 규칙 ID는 승인된 가장 높은 버전만 쓴다
  const latest = new Map();

  for (const { values: v } of rulesTable.rows) {
    if (!isUsableRule(v)) {
      const reason = v.data_origin !== "사람" ? `출처:${v.data_origin || "없음"}` : `상태:${v.approval_status || "없음"}`;
      excluded[reason] = (excluded[reason] ?? 0) + 1;
      continue;
    }

    const prev = latest.get(v.rule_id);
    if (!prev || Number(v.rule_version) > Number(prev.rule_version)) latest.set(v.rule_id, v);
  }

  for (const v of [...latest.values()].sort((a, b) => a.rule_id.localeCompare(b.rule_id))) {
    rules.push({
      id: v.rule_id,
      version: Number(v.rule_version),
      type: v.rule_type === "예외" ? "exception" : "base",
      exceptionOf: v.exception_of || null,
      dimension: v.dimension,
      a: condition(v, "a"),
      b: condition(v, "b"),
      context: {
        tpo: splitValues(v.context_tpo),
        mood: splitValues(v.context_mood),
        season: splitValues(v.context_season),
        weather: splitValues(v.context_weather),
      },
      judgement: v.judgement,
      strength: Number(v.strength),
      confidence: v.confidence,
      reason: v.reason,
      displayText: v.display_text || null,
      author: v.author,
      reviewer: v.reviewer,
      approvedAt: v.approved_at,
      approvalStatus: v.approval_status,
    });
  }

  const confirmed = {};
  for (const [attribute, values] of schemaValues) {
    const list = [...values].filter(([, status]) => status === "확정").map(([value]) => value).sort();
    if (list.length > 0) confirmed[attribute] = list;
  }

  const hash = crypto.createHash("sha256").update(sourceText).digest("hex").slice(0, 12);

  return {
    datasetVersion: `fkd-${hash}`,
    sourceHash: hash,
    note: "승인(approval_status=승인) + 사람(data_origin=사람) 규칙만 포함. 자동 생성 파일 — 직접 고치지 말 것",
    counts: {
      schemaRows: schemaTable.rows.length,
      ruleRows: rulesTable.rows.length,
      approvedRules: rules.length,
      excluded,
    },
    confirmedValues: confirmed,
    rules,
  };
};

// 엔진이 읽을 때 한 번 더 거르는 안전장치(빌드 파일을 손으로 고쳐도 미승인 규칙이 쓰이지 않게)
export const loadApprovedRules = (ruleset) =>
  (ruleset?.rules ?? []).filter((rule) => rule.approvalStatus === "승인" && !rule.id.startsWith("EX-"));
