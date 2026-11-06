#!/usr/bin/env bash
# 분류 체계 인계(2026-10-22) 비파괴 검토 — 앱·DB·계약·Lab 데이터를 바꾸지 않는다
#   LAB_TAXONOMY_JSON=<Lab docs/handoff/knowledge-lab-taxonomy-2026-10-22.json> bash scripts/analysis/taxonomy-review-2026-10-22/run.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
HERE="$ROOT/scripts/analysis/taxonomy-review-2026-10-22"
ENGINE_DIR="$(mktemp -d)"
"$ROOT/node_modules/.bin/tsc" --ignoreConfig --outDir "$ENGINE_DIR" --module commonjs --target es2022 --moduleResolution node \
  --ignoreDeprecations 6.0 --skipLibCheck --esModuleInterop \
  "$ROOT/src/utils/outfitScore.ts" "$ROOT/src/utils/recommendation.ts" "$ROOT/src/utils/weatherRecommendation.ts" "$ROOT/src/utils/prototypeCore.ts"
ENGINE_DIR="$ENGINE_DIR" node "$HERE/engine-scenarios.cjs"
: "${LAB_TAXONOMY_JSON:?Lab 인계 JSON 경로를 LAB_TAXONOMY_JSON에 지정}"
LAB_TAXONOMY_JSON="$LAB_TAXONOMY_JSON" node "$HERE/contract-scenarios.mjs"
