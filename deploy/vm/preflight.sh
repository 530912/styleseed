#!/usr/bin/env bash
# 서버 접속 사전 점검 (읽기 전용 — 서버를 바꾸지 않는다, 비밀번호를 묻지 않는다)
#   bash deploy/vm/preflight.sh 172.104.120.148
# 1) 22·80·443 포트에 TCP 연결이 되는지
# 2) SSH 서버가 응답하는지와 허용 인증 방식(비밀번호 시도 없이 확인)
# 3) 배포 키로 이미 접속되는지(bootstrap 이후)
set -u

IP="${1:?사용법: bash deploy/vm/preflight.sh <서버 IP>}"

KEY="$HOME/.ssh/styleseed_cafe24"

echo "== 이 PC의 공인 IP: $(curl -s -m 5 https://api.ipify.org || echo 확인 실패)"

for port in 22 80 443; do
  if nc -z -G 5 "$IP" "$port" 2>/dev/null; then
    echo "포트 $port: 연결됨"
  else
    echo "포트 $port: 연결 안 됨 (서버가 아직 안 열었거나 이 네트워크에서 차단)"
  fi
done

echo "== SSH 응답·인증 방식 (비밀번호 입력 없이 종료)"
ssh -o BatchMode=yes -o ConnectTimeout=8 -o StrictHostKeyChecking=accept-new \
  -o PreferredAuthentications=none "root@$IP" true 2>&1 | grep -E "Permission denied|Connection|timed out|refused|Host key|Warning" | head -3

if [ -f "$KEY" ]; then
  echo "== 배포 키 접속"
  ssh -i "$KEY" -o BatchMode=yes -o ConnectTimeout=8 "root@$IP" 'echo "키 접속 OK: $(. /etc/os-release; echo $PRETTY_NAME), $(uname -m)"' 2>&1 | tail -1
fi

echo
echo "판단: 포트 22 연결됨 + 'Permission denied (publickey,password)' → bootstrap.sh 실행 가능"
echo "      포트 22 연결 안 됨 → 카페24 방화벽 상태 확인 또는 다른 네트워크(휴대폰 핫스팟)에서 재시도"
