// Round 1 BM Validation 도구 테스트 — 상품 CSV 계약, 고정 배정표, 연구 이벤트 집계 규칙(ANALYSIS_PLAN.md)
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { ROOT } from "../../fkd/lib.mjs";
import { ASSIGNMENT_PATH, assignmentHash, generateAssignment, groupFor, loadAssignment, loadEventsContract } from "../assignment.mjs";
import { eventsCsv, participantsCsv, runAnalysis, validateEvent } from "../events.mjs";
import { buildOutboundUrl, loadCatalogTables, loadProductContract, validateCatalog } from "../products.mjs";

const productContract = loadProductContract();
const eventsContract = loadEventsContract();
const assignment = loadAssignment();

const codes = (issues, level = "error") => issues.filter((i) => i.level === level).map((i) => i.code).sort();

// ---------- 상품 CSV 계약 ----------

test("상품 계약의 앱 속성 목록이 src/constants/clothingOptions.ts와 같다", () => {
  const source = fs.readFileSync(path.join(ROOT, "src/constants/clothingOptions.ts"), "utf8");
  const arrayOf = (name) => {
    const body = source.match(new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const`))[1];
    return [...body.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  };
  const lists = productContract.app_lists;
  assert.deepEqual(lists.category, arrayOf("CLOTHING_CATEGORIES"));
  assert.deepEqual(lists.color, arrayOf("CLOTHING_COLORS"));
  assert.deepEqual(lists.color_tone, arrayOf("COLOR_TONES"));
  assert.deepEqual(lists.fit, arrayOf("CLOTHING_FITS"));
  assert.deepEqual(lists.material, arrayOf("CLOTHING_MATERIALS"));
  assert.deepEqual(lists.season, arrayOf("CLOTHING_SEASONS"));
  assert.deepEqual(lists.tpo, arrayOf("CLOTHING_TPOS"));
  assert.deepEqual(lists.style, arrayOf("CLOTHING_STYLES"));
  const subBody = source.match(/export const CLOTHING_SUBCATEGORIES = \{([\s\S]*?)\} as const/)[1];
  for (const category of lists.category) {
    const block = subBody.match(new RegExp(`${category}: \\[([\\s\\S]*?)\\]`))[1];
    assert.deepEqual(lists.subcategory[category], [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]), category);
  }
});

test("양식(templates) 헤더가 계약과 같고, 예시 행은 허가 전이라 카탈로그에 들어가지 않는다", () => {
  const tables = loadCatalogTables(path.join(ROOT, "data/round1/products/templates"), productContract);
  for (const [entity, spec] of Object.entries(productContract.entities)) {
    assert.deepEqual(tables[entity].keys, spec.fields.map((f) => f.key), entity);
  }
  const { issues, catalog } = validateCatalog(productContract, tables);
  assert.deepEqual(codes(issues), []);
  assert.equal(catalog.length, 0);
});

test("예시 묶음: 허가·판매 중 상품만 포함, 이미지 허가 없으면 이미지 없음, 주얼리 허가 대기는 제외", () => {
  const { issues, catalog } = validateCatalog(productContract, loadCatalogTables(path.join(ROOT, "data/round1/products/examples"), productContract));
  assert.deepEqual(codes(issues), []);
  assert.deepEqual(catalog.map((p) => p.productId), ["BRA-001", "BRA-002", "BRA-003", "BRB-001", "BRB-002"]);
  assert.equal(catalog.find((p) => p.productId === "BRB-001").imageUrl, null);
  assert.equal(catalog.find((p) => p.productId === "BRA-001").imageUrl, "https://bra.example/i/BRA-001.jpg");
  const warnings = codes(issues, "warning");
  for (const code of ["W_EXCLUDED_NOT_ON_SALE", "W_EXCLUDED_PERMISSION", "W_JEWELRY_EXPOSURE", "W_NOT_REVIEWED", "W_NO_IMAGE_PERMISSION"]) {
    assert.ok(warnings.includes(code), code);
  }
});

const productTables = (productOver = {}, brandOver = {}) => {
  const brand = { brand_id: "BRA", brand_name: "A", brand_type: "womenswear", data_permission: "yes", image_permission: "yes", utm_permission: "yes", purchase_report: "no", permission_date: "2026-10-24", permission_evidence: "이메일", ...brandOver };
  const product = {
    product_id: "BRA-001", brand_id: "BRA", product_name: "코트", price_krw: "189000", sale_status: "on_sale",
    product_url: "https://a.example/p/1", image_url: "https://a.example/i/1.jpg", category: "outer", sub_category: "coat",
    color: "beige", color_tone: "muted", fit: "regular", material: "wool", season: "fall|winter", tpo: "office",
    style: "classic", attribute_source: "brand", reviewed_by: "E1", updated_at: "2026-10-24", ...productOver,
  };
  const table = (row) => ({ keys: Object.keys(row), rows: [{ line: 2, values: row }] });
  return { brands: table(brand), products: table(product) };
};

test("상품 오류 코드", () => {
  const cases = [
    [{ sub_category: "shirt" }, {}, ["E_PARENT_MISMATCH"]],
    [{ product_url: "https://a.example/p/1?utm_source=x" }, {}, ["E_URL_HAS_UTM"]],
    [{ product_url: "http://a.example/p/1" }, {}, ["E_URL"]],
    [{ brand_id: "ZZZ", product_id: "ZZZ-001" }, {}, ["E_REF"]],
    [{ product_id: "BRB-001" }, {}, ["E_PRODUCT_BRAND_PREFIX"]],
    [{ fit: "" }, {}, ["E_REQUIRED"]],
    [{ category: "accessory", sub_category: "necklace", fit: "", material: "other" }, {}, []],
    [{ style: "classic|minimal|vintage" }, {}, ["E_ITEMS"]],
    [{ price_krw: "18만원" }, {}, ["E_INT"]],
    [{ color: "burgundy" }, {}, ["E_ENUM"]],
    [{}, { data_permission: "yes", permission_date: "" }, ["E_REQUIRED"]],
    [{ image_url: "" }, { image_permission: "yes" }, ["E_REQUIRED"]],
  ];
  for (const [productOver, brandOver, expected] of cases) {
    const { issues } = validateCatalog(productContract, productTables(productOver, brandOver));
    assert.deepEqual(codes(issues), expected, JSON.stringify(productOver) + JSON.stringify(brandOver));
  }
});

test("상품 ID 중복은 오류", () => {
  const tables = productTables();
  tables.products.rows.push({ line: 3, values: { ...tables.products.rows[0].values } });
  assert.deepEqual(codes(validateCatalog(productContract, tables).issues), ["E_DUPLICATE_KEY"]);
});

test("공식몰 주소: 브랜드가 허용한 경우에만 UTM을 붙이고 기존 쿼리는 유지한다(D4)", () => {
  const item = { productId: "BRA-001", productUrl: "https://a.example/p/1?color=beige", utmAllowed: true };
  const url = new URL(buildOutboundUrl(productContract, item));
  assert.equal(url.searchParams.get("color"), "beige");
  assert.equal(url.searchParams.get("utm_source"), "styleseed");
  assert.equal(url.searchParams.get("utm_content"), "BRA-001");
  assert.equal(buildOutboundUrl(productContract, { ...item, utmAllowed: false }), item.productUrl);
});

// ---------- 고정 배정표 ----------

test("배정표 파일이 시드로 다시 만든 결과와 같다(실험 중 변경 감지)", () => {
  const regenerated = generateAssignment(eventsContract);
  assert.deepEqual(assignment, regenerated);
  assert.equal(assignment.hash, assignmentHash(assignment.assignments));
  assert.equal(fs.readFileSync(ASSIGNMENT_PATH, "utf8"), `${JSON.stringify(regenerated, null, 1)}\n`);
});

test("배정: 3명 블록마다 A·B·C가 하나씩, 첫 18명은 6·6·6, 리허설 코드 3개", () => {
  const main = Object.entries(assignment.assignments).filter(([c]) => c.startsWith("R1-P"));
  assert.equal(main.length, 21);
  for (let i = 0; i < main.length; i += 3) {
    assert.deepEqual(main.slice(i, i + 3).map(([, g]) => g).sort(), ["A", "B", "C"]);
  }
  const first18 = main.slice(0, 18).reduce((m, [, g]) => ({ ...m, [g]: (m[g] ?? 0) + 1 }), {});
  assert.deepEqual(first18, { A: 6, B: 6, C: 6 });
  assert.deepEqual(Object.keys(assignment.assignments).filter((c) => c.startsWith("R1-T")), ["R1-T01", "R1-T02", "R1-T03"]);
});

test("같은 코드는 언제나 같은 그룹·가격, 없는 코드는 null", () => {
  const first = groupFor(assignment, "R1-P01");
  assert.deepEqual(groupFor(loadAssignment(), "R1-P01"), first);
  assert.equal(first.priceKrw, eventsContract.groups[first.group]);
  assert.equal(groupFor(assignment, "R1-P99"), null);
});

test("다른 시드는 다른 배정을 만든다(시드가 실제로 쓰임)", () => {
  assert.notDeepEqual(generateAssignment(eventsContract, { seed: "other" }).assignments, assignment.assignments);
});

// ---------- 연구 이벤트 ----------

const uuid = (seed) => {
  const h = crypto.createHash("sha256").update(String(seed)).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

let clock = Date.parse("2026-11-10T10:00:00+09:00");
const event = (code, name, properties = {}, over = {}) => {
  clock += 1000;
  const group = over.experiment_group ?? assignment.assignments[code];
  return {
    event_id: uuid(`${code}|${name}|${clock}`),
    experiment_id: "r1-plus-price-v1",
    event_name: name,
    participant_code: code,
    experiment_group: group,
    displayed_price_krw: eventsContract.groups[group],
    occurred_at: new Date(clock).toISOString(),
    feature_version: "plus-wardrobe-fit@0.1.0",
    app_version: "1.0.0(1)",
    test_env: "research",
    platform: "ios",
    session_id: uuid(`session|${code}`),
    properties,
    ...over,
  };
};

// 그룹별로 결과를 미리 정한 합성 18명 → 집계가 기대값과 같은지(ANALYSIS_PLAN.md 고정 규칙 확인)
const PLAN = {
  A: ["interest", "interest", "interest", "interest", "declined:price", "drop:feature"],
  B: ["interest", "interest", "declined:not_needed", "declined:price", "declined:price", "drop:paywall"],
  C: ["interest", "declined:price", "declined:price", "declined:trust", "declined:price", "declined:skipped"],
};
const ELAPSED = { A: [4000, 6000, 8000, 10000, 12000], B: [3000, 5000, 7000, 9000, 11000], C: [2000, 4000, 6000, 8000, 10000, 12000] };

const synthetic = () => {
  clock = Date.parse("2026-11-10T10:00:00+09:00");
  const events = [];
  const byGroup = { A: [], B: [], C: [] };
  for (const [code, group] of Object.entries(assignment.assignments)) {
    if (code.startsWith("R1-P") && byGroup[group].length < 6) byGroup[group].push(code);
  }
  for (const [group, outcomes] of Object.entries(PLAN)) {
    outcomes.forEach((outcome, i) => {
      const code = byGroup[group][i];
      events.push(event(code, "experiment_assigned", { consent_version: "r1-consent-v1", assignment_table_hash: assignment.hash }));
      events.push(event(code, "product_impression", { product_id: "BRA-001", brand_id: "BRA", source: "missing_item" }));
      if (i < 2) events.push(event(code, "product_clicked", { product_id: "BRA-001", brand_id: "BRA", source: "missing_item" }));
      if (i === 0) events.push(event(code, "official_store_opened", { product_id: "BRA-001", brand_id: "BRA", utm_applied: true }));
      events.push(event(code, "plus_feature_viewed", { matching_items: 4, new_outfits: 3, has_similar_item: false }));
      if (outcome === "drop:feature") return;
      events.push(event(code, "paywall_viewed"));
      if (outcome === "drop:paywall") return;
      const elapsed = ELAPSED[group][i];
      if (outcome === "interest") events.push(event(code, "subscription_interest_selected", { elapsed_ms: elapsed }));
      else events.push(event(code, "subscription_declined", { elapsed_ms: elapsed, reason: outcome.split(":")[1] }));
      events.push(event(code, "interview_completed", { interviewer_role: "PO" }));
    });
  }
  return { events, byGroup };
};

test("합성 18명: 그룹별 노출·고려·거절·선택 없음·소요시간·완료·이탈이 기대값과 같다", () => {
  const { groups, excluded } = runAnalysis(synthetic().events, eventsContract, assignment);
  assert.deepEqual(excluded, {});
  const pick = (g) => [g.assigned, g.feature_viewed, g.paywall_exposed, g.interest, g.declined, g.no_choice, g.completed, g.dropped];
  assert.deepEqual(pick(groups.A), [6, 6, 5, 4, 1, 0, 5, 1]);
  assert.deepEqual(pick(groups.B), [6, 6, 6, 2, 3, 1, 5, 1]);
  assert.deepEqual(pick(groups.C), [6, 6, 6, 1, 5, 0, 6, 0]);
  assert.equal(groups.A.interest_rate.text, "4/5");
  assert.equal(groups.C.decline_rate.text, "5/6");
  assert.deepEqual(groups.A.time_to_choice_ms, { median: 8000, min: 4000, max: 12000, n: 5 });
  assert.deepEqual(groups.C.time_to_choice_ms, { median: 7000, min: 2000, max: 12000, n: 6 });
  assert.deepEqual(groups.A.dropout_stages, { "체험 후": 1 });
  assert.deepEqual(groups.B.dropout_stages, { "Paywall 후": 1 });
  assert.deepEqual(groups.C.decline_reasons, { price: 3, trust: 1, skipped: 1 });
  assert.equal(groups.A.commerce.clicked.text, "2/6");
  assert.equal(groups.A.commerce.opened_store.text, "1/6");
});

test("중복·반복·충돌·순서 오류는 집계에서 빠지고 이유가 남는다", () => {
  const { events, byGroup } = synthetic();
  const code = byGroup.A[0];
  const paywall = events.find((e) => e.participant_code === code && e.event_name === "paywall_viewed");
  events.push({ ...paywall }); // 재전송(같은 event_id)
  events.push(event(code, "paywall_viewed")); // 화면 다시 열기
  events.push(event(code, "subscription_declined", { elapsed_ms: 1, reason: "price" })); // 고려 후 거절 시도
  const noPaywall = byGroup.A[5];
  events.push(event(noPaywall, "subscription_interest_selected", { elapsed_ms: 1 })); // Paywall 없이 선택
  const { groups, excluded } = runAnalysis(events, eventsContract, assignment);
  assert.deepEqual(excluded, { duplicate_event_id: 1, repeat_once_event: 1, choice_conflict: 1, choice_without_paywall: 1 });
  assert.equal(groups.A.interest, 4);
  assert.equal(groups.A.declined, 1);
});

test("리허설 코드·QA·개발 환경 이벤트는 결과에서 빠진다", () => {
  const { events } = synthetic();
  events.push(event("R1-T01", "experiment_assigned", { consent_version: "v", assignment_table_hash: assignment.hash }));
  events.push(event("R1-P01", "paywall_viewed", {}, { test_env: "qa", event_id: uuid("qa") }));
  events.push(event("R1-P01", "paywall_viewed", {}, { test_env: "dev", event_id: uuid("dev") }));
  const { excluded, groups } = runAnalysis(events, eventsContract, assignment);
  assert.deepEqual(excluded, { rehearsal_code: 1, env_qa: 1, env_dev: 1 });
  assert.equal(groups.A.assigned + groups.B.assigned + groups.C.assigned, 18);
});

test("이벤트 형식 오류: 개인정보 필드, 그룹·가격 불일치, 배정표와 다른 그룹, 모르는 코드, 필드 누락", () => {
  const base = event("R1-P01", "paywall_viewed");
  const other = Object.keys(eventsContract.groups).find((g) => g !== base.experiment_group);
  const check = (over) => validateEvent(eventsContract, { ...base, ...over }, assignment);
  assert.deepEqual(validateEvent(eventsContract, base, assignment), []);
  assert.ok(check({ user_id: "u" }).includes("E_FORBIDDEN_FIELD"));
  assert.ok(check({ properties: { email: "a@b.c" } }).includes("E_FORBIDDEN_FIELD"));
  assert.ok(check({ displayed_price_krw: eventsContract.groups[other] }).includes("E_GROUP_PRICE_MISMATCH"));
  assert.ok(check({ experiment_group: other, displayed_price_krw: eventsContract.groups[other] }).includes("E_ASSIGNMENT_MISMATCH"));
  assert.ok(check({ participant_code: "R1-P99" }).includes("E_UNKNOWN_CODE"));
  assert.ok(check({ participant_code: "P01" }).includes("E_TYPE:participant_code"));
  assert.ok(check({ occurred_at: undefined }).includes("E_MISSING:occurred_at"));
  assert.ok(check({ event_name: "subscription_started" }).includes("E_TYPE:event_name"));
  assert.ok(check({ event_name: "subscription_declined", properties: { reason: "too_expensive" } }).includes("E_PROPERTY:reason"));
});

test("실제 구독·결제 이벤트 이름은 연구 이벤트 계약에 없다", () => {
  for (const name of ["subscription_started", "subscription_cancelled", "paywall_view", "payment_completed", "purchase_completed"]) {
    assert.equal(Object.hasOwn(eventsContract.events, name), false, name);
  }
});

test("내보내기 파일에 user_id·개인정보 열이 없다", () => {
  const { kept, rows } = runAnalysis(synthetic().events, eventsContract, assignment);
  const header = (csv) => csv.split("\n")[0].split(",");
  for (const columns of [header(eventsCsv(eventsContract, kept)), header(participantsCsv(rows))]) {
    for (const forbidden of eventsContract.forbidden_fields) assert.equal(columns.includes(forbidden), false, forbidden);
  }
  assert.equal(rows.length, 18);
});
