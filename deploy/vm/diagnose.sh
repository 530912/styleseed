#!/usr/bin/env bash
# 배포 상태 읽기 전용 진단 (서버를 바꾸지 않는다, 비밀값 내용은 출력하지 않는다)
#   bash deploy/vm/diagnose.sh 172.104.120.148
set -u
IP="${1:?사용법: bash deploy/vm/diagnose.sh <서버 IP>}"
ssh -i "$HOME/.ssh/styleseed_cafe24" -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=10 "root@$IP" '
  cd /opt/styleseed/deploy/vm 2>/dev/null || { echo "/opt/styleseed/deploy/vm 없음"; exit 0; }
  echo "-- 파일(크기만)"; ls -la api.env .env compose.yaml Caddyfile 2>&1 | awk "{print \$5, \$9}"
  echo "-- api.env 변수 이름(값 미출력)"; grep -oE "^[A-Z_]+=" api.env 2>/dev/null | tr "\n" " "; echo
  echo "-- 배포된 코드"; ls /opt/styleseed | head -5
  echo "-- 남은 임시 응답기"; pgrep -af "[p]ython3 -m http.server" || echo "없음"
  echo "-- 80·443 사용 프로세스"; ss -ltnp | grep -E ":(80|443) " || echo "없음"
  echo "-- docker images"; docker images --format "{{.Repository}}:{{.Tag}} {{.Size}}" | head -5
  echo "-- docker compose ps"; docker compose ps -a 2>&1 | head -5
  echo "-- caddy 로그(최근 15줄)"; docker compose logs --tail 15 caddy 2>&1 | cut -c1-220
  echo "-- api 로그(최근 10줄)"; docker compose logs --tail 10 api 2>&1 | cut -c1-220'
