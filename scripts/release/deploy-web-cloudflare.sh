#!/usr/bin/env bash
# 모바일 웹 MVP를 Cloudflare Pages에 올린다(정적 파일 직접 업로드, git 연결·Push 불필요)
#   APPROVED=1 bash scripts/release/deploy-web-cloudflare.sh <환경변수 파일> <Pages 프로젝트 이름>
#   예) APPROVED=1 bash scripts/release/deploy-web-cloudflare.sh .env.research.web styleseed-research
#
# ⛔ 외부 공개 배포다. PO 승인 후에만 APPROVED=1로 실행한다.
# 처음 한 번: Cloudflare 계정(무료) → `npx wrangler@4.149.0 login`(브라우저에서 PO가 직접 로그인)
# 대안: 카페24 같은 도메인 배포는 deploy/vm/deploy-web.sh(B) — 빌드는 아래와 같은 build-web.sh 결과를 쓴다
set -euo pipefail
cd "$(dirname "$0")/../.."

ENV_FILE="${1:?환경변수 파일}"
PROJECT="${2:?Cloudflare Pages 프로젝트 이름}"
OUT=dist-web

if [ "${APPROVED:-}" != "1" ]; then
  echo "외부 공개 배포입니다. PO 승인 후 APPROVED=1을 붙여 실행하세요." >&2
  exit 2
fi

# 1) 검사 통과한 빌드만 올린다(로컬 주소·다른 Supabase·비밀키가 있으면 여기서 멈춤)
bash scripts/release/build-web.sh "$ENV_FILE" "$OUT"

# 2) 시험용 파일이 섞이지 않았는지 마지막 확인
if find "$OUT" -name "__qa-*" | grep -q .; then
  echo "시험용 파일(__qa-*)이 빌드에 있음 — 중단" >&2
  exit 1
fi

# 3) 업로드(같은 이름이면 새 배포로 바뀜, 이전 배포는 Cloudflare 대시보드에서 되돌릴 수 있음)
npx --yes wrangler@4.149.0 pages deploy "$OUT" --project-name "$PROJECT" --branch main --commit-dirty=true
