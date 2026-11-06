#!/usr/bin/env bash
# 배포 이미지 사전 검증 (Beta Launch) — Docker가 있는 PC에서 실행. 외부 배포·Push 없음
#
# 측정: 이미지 빌드 시간·크기, 네트워크 없이 모델 로딩, 콜드 스타트(/healthz), smoke 검증,
#       메모리 한도(4g·8g) × 동시 처리(1·2·3) × 반복별 OOM 여부·최대 메모리·지연
#
#   bash backend/scripts/docker-verify.sh                    # 기본: 4g 8g, 동시 1 2 3, 3회
#   MEMS="8g" CONCURRENCY="1 2" REPS=1 bash backend/scripts/docker-verify.sh
#   PLATFORM=linux/amd64 bash backend/scripts/docker-verify.sh   # Railway와 같은 x86_64(Apple Silicon에서는 에뮬레이션이라 느림)
#
# 결과: $OUT_DIR(기본 ./docker-verify-<시각>)에 JSON·로그·summary.tsv
# 비밀값은 쓰지 않는다(가짜 Supabase 주소로 기동, 이미지 처리 측정은 로컬 이미지 서버 사용).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
IMAGE="${IMAGE:-styleseed-backend:verify}"
MEMS="${MEMS:-4g 8g}"
CONCURRENCY="${CONCURRENCY:-1 2 3}"
REPS="${REPS:-3}"
ROUNDS="${ROUNDS:-5}"
PLATFORM="${PLATFORM:-}"
OUT_DIR="${OUT_DIR:-$ROOT/docker-verify-$(date +%Y%m%d-%H%M%S)}"
SAMPLES="${SAMPLES:-$OUT_DIR/samples}"
PORT="${PORT:-39001}"
OPS_TOKEN="docker-verify-$(openssl rand -hex 16 2>/dev/null || date +%s%N)"

command -v docker >/dev/null || { echo "docker가 필요합니다"; exit 2; }

mkdir -p "$OUT_DIR"
cd "$ROOT"

PLATFORM_ARGS=()
[[ -n "$PLATFORM" ]] && PLATFORM_ARGS=(--platform "$PLATFORM")

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$OUT_DIR/run.log"; }

# 1) 빌드
log "빌드 시작 ($IMAGE ${PLATFORM:-native})"
BUILD_START=$(date +%s)
docker build "${PLATFORM_ARGS[@]}" -t "$IMAGE" . > "$OUT_DIR/build.log" 2>&1
BUILD_SECONDS=$(( $(date +%s) - BUILD_START ))
IMAGE_MB=$(( $(docker image inspect "$IMAGE" --format '{{.Size}}') / 1024 / 1024 ))
log "빌드 ${BUILD_SECONDS}초, 이미지 ${IMAGE_MB}MB"

# 2) 네트워크 없이 모델 로딩(이미지에 모델이 들어 있는지)
log "모델 오프라인 로딩 확인(--network none)"
docker run --rm "${PLATFORM_ARGS[@]}" --network none "$IMAGE" node --input-type=module -e '
import { AutoProcessor, SamModel, env } from "@huggingface/transformers";
env.allowRemoteModels = false;
const t = performance.now();
await SamModel.from_pretrained("Xenova/slimsam-77-uniform");
await AutoProcessor.from_pretrained("Xenova/slimsam-77-uniform");
console.log(JSON.stringify({ offlineModelLoadMs: Math.round(performance.now() - t) }));
' | tee "$OUT_DIR/model-offline.json"

# 3) 콜드 스타트 + smoke 검증(8g)
log "콜드 스타트 측정"
CID=$(docker run -d --rm "${PLATFORM_ARGS[@]}" --memory=8g --memory-swap=8g -p "$PORT:3001" \
  -e SUPABASE_URL=https://verify-placeholder.supabase.co \
  -e SUPABASE_PUBLISHABLE_KEY=sb_publishable_placeholder \
  -e OPS_METRICS_TOKEN="$OPS_TOKEN" -e TRUST_PROXY=1 "$IMAGE")
START=$(date +%s%N)
for _ in $(seq 1 120); do
  curl -sf "http://127.0.0.1:$PORT/healthz" >/dev/null && break
  sleep 0.5
done
COLD_MS=$(( ($(date +%s%N) - START) / 1000000 ))
log "/healthz 200까지 ${COLD_MS}ms"
OPS_METRICS_TOKEN="$OPS_TOKEN" node backend/scripts/verify-deploy.mjs --api "http://127.0.0.1:$PORT" --suite smoke --local \
  --report "$OUT_DIR/smoke.json" | tee -a "$OUT_DIR/run.log" || true
docker stop "$CID" >/dev/null

# 4) 샘플 이미지(긴 변 1600px)
if [[ ! -d "$SAMPLES" ]]; then
  log "샘플 생성 → $SAMPLES"
  node backend/scripts/make-samples.mjs --out "$SAMPLES" > /dev/null
fi

# 5) 메모리 한도 × 동시 처리 × 반복
printf "mem\tconcurrency\trep\texit\toom\tpeak_docker_mb\tpeak_sampled_mb\tp90_ms\tstatuses\n" > "$OUT_DIR/summary.tsv"
for MEM in $MEMS; do
  for C in $CONCURRENCY; do
    for REP in $(seq 1 "$REPS"); do
      NAME="styleseed-verify-$MEM-c$C-r$REP"
      RESULT="$OUT_DIR/route-$MEM-c$C-r$REP.json"
      log "측정 $NAME"
      docker run -d --name "$NAME" "${PLATFORM_ARGS[@]}" --memory="$MEM" --memory-swap="$MEM" \
        -v "$SAMPLES:/samples:ro" "$IMAGE" \
        sh -c "node scripts/measure-route-memory.mjs --offline --concurrency $C --rounds $ROUNDS /samples/*.jpg" > /dev/null

      PEAK=0
      while [[ "$(docker inspect -f '{{.State.Running}}' "$NAME" 2>/dev/null)" == "true" ]]; do
        USED=$(docker stats --no-stream --format '{{.MemUsage}}' "$NAME" 2>/dev/null | awk '{print $1}')
        MB=$(echo "$USED" | awk '/GiB/{printf "%d", $1*1024} /MiB/{printf "%d", $1} /KiB/{printf "%d", $1/1024}' | tr -d 'GiBMK')
        [[ -n "$MB" && "$MB" -gt "$PEAK" ]] && PEAK=$MB
        sleep 1
      done

      EXIT=$(docker inspect -f '{{.State.ExitCode}}' "$NAME")
      OOM=$(docker inspect -f '{{.State.OOMKilled}}' "$NAME")
      docker logs "$NAME" > "$RESULT" 2> "$RESULT.stderr" || true
      docker rm "$NAME" > /dev/null

      if [[ "$EXIT" == "0" ]]; then
        read -r SAMPLED P90 STATUSES < <(node -e '
          const r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
          console.log(r.rssMB.peakUnderLoad, r.latencyMs.p90, JSON.stringify(r.statuses));' "$RESULT")
      else
        SAMPLED="-"; P90="-"; STATUSES="-"
      fi

      printf "%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n" "$MEM" "$C" "$REP" "$EXIT" "$OOM" "$PEAK" "$SAMPLED" "$P90" "$STATUSES" \
        | tee -a "$OUT_DIR/summary.tsv"
    done
  done
done

{
  echo "build_seconds=$BUILD_SECONDS"
  echo "image_mb=$IMAGE_MB"
  echo "cold_start_ms=$COLD_MS"
} > "$OUT_DIR/build-summary.txt"

log "완료. 판정 기준: docs/launch/RAILWAY_DEPLOY_RUNBOOK.md 4장 (exit 0, OOM false, 최대 메모리 ≤ 한도의 75%)"
log "결과: $OUT_DIR/summary.tsv"
