#!/usr/bin/env bash
# 실제 iOS Safari(Xcode 시뮬레이터) 회귀 시험 — 모바일 웹 MVP
#   bash scripts/webqa/run-safari-sim.sh [반복 횟수=3] [시뮬레이터 이름="iPhone 17 Pro"]
#
# 하는 일(모두 이 Mac 안에서만, 외부 서비스·운영 DB 접속 없음):
#  1) 가짜 Supabase(127.0.0.1:54321) + 로컬 시험 빌드(build-web.sh, ALLOW_LOCAL=1)
#  2) 빌드 복사본에만 시험 드라이버를 넣고 정적 서버(localhost:8181)로 연다
#  3) 시뮬레이터 Safari에서
#     A. [옷장 → 옷 탭 → 코디 → TOP 3 → 뒤로 → 새로고침] N회 (2026-10-27 Playwright WebKit 크래시 경로)
#     B. 사진 처리: 24MP(5712×4284·4900×4900)·HEIC → 1600px JPEG, 24MP 15회 반복 메모리
#  4) 단계 기록을 읽어 PASS/FAIL
# 필요: macOS + Xcode(iOS 시뮬레이터), node. 분석(Gemini)은 부르지 않는다.
set -euo pipefail
cd "$(dirname "$0")/../.."

RUNS="${1:-3}"
DEVICE_NAME="${2:-iPhone 17 Pro}"
WORK="$(mktemp -d -t styleseed-webqa)"
MOCK=http://127.0.0.1:54321
pids=()
cleanup() { for p in "${pids[@]}"; do kill "$p" 2>/dev/null || true; done; }
trap cleanup EXIT

for port in 54321 8181; do
  if lsof -ti "tcp:$port" -sTCP:LISTEN >/dev/null; then echo "포트 $port 사용 중 — 비우고 다시 실행" >&2; exit 2; fi
done

echo "== 1. 가짜 Supabase + 시험 빌드"
node scripts/webqa/mock-supabase.mjs > "$WORK/mock.log" 2>&1 & pids+=($!)
cat > "$WORK/env" <<EOF
EXPO_PUBLIC_SUPABASE_URL=$MOCK
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_localmock
EXPO_PUBLIC_API_URL=http://localhost:3101
EXPO_PUBLIC_RESEARCH_MODE=true
EOF
ALLOW_LOCAL=1 bash scripts/release/build-web.sh "$WORK/env" "$WORK/dist" | grep -E "^(OK|FAIL|웹)"

echo "== 2. 시험 드라이버·사진 넣기(복사본만)"
cp scripts/webqa/qa-driver.js "$WORK/dist/__qa-driver.js"
cp scripts/webqa/qa-image.html "$WORK/dist/__qa-image.html"
# 드라이버 주소에 실행마다 다른 값을 붙인다(정적 서버가 JS를 오래 캐시하므로 예전 드라이버가 쓰이지 않게)
V="$(date +%s)"
find "$WORK/dist" -name "*.html" ! -name "__qa-image.html" -exec sed -i '' "s#</body>#<script src=\"/__qa-driver.js?v=$V\"></script></body>#" {} \;
SRC=assets/images/products/white-shirts.jpg
sips -s format jpeg -z 4284 5712 "$SRC" --out "$WORK/dist/photo-24mp-wide.jpg" >/dev/null
sips -s format jpeg -z 4900 4900 "$SRC" --out "$WORK/dist/shirt-24mp.jpg" >/dev/null
sips -s format heic assets/images/products/poet-core-denim.jpg --out "$WORK/dist/jeans.heic" >/dev/null
node scripts/webqa/static-server.mjs "$WORK/dist" 8181 > "$WORK/static.log" 2>&1 & pids+=($!)
sleep 1
SESSION="$(node scripts/webqa/seed.mjs "$MOCK")"

echo "== 3. 시뮬레이터 Safari ($DEVICE_NAME)"
UDID="$(xcrun simctl list devices available | grep -F "$DEVICE_NAME (" | head -1 | grep -oE '[0-9A-F-]{36}')"
[ -n "$UDID" ] || { echo "시뮬레이터 없음: $DEVICE_NAME" >&2; exit 2; }
xcrun simctl boot "$UDID" 2>/dev/null || true
xcrun simctl bootstatus "$UDID" -b >/dev/null
# 위치 권한 시스템 창이 화면을 막지 않도록 시뮬레이터 Safari 위치 권한은 "거부"(참가자가 거부한 경우와 같음, 시뮬레이터 설정만)
xcrun simctl privacy "$UDID" revoke location com.apple.mobilesafari 2>/dev/null || true
xcrun simctl terminate "$UDID" com.apple.mobilesafari 2>/dev/null || true

stages() { curl -s "$MOCK/__state" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const L=JSON.parse(d).log.filter(l=>l.includes("/__ping/")).map(l=>decodeURIComponent(l.split(" ")[1].replace("/__ping/","")));console.log(L.join("\n"))})'; }
wait_for() { local pattern="$1" limit="$2" t=0; until stages | grep -qE "$pattern"; do sleep 2; t=$((t + 2)); [ $t -ge "$limit" ] && return 1; done; }

xcrun simctl openurl "$UDID" "http://localhost:8181/closet#qa-session=$SESSION~runs=$RUNS"
wait_for "^done$|^err-" $((RUNS * 40 + 60)) || true
A="$(stages)"

xcrun simctl openurl "$UDID" "http://localhost:8181/__qa-image.html"
wait_for "^DONE$|^ERR" 120 || true
B="$(stages)"
xcrun simctl io "$UDID" screenshot "$WORK/last.png" >/dev/null 2>&1 || true

echo "== 4. 결과"
fail=0
survived="$(printf '%s\n' "$A" | grep -c '^survived-' || true)"
if printf '%s\n' "$A" | grep -q '^done$' && [ "$survived" -ge "$RUNS" ]; then
  echo "PASS  A. 코디→TOP 3→뒤로→새로고침 ${survived}/${RUNS}회 생존"
else
  echo "FAIL  A. 생존 ${survived}/${RUNS} — 마지막 단계: $(printf '%s\n' "$A" | tail -3 | tr '\n' ' ')"; fail=1
fi
for f in photo-24mp-wide.jpg shirt-24mp.jpg jeans.heic; do
  line="$(printf '%s\n' "$B" | grep "^NEW $f " | tail -1)"
  if [ -n "$line" ] && printf '%s' "$line" | grep -qE -- "-> (1600x|[0-9]+x1600|525x630)"; then echo "PASS  B. $line"; else echo "FAIL  B. $f ${line:-기록 없음}"; fail=1; fi
done
printf '%s\n' "$B" | grep -q "^MEM repeat24mp=15 alive" && echo "PASS  B. 24MP 15회 반복 후 페이지 유지" || { echo "FAIL  B. 메모리 반복"; fail=1; }
printf '%s\n' "$B" | grep "^OLD " | sed 's/^/info  (예전 방식) /' || true
echo "기록·화면: $WORK"
exit $fail
