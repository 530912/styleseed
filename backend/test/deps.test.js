// 배포 이미지 의존성 확인 (Beta Launch DP-01 ~ 03)
// Dockerfile은 backend/package.json만 설치한다. 백엔드 코드가 새 패키지를 쓰거나 루트 버전이 바뀌면
// 여기서 실패하므로 backend/package.json·backend/package-lock.json을 함께 갱신한다
// (cd backend && npm install --package-lock-only --ignore-scripts).

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { builtinModules } = require("node:module");

const BACKEND = path.join(__dirname, "..");

const backendPackage = require("../package.json");
const backendLock = require("../package-lock.json");
const rootLock = require("../../package-lock.json");

const BUILTINS = new Set(builtinModules.flatMap((name) => [name, `node:${name}`]));

// 배포 이미지에 들어가는 코드(test 제외)
const listSources = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      return ["node_modules", "test"].includes(entry.name) ? [] : listSources(full);
    }

    return /\.(c|m)?js$/.test(entry.name) ? [full] : [];
  });

const packageName = (specifier) =>
  specifier.startsWith("@") ? specifier.split("/").slice(0, 2).join("/") : specifier.split("/")[0];

const usedPackages = () => {
  const used = new Map();

  const pattern = /(?:require\(|import\(|from\s+)["']([^"'.][^"']*)["']/g;

  for (const file of listSources(BACKEND)) {
    for (const [, specifier] of fs.readFileSync(file, "utf8").matchAll(pattern)) {
      if (BUILTINS.has(specifier)) continue;

      used.set(packageName(specifier), path.relative(BACKEND, file));
    }
  }

  return used;
};

test("DP-01 백엔드 코드가 쓰는 패키지는 모두 backend/package.json에 있다", () => {
  const declared = backendPackage.dependencies;

  for (const [name, file] of usedPackages()) {
    assert.ok(declared[name], `${name} (${file})가 backend/package.json에 없습니다`);
  }
});

test("DP-02 backend/package.json 버전은 루트 package-lock.json 설치 버전과 같다", () => {
  for (const [name, version] of Object.entries(backendPackage.dependencies)) {
    const root = rootLock.packages[`node_modules/${name}`]?.version;

    assert.equal(version, root, `${name}: backend ${version} / 루트 ${root}`);
  }
});

test("DP-03 backend/package-lock.json이 backend/package.json과 맞는다(npm ci 가능)", () => {
  assert.deepEqual(backendLock.packages[""].dependencies, backendPackage.dependencies);

  for (const [name, version] of Object.entries(backendPackage.dependencies)) {
    assert.equal(backendLock.packages[`node_modules/${name}`]?.version, version, name);
  }
});
