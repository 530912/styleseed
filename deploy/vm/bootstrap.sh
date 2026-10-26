#!/usr/bin/env bash
# 카페24 서버 최초 연결·준비 — 단계별로 나눠 실행한다(접속이 끊길 수 있는 변경은 마지막에 따로)
#
#   1) bash deploy/vm/bootstrap.sh <IP> key      ← Mac "터미널 앱"에서. 임시 Root 비밀번호를 1회 입력
#        배포 키 등록 → 키 로그인 확인 → 서버 상태 읽기(변경 없음)
#   2) bash deploy/vm/bootstrap.sh <IP> inspect  ← 언제든(읽기 전용, 키 사용, 비밀번호 없음)
#   3) bash deploy/vm/bootstrap.sh <IP> setup    ← 점검 결과 확인 후. 업데이트·Docker·방화벽(22 먼저 허용)·스왑
#   4) bash deploy/vm/bootstrap.sh <IP> harden   ← 키 로그인을 다시 확인한 뒤에만 비밀번호 로그인 끄기
#
# 비밀번호는 ssh-copy-id가 터미널에서 직접 묻는다(화면·로그·파일에 남지 않음). 개인키는 이 Mac에만 있다.
set -euo pipefail

IP="${1:?사용법: bash deploy/vm/bootstrap.sh <서버 IP> key|inspect|setup|harden}"

STAGE="${2:-key}"

KEY="$HOME/.ssh/styleseed_cafe24"

SERVER="root@$IP"

SSH_OPTS=(-i "$KEY" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10)

cd "$(dirname "$0")"

key_login() {
  ssh "${SSH_OPTS[@]}" -o BatchMode=yes "$SERVER" 'echo "키 로그인 OK: $(hostname)"'
}

inspect() {
  echo "== 서버 상태(읽기 전용)"
  ssh "${SSH_OPTS[@]}" -o BatchMode=yes "$SERVER" 'set +e
    . /etc/os-release; echo "os: $PRETTY_NAME / arch: $(uname -m) / kernel: $(uname -r)"
    echo "cpu: $(nproc) cores, avx2: $(grep -c avx2 /proc/cpuinfo) / $(nproc)"
    free -h | sed -n 1,3p; df -h / | tail -1
    echo "-- 열린 포트(LISTEN)"; ss -ltnp 2>/dev/null | awk "NR>1{print \$4, \$6}" | head -20
    echo "-- ufw"; command -v ufw >/dev/null && ufw status verbose 2>&1 | head -15 || echo "ufw 없음"
    echo "-- iptables INPUT"; iptables -S INPUT 2>/dev/null | head -20
    echo "-- nftables"; command -v nft >/dev/null && nft list ruleset 2>/dev/null | grep -E "table|chain|policy|dport" | head -20 || echo "nft 없음"
    echo "-- firewalld"; systemctl is-active firewalld 2>/dev/null || true
    echo "-- sshd 인증 설정"; sshd -T 2>/dev/null | grep -E "^(port|passwordauthentication|permitrootlogin|pubkeyauthentication|kbdinteractiveauthentication) "
    echo "-- docker"; command -v docker >/dev/null && docker --version || echo "docker 없음"'
}

case "$STAGE" in
  key)
    test -f "$KEY" || ssh-keygen -t ed25519 -N "" -C "styleseed-cafe24-deploy" -f "$KEY" -q
    echo "== 1) 배포 키 등록: 임시 Root 비밀번호를 입력하세요(화면에 표시되지 않음)"
    ssh-copy-id -i "$KEY.pub" -o StrictHostKeyChecking=accept-new -o PubkeyAuthentication=no "$SERVER"
    echo "== 2) 키 로그인 확인(비밀번호 없이)"
    key_login
    inspect
    echo
    echo "완료: 비밀번호 로그인은 그대로 켜져 있다. 위 출력(비밀값 없음)을 Claude B에게 전달하세요."
    ;;
  inspect)
    key_login
    inspect
    ;;
  setup)
    key_login
    echo "== 서버 준비(수 분): 업데이트, Docker, 방화벽(22 먼저 허용), 스왑"
    scp "${SSH_OPTS[@]}" setup-ubuntu.sh "$SERVER:/root/setup-ubuntu.sh"
    ssh "${SSH_OPTS[@]}" "$SERVER" 'bash /root/setup-ubuntu.sh'
    key_login
    inspect
    ;;
  harden)
    echo "== 키 로그인 재확인(실패하면 아무것도 바꾸지 않음)"
    key_login
    ssh "${SSH_OPTS[@]}" "$SERVER" 'set -e
      printf "PasswordAuthentication no\nKbdInteractiveAuthentication no\nPermitRootLogin prohibit-password\n" > /etc/ssh/sshd_config.d/99-styleseed.conf
      if ! sshd -t; then rm -f /etc/ssh/sshd_config.d/99-styleseed.conf; echo "sshd 설정 오류 — 되돌림"; exit 1; fi
      systemctl reload ssh || systemctl reload sshd'
    echo "== 변경 후 키 로그인 재확인"
    key_login
    ssh "${SSH_OPTS[@]}" -o BatchMode=yes "$SERVER" 'sshd -T | grep -E "^(passwordauthentication|permitrootlogin) "'
    ;;
  *)
    echo "단계: key | inspect | setup | harden"; exit 2
    ;;
esac
