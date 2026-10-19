// FKD 검증 — 공동창업자가 내보낸 CSV가 규칙에 맞는지 확인한다.
// 오류(error)는 반드시 고쳐야 하고, 경고(warning)는 확인만 하면 된다. 메시지는 한국어(시트 줄 번호 포함).

import { LISTS, isDate, splitValues } from "./lib.mjs";

const issue = (level, file, line, message) => ({ level, file, line, message });

// ---- garment_schema ----
export const validateSchema = (table, file = "garment_schema.csv") => {
  const issues = [];
  const values = new Map(); // attribute → Map(value → status)
  const seen = new Set();

  for (const { line, values: v } of table.rows) {
    if (v.data_origin === "예시") continue;

    if (!LISTS.dataOrigin.includes(v.data_origin)) {
      issues.push(issue("error", file, line, `데이터 출처는 ${LISTS.dataOrigin.join("/")} 중 하나여야 해요`));
    }

    if (!v.attribute_key || !v.value_key) {
      issues.push(issue("error", file, line, "속성 키와 값 키는 비울 수 없어요"));
      continue;
    }

    const id = `${v.attribute_key}:${v.value_key}`;
    if (seen.has(id)) issues.push(issue("error", file, line, `같은 값이 두 번 있어요: ${id}`));
    seen.add(id);

    if (!LISTS.schemaStatus.includes(v.status)) {
      issues.push(issue("error", file, line, `상태는 ${LISTS.schemaStatus.join("/")} 중 하나여야 해요 (지금: "${v.status}")`));
    }

    if (v.status === "확정" && (!v.decided_by || !isDate(v.decided_at))) {
      issues.push(issue("error", file, line, "확정한 값은 결정자와 결정일(YYYY-MM-DD)이 필요해요"));
    }

    if (v.status === "확정" && v.data_origin !== "사람") {
      issues.push(issue("error", file, line, "확정은 사람이 결정한 값만 할 수 있어요. Claude 초안 값을 확정하려면 출처를 '사람'으로 바꿔 주세요"));
    }

    if (!values.has(v.attribute_key)) values.set(v.attribute_key, new Map());
    values.get(v.attribute_key).set(v.value_key, v.status);
  }

  return { issues, values };
};

const checkCondition = (schema, side, v, file, line, issues, approved) => {
  const category = v[`${side}_category`];
  const attribute = v[`${side}_attribute`];
  const list = splitValues(v[`${side}_values`]);
  const name = side === "a" ? "조건 A" : "조건 B";

  if (!attribute && list.length === 0 && !category) return [];

  if (category && category !== "any" && !schema.get("category")?.has(category)) {
    issues.push(issue("error", file, line, `${name} 대분류 "${category}"가 속성 사전에 없어요(any 또는 category 값)`));
  }

  if (!attribute || list.length === 0) {
    issues.push(issue("error", file, line, `${name}의 속성과 값을 함께 적어 주세요`));
    return [];
  }

  const allowed = schema.get(attribute);
  if (!allowed) {
    issues.push(issue("error", file, line, `${name} 속성 "${attribute}"가 속성 사전에 없어요`));
    return [];
  }

  const unconfirmed = [];
  for (const value of list) {
    if (!allowed.has(value)) {
      issues.push(issue("error", file, line, `${name} 값 "${value}"가 속성 "${attribute}"의 허용값에 없어요`));
    } else if (allowed.get(value) !== "확정") {
      unconfirmed.push(`${attribute}:${value}`);
    }
  }

  if (approved && unconfirmed.length > 0) {
    issues.push(issue("error", file, line, `승인 규칙은 '확정'된 속성값만 쓸 수 있어요: ${unconfirmed.join(", ")}`));
  }

  return unconfirmed;
};

const checkContext = (schema, attribute, text, label, file, line, issues, approved) => {
  for (const value of splitValues(text)) {
    const allowed = schema.get(attribute);
    if (!allowed?.has(value)) {
      issues.push(issue("error", file, line, `${label} "${value}"가 속성 사전(${attribute})에 없어요`));
    } else if (approved && allowed.get(value) !== "확정") {
      issues.push(issue("error", file, line, `승인 규칙은 '확정'된 ${label}만 쓸 수 있어요: ${value}`));
    }
  }
};

// ---- styling_rules ----
export const validateRules = (table, schema, file = "styling_rules.csv") => {
  const issues = [];
  const byId = new Map();

  for (const row of table.rows) {
    const v = row.values;
    if (v.rule_id) byId.set(`${v.rule_id}@${v.rule_version}`, row);
  }

  const seen = new Set();

  for (const { line, values: v } of table.rows) {
    const isExample = v.data_origin === "예시" || v.rule_id.startsWith("EX-");

    if (!LISTS.dataOrigin.includes(v.data_origin)) {
      issues.push(issue("error", file, line, `데이터 출처는 ${LISTS.dataOrigin.join("/")} 중 하나여야 해요`));
    }

    if (isExample) {
      if (v.approval_status === "승인") {
        issues.push(issue("error", file, line, "예시 행은 승인할 수 없어요. 쓰려면 새 규칙 ID로 옮기고 출처를 '사람'으로 바꿔 주세요"));
      }
      continue;
    }

    const id = v.rule_id;
    const prefix = LISTS.dimensionPrefix[v.dimension];

    if (!LISTS.dimension.includes(v.dimension)) {
      issues.push(issue("error", file, line, `평가 차원은 ${LISTS.dimension.join("/")} 중 하나여야 해요`));
    }

    if (!/^(COL|FIT|MAT|TPO|MOOD)-\d{3}$/.test(id)) {
      issues.push(issue("error", file, line, `규칙 ID 형식은 COL-001처럼 '차원 약자-세 자리 숫자'예요 (지금: "${id}")`));
    } else if (prefix && !id.startsWith(`${prefix}-`)) {
      issues.push(issue("error", file, line, `평가 차원 "${v.dimension}"의 규칙 ID는 ${prefix}-로 시작해야 해요`));
    }

    if (!/^[1-9]\d*$/.test(v.rule_version)) {
      issues.push(issue("error", file, line, "버전은 1, 2, 3 같은 숫자예요"));
    }

    const key = `${id}@${v.rule_version}`;
    if (seen.has(key)) issues.push(issue("error", file, line, `같은 규칙 ID·버전이 두 번 있어요: ${key}`));
    seen.add(key);

    const approved = v.approval_status === "승인";

    if (!LISTS.approvalStatus.includes(v.approval_status)) {
      issues.push(issue("error", file, line, `승인 상태는 ${LISTS.approvalStatus.join("/")} 중 하나여야 해요`));
    }

    if (!LISTS.ruleType.includes(v.rule_type)) {
      issues.push(issue("error", file, line, "규칙 종류는 기본/예외 중 하나예요"));
    } else if (v.rule_type === "예외") {
      const base = [...byId.values()].find((r) => r.values.rule_id === v.exception_of);
      if (!base) {
        issues.push(issue("error", file, line, `예외 규칙은 대상 기본 규칙 ID가 필요해요 (지금: "${v.exception_of}")`));
      } else if (approved && base.values.approval_status !== "승인") {
        issues.push(issue("error", file, line, `대상 기본 규칙 ${v.exception_of}이 아직 승인되지 않았어요`));
      }
    }

    checkCondition(schema, "a", v, file, line, issues, approved);
    if (!v.a_attribute) issues.push(issue("error", file, line, "조건 A는 반드시 적어야 해요"));
    checkCondition(schema, "b", v, file, line, issues, approved);

    checkContext(schema, "tpo", v.context_tpo, "적용 TPO", file, line, issues, approved);
    checkContext(schema, "mood", v.context_mood, "적용 무드", file, line, issues, approved);
    checkContext(schema, "season", v.context_season, "적용 계절", file, line, issues, approved);
    for (const w of splitValues(v.context_weather)) {
      if (!LISTS.weather.includes(w)) {
        issues.push(issue("error", file, line, `적용 날씨는 ${LISTS.weather.join("/")} 중에서 골라 주세요 (지금: "${w}")`));
      }
    }

    if (!LISTS.judgement.includes(v.judgement)) {
      issues.push(issue("error", file, line, `판정은 ${LISTS.judgement.join("/")} 중 하나예요`));
    }
    if (!/^[1-5]$/.test(v.strength)) issues.push(issue("error", file, line, "강도는 1~5 숫자예요"));
    if (!LISTS.confidence.includes(v.confidence)) {
      issues.push(issue("error", file, line, "확신도는 High/Medium/Low 중 하나예요"));
    }
    if (v.reason.length < 10) {
      issues.push(issue("error", file, line, "판단 이유를 관찰 가능한 문장으로 적어 주세요(10자 이상)"));
    }
    if (v.judgement === "조건부 권장" && !(v.context_tpo || v.context_mood || v.context_season || v.context_weather)) {
      issues.push(issue("warning", file, line, "조건부 권장은 적용 상황(TPO·무드·계절·날씨) 중 하나를 적는 것이 좋아요"));
    }

    if (approved) {
      if (v.data_origin !== "사람") {
        issues.push(issue("error", file, line, "승인 규칙은 데이터 출처가 '사람'이어야 해요"));
      }
      if (!v.author || !v.reviewer) {
        issues.push(issue("error", file, line, "승인 규칙은 작성자와 검토자가 모두 필요해요"));
      } else if (v.author === v.reviewer) {
        issues.push(issue("error", file, line, "작성자와 검토자는 서로 다른 사람이어야 해요"));
      }
      if (!isDate(v.approved_at)) {
        issues.push(issue("error", file, line, "승인일을 YYYY-MM-DD 형식으로 적어 주세요"));
      }
    }
  }

  return { issues };
};

// ---- outfit_evaluation (평가자 한 명의 파일) ----
export const validateEvaluation = (table, file = "outfit_evaluation.csv") => {
  const issues = [];
  const evaluators = new Set();
  const seen = new Set();
  let rated = 0;
  let unrated = 0;

  for (const { line, values: v } of table.rows) {
    if (v.data_origin === "예시" || v.evaluator_id === "예시" || v.outfit_id.startsWith("EX-")) continue;

    const scores = LISTS.scoreKeys.map((key) => v[key]);
    const anyScore = scores.some(Boolean);

    if (!v.outfit_id) issues.push(issue("error", file, line, "코디 ID가 비어 있어요"));
    if (seen.has(v.outfit_id)) issues.push(issue("error", file, line, `같은 코디 ID가 두 번 있어요: ${v.outfit_id}`));
    seen.add(v.outfit_id);

    if (!anyScore) {
      unrated += 1;
      continue;
    }

    rated += 1;

    if (!v.evaluator_id) issues.push(issue("error", file, line, "평가자 ID를 적어 주세요"));
    else evaluators.add(v.evaluator_id);

    LISTS.scoreKeys.forEach((key, i) => {
      if (!/^[1-5]$/.test(scores[i])) {
        issues.push(issue("error", file, line, `${key} 점수는 1~5 숫자예요 (지금: "${scores[i]}")`));
      }
    });

    if (!LISTS.label.includes(v.label)) issues.push(issue("error", file, line, "판정은 적합/조건부/부적합 중 하나예요"));
    if (!LISTS.recommendable.includes(v.recommendable)) {
      issues.push(issue("error", file, line, "추천해도 되나는 예/아니오/모름 중 하나예요"));
    }
    if (v.reason.length < 10) issues.push(issue("error", file, line, "핵심 이유를 10자 이상 적어 주세요"));
    if (!LISTS.confidence.includes(v.confidence)) {
      issues.push(issue("error", file, line, "확신도는 High/Medium/Low 중 하나예요"));
    }
    if (v.data_origin !== "사람") issues.push(issue("error", file, line, "평가 행의 데이터 출처는 '사람'이어야 해요"));
    if (v.rated_at && !isDate(v.rated_at)) issues.push(issue("error", file, line, "평가일은 YYYY-MM-DD 형식이에요"));
  }

  // 독립 평가: 한 파일에는 한 사람의 평가만 둔다(서로의 점수를 보지 않도록 파일을 나눈다)
  if (evaluators.size > 1) {
    issues.push(issue("error", file, 0, `한 파일에 평가자가 ${evaluators.size}명 있어요(${[...evaluators].join(", ")}). 평가자마다 따로 만든 시트에서 내보내 주세요`));
  }

  return { issues, evaluator: [...evaluators][0] ?? null, rated, unrated };
};

export const formatIssues = (issues) =>
  issues
    .map((i) => `${i.level === "error" ? "오류" : "경고"} ${i.file}${i.line ? ` ${i.line}행` : ""}: ${i.message}`)
    .join("\n");
