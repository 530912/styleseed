#!/usr/bin/env bash
# 로컬(이 저장소)에서 서버로 코드 올리기 + 빌드·재시작. GitHub Push가 필요 없다.
#   SERVER=root@<서버 IP> bash deploy/vm/deploy.sh [브랜치, 기본 integration/mvp-2026-11]
#
# 비밀값: 로컬 deploy/vm/api.env(git 제외)가 있으면 먼저 check-env로 이름·형식만 점검(값은 출력하지 않음)한 뒤
#         서버에 권한 600으로 올린다. 없으면 서버에 이미 있는 api.env를 그대로 쓴다.
#         CHECK_TARGET(기본 research)이 운영·QA Supabase를 가리키면 업로드를 중단한다.
#         INFRA_ONLY=1: 조사 DB·Gemini 키 없이 인프라만 먼저 확인(Docker·HTTPS·/healthz·SlimSAM 로딩).
#                       api.env에 비밀값 없이 ALLOW_TOKENLESS_GUEST=false 등만 두고 실행. 분석·저장은 동작하지 않음
# SSH 키: ~/.ssh/styleseed_cafe24 (bootstrap.sh가 등록)
set -euo pipefail

: "${SERVER:?SERVER=root@<서버 IP> 를 지정하세요}"

REF="${1:-integration/mvp-2026-11}"

CHECK_TARGET="${CHECK_TARGET:-research}"

KEY="$HOME/.ssh/styleseed_cafe24"

SSH_OPTS=(-o ConnectTimeout=10)

test -f "$KEY" && SSH_OPTS+=(-i "$KEY")

cd "$(dirname "$0")/../.."

VM=deploy/vm

if [ -f "$VM/api.env" ] && [ "${INFRA_ONLY:-}" != "1" ]; then
  echo "== api.env 점검(--target $CHECK_TARGET, 값 미출력)"
  # 하위 셸에서만 변수를 읽는다(현재 셸·로그에 남기지 않음)
  ( set -a; . "$VM/api.env"; set +a; TRUST_PROXY=1 node backend/scripts/check-env.mjs --target "$CHECK_TARGET" )
fi

ARCHIVE="$(mktemp -t styleseed-deploy).tar.gz"

git archive --format=tar.gz -o "$ARCHIVE" "$REF"

echo "== 올리는 커밋: $(git rev-parse --short "$REF") ($REF)"

scp "${SSH_OPTS[@]}" "$ARCHIVE" "$SERVER:/tmp/styleseed.tar.gz"

rm -f "$ARCHIVE"

ssh "${SSH_OPTS[@]}" "$SERVER" 'mkdir -p /opt/styleseed && cd /opt/styleseed && tar -xzf /tmp/styleseed.tar.gz && rm /tmp/styleseed.tar.gz'

for file in api.env .env; do
  if [ -f "$VM/$file" ]; then
    scp "${SSH_OPTS[@]}" "$VM/$file" "$SERVER:/opt/styleseed/deploy/vm/$file"
    echo "== $file 업로드(권한 600)"
  fi
done

ssh "${SSH_OPTS[@]}" "$SERVER" 'set -e
  cd /opt/styleseed/deploy/vm
  test -f api.env || { [ "'"${INFRA_ONLY:-}"'" = "1" ] && printf "ALLOW_TOKENLESS_GUEST=false\nGEMINI_MODEL=gemini-3.6-flash\nGEMINI_DAILY_LIMIT=1\n" > api.env; }
  test -f api.env || { echo "api.env 없음 — deploy/vm/README.md 3단계"; exit 1; }
  test -f .env || { echo ".env(API_DOMAIN) 없음 — deploy/vm/README.md 3단계"; exit 1; }
  chmod 600 api.env .env
  docker compose up -d --build
  docker compose ps'
