# 국내 가상서버 배포 (2026-11 사용자 조사, Railway 대체)

앱·백엔드 코드는 바꾸지 않는다. 저장소 루트 `Dockerfile`을 서버에서 그대로 빌드하고, 앞에 Caddy(HTTPS)를 둔다.
선택 근거·상품 비교: `docs/launch/2026-11-DOMESTIC-SERVER-OPTIONS.md`.

| 파일 | 역할 |
|---|---|
| `compose.yaml` | `api`(Express + SlimSAM, 메모리 6GB 제한, 상태 확인) + `caddy`(80·443, 인증서 자동) |
| `Caddyfile` | `API_DOMAIN` → `api:3001`, 본문 12MB |
| `setup-ubuntu.sh` | 서버 최초 1회: 업데이트, Docker, 방화벽 22·80·443, 스왑 4GB |
| `deploy.sh` | 이 PC에서 `git archive` → `scp` → 서버에서 `docker compose up -d --build` (GitHub Push 불필요) |
| `api.env.example` | 서버 비밀값 목록(서버에서 `api.env`로 복사, git 제외) |
| `.env.example` | `API_DOMAIN` |

## 순서 (서버 생성 후)

1. **도메인**: `API_DOMAIN`(예: `api.<도메인>`)의 A 레코드를 서버 공인 IP로. 기본 제공 `아이디.mycafe24.com`도 가능하지만 인증서 발급 제한 여부가 확인되지 않아 **자체 도메인 권장**.
2. **서버 준비**(SSH 접속 후): `sudo bash setup-ubuntu.sh` — 스크립트는 1단계 업로드 전에 따로 복사하거나 내용을 붙여 넣어 실행.
3. **비밀값**(서버에서만): 첫 배포 전 `/opt/styleseed/deploy/vm/`에 `api.env`(← `api.env.example`)와 `.env`(← `.env.example`)를 만들고 값을 채운다. `chmod 600 api.env`.
4. **배포**(이 PC): `SERVER=root@<IP> bash deploy/vm/deploy.sh` → 빌드(첫 회 SlimSAM 모델 포함 수 분) → `docker compose ps`가 `healthy`.
5. **검증**(이 PC): `node backend/scripts/verify-deploy.mjs --api https://<API_DOMAIN> --suite smoke` → `docs/launch/2026-11-MVP-GO-LIVE-STEPS.md` 3장 검증 순서.

## 운영

```bash
cd /opt/styleseed/deploy/vm
docker compose ps                         # 상태(healthy)
docker compose logs --since 24h api > /tmp/api.log   # 일일 점검 → GO-LIVE 문서의 grep 명령 그대로
docker stats --no-stream                  # 메모리
docker compose restart api                # 재시작
```

- 컨테이너가 메모리 초과 등으로 죽으면 `restart: unless-stopped`로 자동 재시작. 상태 확인 실패만으로는 재시작하지 않으므로 일일 점검에서 `healthy` 확인.
- 보안 업데이트는 `unattended-upgrades`가 자동 적용. SSH는 키 인증 권장(비밀번호 로그인 끄기).
- 조사 종료 후: 서비스 기간 만료 전 데이터 백업 불필요(서버에는 사용자 데이터 없음 — 사진·옷은 Supabase). 만료 시 서버 삭제.

> 이 키트는 로컬에서 문법만 확인했다(셸 `bash -n`, YAML 파싱). 실제 서버·Docker에서는 아직 실행하지 않았다.
