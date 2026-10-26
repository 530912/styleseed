// FKD 빌드 — 검증을 통과한 묶음에서 "승인 + 출처 human" 규칙만 엔진용 ruleset으로 만든다.
// 초안·검토중·보류·폐기·예시·Claude 초안 규칙은 결과에 들어가지 않는다(개수만 기록).
// 시각 대신 입력 해시로 datasetVersion을 만들어 같은 입력이면 같은 파일이 나오게 한다.

import crypto from "node:crypto";

export const isUsableRule = (v) =>
  v.approval_status === "approved" && v.data_origin === "human" && !String(v.rule_id).startsWith("EX-");

const condition = (v, side) =>
  v[`${side}_attribute`]
    ? { category: v[`${side}_category`] || "any", attribute: v[`${side}_attribute`], values: v[`${side}_values`] }
    : null;

export const buildRuleset = ({ contract, data, taxonomy, sourceText }) => {
  const excluded = {};
  const latest = new Map();

  for (const { v } of data.styling_rules) {
    if (!isUsableRule(v)) {
      const reason = v.data_origin !== "human" ? `origin:${v.data_origin || "none"}` : `status:${v.approval_status || "none"}`;
      excluded[reason] = (excluded[reason] ?? 0) + 1;
      continue;
    }
    // 같은 규칙 ID는 승인된 가장 높은 버전만 쓴다
    const prev = latest.get(v.rule_id);
    if (!prev || Number(v.rule_version) > Number(prev.rule_version)) latest.set(v.rule_id, v);
  }

  const rules = [...latest.values()]
    .sort((a, b) => a.rule_id.localeCompare(b.rule_id))
    .map((v) => ({
      id: v.rule_id,
      version: Number(v.rule_version),
      type: v.rule_type,
      exceptionOf: v.exception_of || null,
      dimension: v.dimension,
      a: condition(v, "a"),
      b: condition(v, "b"),
      context: { tpo: v.context_tpo, mood: v.context_mood, season: v.context_season, weather: v.context_weather },
      judgement: v.judgement,
      strength: Number(v.strength),
      confidence: v.confidence,
      reason: v.reason,
      displayText: v.display_text || null,
      author: v.author,
      reviewer: v.reviewer,
      approvedAt: v.approved_at,
      approvalStatus: v.approval_status,
    }));

  const confirmedValues = {};
  for (const [attribute, values] of [...taxonomy.entries()].sort()) {
    const list = [...values].filter(([, e]) => e.status === "confirmed").map(([value]) => value).sort();
    if (list.length > 0) confirmedValues[attribute] = list;
  }

  const hash = crypto.createHash("sha256").update(sourceText).digest("hex").slice(0, 12);

  return {
    contractVersion: contract.contract_version,
    datasetVersion: `fkd-${hash}`,
    note: "approval_status=approved + data_origin=human 규칙만 포함. 자동 생성 파일 — 직접 고치지 말 것",
    counts: { ruleRows: data.styling_rules.length, approvedRules: rules.length, excluded },
    confirmedValues,
    rules,
  };
};

// 엔진이 읽을 때 한 번 더 거르는 안전장치(빌드 파일을 손으로 고쳐도 미승인 규칙이 쓰이지 않게)
export const loadApprovedRules = (ruleset) =>
  (ruleset?.rules ?? []).filter((rule) => rule.approvalStatus === "approved" && !String(rule.id).startsWith("EX-"));
