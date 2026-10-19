# 백엔드 클라우드 배포 준비 — Railway + SlimSAM (Beta Launch)

| 항목 | 내용 |
|---|---|
| 작성일 | 2026-10-19 |
| 상태 | **배포 파일·검증 스크립트 준비 완료. Railway 프로젝트 생성·배포·유료 리소스는 하지 않았다.** |
| 함께 볼 문서 | `DEPLOYMENT_PLAN.md` 4장(아키텍처), `COST_ESTIMATE.md` |

---

## 1. 만든 파일

| 파일 | 내용 |
|---|---|
| `Dockerfile` (루트) | 2단계 빌드. ① `backend/package.json`만 `npm ci --omit=dev`, 리눅스에서 안 쓰는 onnxruntime 바이너리 제거, **SlimSAM 모델 사전 다운로드·캐시 검증** ② 실행 이미지에 `node_modules`(모델 캐시 포함) + `backend/` 복사, `node` 사용자로 실행 |
| `.dockerignore` | `backend/`만 빌드 컨텍스트에 포함. `backend/test`, `.env*` 제외 |
| `backend/package.json`, `backend/package-lock.json` | 배포 전용 의존성 7개. **버전은 루트 lockfile과 같아야 한다** — `backend/test/deps.test.js`(DP-01~03)가 `npm run test:backend`에서 확인 |
| `backend/scripts/prefetch-models.mjs` | 모델 다운로드 후 `allowRemoteModels = false`로 다시 로딩해 캐시만으로 뜨는지 확인. 실패하면 빌드 실패 |
| `backend/scripts/measure-slimsam.mjs` | 모델 로딩 시간, RSS, 이미지별 처리 시간, 동시 처리 시 최대 RSS 측정 |
| `docs/launch/railway/railway.ts.example` | Railway Infrastructure as Code 초안(적용 안 함) |

Railway는 저장소 루트에 `Dockerfile`이 있으면 그것으로 빌드한다. 루트 `package.json`(Expo 앱 의존성 700여 개)은 이미지에 들어가지 않는다.

## 2. 실행 구성

| 항목 | 값 | 비고 |
|---|---|---|
| 포트 | `PORT`(Railway 주입, 기본 3001) | `server.js`가 `process.env.PORT`를 읽음 |
| 헬스 체크 | **`GET /healthz`** → `200 {"status":"ok","uptimeSeconds":n}` | 인증 없음, 내부 정보 미노출. 기존 `GET /`도 200 |
| 헬스 체크 시점 | Railway는 **배포 때만** 확인(운영 중 감시 안 함) [공식] | 운영 감시는 별도 Uptime 도구(결정 D-9) |
| 헬스 체크 시간 제한 | 기본 300초 [공식] | 모델이 이미지에 있어 기동은 수 초 |
| 리전 | 싱가포르(Supabase와 같은 지역) | Railway 리전 ID는 대시보드에서 확인 |
| 메모리 | **4GB 한도 + SlimSAM 동시 처리 1건 제한 필요**(4장) | |
| 재시작 정책 | 실패 시 재시작 | |

### 환경변수 (Railway 서비스 변수)

| 변수 | 값 | 비밀 | 필수 |
|---|---|---|---|
| `SUPABASE_URL` | 운영 프로젝트 URL | | ✅ |
| `SUPABASE_PUBLISHABLE_KEY` | Publishable key | | ✅ |
| `SUPABASE_SECRET_KEY` | 관리자 키(`sb_secret_…`) — 계정 삭제 전용 | 🔒 | ✅ (없으면 계정 삭제 503) |
| `GEMINI_API_KEY` | | 🔒 | ✅ |
| `BRIA_API_TOKEN` | | 🔒 | ✅ |
| `FAL_KEY` | 쓰지 않음(앱이 fal 경로를 호출하지 않음) | 🔒 | ❌ 넣지 않는 것 권장 |
| `TRUST_PROXY` | **`1`** | | ✅ 안 하면 모든 사용자가 프록시 IP 하나로 보여 IP 한도를 함께 씀 |
| `ALLOWED_ORIGINS` | 웹 배포 주소(없으면 그대로) | | 네이티브 앱은 Origin 없음 |
| `ALLOW_TOKENLESS_GUEST` | PO 결정(KI-3) | | |
| `*_ANALYZE_LIMIT_PER_HOUR` | 운영 한도(COST_ESTIMATE 기준) | | |
| `GEMINI_MODEL`, `GEMINI_THINKING_LEVEL` | 모델 실험 결과에 따라 | | |
| `GEMINI_REQUEST_MASK` | 비워 둠(개발 트랙 1A-3 이후 변수) | | |
| `SUPPORT_EMAIL` | 확정 후 | | 웹 삭제 페이지에 표시 |
| `ACCOUNT_DELETE_REAUTH_MAX_AGE_SECONDS`, `ACCOUNT_DELETE_WEB_ATTEMPTS_PER_HOUR` | 기본 600 / 5 | | |

비밀값(🔒)은 Railway 변수에만 넣는다. 이미지·저장소·로그에 남기지 않는다(`.dockerignore`가 `.env` 제외, 계정 삭제 로그는 사용자 ID 해시만).

## 3. Railway 설정 방식

- `railway.json`/`railway.toml`(Config as Code)은 **지원 종료 예정**: 기존 파일은 2026-12-01까지만 읽는다 [공식, docs.railway.com/reference/config-as-code]. Beta가 그 뒤까지 이어지므로 **만들지 않았다.**
- 대체: **Infrastructure as Code**(`.railway/railway.ts`, `railway` npm 패키지, `railway config plan/apply`) [공식]. 루트 `package.json`에 패키지를 추가해야 해서 이번에는 `docs/launch/railway/railway.ts.example` 초안만 두었다. 적용 방법은 승인 후 결정(D-8): ① 대시보드에서 직접 설정 ② IaC 파일을 `.railway/`로 옮기고 `npx railway config plan`

## 4. SlimSAM 측정 결과 (로컬, 2026-10-19)

`node backend/scripts/measure-slimsam.mjs --offline` — macOS arm64(Apple Silicon), Node 24.11.1, 모델 캐시 사용. **리눅스 x64 컨테이너 수치가 아니다.**

| 조건 | 모델 로딩 | 로딩 후 RSS | 처리 중 최대 RSS | 처리 시간 p50 / max |
|---|---|---|---|---|
| 저장소 상품 이미지 7장(525~920px), 동시 1건 | 0.24초 | 218MB | **2.28GB** | 0.82초 / 2.1초 |
| 같은 7장, 동시 3건 | 0.25초 | 226MB | 2.23GB | 2.4초 / 3.4초 |
| 1600px급 3장(1600×1600 등), 동시 1건 | — | 218MB | **2.21GB** | 1.0초 / 2.1초 |
| 1600px급 3장, **동시 2건** | — | 224MB | **3.59GB** | 2.3초 / 2.4초 |

- 첫 처리 1회는 2초 안팎(세션 준비), 이후 약 0.8~1초.
- 모델 캐시 다운로드는 약 40MB, 캐시에서 로딩 0.24초 → **이미지에 모델을 넣으면 콜드 스타트가 사실상 없다.**
- ⚠️ **큰 사진 2건이 동시에 들어오면 3.6GB** → 4GB 한도에서 3건 이상이면 메모리 초과(OOM 재시작) 위험. 개발 트랙의 업로드 리사이즈(긴 변 1600px)가 들어와도 같다.
- 판정 기준(초안): 최대 RSS가 컨테이너 한도의 75% 미만 → 4GB면 동시 1건(2.3GB)만 통과.

위 측정은 `sprint/1a-2` 방식(점 1개)과 같은 입력이다. 개발 트랙 Sprint 1A-3(`b721f7b`)의 새 분리 방식은 후보 마스크를 여러 번 계산하고 품질 미달이면 한 번 더 실행하며, 개발 트랙 측정 최대 RSS는 **약 3.06GB**(순차, macOS)다(`docs/handoff/sprint-1a-3-handoff.md` H-2, 개발 트랙 작업 트리). 동시 처리 시에는 이보다 커진다.

**권장(개발 트랙 인계 H-1):** `/segment-garment-local`에 **동시 처리 1건 제한(대기열)** 추가. 또는 Railway 메모리 한도를 8GB로 올린다(비용 증가, COST_ESTIMATE 갱신 필요). 병합 후 리눅스 컨테이너에서 새 방식으로 다시 측정(BD-07).

### 개발 트랙 Sprint 1A-3 인계 사항 반영

| 인계 | 내용 | 반영 |
|---|---|---|
| H-1 모델 이미지 포함 | 런타임 다운로드 제거 | ✅ `Dockerfile` + `prefetch-models.mjs`(오프라인 로딩 검증) |
| H-2 메모리 3GB 이상 | 새 분리 방식 약 3.06GB | ✅ 4GB + 동시 1건 제한 권장(위). COST_ESTIMATE 2.5GB 가정 갱신 필요 |
| H-3 libvips 중복(KI-10) | `sharp` 0.35.4와 transformers 내부 `sharp` 0.34.5 | ⚠️ **배포용 설치에서도 재현**(`npm ls sharp`: `@huggingface/transformers@4.2.0 → sharp@0.34.5`, 요구 범위 `^0.34.5`). `overrides`로 0.35.4를 강제하면 transformers의 요구 범위를 벗어난다 → 루트 `sharp`를 0.34.5로 맞추는 쪽이 안전하나 서버 이미지 처리 회귀 테스트가 필요해 **개발 트랙 결정**(인계 H-2). 맞추면 `backend/package.json`도 같이 바꾼다(`deps.test.js`가 알려 줌) |
| H-4 첫 요청 지연 | 모델 로딩 | 모델이 이미지에 있어 로딩 0.24초. 첫 추론 약 2초는 남음 → 시작 시 미리 1회 실행(warm-up, PRD TR-04)은 개발 트랙 |
| 422 `LOW_QUALITY_CUTOUT` | 정상적인 품질 판정 | 모니터링에서 서버 오류(5xx)로 집계하지 않는다. 분리 품질 지표로 따로 본다 |
| `GEMINI_REQUEST_MASK` | 운영도 비워 둠 | 2장 환경변수 표에 추가 |

## 5. 검증 결과

| ID | 항목 | 결과 | 근거 |
|---|---|---|---|
| BD-01 | 배포 전용 의존성만으로 설치 | ✅ Pass | 임시 폴더에 `backend/`만 복사 → `npm ci --omit=dev` 136개 패키지 설치 |
| BD-02 | 모델 사전 다운로드 + 오프라인 로딩 | ✅ Pass | `prefetch-models.mjs`: 다운로드 4.5~7.5초, 캐시만으로 0.23초 |
| BD-03 | 배포 전용 설치로 서버 기동, `/healthz` 200 | ✅ Pass | `PORT=3999 TRUST_PROXY=1 node server.js` → `{"status":"ok"}`, `/account-deletion` 200, `/account/delete` 토큰 없음 401 |
| BD-04 | 의존성 불일치 자동 감지 | ✅ Pass | `deps.test.js` 3건 |
| BD-05 | SlimSAM 메모리·시간 측정 | ✅ Pass(macOS) | 4장 표 |
| BD-06 | `docker build` 성공, 이미지 크기 | ⬜ **Not Tested** | 이 Mac에 Docker 없음 |
| BD-07 | 리눅스 컨테이너에서 SlimSAM 측정(`docker run … node scripts/measure-slimsam.mjs --offline`) | ⬜ **Not Tested** | Docker 없음. 측정 스크립트는 이미지에 포함됨(`/app/backend/scripts`)·테스트 이미지는 상품 사진 경로가 없으므로 이미지 경로를 인자로 전달 |
| BD-08 | Railway 배포·헬스 체크 통과 | ⬜ **Not Tested** | 외부 배포 금지(승인 필요) |
| BD-09 | 운영 환경 HTTPS·`TRUST_PROXY` 동작(IP 한도가 사용자별로 분리) | ⬜ **Not Tested** | 배포 후 |

## 6. 배포 순서 (승인 필요 단계 ⛔)

1. ⛔ Railway 계정·프로젝트 생성(유료 플랜) — 리전 싱가포르
2. GitHub 저장소 연결(배포 브랜치 결정 D-7) 또는 `railway up`
3. ⛔ 서비스 변수 입력(2장, 🔒 비밀값은 PO가 직접 입력 권장)
4. 헬스 체크 경로 `/healthz` 설정
5. ⛔ 첫 배포 → `/healthz` 확인 → QA Supabase로 E2E(`npm run test:e2e`, `E2E_API_URL` 지원은 후속)
6. 도메인(HTTPS) 확인 → EAS `EXPO_PUBLIC_API_URL`에 등록
7. 리눅스 컨테이너에서 BD-07 측정 → 메모리 한도 확정
