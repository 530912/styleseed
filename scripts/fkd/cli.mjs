// FKD 명령어
//   node scripts/fkd/cli.mjs validate [폴더]           속성 사전·규칙·평가 파일 검증 (기본 폴더: data/fkd/sheets, 없으면 templates)
//   node scripts/fkd/cli.mjs build [폴더]              검증 통과 시 승인 규칙만 data/fkd/build/ruleset.json 생성
//   node scripts/fkd/cli.mjs compare <평가1.csv> <평가2.csv> [--out 파일] [--allow-partial]
//                                                      두 평가자 일치도 + 불일치 검토 목록(disagreement_review) 생성

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildRuleset } from "./build.mjs";
import { REVIEW_HEADERS, compareEvaluations } from "./compare.mjs";
import { readTable, toCsv } from "./lib.mjs";
import { formatIssues, validateEvaluation, validateRules, validateSchema } from "./validate.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const [command, ...args] = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const positional = args.filter((a, i) => !a.startsWith("--") && !(args[i - 1] === "--out"));
const outIndex = args.indexOf("--out");

const pickDir = () => {
  if (positional[0]) return path.resolve(positional[0]);
  const sheets = path.join(ROOT, "data/fkd/sheets");
  return fs.existsSync(path.join(sheets, "styling_rules.csv")) ? sheets : path.join(ROOT, "data/fkd/templates");
};

const evaluationFiles = (dir) => {
  const nested = path.join(dir, "evaluations");
  if (fs.existsSync(nested)) {
    return fs.readdirSync(nested).filter((f) => f.endsWith(".csv")).map((f) => path.join(nested, f));
  }
  const single = path.join(dir, "outfit_evaluation.csv");
  return fs.existsSync(single) ? [single] : [];
};

const runValidate = (dir) => {
  const schemaTable = readTable(path.join(dir, "garment_schema.csv"));
  const rulesTable = readTable(path.join(dir, "styling_rules.csv"));
  const schema = validateSchema(schemaTable);
  const rules = validateRules(rulesTable, schema.values);
  const issues = [...schema.issues, ...rules.issues];
  const evaluations = [];

  for (const file of evaluationFiles(dir)) {
    const result = validateEvaluation(readTable(file), path.relative(dir, file));
    issues.push(...result.issues);
    evaluations.push({ file: path.relative(ROOT, file), evaluator: result.evaluator, rated: result.rated, unrated: result.unrated });
  }

  const errors = issues.filter((i) => i.level === "error").length;
  const warnings = issues.length - errors;

  console.log(`검증 폴더: ${path.relative(ROOT, dir) || "."}`);
  if (issues.length > 0) console.log(formatIssues(issues));
  for (const e of evaluations) {
    console.log(`평가 파일 ${e.file}: 평가자 ${e.evaluator ?? "-"}, 평가 ${e.rated}개, 미평가 ${e.unrated}개`);
  }
  console.log(`결과: 오류 ${errors}개, 경고 ${warnings}개`);

  return { errors, schemaTable, rulesTable, schemaValues: schema.values };
};

if (command === "validate") {
  const { errors } = runValidate(pickDir());
  process.exit(errors > 0 ? 1 : 0);
} else if (command === "build") {
  const dir = pickDir();
  const result = runValidate(dir);
  if (result.errors > 0) {
    console.error("오류가 있어 빌드하지 않았어요. 위 오류를 시트에서 고친 뒤 다시 내보내 주세요.");
    process.exit(1);
  }
  const sourceText = ["garment_schema.csv", "styling_rules.csv"]
    .map((f) => fs.readFileSync(path.join(dir, f), "utf8"))
    .join("\n");
  const ruleset = buildRuleset({ ...result, sourceText });
  const outFile = path.join(ROOT, "data/fkd/build/ruleset.json");
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify(ruleset, null, 1)}\n`);
  console.log(`생성: ${path.relative(ROOT, outFile)} (승인 규칙 ${ruleset.counts.approvedRules}개, 제외 ${JSON.stringify(ruleset.counts.excluded)})`);
} else if (command === "compare") {
  const [fileA, fileB] = positional;
  if (!fileA || !fileB) {
    console.error("사용법: compare <평가1.csv> <평가2.csv> [--out 파일] [--allow-partial]");
    process.exit(2);
  }
  const tables = [fileA, fileB].map((f) => readTable(path.resolve(f)));
  const checks = tables.map((t, i) => validateEvaluation(t, path.basename([fileA, fileB][i])));
  const errors = checks.flatMap((c) => c.issues).filter((i) => i.level === "error");
  if (errors.length > 0) {
    console.error(formatIssues(errors));
    process.exit(1);
  }
  if (!flags.has("--allow-partial") && checks.some((c) => c.unrated > 0)) {
    console.error(`아직 평가하지 않은 코디가 있어요(${checks.map((c) => c.unrated).join(" / ")}개). 두 사람 모두 끝낸 뒤 비교해요.`);
    process.exit(1);
  }
  if (checks[0].evaluator && checks[0].evaluator === checks[1].evaluator) {
    console.error("두 파일의 평가자 ID가 같아요. 서로 다른 평가자의 파일인지 확인해 주세요.");
    process.exit(1);
  }
  const result = compareEvaluations(tables[0], tables[1]);
  const outFile = outIndex >= 0 ? path.resolve(args[outIndex + 1]) : path.join(ROOT, "data/fkd/review/disagreement_review.csv");
  if (fs.existsSync(outFile) && !flags.has("--force")) {
    console.error(`${path.relative(ROOT, outFile)}이 이미 있어요(검토 내용 보호). 다른 --out 경로를 쓰거나 --force`);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, toCsv(REVIEW_HEADERS, result.review));
  const { review, ...summary } = result;
  console.log(JSON.stringify({ ...summary, reviewRows: review.length, reviewFile: path.relative(ROOT, outFile) }, null, 1));
} else {
  console.error("명령: validate | build | compare");
  process.exit(2);
}
