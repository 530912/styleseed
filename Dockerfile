# STYLESEED 백엔드 배포 이미지 (Railway, Beta Launch)
#
# - 앱(Expo) 의존성 없이 backend/package.json만 설치한다(버전은 루트 lockfile과 같게 유지)
# - SlimSAM 모델(Xenova/slimsam-77-uniform)을 빌드 단계에서 내려받아 이미지에 포함한다
#   → 실행 중 Hugging Face 다운로드가 없고, 모델 캐시를 확인하지 못하면 빌드가 실패한다
# - 비밀값은 이미지에 넣지 않는다. Railway 서비스 변수로만 주입한다(.dockerignore가 .env 제외)
#
# 로컬 확인(Docker 필요): docker build -t styleseed-backend . && docker run --rm -p 3001:3001 --env-file .env styleseed-backend
# 상세: docs/launch/BACKEND_DEPLOY.md

FROM node:24.11.1-bookworm-slim AS deps

WORKDIR /app/backend

COPY backend/package.json backend/package-lock.json ./

# 설치 후 리눅스 컨테이너에서 쓰지 않는 onnxruntime 바이너리(darwin·win32, 약 160MB)를 지운다
RUN npm ci --omit=dev --no-audit --no-fund \
  && npm cache clean --force \
  && rm -rf node_modules/onnxruntime-node/bin/napi-v*/darwin node_modules/onnxruntime-node/bin/napi-v*/win32

COPY backend/scripts/prefetch-models.mjs ./scripts/prefetch-models.mjs

RUN node scripts/prefetch-models.mjs

FROM node:24.11.1-bookworm-slim

ENV NODE_ENV=production \
  PORT=3001

WORKDIR /app/backend

COPY --from=deps --chown=node:node /app/backend/node_modules ./node_modules

COPY --chown=node:node backend/ ./

USER node

EXPOSE 3001

CMD ["node", "server.js"]
