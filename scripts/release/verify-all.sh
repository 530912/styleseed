#!/usr/bin/env bash
# 통합·배포 전 회귀 확인: 자동 테스트 전부 + 타입 검사 + (선택) 웹 내보내기
#   bash scripts/release/verify-all.sh            # 테스트 + tsc
#   bash scripts/release/verify-all.sh --export   # + expo export --platform web
# 외부 서비스를 부르지 않는다(backend 테스트는 가짜 Supabase·Gemini를 쓴다).
# 로컬 .env 값이 테스트 기대값을 바꾸지 않도록 FAL_KEY·GEMINI_MODEL은 비워서 실행한다(dotenv는 이미 있는 변수를 덮지 않음).
set -u
cd "$(dirname "$0")/../.."

fail=0

run() {
  local name="$1"; shift
  local out
  out="$("$@" 2>&1)"
  local code=$?
  local summary
  summary="$(printf '%s\n' "$out" | grep -E '^ℹ (pass|fail|skipped) ' | tr '\n' ' ')"
  if [ $code -eq 0 ]; then
    echo "PASS  $name  $summary"
  else
    echo "FAIL  $name  $summary"
    printf '%s\n' "$out" | grep -E '^✖|Error' | head -20
    fail=1
  fi
}

for suite in test:backend test:client test:engine test:fkd test:round1; do
  run "$suite" env FAL_KEY= GEMINI_MODEL= npm run -s "$suite"
done

# expo-env.d.ts는 git에 없다(자동 생성). 새 작업 트리에서는 expo start 한 번 또는 아래 한 줄로 만든다
if [ ! -f expo-env.d.ts ]; then
  printf '/// <reference types="expo/types" />\n\n// NOTE: This file should not be edited and should be in your git ignore\n' > expo-env.d.ts
  echo "info  expo-env.d.ts 생성"
fi

run "tsc" npx tsc --noEmit

# 화면(라우트)을 추가했는데 .expo/types가 예전 것이면 라우트 타입 오류가 난다 → expo start 한 번 실행 후 다시
if [ $fail -ne 0 ] && [ -f .expo/types/router.d.ts ]; then
  echo "hint  tsc 라우트 오류라면 .expo/types/router.d.ts가 오래된 것일 수 있음: npx expo start 한 번 실행 후 재시도"
fi

run "round1 배정표" node scripts/round1/assignment.mjs --check

if [ "${1:-}" = "--export" ]; then
  run "web export" npx expo export --platform web --output-dir "${TMPDIR:-/tmp}/styleseed-web-export"
fi

if [ $fail -eq 0 ]; then
  echo "모두 통과"
else
  echo "실패 항목이 있음"
fi

exit $fail
