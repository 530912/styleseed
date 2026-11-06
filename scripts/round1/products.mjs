// Round 1 커머스 PoC — 브랜드 상품 CSV 검증과 실험용 카탈로그 생성
//   node scripts/round1/products.mjs <폴더>                 brands.csv·products.csv 검증
//   node scripts/round1/products.mjs <폴더> --out <파일>     오류 0이면 포함 대상만 카탈로그 JSON으로 저장
// 계약: data/round1/contract/product-catalog-v0.1.json

import fs from "node:fs";
import path from "node:path";

import { ROOT, isDate, readTable, splitValues } from "../fkd/lib.mjs";

export const PRODUCT_CONTRACT_PATH = path.join(ROOT, "data/round1/contract/product-catalog-v0.1.json");

export const loadProductContract = (file = PRODUCT_CONTRACT_PATH) => JSON.parse(fs.readFileSync(file, "utf8"));

// "field=value" / "field!=value" 조건부 필수
const isRequired = (required, values) => {
  if (required === true) return true;
  if (!required) return false;
  const match = required.match(/^([a-z_]+)(!?=)(.+)$/);
  if (!match) return false;
  const [, field, op, expected] = match;
  return op === "=" ? values[field] === expected : values[field] !== expected;
};

const allowedFor = (contract, field, values) => {
  if (field.list) return contract.lists[field.list];
  if (field.app_list === "subcategory") return contract.app_lists.subcategory[values[field.parent]] ?? null;
  if (field.app_list) return contract.app_lists[field.app_list];
  return null;
};

export const validateCatalog = (contract, tables) => {
  const issues = [];
  const add = (level, code, entity, line, field, message, record = "") =>
    issues.push({ level, code, entity, file: contract.files[entity], line, record, field, message });

  const data = {};
  // 상품 행의 조건부 필수(예: image_permission=yes → image_url)는 해당 브랜드 값도 함께 본다
  const brandRaw = new Map((tables.brands?.rows ?? []).map(({ values }) => [values.brand_id, values]));

  for (const [entity, spec] of Object.entries(contract.entities)) {
    const table = tables[entity] ?? { keys: [], rows: [] };
    const missing = spec.fields.filter((f) => f.required && !table.keys.includes(f.key));
    for (const f of missing) add("error", "E_HEADER", entity, 1, f.key, `${f.label} 열 없음`);

    const seen = new Set();
    data[entity] = [];

    for (const { line, values } of table.rows) {
      const record = spec.key.map((k) => values[k]).join("+");
      const out = {};

      for (const f of spec.fields) {
        const raw = values[f.key] ?? "";
        if (raw === "") {
          const context = entity === "products" ? { ...(brandRaw.get(values.brand_id) ?? {}), ...values } : values;
          if (isRequired(f.required, context)) add("error", "E_REQUIRED", entity, line, f.key, `${f.label} 필수`, record);
          out[f.key] = f.multi ? [] : null;
          continue;
        }

        if (f.pattern && !new RegExp(f.pattern).test(raw)) add("error", "E_PATTERN", entity, line, f.key, `${f.label} 형식 ${f.pattern}`, record);

        if (f.type === "int") {
          const n = Number(raw);
          if (!/^-?\d+$/.test(raw) || n < (f.min ?? -Infinity) || n > (f.max ?? Infinity)) {
            add("error", "E_INT", entity, line, f.key, `${f.label} 정수 ${f.min}~${f.max}`, record);
          }
          out[f.key] = n;
          continue;
        }

        if (f.type === "url" && !/^https:\/\/\S+$/.test(raw)) add("error", "E_URL", entity, line, f.key, `${f.label} https 주소`, record);
        if (f.type === "date" && !isDate(raw)) add("error", "E_DATE", entity, line, f.key, `${f.label} YYYY-MM-DD`, record);
        if (f.max_length && raw.length > f.max_length) add("error", "E_PATTERN", entity, line, f.key, `${f.label} ${f.max_length}자 이하`, record);

        const allowed = allowedFor(contract, f, values);
        const items = f.multi ? splitValues(raw) : [raw];
        if (allowed) {
          for (const item of items) {
            if (!allowed.includes(item)) {
              const code = f.app_list === "subcategory" ? "E_PARENT_MISMATCH" : "E_ENUM";
              add("error", code, entity, line, f.key, `${f.label} '${item}' 허용값 아님`, record);
            }
          }
        }
        if (f.multi && (items.length < (f.min_items ?? 0) || items.length > (f.max_items ?? Infinity))) {
          add("error", "E_ITEMS", entity, line, f.key, `${f.label} ${f.min_items}~${f.max_items ?? ""}개`, record);
        }

        out[f.key] = f.multi ? items : raw;
      }

      if (seen.has(record)) add("error", "E_DUPLICATE_KEY", entity, line, spec.key.join("+"), `${record} 중복`, record);
      seen.add(record);
      data[entity].push({ line, ...out });
    }
  }

  const brands = new Map(data.brands.map((b) => [b.brand_id, b]));
  const catalog = [];

  for (const p of data.products) {
    const brand = brands.get(p.brand_id);
    const record = p.product_id ?? "";
    if (p.brand_id && !brand) {
      add("error", "E_REF", "products", p.line, "brand_id", `브랜드 ${p.brand_id} 없음`, record);
      continue;
    }
    if (!brand) continue;
    if (p.product_id && !p.product_id.startsWith(`${p.brand_id}-`)) {
      add("error", "E_PRODUCT_BRAND_PREFIX", "products", p.line, "product_id", `${p.product_id}는 ${p.brand_id}-로 시작해야 함`, record);
    }
    if (p.product_url && /[?&]utm_/i.test(p.product_url)) {
      add("error", "E_URL_HAS_UTM", "products", p.line, "product_url", "utm_ 파라미터를 빼고 원래 주소만", record);
    }
    if (!p.reviewed_by) add("warning", "W_NOT_REVIEWED", "products", p.line, "reviewed_by", "속성 검수 전", record);
    if (p.category === "accessory") add("warning", "W_JEWELRY_EXPOSURE", "products", p.line, "category", "Missing Item 경로로는 노출되지 않음", record);

    if (brand.data_permission !== "yes") {
      add("warning", "W_EXCLUDED_PERMISSION", "products", p.line, "brand_id", `${p.brand_id} 상품 정보 허가 ${brand.data_permission}`, record);
      continue;
    }
    if (p.sale_status !== "on_sale") {
      add("warning", "W_EXCLUDED_NOT_ON_SALE", "products", p.line, "sale_status", p.sale_status ?? "", record);
      continue;
    }
    const showImage = brand.image_permission === "yes" && Boolean(p.image_url);
    if (brand.image_permission !== "yes") add("warning", "W_NO_IMAGE_PERMISSION", "products", p.line, "image_url", "이미지 없이 표시", record);

    catalog.push({
      productId: p.product_id,
      brandId: p.brand_id,
      brandName: brand.brand_name,
      brandType: brand.brand_type,
      name: p.product_name,
      priceKrw: p.price_krw,
      productUrl: p.product_url,
      imageUrl: showImage ? p.image_url : null,
      utmAllowed: brand.utm_permission === "yes",
      category: p.category,
      subCategory: p.sub_category,
      color: p.color,
      colorTone: p.color_tone,
      fit: p.fit,
      material: p.material,
      season: p.season,
      tpo: p.tpo,
      style: p.style,
      attributeSource: p.attribute_source,
      reviewed: Boolean(p.reviewed_by),
      updatedAt: p.updated_at,
    });
  }

  return { issues, data, catalog };
};

// 공식몰 이동 주소. 브랜드가 UTM을 허락한 경우에만 붙인다(D4). 기존 쿼리는 유지한다
export const buildOutboundUrl = (contract, item) => {
  if (!item.utmAllowed) return item.productUrl;
  const url = new URL(item.productUrl);
  for (const [key, template] of Object.entries(contract.utm)) {
    url.searchParams.set(key, template.replace("{product_id}", item.productId));
  }
  return url.toString();
};

export const loadCatalogTables = (dir, contract) =>
  Object.fromEntries(
    Object.entries(contract.files).map(([entity, file]) => {
      const full = path.join(dir, file);
      return [entity, fs.existsSync(full) ? readTable(full, file) : { file, keys: [], rows: [] }];
    }),
  );

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const args = process.argv.slice(2);
  const outIndex = args.indexOf("--out");
  const dir = args.find((a, i) => !a.startsWith("--") && !(outIndex >= 0 && i === outIndex + 1)) ?? "data/round1/products/templates";
  const contract = loadProductContract();
  const { issues, catalog } = validateCatalog(contract, loadCatalogTables(path.resolve(dir), contract));
  for (const i of issues) console.log(`${i.level === "error" ? "오류" : "경고"} ${i.code} ${i.file}:${i.line} ${i.record} ${i.field} — ${i.message}`);
  const errors = issues.filter((i) => i.level === "error").length;
  console.log(`오류 ${errors}건, 경고 ${issues.length - errors}건, 카탈로그 포함 ${catalog.length}개`);
  if (errors > 0) process.exit(1);
  if (outIndex >= 0) {
    const out = path.resolve(args[outIndex + 1]);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, `${JSON.stringify({ contract_version: contract.contract_version, products: catalog }, null, 1)}\n`);
    console.log(`생성: ${path.relative(ROOT, out)}`);
  }
}
