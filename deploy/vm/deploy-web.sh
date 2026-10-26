#!/usr/bin/env bash
# Expo Web 정적 빌드를 카페24 서버(Caddy /srv/web)에 올린다 — 같은 도메인 배포(권장안)
#   SERVER=root@<서버 IP> bash deploy/vm/deploy-web.sh <expo export 출력 폴더, 기본 dist>
# 빌드(Claude A): EXPO_PUBLIC_API_URL=https://<API_DOMAIN>/api … npx expo export --platform web --output-dir dist
# 앱 빌드 변수 점검: node backend/scripts/check-env.mjs --app --target research
set -euo pipefail

: "${SERVER:?SERVER=root@<서버 IP> 를 지정하세요}"

DIST="${1:-dist}"

KEY="$HOME/.ssh/styleseed_cafe24"

SSH_OPTS=(-o ConnectTimeout=10)

test -f "$KEY" && SSH_OPTS+=(-i "$KEY")

test -f "$DIST/index.html" || { echo "$DIST/index.html 없음 — expo export 먼저"; exit 1; }

# 서버 비밀값이 웹 번들에 섞이지 않았는지 마지막 확인
if grep -rqE "sb_secret_[A-Za-z0-9]{8}|GEMINI_API_KEY|BRIA_API_TOKEN|SUPABASE_SECRET_KEY" "$DIST"; then
  echo "웹 번들에 서버 비밀값으로 보이는 문자열이 있음 — 중단"; exit 1
fi

ARCHIVE="$(mktemp -t styleseed-web).tar.gz"

tar -czf "$ARCHIVE" -C "$DIST" .

scp "${SSH_OPTS[@]}" "$ARCHIVE" "$SERVER:/tmp/styleseed-web.tar.gz"

rm -f "$ARCHIVE"

# 새 폴더에 풀고 한 번에 교체(배포 중 반쯤 바뀐 화면을 보이지 않게)
ssh "${SSH_OPTS[@]}" "$SERVER" 'set -e
  cd /opt/styleseed/deploy/vm
  rm -rf web.new && mkdir web.new
  tar -xzf /tmp/styleseed-web.tar.gz -C web.new && rm /tmp/styleseed-web.tar.gz
  rm -rf web.old && { [ -d web ] && mv web web.old || true; } && mv web.new web
  docker compose up -d --force-recreate caddy
  echo "웹 배포 완료: $(find web -name "*.html" | wc -l) 개 HTML"'
