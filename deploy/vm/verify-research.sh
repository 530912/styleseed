#!/usr/bin/env bash
# 조사용 DB + 카페24 서버 실연동 검증 (값은 출력하지 않는다)
#   bash deploy/vm/verify-research.sh            # smoke만(계정·사진을 만들지 않음, Gemini 호출 없음)
#   bash deploy/vm/verify-research.sh storage    # + Gemini 없이: 테스트 계정 → 사진 업로드·조회 → SlimSAM → 교차 접근 차단 → 계정 삭제 정리
#   bash deploy/vm/verify-research.sh full       # + 실제 1회: 테스트 계정 → 사진 업로드 → Gemini 분석 1회 → SlimSAM →
#                                                #   교차 접근 차단 → 계정 삭제로 정리
# 비밀값은 로컬 deploy/vm/api.env(git 제외)에서 하위 셸로만 읽는다.
# 운영·QA Supabase를 가리키면 check-env가 중단한다(운영 DB는 verify-deploy도 거부).
set -euo pipefail

cd "$(dirname "$0")/../.."

MODE="${1:-smoke}"

API="${API:-https://styleseed.mycafe24.com/api}"

test -f deploy/vm/api.env || { echo "deploy/vm/api.env 없음 — api.env.example을 복사해 채우세요"; exit 1; }

(
  set -a
  . deploy/vm/api.env
  set +a

  echo "== 1) 서버 변수 점검(--target research)"
  NOGEM=""
  [ "$MODE" = "full" ] || NOGEM="--no-gemini"
  TRUST_PROXY=1 node backend/scripts/check-env.mjs --target research $NOGEM

  echo "== 2) smoke: $API"
  node backend/scripts/verify-deploy.mjs --api "$API" --suite smoke

  if [ "$MODE" = "full" ] || [ "$MODE" = "storage" ]; then
    ANALYZE=0
    [ "$MODE" = "full" ] && ANALYZE=1

    SAMPLES="$(mktemp -d)"

    node backend/scripts/make-samples.mjs --out "$SAMPLES" >/dev/null

    echo "== 3) full(가벼운 설정): 계정 2(교차 접근 시험), 순차 3, 동시 2, Gemini ${ANALYZE}회"
    QA_SUPABASE_URL="$SUPABASE_URL" \
    QA_SUPABASE_PUBLISHABLE_KEY="$SUPABASE_PUBLISHABLE_KEY" \
    QA_SUPABASE_SECRET_KEY="$SUPABASE_SECRET_KEY" \
      node backend/scripts/verify-deploy.mjs --api "$API" --suite full \
        --samples "$SAMPLES" --users 2 --sequential 3 --concurrency 2 --rounds 1 \
        --analyze "$ANALYZE" --memory-limit-mb 6144 --report "$SAMPLES/verify-report.json"

    echo "보고서: $SAMPLES/verify-report.json (비밀값 없음)"
  fi
)
