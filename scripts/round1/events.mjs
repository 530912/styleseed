// PLUS 가격 실험·커머스 연구 이벤트 — 검증, 중복 제거, 제외, 집계, 내보내기
//   node scripts/round1/events.mjs <events.json|events.jsonl> [--out <폴더>]
// 집계 규칙(분모·제외 기준)은 실험 전에 고정한다: docs/round1/ANALYSIS_PLAN.md

import fs from "node:fs";
import path from "node:path";

import { ROOT, toCsv } from "../fkd/lib.mjs";

import { loadAssignment, loadEventsContract } from "./assignment.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

const typeOk = (contract, type, value) => {
  switch (type) {
    case "uuid": return typeof value === "string" && UUID.test(value);
    case "datetime": return typeof value === "string" && DATETIME.test(value) && !Number.isNaN(Date.parse(value));
    case "string": return typeof value === "string" && value.length > 0 && value.length <= 120;
    case "int": return Number.isInteger(value) && value >= 0;
    case "bool": return typeof value === "boolean";
    case "event": return Object.hasOwn(contract.events, value);
    case "code": return typeof value === "string" && new RegExp(contract.participant_code_pattern).test(value);
    case "group": return Object.hasOwn(contract.groups, value);
    case "price": return Object.values(contract.groups).includes(value);
    case "test_env": return contract.test_env.includes(value);
    case "platform": return contract.platform.includes(value);
    default: return contract.enums[type]?.includes(value) ?? false;
  }
};

// 이벤트 1개의 형식 검사. 오류 코드 목록을 돌려준다
export const validateEvent = (contract, event, assignment) => {
  const problems = [];
  if (!event || typeof event !== "object") return ["E_NOT_OBJECT"];

  const forbidden = (obj) => Object.keys(obj ?? {}).some((k) => contract.forbidden_fields.includes(k.toLowerCase()));
  if (forbidden(event) || forbidden(event.properties)) problems.push("E_FORBIDDEN_FIELD");

  for (const [field, type] of Object.entries(contract.common_fields)) {
    if (event[field] === undefined || event[field] === null || event[field] === "") problems.push(`E_MISSING:${field}`);
    else if (!typeOk(contract, type, event[field])) problems.push(`E_TYPE:${field}`);
  }
  if (event.experiment_id !== undefined && event.experiment_id !== contract.experiment_id) problems.push("E_EXPERIMENT_ID");
  if (contract.groups[event.experiment_group] !== undefined && contract.groups[event.experiment_group] !== event.displayed_price_krw) {
    problems.push("E_GROUP_PRICE_MISMATCH");
  }

  const spec = contract.events[event.event_name];
  if (spec) {
    const props = event.properties ?? {};
    for (const [key, type] of Object.entries(spec.properties)) {
      if (props[key] !== undefined && !typeOk(contract, type, props[key])) problems.push(`E_PROPERTY:${key}`);
    }
    const unknown = Object.keys(props).filter((k) => !Object.hasOwn(spec.properties, k));
    if (unknown.length > 0) problems.push("E_UNKNOWN_PROPERTY");
  }

  if (assignment && typeof event.participant_code === "string") {
    const assigned = assignment.assignments[event.participant_code];
    if (!assigned) problems.push("E_UNKNOWN_CODE");
    else if (assigned !== event.experiment_group) problems.push("E_ASSIGNMENT_MISMATCH");
  }
  return problems;
};

const byTime = (a, b) => Date.parse(a.occurred_at) - Date.parse(b.occurred_at) || String(a.event_id).localeCompare(String(b.event_id));

// 분석 전 처리: 중복 ID 제거 → 형식 오류 제외 → 환경·리허설 제외 → 1회 이벤트·선택 규칙
export const prepareEvents = (contract, events, assignment) => {
  const excluded = {};
  const issues = [];
  const exclude = (reason, event, detail = "") => {
    excluded[reason] = (excluded[reason] ?? 0) + 1;
    issues.push({ reason, event_id: event?.event_id ?? null, participant_code: event?.participant_code ?? null, event_name: event?.event_name ?? null, detail });
  };

  const seenIds = new Set();
  const unique = [];
  for (const event of events) {
    if (event?.event_id && seenIds.has(event.event_id)) {
      exclude("duplicate_event_id", event);
      continue;
    }
    if (event?.event_id) seenIds.add(event.event_id);
    unique.push(event);
  }

  const valid = [];
  for (const event of unique) {
    const problems = validateEvent(contract, event, assignment);
    if (problems.length > 0) exclude("invalid", event, problems.join(" "));
    else valid.push(event);
  }

  const inScope = [];
  for (const event of valid.sort(byTime)) {
    if (event.test_env !== contract.analysis_env) exclude(`env_${event.test_env}`, event);
    else if (event.participant_code.startsWith(contract.rehearsal_code_prefix)) exclude("rehearsal_code", event);
    else inScope.push(event);
  }

  const kept = [];
  const onceSeen = new Set();
  const choiceSeen = new Map();
  const paywallSeen = new Set();
  for (const event of inScope) {
    const spec = contract.events[event.event_name];
    const code = event.participant_code;
    if (spec.once) {
      const key = `${code}|${event.event_name}`;
      if (onceSeen.has(key)) {
        exclude("repeat_once_event", event);
        continue;
      }
      if (spec.choice) {
        if (!paywallSeen.has(code)) {
          exclude("choice_without_paywall", event);
          continue;
        }
        if (choiceSeen.has(code)) {
          exclude("choice_conflict", event, `first=${choiceSeen.get(code)}`);
          continue;
        }
        choiceSeen.set(code, event.event_name);
      }
      onceSeen.add(key);
    }
    if (event.event_name === "paywall_viewed") paywallSeen.add(code);
    kept.push(event);
  }

  return { kept, excluded, issues };
};

const median = (values) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const STAGE_LABEL = {
  experiment_assigned: "배정 후",
  plus_feature_viewed: "체험 후",
  paywall_viewed: "Paywall 후",
  choice: "인터뷰 전",
};

// 참가자 1명 = 1행
export const participantRows = (contract, kept) => {
  const rows = new Map();
  for (const event of kept) {
    const code = event.participant_code;
    if (!rows.has(code)) {
      rows.set(code, {
        participant_code: code, experiment_group: event.experiment_group, displayed_price_krw: event.displayed_price_krw,
        assigned_at: null, feature_viewed_at: null, paywall_viewed_at: null, choice: "none", choice_at: null,
        elapsed_ms: null, decline_reason: null, interview_completed_at: null,
        product_impressions: 0, product_clicks: 0, official_store_opens: 0, dropout_stage: null,
      });
    }
    const row = rows.get(code);
    const props = event.properties ?? {};
    switch (event.event_name) {
      case "experiment_assigned": row.assigned_at = event.occurred_at; break;
      case "plus_feature_viewed": row.feature_viewed_at = event.occurred_at; break;
      case "paywall_viewed": row.paywall_viewed_at = event.occurred_at; break;
      case "subscription_interest_selected":
        Object.assign(row, { choice: "interest", choice_at: event.occurred_at, elapsed_ms: props.elapsed_ms ?? null });
        break;
      case "subscription_declined":
        Object.assign(row, { choice: "declined", choice_at: event.occurred_at, elapsed_ms: props.elapsed_ms ?? null, decline_reason: props.reason ?? "skipped" });
        break;
      case "interview_completed": row.interview_completed_at = event.occurred_at; break;
      case "product_impression": row.product_impressions += 1; break;
      case "product_clicked": row.product_clicks += 1; break;
      case "official_store_opened": row.official_store_opens += 1; break;
      default: break;
    }
  }
  for (const row of rows.values()) {
    if (row.interview_completed_at) continue;
    const reached = row.choice !== "none" ? "choice" : row.paywall_viewed_at ? "paywall_viewed" : row.feature_viewed_at ? "plus_feature_viewed" : row.assigned_at ? "experiment_assigned" : null;
    row.dropout_stage = reached ? STAGE_LABEL[reached] : "배정 기록 없음";
  }
  return [...rows.values()].sort((a, b) => a.participant_code.localeCompare(b.participant_code));
};

const ratio = (n, d) => ({ n, d, text: d === 0 ? "—" : `${n}/${d}` });

// 그룹별 결과 표. 비율은 분모와 함께 둔다(탐색적 결과, 검정으로 결론 내지 않음)
export const analyzeExperiment = (contract, rows) => {
  const groups = {};
  for (const [group, price] of Object.entries(contract.groups)) {
    const members = rows.filter((r) => r.experiment_group === group && r.assigned_at);
    const exposed = members.filter((r) => r.paywall_viewed_at);
    const interest = exposed.filter((r) => r.choice === "interest");
    const declined = exposed.filter((r) => r.choice === "declined");
    const times = exposed.filter((r) => r.choice !== "none" && Number.isInteger(r.elapsed_ms)).map((r) => r.elapsed_ms);
    const reasons = {};
    for (const r of declined) reasons[r.decline_reason] = (reasons[r.decline_reason] ?? 0) + 1;
    const dropouts = {};
    for (const r of members.filter((m) => !m.interview_completed_at)) dropouts[r.dropout_stage] = (dropouts[r.dropout_stage] ?? 0) + 1;
    const commerce = members.filter((r) => r.product_impressions > 0);

    groups[group] = {
      price_krw: price,
      assigned: members.length,
      feature_viewed: members.filter((r) => r.feature_viewed_at).length,
      paywall_exposed: exposed.length,
      interest: interest.length,
      declined: declined.length,
      no_choice: exposed.length - interest.length - declined.length,
      interest_rate: ratio(interest.length, exposed.length),
      decline_rate: ratio(declined.length, exposed.length),
      time_to_choice_ms: { median: median(times), min: times.length ? Math.min(...times) : null, max: times.length ? Math.max(...times) : null, n: times.length },
      completed: members.filter((r) => r.interview_completed_at).length,
      dropped: members.length - members.filter((r) => r.interview_completed_at).length,
      dropout_stages: dropouts,
      decline_reasons: reasons,
      commerce: {
        saw_products: commerce.length,
        clicked: ratio(commerce.filter((r) => r.product_clicks > 0).length, commerce.length),
        opened_store: ratio(commerce.filter((r) => r.official_store_opens > 0).length, commerce.length),
      },
    };
  }
  return groups;
};

// 핵심 흐름(kind=core) 참가자별 집계: 등록·분석·AI 결과 수정·코디 조회·Missing (2026-11 MVP)
export const coreRows = (contract, kept) => {
  const rows = new Map();
  for (const event of kept) {
    if (contract.events[event.event_name]?.kind !== "core") continue;
    const code = event.participant_code;
    if (!rows.has(code)) {
      rows.set(code, {
        participant_code: code, app_opens: 0, registers_started: 0, registers_completed: 0, registers_failed: 0,
        analyses_started: 0, analyses_completed: 0, analyses_failed: 0, analysis_ms: [], reviews: 0, reviews_edited: 0,
        edited_fields: {}, outfits_styling: 0, outfits_looks: 0, missing_clicked: 0, missing_viewed: 0, missing_products_clicked: 0,
      });
    }
    const row = rows.get(code);
    const props = event.properties ?? {};
    switch (event.event_name) {
      case "app_opened": row.app_opens += 1; break;
      case "register_started": row.registers_started += 1; break;
      case "register_completed": row.registers_completed += 1; break;
      case "register_failed": row.registers_failed += 1; break;
      case "analysis_started": row.analyses_started += 1; break;
      case "analysis_completed":
        row.analyses_completed += 1;
        if (Number.isInteger(props.duration_ms)) row.analysis_ms.push(props.duration_ms);
        break;
      case "analysis_failed": row.analyses_failed += 1; break;
      case "analysis_reviewed":
        row.reviews += 1;
        if (props.edited) {
          row.reviews_edited += 1;
          for (const field of String(props.edited_fields ?? "").split("|").filter((f) => f && f !== "none")) {
            row.edited_fields[field] = (row.edited_fields[field] ?? 0) + 1;
          }
        }
        break;
      case "outfit_viewed":
        if (props.screen === "looks") row.outfits_looks += 1;
        else row.outfits_styling += 1;
        break;
      case "missing_item_clicked": row.missing_clicked += 1; break;
      case "missing_item_viewed": row.missing_viewed += 1; break;
      case "missing_products_clicked": row.missing_products_clicked += 1; break;
      default: break;
    }
  }
  return [...rows.values()]
    .map(({ analysis_ms: ms, edited_fields: fields, ...row }) => ({
      ...row,
      analysis_median_ms: median(ms),
      edited_fields: Object.entries(fields).sort().map(([k, n]) => `${k}:${n}`).join(" ") || "none",
    }))
    .sort((a, b) => a.participant_code.localeCompare(b.participant_code));
};

// 핵심 흐름 요약. 비율은 분모와 함께 둔다
export const coreSummary = (rows) => {
  const sum = (key) => rows.reduce((total, r) => total + r[key], 0);
  const fieldTotals = {};
  for (const r of rows) {
    for (const part of r.edited_fields === "none" ? [] : r.edited_fields.split(" ")) {
      const [field, n] = part.split(":");
      fieldTotals[field] = (fieldTotals[field] ?? 0) + Number(n);
    }
  }
  const sawStyling = rows.filter((r) => r.outfits_styling > 0);
  return {
    participants: rows.length,
    register_completion: ratio(sum("registers_completed"), sum("registers_started")),
    register_failures: sum("registers_failed"),
    analysis_failure: ratio(sum("analyses_failed"), sum("analyses_started")),
    analysis_median_ms: median(rows.map((r) => r.analysis_median_ms).filter((v) => v !== null)),
    ai_edit_rate: ratio(sum("reviews_edited"), sum("reviews")),
    edited_fields: fieldTotals,
    missing_click_participants: ratio(sawStyling.filter((r) => r.missing_clicked > 0).length, sawStyling.length),
    missing_products_participants: ratio(rows.filter((r) => r.missing_products_clicked > 0).length, rows.filter((r) => r.missing_viewed > 0).length),
  };
};

export const coreSummaryMarkdown = (core) => [
  "## 핵심 흐름 (등록·분석·코디·Missing)",
  "",
  "| 항목 | 값 |",
  "|---|---|",
  `| 이벤트가 있는 참가자 | ${core.participants} |`,
  `| 의류 등록 완료 (완료/시작) | ${core.register_completion.text} |`,
  `| 등록 실패 | ${core.register_failures}건 |`,
  `| AI 분석 실패 (실패/시작) | ${core.analysis_failure.text} |`,
  `| AI 분석 시간 중앙값 | ${fmtMs(core.analysis_median_ms)} |`,
  `| AI 결과를 고친 비율 (고침/저장 시도) | ${core.ai_edit_rate.text} |`,
  `| 고친 속성 | ${Object.entries(core.edited_fields).map(([k, n]) => `${k} ${n}`).join(", ") || "없음"} |`,
  `| Missing Item 클릭 (클릭한 사람/코디 본 사람) | ${core.missing_click_participants.text} |`,
  `| 예시 상품 보기 (누른 사람/Missing 본 사람) | ${core.missing_products_participants.text} |`,
  "",
].join("\n");

const fmtMs = (ms) => (ms === null ? "—" : `${(ms / 1000).toFixed(1)}초`);

export const summaryMarkdown = (contract, groups, excluded) => {
  const names = Object.keys(groups);
  const line = (label, fn) => `| ${label} | ${names.map((g) => fn(groups[g])).join(" | ")} |`;
  return [
    `# PLUS 가격 실험 결과 요약 (${contract.experiment_id})`,
    "",
    "> 탐색적 결과다. 그룹당 인원이 적어 차이는 우연으로도 생길 수 있다. 최적 가격을 확정하는 근거로 쓰지 않는다. '구독 고려'는 의향이며 결제·구독이 아니다.",
    "",
    `| 항목 | ${names.map((g) => `${g} (월 ${groups[g].price_krw.toLocaleString("ko-KR")}원)`).join(" | ")} |`,
    `|---|${names.map(() => "---").join("|")}|`,
    line("배정", (g) => g.assigned),
    line("기능 체험", (g) => g.feature_viewed),
    line("Paywall 노출", (g) => g.paywall_exposed),
    line("구독 고려 (고려/노출)", (g) => g.interest_rate.text),
    line("거절 (거절/노출)", (g) => g.decline_rate.text),
    line("선택 없음", (g) => g.no_choice),
    line("선택 소요시간 중앙값 (최소~최대)", (g) => `${fmtMs(g.time_to_choice_ms.median)} (${fmtMs(g.time_to_choice_ms.min)}~${fmtMs(g.time_to_choice_ms.max)})`),
    line("완료 / 이탈", (g) => `${g.completed} / ${g.dropped}`),
    line("상품 클릭 (클릭/상품 본 사람)", (g) => g.commerce.clicked.text),
    line("공식몰 이동 (이동/상품 본 사람)", (g) => g.commerce.opened_store.text),
    "",
    "**제외한 이벤트**",
    "",
    ...(Object.keys(excluded).length === 0 ? ["- 없음"] : Object.entries(excluded).map(([reason, n]) => `- ${reason}: ${n}건`)),
    "",
  ].join("\n");
};

const EVENT_COLUMNS = ["event_id", "experiment_id", "event_name", "participant_code", "experiment_group", "displayed_price_krw", "occurred_at", "feature_version", "app_version", "test_env", "platform", "session_id"];

export const eventsCsv = (contract, kept) => {
  const propKeys = [...new Set(Object.values(contract.events).flatMap((s) => Object.keys(s.properties)))].sort();
  return toCsv(
    [...EVENT_COLUMNS, ...propKeys.map((k) => `prop_${k}`)],
    kept.map((e) => [...EVENT_COLUMNS.map((c) => e[c]), ...propKeys.map((k) => e.properties?.[k] ?? "")]),
  );
};

export const participantsCsv = (rows) => {
  const columns = Object.keys(rows[0] ?? { participant_code: "" });
  return toCsv(columns, rows.map((r) => columns.map((c) => r[c] ?? "")));
};

export const readEvents = (file) => {
  const text = fs.readFileSync(file, "utf8");
  if (file.endsWith(".jsonl")) return text.split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
  const parsed = JSON.parse(text);
  return Array.isArray(parsed) ? parsed : parsed.events;
};

export const runAnalysis = (events, contract = loadEventsContract(), assignment = loadAssignment()) => {
  const prepared = prepareEvents(contract, events, assignment);
  const rows = participantRows(contract, prepared.kept);
  const groups = analyzeExperiment(contract, rows);
  const core = coreSummary(coreRows(contract, prepared.kept));
  return {
    ...prepared, rows, groups, coreRows: coreRows(contract, prepared.kept), core,
    summary: `${summaryMarkdown(contract, groups, prepared.excluded)}\n${coreSummaryMarkdown(core)}`,
  };
};

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const args = process.argv.slice(2);
  const outIndex = args.indexOf("--out");
  const file = args.find((a, i) => !a.startsWith("--") && !(outIndex >= 0 && i === outIndex + 1));
  if (!file) {
    console.error("사용법: node scripts/round1/events.mjs <events.json|events.jsonl> [--out <폴더>]");
    process.exit(2);
  }
  const contract = loadEventsContract();
  const result = runAnalysis(readEvents(path.resolve(file)), contract);
  console.log(result.summary);
  if (outIndex >= 0) {
    const dir = path.resolve(args[outIndex + 1]);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "r1_plus_events.csv"), eventsCsv(contract, result.kept));
    fs.writeFileSync(path.join(dir, "r1_plus_events.json"), `${JSON.stringify(result.kept, null, 1)}\n`);
    fs.writeFileSync(path.join(dir, "r1_plus_participants.csv"), participantsCsv(result.rows));
    fs.writeFileSync(path.join(dir, "r1_core_participants.csv"), participantsCsv(result.coreRows));
    fs.writeFileSync(path.join(dir, "r1_plus_summary.md"), result.summary);
    fs.writeFileSync(path.join(dir, "r1_plus_exclusions.json"), `${JSON.stringify({ excluded: result.excluded, issues: result.issues }, null, 1)}\n`);
    console.log(`내보냄: ${path.relative(ROOT, dir)}`);
  }
}
