// FKD 가져오기 명령 (Data Contract V0.1)
//   node scripts/fkd/cli.mjs validate [묶음폴더] [--json]   계약 검증(기본: data/fkd/sheets, 없으면 data/fkd/templates)
//   node scripts/fkd/cli.mjs build [묶음폴더]               오류 0일 때만 승인 규칙 → data/fkd/build/ruleset.json
//   node scripts/fkd/cli.mjs compare [묶음폴더] [--out 파일] [--allow-partial] [--force]
//                                                          evaluations/의 두 평가자 일치도 + 불일치 검토 목록
//
// 묶음폴더 구성: manifest.json(Lab 내보내기 필수) · evaluators.csv · garment_schema.csv · garments.csv · outfits.csv
//               · styling_rules.csv · [disagreement_review.csv] · evaluations/*.csv

import fs from "node:fs";
import path from "node:path";

import { buildRuleset } from "./build.mjs";
import { compareEvaluations, reviewHeaders } from "./compare.mjs";
import { ROOT, loadContract, readTable, toCsv } from "./lib.mjs";
import { createValidator, formatIssues, validateManifest } from "./validate.mjs";

const REQUIRED_FILES = {
  evaluators: "evaluators.csv",
  attribute_values: "garment_schema.csv",
  garments: "garments.csv",
  outfits: "outfits.csv",
  styling_rules: "styling_rules.csv",
};

export const loadBundle = (dir, contract) => {
  const issues = [];
  const tables = {};
  for (const [entity, file] of Object.entries(REQUIRED_FILES)) {
    const full = path.join(dir, file);
    if (!fs.existsSync(full)) {
      issues.push({ level: "error", code: "E_FILE_MISSING", entity, file, line: 0, record: "", field: "", message: `${contract.error_codes.E_FILE_MISSING}: ${file}` });
      tables[entity] = { file, keys: [], rows: [], missing: true };
    } else {
      tables[entity] = readTable(full, file);
    }
  }
  const reviewFile = path.join(dir, "disagreement_review.csv");
  if (fs.existsSync(reviewFile)) tables.disagreement_reviews = readTable(reviewFile, "disagreement_review.csv");
  const evalDir = path.join(dir, "evaluations");
  tables.outfit_evaluations = fs.existsSync(evalDir)
    ? fs.readdirSync(evalDir).filter((f) => f.endsWith(".csv")).sort().map((f) => readTable(path.join(evalDir, f), `evaluations/${f}`))
    : [];

  const manifestFile = path.join(dir, "manifest.json");
  let manifest = null;
  if (fs.existsSync(manifestFile)) {
    try {
      manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
    } catch {
      manifest = {};
    }
  }
  issues.push(...validateManifest(contract, manifest, (file) => {
    const full = path.join(dir, file);
    return fs.existsSync(full) ? fs.readFileSync(full) : null;
  }));

  return { tables, issues };
};

export const runValidation = (dir, contract = loadContract()) => {
  const bundle = loadBundle(dir, contract);
  const validator = createValidator(contract);
  const result = validator.validateBundle(bundle.tables);
  const issues = [...bundle.issues, ...result.issues];
  return { ...result, issues, errors: issues.filter((i) => i.level === "error").length };
};

const pickDir = (positional) => {
  if (positional[0]) return path.resolve(positional[0]);
  const sheets = path.join(ROOT, "data/fkd/sheets");
  return fs.existsSync(path.join(sheets, "styling_rules.csv")) ? sheets : path.join(ROOT, "data/fkd/templates");
};

const main = () => {
  const [command, ...args] = process.argv.slice(2);
  const flags = new Set(args.filter((a) => a.startsWith("--")));
  const outIndex = args.indexOf("--out");
  const positional = args.filter((a, i) => !a.startsWith("--") && !(outIndex >= 0 && i === outIndex + 1));
  const contract = loadContract();
  const dir = pickDir(positional);

  if (!["validate", "build", "compare"].includes(command)) {
    console.error("명령: validate | build | compare");
    process.exit(2);
  }

  const result = runValidation(dir, contract);

  if (flags.has("--json")) {
    console.log(JSON.stringify({ contractVersion: contract.contract_version, errors: result.errors, issues: result.issues }, null, 1));
  } else {
    console.log(`검증: ${path.relative(ROOT, dir) || "."} (계약 ${contract.contract_version})`);
    if (result.issues.length > 0) console.log(formatIssues(result.issues));
    for (const e of result.data.outfit_evaluations) {
      const submitted = e.records.filter((r) => !r.example && r.v.submission_status === "submitted").length;
      const open = e.records.filter((r) => !r.example && r.v.submission_status !== "submitted").length;
      console.log(`평가 ${e.file}: 평가자 ${e.evaluator ?? "-"}, 제출 ${submitted}개, 작성중 ${open}개`);
    }
    console.log(`결과: 오류 ${result.errors}개, 경고 ${result.issues.length - result.errors}개`);
  }

  if (result.errors > 0) {
    if (command !== "validate") console.error("오류가 있어 진행하지 않았어요. 데이터를 고친 뒤 다시 내보내 주세요.");
    process.exit(1);
  }

  if (command === "build") {
    const sourceText = Object.values(REQUIRED_FILES).map((f) => fs.readFileSync(path.join(dir, f), "utf8")).join("\n");
    const ruleset = buildRuleset({ contract, data: result.data, taxonomy: result.taxonomy, sourceText });
    const outFile = path.join(ROOT, "data/fkd/build/ruleset.json");
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, `${JSON.stringify(ruleset, null, 1)}\n`);
    console.log(`생성: ${path.relative(ROOT, outFile)} (승인 규칙 ${ruleset.counts.approvedRules}개, 제외 ${JSON.stringify(ruleset.counts.excluded)})`);
  }

  if (command === "compare") {
    const files = result.data.outfit_evaluations.filter((e) => e.evaluator);
    if (files.length !== 2 || files[0].evaluator === files[1].evaluator) {
      console.error(`서로 다른 평가자 2명의 평가 파일이 필요해요(지금: ${files.map((f) => `${f.file}=${f.evaluator}`).join(", ") || "없음"})`);
      process.exit(1);
    }
    const open = files.map((f) => f.records.filter((r) => !r.example && r.v.submission_status !== "submitted").length);
    if (!flags.has("--allow-partial") && open.some((n) => n > 0)) {
      console.error(`아직 제출하지 않은 평가가 있어요(${open.join(" / ")}개). 두 사람 모두 제출한 뒤 비교해요.`);
      process.exit(1);
    }
    const compared = compareEvaluations(contract, files[0].records, files[1].records);
    const outFile = outIndex >= 0 ? path.resolve(args[outIndex + 1]) : path.join(ROOT, "data/fkd/review/disagreement_review.csv");
    if (fs.existsSync(outFile) && !flags.has("--force")) {
      console.error(`${path.relative(ROOT, outFile)}이 이미 있어요(검토 내용 보호). 다른 --out 경로를 쓰거나 --force`);
      process.exit(1);
    }
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, toCsv(reviewHeaders(contract), compared.review));
    const { review, ...summary } = compared;
    console.log(JSON.stringify({ ...summary, reviewRows: review.length, reviewFile: path.relative(ROOT, outFile) }, null, 1));
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) main();
