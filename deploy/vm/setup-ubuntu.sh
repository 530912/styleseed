#!/usr/bin/env bash
# 국내 가상서버 최초 1회 준비 (Ubuntu 24.04, root 또는 sudo). 서버에서 실행한다.
#   sudo bash setup-ubuntu.sh
# 하는 일: 보안 업데이트, Docker·Compose 설치, 방화벽(22·80·443만), 스왑 4GB(메모리 순간 초과 시 강제 종료 방지)
# SSH 설정 파일은 바꾸지 않는다(비밀번호 로그인 끄기는 bootstrap.sh harden 단계에서 따로)
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

# 업데이트 중 질문에서 멈추지 않게: 서비스 재시작 자동, 기존 설정 파일 유지
export NEEDRESTART_MODE=a

APT_OPTS=(-y -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold)

apt-get update
apt-get "${APT_OPTS[@]}" upgrade
apt-get "${APT_OPTS[@]}" install docker.io docker-compose-v2 ufw unattended-upgrades

systemctl enable --now docker

# 22번을 먼저 허용한 뒤 켠다(켜는 순간 SSH가 끊기지 않게)
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status verbose | head -12

if ! swapon --show | grep -q /swapfile; then
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

mkdir -p /opt/styleseed

docker --version
docker compose version
echo "준비 완료: /opt/styleseed 에 코드를 올린 뒤 deploy/vm/README.md 3단계"
