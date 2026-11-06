# 출시 트랙 통합·검증 계획 (release/beta-prep ↔ sprint/1a-3)

| 항목 | 내용 |
|---|---|
| 작성일 | 2026-10-19 |
| 출시 브랜치 | `release/beta-prep` @ `053e09c`(로컬 커밋, Push 안 함) |
| 개발 브랜치 | `sprint/1a-3` @ `120ecf4`(개발 트랙 작업 트리, 미커밋 변경 없음 확인) |
| 공통 조상 | `835681e`(sprint/1a-2 최종) |
| 상태 | **분석·시험 병합(임시 폴더)·측정까지.** 실제 브랜치 병합·Push·배포·빌드는 하지 않음 |

시험 병합 방법: `git merge-tree --write-tree release/beta-prep sprint/1a-3`(브랜치·작업 트리를 바꾸지 않고 결과 트리 `b6ef641`만 계산) → `git archive`로 스크래치 폴더에 풀고 `npm ci` 후 테스트. 개발 트랙 작업 트리는 읽기만 했다.

---

## 1. 두 브랜치의 차이

| 구분 | 출시 트랙(1커밋) | 개발 트랙(3커밋: `b721f7b` 품질·리사이즈, `942a11c` Phase 1B 계획, `120ecf4` FKD 데이터셋) |
|---|---|---|
| 백엔드 | 계정 삭제·웹 페이지·`/healthz`(새 파일 3개), `server.js` 7줄, 배포용 `backend/package.json`·스크립트 | `server.js` 247줄(SlimSAM 분리 재작성, Gemini mask 끔), `cutout.js` 신규 |
| 앱 | 화면 3개, lib 4개, `upload.tsx` `handleAnalyze`, `closet.tsx` 링크 | `upload.tsx` `pickImage`(1600px 리사이즈), `analyze.tsx`·`clothes.ts` 성능 로그, `imagePrep`·`imageSizing`·`perf` |
| 설정 | `app.json`, `eas.json`, `Dockerfile`, `.dockerignore`, `.gitignore`, `.env.example` 끝 | `package.json` 스크립트(의존성 변경 없음), `.env.example` 중간(`GEMINI_REQUEST_MASK`) |
| 데이터·문서 | `docs/launch/*`, `docs/legal/*`, `docs/handoff/release-beta-prep-handoff.md` | `data/fkd/*`, `scripts/fkd/*`, `docs/recommendation/*`, `docs/sprints/*`, `docs/handoff/sprint-1a-3-handoff.md` |

## 2. 충돌 가능 파일과 API 인터페이스

### 2.1 파일 (양쪽이 모두 고친 파일 3개)

| 파일 | 시험 병합 | 병합 결과 확인 | 앞으로의 위험 |
|---|---|---|---|
| `backend/server.js` | ✅ 자동 병합 | `require("./cutout")`(34행) + `registerAccountRoutes`(오류 처리기 앞) 둘 다 존재, 의존 식별자(`authenticate`, `requireUser`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`) 유지 | 개발 트랙이 파일 끝 오류 처리기를 옮기면 충돌 → 해결: 등록 블록을 오류 처리기 **바로 앞**에 다시 둔다 |
| `src/app/upload.tsx` | ✅ 자동 병합 | `prepareClothingImage`(개발) + `hasAiConsent` 동의 확인(출시) 둘 다 존재 | 개발 트랙이 `handleAnalyze`를 고치면 충돌 → 해결: 동의 확인 4줄을 `router.push("/analyze")` 앞에 유지 |
| `.env.example` | ✅ 자동 병합 | `GEMINI_REQUEST_MASK`(21행) + 출시 변수(48행~) | 낮음 |

출시 트랙만 고친 공유 파일(`app.json`, `closet.tsx`, `.gitignore`)은 개발 트랙 변경이 없어 충돌 없음. `package.json`은 출시 트랙이 고치지 않았다.

### 2.2 API·인터페이스 차이

| 항목 | 차이 | 영향 | 조치 |
|---|---|---|---|
| 라우트 경로 | 출시: `/healthz`, `/account/delete`, `/account-deletion` 추가 / 개발: 경로 추가 없음 | 겹침 없음 | — |
| `app.locals` | 출시: `getAdminClient`, `verifyPassword`, `accountDeletionConfig`, `resetAccountDeletionCounters` / 개발: 새 이름 없음 | 겹침 없음 | — |
| `/segment-garment-local` 응답 | 개발: **422 `LOW_QUALITY_CUTOUT`** + `X-Cutout-*` 헤더 추가 | 앱은 422를 실패로 보고 BRIA로 대체 → **BRIA로 가는 사진이 늘어난다**(동의·처리방침 문구 "서버 배경 제거가 실패한 경우에만"은 그대로 맞음) | 모니터링에서 422를 5xx로 집계하지 않음(BACKEND_DEPLOY) |
| `test:backend` 범위 | 개발: `backend/test/**/*.test.js` → `backend/test/*.test.js` | 출시 테스트(`account.test.js`, `deps.test.js`)는 최상위라 **포함됨**(확인). E2E `account-deletion.e2e.js`는 `test:e2e`에 포함되고 키가 없으면 건너뜀 | — |
| 배포 의존성 | 개발: npm 의존성 변경 없음, `cutout.js`는 모듈을 불러오지 않는 순수 함수 | `backend/package.json` 갱신 불필요 → `deps.test.js` 병합 트리에서 통과 | — |
| 앱 업로드 이미지 | 개발: 긴 변 1600px JPEG로 재저장 | 배포 메모리 측정 기준 이미지를 1600px로 잡음(5장) | — |
| sharp 중복(KI-10) | 양쪽 모두 미해결 | 배포 이미지에도 존재 | 개발 트랙 결정(인계 H-2) |

## 3. 권장 병합 순서 (공통 파일 변경 최소화)

**권장: 개발 트랙 먼저, 출시 트랙을 그 위로.**

```text
1. sprint/1a-3 → (통합 브랜치, 예: integration/beta)      # 개발 트랙 그대로(fast-forward 가능: 1a-3은 835681e에서 이어짐)
2. release/beta-prep → integration/beta  (merge commit)    # 출시 변경 1커밋. 공유 파일 3개 자동 병합(시험 확인)
3. 통합 브랜치에서 4장 회귀 검증 → 통과하면 main 반영은 PO 승인 후
```

| 이유 | 설명 |
|---|---|
| 출시 쪽 공유 변경이 작다 | `server.js` 7줄, `upload.tsx` 5줄, `.env.example` 끝. 개발 쪽은 `server.js` 247줄 → 큰 쪽을 기준으로 작은 쪽을 얹는 게 충돌 해결이 쉽다 |
| 개발 트랙 작업 흐름을 건드리지 않는다 | `sprint/1a-3`에는 출시 파일이 들어가지 않으므로 개발 트랙이 계속 같은 브랜치에서 작업 가능 |
| 출시 트랙이 개발 최신을 따라가기 쉽다 | 이후에는 출시 브랜치에서 통합 브랜치를 주기적으로 받아(merge) 검증 |

**하지 않을 것:** `release/beta-prep`를 `sprint/1a-3` 위로 rebase(출시 커밋 해시가 바뀌고, 이미 기록한 검증 근거가 흔들림), 개발 트랙 브랜치에 출시 커밋을 직접 병합(개발 트랙 작업 트리 변경).

병합 전 준비(출시 트랙에서 할 수 있는 것): 없음 — 시험 병합이 충돌 없이 통과했다. 개발 트랙이 그 사이 `server.js` 끝부분이나 `handleAnalyze`를 바꾸면 이 문서 2.1의 해결 방법을 따른다.

## 4. 통합 회귀 검증 계획과 시험 병합 결과

### 4.1 시험 병합 트리(`b6ef641`)에서 실제로 돌린 결과 — 2026-10-19

| 명령 | 결과 | 출시 테스트 포함 여부 |
|---|---|---|
| `npm run test:backend` | **70/70 통과** | 출시 24건(AD-01~21, DP-01~03) 모두 통과 = 단독 61건 중 출시분 24 + 개발 46 |
| `npm run test:client` | **33/33 통과** | 출시 8건(AC-01~05, CS-01~03) 모두 통과 = 개발 25 + 출시 8 |
| `npm run test:engine` | 2/2 통과 | 개발 트랙 |
| `npm run test:fkd` | 12/12 통과 | 개발 트랙 |
| `npm run test:quality`(실제 SlimSAM, 오프라인) | 8/8 통과 | 개발 트랙 |
| `account-deletion.e2e.js`(키 없음) | 3 건너뜀, 실패 0 | 의도대로 |
| `npx tsc --noEmit` | 기존 오류 2건만(`animated-icon.web.tsx`, `theme.ts`) | 새 오류 0 |
| `npx expo export --platform web` | 성공, `/account`·`/ai-consent`·`/delete-account`·`/upload` 포함 | |

"출시 61 + 앱 29"는 병합 후 **백엔드 70, 앱 33**이 된다(개발 트랙 테스트와 합쳐짐). 출시 트랙 자체 테스트(24 + 8)는 개발 최신 코드에서도 전부 통과했다.

### 4.2 실제 병합 때 다시 돌릴 순서 (통합 브랜치)

| 단계 | 명령·확인 | 통과 기준 | 실패 시 |
|---|---|---|---|
| V-1 | `git merge` 충돌 0 | 2.1 표의 3개 파일 자동 병합 | 2.1 해결 방법 |
| V-2 | `npm ci` | 성공 | lockfile은 개발 트랙 기준 |
| V-3 | `npm run test:backend` | 70 이상, 실패 0, `AD-`·`DP-` 24건 포함 | `DP-*` 실패 → `backend/package.json` 갱신(인계 H-7) |
| V-4 | `npm run test:client` / `test:engine` / `test:fkd` | 실패 0 | 해당 트랙 담당 |
| V-5 | `npm run test:quality` | 8/8 | 개발 트랙 |
| V-6 | `npx tsc --noEmit` | 기존 2건 외 0 | |
| V-7 | `npx expo export --platform web` | 성공 | |
| V-8 | 백엔드 배포용 설치(`backend/`만 복사 → `npm ci --omit=dev` → `node server.js` → `/healthz` 200) | 200 | `cutout.js` 등 새 파일이 `backend/`에 있는지 |
| V-9 | ⛔ QA E2E: `npm run test:e2e`(개발 26) + `account-deletion.e2e.js`(QA 관리자 키) | 실패 0 | QA 관리자 키 승인 필요 |
| V-10 | ⛔ 메모리: 5장 절차(Docker, Linux) | 5장 판정 기준 | |

## 5. SlimSAM 4GB·8GB 메모리 적합성 검증

### 5.1 지금까지의 근거 (macOS arm64, 병합 트리의 실제 라우트)

새 도구 `backend/scripts/measure-route-memory.mjs`: 실제 `/segment-garment-local` 라우트(인증→경로 검사→서명 URL→SlimSAM→PNG)를 로컬 이미지 서버로 실행해 동시 요청·순차 반복 시 메모리를 잰다. 외부 서비스 없음.

입력: 1600px급 3장(1280×1600, 1600×1200, 1600×1600) + 736px 1장, 가운데 80% box, 모든 응답 200.

| 측정 | 결과 |
|---|---|
| 순차 40건, 요청 직후 RSS | 1.4~2.2GB, **증가 추세 없음**(누수 징후 없음) |
| 순차 40건, OS 최대 RSS(`/usr/bin/time -l`) | 2.5GB / 3.4GB(2회) |
| 순차 40건, macOS peak memory footprint | 4.1GB / 4.1GB |
| 동시 1~4건 × 12요청, OS 최대 RSS | 3.5~4.1GB(실행마다 흔들림이 큼, 동시 수와 뚜렷한 비례 없음) |
| 처리 시간 p90 | 동시 1: 1.1~1.2초 / 2: 2.1~2.5초 / 3: 3.2~3.5초 / 4: 4.2~4.8초 → **모델 실행은 사실상 한 번에 하나씩**이고 동시 요청은 대기 시간으로 바뀐다 |

**해석:** 순간 최대 메모리가 macOS에서 이미 3.4~4.1GB까지 나온다. 4GB 한도는 동시 1건이어도 여유가 없다. macOS와 리눅스의 메모리 집계가 달라 이 수치로 확정할 수 없으므로 **리눅스 컨테이너에서 메모리 한도를 걸고 실제로 죽는지**로 판정한다.

### 5.2 판정 방법 (Docker 있는 PC 또는 Railway 배포 전)

```bash
# 0) 이미지 빌드(모델 포함)
docker build -t styleseed-backend .

# 1) 측정용 사진: 실제 휴대폰 사진을 앱과 같이 긴 변 1600px JPEG로 준비(얼굴·개인정보 없는 사진), 10장 이상
#    samples/*.jpg

# 2) 한도별·동시 수별 실행 (각 3회)
for MEM in 4g 8g; do
  for C in 1 2 3; do
    docker run --rm --memory=$MEM --memory-swap=$MEM \
      -v "$PWD/samples:/samples:ro" styleseed-backend \
      node scripts/measure-route-memory.mjs --offline --concurrency $C --rounds 5 /samples/*.jpg \
      > result-$MEM-c$C.json; echo "exit=$?"     # 137 = OOM으로 종료
  done
done

# 3) 별도 터미널에서 컨테이너 메모리 관찰
docker stats --no-stream   # MEM USAGE / LIMIT
```

| 판정 | 기준 |
|---|---|
| **적합** | 3회 모두 exit 0, `rssMB.peakUnderLoad`와 `docker stats` 최대값이 한도의 **75% 이하**, 응답 5xx 0 |
| 조건부 | exit 0이지만 75% 초과 → 동시 처리 제한(개발 트랙 H-1) 적용 후 재측정 |
| 부적합 | exit 137(OOM) 1회라도 발생 |

추가로 확인할 것: 모델 콜드 로딩 시간(`cold.ms`), 동시 2·3건의 p90(앱 시간 제한 90초 대비), 422 비율.

### 5.3 Railway에서의 최종 확인 (배포 승인 후)

1. 서비스 메모리 상한 설정(대시보드) → 배포 → `/healthz`
2. Railway Metrics에서 메모리 그래프를 보며, QA 계정으로 앱에서 사진 저장을 연속 실행(또는 5.2 스크립트를 컨테이너 셸에서 실행)
3. 배포 로그에 OOM 재시작이 없는지 확인

### 5.4 현재 권고

| 선택 | 판단 |
|---|---|
| 4GB 상한 | **권장하지 않음.** macOS 순간 최대 3.4~4.1GB, 리눅스 측정 전 |
| **8GB 상한** | **권장(잠정).** Railway는 상한이 아니라 **실제 사용량으로 과금**한다("only charged for the resources you actually use", $10/GB·월, docs.railway.com/pricing/plans). 평상시 약 2.2GB를 쓰면 상한을 8GB로 올려도 비용은 거의 같고, 순간 최대만 흡수한다 |
| 동시 처리 1건 제한(개발 트랙) | **권장.** 모델 실행이 어차피 순차라 처리량 손실이 거의 없고 메모리 상한을 예측 가능하게 만든다 |

COST_ESTIMATE의 메모리 가정(2.5GB)은 평상시 사용량 기준으로는 크게 틀리지 않지만, 상한·순간 최대 기준을 8GB로 고쳐 기록할 것을 권장한다.

## 6. 승인 대기 작업

| 작업 | 승인 |
|---|---|
| 통합 브랜치 생성·병합(3장) | ⛔ PO |
| QA 관리자 키로 계정 삭제 E2E(V-9) | ⛔ Secret |
| Docker 측정(5.2) — Docker 설치된 PC 필요 | 설치·실행은 로컬 작업, 이미지 Push 없음 |
| Railway 배포·메모리 상한 설정(5.3) | ⛔ 배포·유료 |
