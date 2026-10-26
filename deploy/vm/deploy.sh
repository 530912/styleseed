#!/usr/bin/env bash
# 로컬(이 저장소)에서 서버로 코드 올리기 + 빌드·재시작. GitHub Push가 필요 없다.
#   SERVER=root@<서버 IP> bash deploy/vm/deploy.sh [브랜치, 기본 integration/mvp-2026-11]
# 서버의 /opt/styleseed/deploy/vm/{api.env,.env}는 덮어쓰지 않는다(비밀값은 서버에만).
set -euo pipefail

: "${SERVER:?SERVER=user@host 를 지정하세요}"

REF="${1:-integration/mvp-2026-11}"

cd "$(dirname "$0")/../.."

ARCHIVE="$(mktemp -t styleseed-deploy).tar.gz"

git archive --format=tar.gz -o "$ARCHIVE" "$REF"

echo "올리는 커밋: $(git rev-parse --short "$REF") ($REF)"

scp "$ARCHIVE" "$SERVER:/tmp/styleseed.tar.gz"

ssh "$SERVER" 'set -e
  cd /opt/styleseed
  tar -xzf /tmp/styleseed.tar.gz
  rm /tmp/styleseed.tar.gz
  cd deploy/vm
  test -f api.env || { echo "api.env 없음 — README 3단계"; exit 1; }
  test -f .env || { echo ".env(API_DOMAIN) 없음 — README 3단계"; exit 1; }
  chmod 600 api.env
  docker compose up -d --build
  docker compose ps'

rm -f "$ARCHIVE"
