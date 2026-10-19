// Fashion Knowledge Dataset(FKD) 공통 도구 — CSV 읽기·쓰기, 열 키, 고정 목록
// 공동창업자가 Google Sheets에서 내보낸 CSV를 읽는다. 헤더는 "한국어 이름 [key]" 형식이고 key로 읽는다.

import fs from "node:fs";

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

// CSV → [{ key: value }] + 원래 줄 번호(헤더 = 1행)
export const readTable = (filePath) => {
  const [header = [], ...body] = parseCsv(fs.readFileSync(filePath, "utf8"));
  const keys = header.map(headerKey);

  return {
    keys,
    rows: body.map((cells, index) => ({
      line: index + 2,
      values: Object.fromEntries(keys.map((key, i) => [key, (cells[i] ?? "").trim()])),
    })),
  };
};

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

// 사람이 고르는 고정 목록(코드와 문서가 같은 값을 쓴다)
export const LISTS = {
  dimension: ["색", "핏·실루엣", "소재·계절", "TPO", "무드"],
  dimensionPrefix: { 색: "COL", "핏·실루엣": "FIT", "소재·계절": "MAT", TPO: "TPO", 무드: "MOOD" },
  ruleType: ["기본", "예외"],
  judgement: ["권장", "조건부 권장", "주의", "비권장"],
  confidence: ["High", "Medium", "Low"],
  approvalStatus: ["초안", "검토중", "승인", "보류", "폐기"],
  dataOrigin: ["사람", "예시", "Claude 초안"],
  schemaStatus: ["제안", "검토중", "확정", "폐기"],
  weather: ["cold", "cool", "mild", "warm", "hot", "rain", "snow"],
  label: ["적합", "조건부", "부적합"],
  recommendable: ["예", "아니오", "모름"],
  scoreKeys: [
    "score_color",
    "score_silhouette_fit",
    "score_material_season",
    "score_tpo",
    "score_mood",
    "score_overall",
  ],
  causes: ["기준 해석 차이", "정보 부족(사진·설명)", "취향 차이", "입력 실수", "규칙 필요"],
  actions: ["규칙 추가", "규칙 수정", "평가 기준 문장 수정", "예외 추가", "조치 없음"],
  reviewStatus: ["미검토", "논의중", "합의", "보류"],
};

export const isDate = (text) => /^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(Date.parse(text));
