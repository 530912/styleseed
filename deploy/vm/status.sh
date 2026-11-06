#!/usr/bin/env bash
# 서버 상태 한눈에 보기 (비밀값 미출력)
#   SERVER=root@<서버 IP> bash deploy/vm/status.sh
set -euo pipefail
: "${SERVER:?SERVER=root@<서버 IP>}"
KEY="$HOME/.ssh/styleseed_cafe24"
ssh -i "$KEY" -o ConnectTimeout=10 "$SERVER" 'set -e
  cd /opt/styleseed/deploy/vm
  docker compose ps
  docker stats --no-stream --format "{{.Name}}  mem {{.MemUsage}}  cpu {{.CPUPerc}}"
  domain=$(grep -E "^API_DOMAIN=" .env | cut -d= -f2)
  echo "healthz(내부): $(docker compose exec -T api node -e "fetch(\"http://127.0.0.1:3001/healthz\").then(r=>r.text()).then(console.log)")"
  echo "healthz(https://$domain): $(curl -s -m 10 https://$domain/api/healthz || echo 실패)"
  echo "최근 오류(24h): $(docker compose logs --since 24h api 2>/dev/null | grep -c "\"evt\":\"http_error\"" || true)"'
