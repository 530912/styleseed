#!/usr/bin/env bash
# 80·443 외부 접속 시험 (인증서 발급 전 1회). 서버에 20초짜리 임시 응답기를 띄우고 이 PC에서 접속해 본다.
#   bash deploy/vm/porttest.sh 172.104.120.148
# 서버에 남는 것 없음(응답기는 20초 뒤 스스로 종료). Docker·Caddy가 80·443을 쓰기 전에만 실행한다.
set -u

IP="${1:?사용법: bash deploy/vm/porttest.sh <서버 IP>}"

KEY="$HOME/.ssh/styleseed_cafe24"

ssh -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=10 "root@$IP" '
  for port in 80 443; do
    if ss -ltn "sport = :$port" | grep -q LISTEN; then echo "서버: $port 이미 사용 중 — 시험 생략"; continue; fi
    (timeout 20 python3 -m http.server "$port" --bind 0.0.0.0 >/dev/null 2>&1 &)
  done
  sleep 1; ss -ltn | grep -E ":(80|443) " | sed "s/^/서버 LISTEN: /"'

sleep 2

for port in 80 443; do
  code=$(curl -s -m 8 -o /dev/null -w "%{http_code}" "http://$IP:$port/" 2>/dev/null)
  if [ -n "$code" ] && [ "$code" != "000" ]; then
    echo "포트 $port: 외부 접속 OK (HTTP $code)"
  else
    echo "포트 $port: 외부 접속 실패(시간 초과) — 서버 바깥(제공사) 필터 가능성 → 카페24 문의"
  fi
done
