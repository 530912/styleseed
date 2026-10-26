#!/usr/bin/env bash
# 카페24 서버 최초 1회 연결·준비 (PO가 Mac 터미널에서 직접 실행)
#   bash deploy/vm/bootstrap.sh <서버 IP>
#
# 1) 배포 전용 SSH 키(~/.ssh/styleseed_cafe24)를 서버 root에 등록 — 이때 한 번만 임시 Root 비밀번호를 직접 입력
# 2) 키로 접속되는지 확인
# 3) setup-ubuntu.sh 실행: 보안 업데이트, Docker, 방화벽(22·80·443), 스왑 4GB
# 4) SSH 비밀번호 로그인 끄기(키 로그인만)
# 5) 환경 점검 출력: CPU 아키텍처, Docker 동작, 메모리·디스크
set -euo pipefail

IP="${1:?사용법: bash deploy/vm/bootstrap.sh <서버 IP>}"

KEY="$HOME/.ssh/styleseed_cafe24"

SERVER="root@$IP"

SSH_OPTS=(-i "$KEY" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10)

cd "$(dirname "$0")"

test -f "$KEY" || ssh-keygen -t ed25519 -N "" -C "styleseed-cafe24-deploy" -f "$KEY" -q

echo "== 1/5 SSH 키 등록 (임시 Root 비밀번호를 입력하세요. 화면에 표시되지 않습니다)"
ssh-copy-id -i "$KEY.pub" -o StrictHostKeyChecking=accept-new "$SERVER"

echo "== 2/5 키 로그인 확인"
ssh "${SSH_OPTS[@]}" -o BatchMode=yes "$SERVER" 'echo "키 로그인 OK: $(hostname)"'

echo "== 3/5 서버 준비 (수 분)"
scp "${SSH_OPTS[@]}" setup-ubuntu.sh "$SERVER:/root/setup-ubuntu.sh"
ssh "${SSH_OPTS[@]}" "$SERVER" 'bash /root/setup-ubuntu.sh'

echo "== 4/5 비밀번호 로그인 끄기"
ssh "${SSH_OPTS[@]}" "$SERVER" 'set -e
  printf "PasswordAuthentication no\nKbdInteractiveAuthentication no\nPermitRootLogin prohibit-password\n" > /etc/ssh/sshd_config.d/99-styleseed.conf
  sshd -t
  systemctl reload ssh || systemctl reload sshd'
ssh "${SSH_OPTS[@]}" -o BatchMode=yes "$SERVER" 'echo "재확인: 키 로그인 OK"'

echo "== 5/5 환경 점검"
ssh "${SSH_OPTS[@]}" "$SERVER" 'set -e
  echo "arch: $(uname -m)  (x86_64 이어야 함)"
  . /etc/os-release && echo "os: $PRETTY_NAME"
  echo "cpu: $(nproc) cores, avx2: $(grep -c avx2 /proc/cpuinfo || true) / $(nproc)"
  free -h | sed -n 1,3p
  df -h / | tail -1
  docker run --rm hello-world >/dev/null && echo "docker: OK" || echo "docker: 실패"
  ufw status | head -6'

echo
echo "완료. 위 출력 전체를 Claude B에게 전달하세요(비밀값 없음)."
