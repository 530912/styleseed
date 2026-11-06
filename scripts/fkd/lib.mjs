// Fashion Knowledge Dataset(FKD) 공통 도구 — CSV 읽기·쓰기, 계약(Data Contract) 불러오기, 고정 목록 정규화
// 계약 원본: data/fkd/contract/fkd-contract-v0.1.json (필드·허용값·오류 코드의 단일 원본)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const CONTRACT_PATH = path.join(ROOT, "data/fkd/contract/fkd-contract-v0.1.json");

// RFC 4180 CSV 파서(따옴표 안 쉼표·줄바꿈·"" 지원). 첫 줄 BOM 제거.
export const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];

    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
};

// "규칙 ID [rule_id]" → "rule_id". 대괄호가 없으면 헤더 글자 그대로
export const headerKey = (header) => {
  const match = header.match(/\[([A-Za-z0-9_]+)\]\s*$/);
  return match ? match[1] : header.trim();
};

export const tableFromText = (text, file = "") => {
  const [header = [], ...body] = parseCsv(text);
  const keys = header.map(headerKey);

  return {
    file,
    keys,
    rows: body.map((cells, index) => ({
      line: index + 2,
      values: Object.fromEntries(keys.map((key, i) => [key, (cells[i] ?? "").trim()])),
    })),
  };
};

export const readTable = (filePath, file = path.basename(filePath)) =>
  tableFromText(fs.readFileSync(filePath, "utf8"), file);

const quote = (value) => {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const toCsv = (headers, rows) =>
  [headers, ...rows].map((cells) => cells.map(quote).join(",")).join("\n") + "\n";

export const splitValues = (text) =>
  String(text ?? "")
    .split("|")
    .map((value) => value.trim())
    .filter(Boolean);

export const isDate = (text) => /^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(Date.parse(text));

export const loadContract = (file = CONTRACT_PATH) => JSON.parse(fs.readFileSync(file, "utf8"));

// 고정 목록: 영어 키가 정식 값, 한국어 라벨도 받아 영어 키로 바꾼다
export const listLookup = (contract) => {
  const lookup = {};
  for (const [name, pairs] of Object.entries(contract.lists)) {
    const map = new Map();
    for (const [key, label] of pairs) {
      map.set(key, key);
      map.set(label, key);
      map.set(key.toLowerCase(), key);
    }
    lookup[name] = map;
  }
  return lookup;
};

export const listLabel = (contract, name, key) =>
  contract.lists[name]?.find(([k]) => k === key)?.[1] ?? key;

// 템플릿 헤더: "한국어 이름 [key]"
export const headerFor = (field) => `${field.label} [${field.key}]`;
