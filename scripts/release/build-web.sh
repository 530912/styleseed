#!/usr/bin/env bash
# 모바일 웹 MVP 정적 빌드 — 지정한 환경변수 파일의 값만 앱에 넣고, 결과물을 검사한다
#   bash scripts/release/build-web.sh <환경변수 파일> [출력 폴더(기본 dist-web)]
#   예) bash scripts/release/build-web.sh .env.research.web
#   로컬 시험 빌드(가짜 Supabase·로컬 서버)만: ALLOW_LOCAL=1 bash scripts/release/build-web.sh <파일> <폴더>
#
# 왜 이렇게 하나(2026-10-27 확인):
# - expo export는 변환 캐시를 다시 써서, 명령줄에 준 EXPO_PUBLIC_* 대신 예전 빌드 값(로컬 .env = 운영 Supabase)이
#   번들에 남을 수 있었다 → 항상 --clear
# - 로컬 .env를 읽지 않게 EXPO_NO_DOTENV=1. 값은 인자로 준 파일에서만 읽는다(파일은 git에 넣지 않는다)
# - 빌드 후 번들 안의 Supabase·API 주소가 파일 값과 같은지, 로컬 .env의 다른 주소가 없는지, 서버 비밀키가 없는지 확인
set -euo pipefail
cd "$(dirname "$0")/../.."

ENV_FILE="${1:?환경변수 파일을 지정하세요 (예: .env.research.web)}"
OUT="${2:-dist-web}"

if [ ! -f "$ENV_FILE" ]; then
  echo "파일 없음: $ENV_FILE" >&2
  exit 2
fi

# EXPO_PUBLIC_ 값만 읽는다(서버 비밀값이 섞여 있어도 빌드에 넘기지 않음)
while IFS= read -r line; do
  case "$line" in
    EXPO_PUBLIC_*=*) export "${line?}" ;;
  esac
done < "$ENV_FILE"

for name in EXPO_PUBLIC_SUPABASE_URL EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY EXPO_PUBLIC_API_URL; do
  if [ -z "${!name:-}" ]; then
    echo "필수 값 없음: $name" >&2
    exit 2
  fi
done

rm -rf "$OUT"
EXPO_NO_DOTENV=1 npx expo export --platform web --clear --output-dir "$OUT"

BUNDLE="$(ls "$OUT"/_expo/static/js/web/*.js)"

# Cloudflare Pages는 업로드할 때 이름이 node_modules인 폴더를 빼 버린다(2026-10-27 배포에서 아이콘 폰트 404 → 네모 표시).
# expo export가 패키지 에셋(아이콘 폰트·expo-router 이미지)을 assets/node_modules/ 아래에 두므로 assets/vendor/로 옮기고
# 번들 안의 경로도 같이 바꾼다. 경로 문자열은 번들(JS)에만 있다.
if [ -d "$OUT/assets/node_modules" ]; then
  mv "$OUT/assets/node_modules" "$OUT/assets/vendor"
  for js in $BUNDLE; do
    sed -i '' 's#assets/node_modules/#assets/vendor/#g' "$js"
  done
fi

# 정적 호스팅 설정(Cloudflare Pages·Netlify가 읽음, 다른 곳에서는 무시됨)
# - HTML은 매번 새로 받게(배포 직후 옛 화면이 남지 않게), 해시가 붙은 JS·이미지는 오래 캐시
# - 없는 주소는 Expo가 만든 not-found 화면으로
cp "$OUT/+not-found.html" "$OUT/404.html"
cat > "$OUT/_headers" <<'HEADERS'
/*
  Cache-Control: no-cache
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
/_expo/static/*
  Cache-Control: public, max-age=31536000, immutable
/assets/*
  Cache-Control: public, max-age=31536000, immutable
HEADERS

fail=0
check() {
  if [ "$1" = ok ]; then echo "OK    $2"; else echo "FAIL  $2"; fail=1; fi
}

grep -qF "$EXPO_PUBLIC_SUPABASE_URL" $BUNDLE && check ok "Supabase 주소 = 파일 값" || check fail "Supabase 주소가 번들에 없음"
grep -qF "$EXPO_PUBLIC_API_URL" $BUNDLE && check ok "API 주소 = 파일 값" || check fail "API 주소가 번들에 없음"
grep -q "assets/node_modules/" $BUNDLE && check fail "번들에 assets/node_modules 경로가 남아 있음(Cloudflare에서 404)" || check ok "패키지 에셋 경로 = assets/vendor"
find "$OUT" -type d -name node_modules | grep -q . && check fail "출력에 node_modules 폴더가 있음(Cloudflare가 빼고 올림)" || check ok "node_modules 폴더 없음"
# 번들이 가리키는 패키지 에셋(아이콘 폰트 등)이 실제 파일로 모두 있는지
MISSING_ASSETS="$(grep -ohE "assets/vendor/[^\"']+" $BUNDLE | sort -u | while read -r p; do [ -f "$OUT/$p" ] || echo "$p"; done)"
[ -z "$MISSING_ASSETS" ] && check ok "패키지 에셋 파일 모두 있음(Ionicons 포함)" || check fail "없는 에셋: $(echo $MISSING_ASSETS)"
grep -q "assets/vendor/@expo/vector-icons/.*Ionicons\.[0-9a-f]*\.ttf" $BUNDLE && check ok "Ionicons 폰트 경로 있음" || check fail "Ionicons 폰트 경로 없음"
grep -q "localhost:3001" $BUNDLE && check fail "API 기본값(localhost:3001)이 남아 있음" || check ok "API 기본값 없음"

# 번들 안의 Supabase 주소는 파일에 적은 것 하나뿐이어야 한다(테스트·운영 프로젝트가 섞이지 않게)
OTHER_SUPABASE="$(grep -ohE "https://[a-z0-9]+\.supabase\.co" $BUNDLE | sort -u | grep -vxF "$EXPO_PUBLIC_SUPABASE_URL" || true)"
[ -z "$OTHER_SUPABASE" ] && check ok "다른 Supabase 주소 없음" || check fail "다른 Supabase 주소: $OTHER_SUPABASE"

# 조사·배포 빌드에는 로컬 주소가 없어야 한다(시험 빌드만 ALLOW_LOCAL=1)
if [ "${ALLOW_LOCAL:-}" != "1" ]; then
  # supabase-js 인증 라이브러리의 기본값 상수(http://localhost:9999)는 앱이 쓰지 않으므로 제외
  LOCAL_HITS="$(grep -ohE "//(localhost|127\.0\.0\.1)(:[0-9]+)?" $BUNDLE | sort -u | grep -vx "//localhost:9999" || true)"
  [ -z "$LOCAL_HITS" ] && check ok "로컬 주소 없음" || check fail "로컬 주소가 번들에 있음: $(echo $LOCAL_HITS)"
  case "$EXPO_PUBLIC_API_URL" in https://*) check ok "API 주소 https";; *) check fail "API 주소가 https가 아님(Safari가 막음)";; esac
fi

# 로컬 개발 .env의 Supabase 주소가 파일 값과 다르면 번들에 없어야 한다
if [ -f .env ]; then
  DEV_SUPABASE="$(grep -E '^EXPO_PUBLIC_SUPABASE_URL=' .env | head -1 | cut -d= -f2- || true)"
  if [ -n "$DEV_SUPABASE" ] && [ "$DEV_SUPABASE" != "$EXPO_PUBLIC_SUPABASE_URL" ]; then
    grep -qF "$DEV_SUPABASE" $BUNDLE && check fail "개발 .env의 Supabase 주소가 번들에 들어감" || check ok "개발 .env 주소 없음"
  fi
fi

# 서버 비밀키 형식(Gemini AIza…, Supabase secret 값) — sb_secret_ 접두어 검사 문자열만 있는 것은 정상
grep -qE "AIza[0-9A-Za-z_-]{30,}" $BUNDLE && check fail "Google API 키 형식 문자열 발견" || check ok "Google API 키 없음"
grep -qE "sb_secret_[0-9A-Za-z_-]{20,}" $BUNDLE && check fail "Supabase secret 키 발견" || check ok "Supabase secret 키 없음"

if [ "${EXPO_PUBLIC_RESEARCH_MODE:-}" = "true" ]; then
  echo "info  연구 모드 빌드"
fi
if [ -n "${EXPO_PUBLIC_SHOW_PROTOTYPES:-}" ]; then
  check fail "EXPO_PUBLIC_SHOW_PROTOTYPES는 조사 빌드에 넣지 않는다"
fi

[ $fail -eq 0 ] && echo "웹 빌드 검사 통과: $OUT" || { echo "웹 빌드 검사 실패" >&2; exit 1; }
