#!/usr/bin/env bash
# 통합·배포 전 회귀 확인: 자동 테스트 전부 + 타입 검사 + (선택) 웹 내보내기
#   bash scripts/release/verify-all.sh            # 테스트 + tsc
#   bash scripts/release/verify-all.sh --export   # + expo export --platform web
# 외부 서비스를 부르지 않는다(backend 테스트는 가짜 Supabase·Gemini를 쓴다). FAL_KEY는 비워서 실행한다.
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
  run "$suite" env FAL_KEY= npm run -s "$suite"
done

# expo-env.d.ts는 git에 없다(자동 생성). 새 작업 트리에서는 expo start 한 번 또는 아래 한 줄로 만든다
if [ ! -f expo-env.d.ts ]; then
  printf '/// <reference types="expo/types" />\n\n// NOTE: This file should not be edited and should be in your git ignore\n' > expo-env.d.ts
  echo "info  expo-env.d.ts 생성"
fi

run "tsc" npx tsc --noEmit

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
