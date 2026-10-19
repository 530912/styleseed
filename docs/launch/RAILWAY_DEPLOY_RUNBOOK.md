# Railway 8GB 배포 검증 런북 (Beta RC1)

| 항목 | 내용 |
|---|---|
| 작성일 | 2026-10-19 |
| 배포 대상 | **`integration/beta-rc1.1`** = `integration/beta-rc1`(RC1 기준선, 변경 없음) + 이 런북의 검증 도구(출시 트랙). 앱·추천엔진·SlimSAM 코드는 RC1과 같다 |
| 상태 | **준비 완료, 미배포.** Railway 서비스 생성·과금·배포는 ⛔ PO 승인 후 |
| 함께 볼 문서 | `BACKEND_DEPLOY.md`(이미지 구성), `BETA_RC1_INTEGRATION_REPORT.md`(측정 근거), `STORE_PREP_RESPONSIBILITIES.md` |

---

## 1. 배포 구성 (Railway 대시보드 설정값)

| 항목 | 값 | 근거·비고 |
|---|---|---|
| 프로젝트·서비스 | `styleseed` / `styleseed-api` 1개 | |
| 소스 | GitHub 저장소 연결 시 브랜치 **`integration/beta-rc1.1`**(⛔ Push 필요) 또는 로컬에서 `railway up`(Push 없이 업로드) | 결정 D-7 |
| 빌드 | 저장소 루트 `Dockerfile` 자동 인식 | 백엔드만 설치 + SlimSAM 모델 포함 |
| 리전 | 싱가포르(Southeast Asia) ❓ 대시보드 표기 확인 | Supabase 리전과 같게 |
| 메모리 상한 | **8GB** | 순간 최대 3.4~4.1GB(macOS) 대비 여유. 사용량 과금이라 상한은 비용에 영향 거의 없음 |
| vCPU 상한 | 기본값(플랜 최대) 유지 ❓ | SlimSAM은 CPU를 많이 쓰는 짧은 작업 |
| 인스턴스(replica) | **1** | 메모리 기반 IP 한도·SlimSAM 메모리 예측 가능성 |
| 헬스 체크 경로 | `/healthz` | 배포 시에만 확인(운영 중 감시 안 함) |
| 헬스 체크 제한 시간 | 300초(기본) | 실제 기동은 수 초 예상 |
| 재시작 정책 | On Failure(실패 시 재시작) | |
| 공개 도메인 | Railway 기본 `*.up.railway.app`(HTTPS) → 이후 사용자 도메인 선택 | 처리방침·웹 삭제 페이지 주소가 이 도메인에 걸림 |
| 영구 볼륨 | 없음 | 상태는 Supabase에만 |

## 2. 예상 월간 비용 (Railway만, Closed Beta 300명)

요금 [공식, docs.railway.com/pricing/plans, 2026-10-19 조회]: RAM $10/GB·월, CPU $20/vCPU·월, 송신 $0.05/GB, **사용량 과금**. Hobby $5/월(사용량 $5 포함), Pro $20/월(사용량 $20 포함).

| 항목 | 가정 | 월 비용 |
|---|---|---|
| RAM | 첫 처리 후 SlimSAM이 메모리에 남아 상시 약 **2.2GB**(측정, macOS) | **약 $22** |
| RAM 순간 최대분 | 저장 1건당 약 3초 × 추가 2GB, 월 9,000건(300명 × 30건) | 약 $0.2 |
| CPU | 저장 1건당 약 2~4 vCPU·초 + 대기 약 0.02 vCPU [가정] / 보수적 상한 평균 0.25 vCPU | 약 $1 ~ $5 |
| 송신(egress) | 결과 PNG·Gemini 요청 사진 등 약 20~40GB [가정] | 약 $1 ~ $2 |
| **사용량 합계** | | **약 $24 ~ $29** |
| **청구액 — Hobby** | $5 + (사용량 − $5) | **약 $24 ~ $29** |
| **청구액 — Pro** | $20 + (사용량 − $20) | **약 $24 ~ $29** |
| 검증 기간 추가분 | R-1~R-10(30분 혼합 부하 포함) 약 2시간 | $0.1 미만 |

- 이 규모에서는 **Hobby와 Pro의 청구액이 거의 같다.** 플랜 선택은 기능·약관(팀원 초대, 지원, 상업적 사용 조건 ❓)으로 정한다(결정 D-17).
- 4GB와 8GB 상한의 비용 차이는 월 $1 미만(순간 최대분만 다름).
- Railway 외 비용(Supabase Pro $25, Gemini·BRIA 사용량, 스토어 등록비)은 `COST_ESTIMATE.md`. 환율 1,400원 가정 시 Railway 약 3.4만~4.1만 원/월.
- 리눅스 컨테이너에서 메모리가 macOS보다 크게 나오면(4장 D-단계) RAM 비용을 다시 계산한다.

## 3. 환경변수

**규칙:** 실제 값은 Git·문서·채팅·로그에 남기지 않는다. 🔒 값은 PO가 Railway·EAS 대시보드에 직접 입력한다. 입력 후 `railway run node backend/scripts/check-env.mjs --target qa|production`(값을 출력하지 않음) 또는 컨테이너 안에서 `node scripts/check-env.mjs`로 확인한다.

### 3.1 백엔드 (Railway 서비스 변수)

| 변수 | 필수 | 🔒 | 값의 출처·형식 | QA 검증 단계 | 운영 |
|---|---|---|---|---|---|
| `SUPABASE_URL` | ✅ | | Supabase 대시보드 → Settings → API, `https://<ref>.supabase.co` | QA 프로젝트 | 운영 프로젝트 |
| `SUPABASE_PUBLISHABLE_KEY` | ✅ | | 같은 화면, `sb_publishable_…` | QA | 운영 |
| `SUPABASE_SECRET_KEY` | ✅ | 🔒 | API Keys → **새 Secret key 발급**(서비스별 이름 예: `railway-api`), `sb_secret_…` | QA 키 | 운영 키 |
| `GEMINI_API_KEY` | ✅ | 🔒 | Google AI Studio. 운영은 유료 등급 프로젝트의 키 | 검증용 키 | 유료 키 |
| `BRIA_API_TOKEN` | ✅ | 🔒 | BRIA 콘솔 | 같음 | 같음 |
| `TRUST_PROXY` | ✅ | | `1` | 1 | 1 |
| `OPS_METRICS_TOKEN` | 검증 시 ✅ | 🔒 | 무작위 32자 이상(`openssl rand -hex 24`). 검증 끝나면 **교체 또는 삭제** | 설정 | 비우거나 새 값 |
| `ALLOW_TOKENLESS_GUEST` | 권장 | | `true`/`false` — KI-3 결정 | true | 결정값 |
| `SUPPORT_EMAIL` | 권장 | | 지원 이메일(결정 D-6) | 선택 | ✅ |
| `ANON_/USER_/IP_/GUEST_ANALYZE_LIMIT_PER_HOUR` | 선택 | | 정수. 운영 한도는 비용 기준 | 기본 | 결정값 |
| `GEMINI_MODEL`, `GEMINI_THINKING_LEVEL` | 선택 | | 모델 실험 결과 | 기본 | 결정값 |
| `GEMINI_REQUEST_MASK` | 선택 | | **비움**(개발 트랙 기준) | 비움 | 비움 |
| `ALLOWED_ORIGINS` | 선택 | | 웹 배포 시 Origin 목록 | 비움 | 비움 |
| `ACCOUNT_DELETE_REAUTH_MAX_AGE_SECONDS`, `ACCOUNT_DELETE_WEB_ATTEMPTS_PER_HOUR` | 선택 | | 기본 600 / 5 | 기본 | 기본 |
| `FAL_KEY` | ❌ 넣지 않음 | 🔒 | 앱이 fal 경로를 쓰지 않음 | — | — |
| `PORT`, `NODE_ENV` | 자동 | | Railway 주입 / Dockerfile `production` | | |

### 3.2 앱 (EAS 환경변수, 앱 번들에 공개됨 — 비밀값 금지)

| 변수 | preview(QA) | production |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | QA 백엔드 Railway 주소 | 운영 백엔드 주소 |
| `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | QA | 운영 |
| `EXPO_PUBLIC_PRIVACY_POLICY_URL` / `EXPO_PUBLIC_TERMS_URL` | 게시 후 | **필수** |
| `EXPO_PUBLIC_GEMINI_PAID_TIER` | 비움 | 유료 전환 후 `true` |

### 3.3 검증 러너 (개발자 PC 셸에서만, 저장하지 않음)

| 변수 | 용도 |
|---|---|
| `OPS_METRICS_TOKEN` | 서버와 같은 값. 메모리·재시작·클라이언트 IP 지표 |
| `QA_SUPABASE_URL`, `QA_SUPABASE_PUBLISHABLE_KEY` | full 묶음: QA 테스트 계정 생성(운영 주소면 실행 거부) |
| `QA_SUPABASE_SECRET_KEY` | 선택. 삭제 후 Auth·Storage·`clothes`·`ai_usage` 0건 확인, 실패 시 정리 |

**배포 단계 권장:** 먼저 Railway 서비스를 **QA Supabase에 연결**해 4장 전체를 통과시킨 뒤, 변수만 운영 값으로 바꾸고 재배포 → smoke 묶음만 실행(운영에는 테스트 계정을 만들지 않음).

## 4. 검증 도구와 자동화 범위

| 도구 | 하는 일 | 로컬 검증 결과(2026-10-19) |
|---|---|---|
| `backend/scripts/docker-verify.sh` | 이미지 빌드·크기, `--network none` 모델 로딩, 콜드 스타트, smoke, 메모리 4g·8g × 동시 1·2·3 × 3회(OOM·최대 메모리·p90) | ⬜ Not Tested(이 Mac에 Docker 없음). `bash -n` 통과 |
| `backend/scripts/make-samples.mjs` | 상품 사진 → 긴 변 1600px JPEG 7장 | ✅ |
| `backend/scripts/measure-route-memory.mjs` | 실제 `/segment-garment-local` 부하(컨테이너 안에서도 실행) | ✅(이전 측정) |
| `backend/scripts/check-env.mjs` | 환경변수 존재·형식·대상 프로젝트 확인, **값 출력 안 함** | ✅ 테스트 EV-01~05 |
| `backend/scripts/verify-deploy.mjs` | R-1~R-10 + S-1~S-8 판정, JSON 보고서 | ✅ 실제 서버·SlimSAM·가짜 Supabase로 full 묶음 종단 통과(DV-03), 음성 검증(메모리 한도 초과·틀린 토큰을 실패로 판정), CLI smoke 통과 |
| `backend/scripts/watch-health.mjs` | R-7 재시작·다운타임 감시 | ✅ 로컬 재시작 모의(다운타임 4초·재시작 1회 감지) |
| `/healthz` + `X-Ops-Token` | 메모리(RSS 등)·bootId·서버가 본 클라이언트 IP | ✅ AD-22·23(토큰 없거나 틀리면 기본 응답과 동일) |

### 시나리오별 자동화

| ID | 시나리오 | 자동화 | 완료 기준 |
|---|---|---|---|
| D-1 | (배포 전) Docker 8g 메모리 | `docker-verify.sh` | 8g: 9회 모두 exit 0·OOM false·최대 ≤ 6GB. 4g 결과는 비교 기록 |
| R-1 | 빌드·기동 | Railway 배포 로그 + `verify-deploy` R-1 | 빌드 성공, 로그에 모델 다운로드 없음, `/healthz` 200, 응답 2초 이내 |
| R-2 | 대기 메모리 | `verify-deploy` R-2 | 첫 처리 전 ≤ 512MB(새로 뜬 서버일 때), 첫 처리 후 ≤ 2,560MB |
| R-3 | 순차 50건 | `--sequential 50` | 5xx·시간 초과 0, p90 ≤ 15초, 재시작 0, 최대 RSS ≤ 6,144MB |
| R-4 | 동시 2·3·5건 | `--concurrency 2,3,5 --rounds 2` | 5xx·90초 초과 0, 재시작 0, 최대 RSS ≤ 6,144MB |
| R-5 | 30분 혼합 부하 | `--soak-minutes 30` | 오류율 ≤ 1%(422 제외), 뒤 20% 평균 ≤ 앞 20% × 1.10, 재시작 0 |
| R-6 | 품질 미달 → BRIA | R-6(+ `--with-bria`) | 422 `LOW_QUALITY_CUTOUT`, BRIA 200 + 결과 URL |
| R-7 | 재시작 복구 | `watch-health.mjs` + 대시보드 재시작(수동 1클릭) | 복구 ≤ 60초, 재시작 감지 |
| R-8 | 프록시 IP | R-8 | 위조 `X-Forwarded-For` 무시, 서버가 본 IP가 사설 대역 아님 |
| R-9 | 계정 삭제(앱·웹) | full 묶음 끝 정리 단계 | 삭제 200, 재로그인 불가, (관리자 키) Auth·Storage·`clothes`·`ai_usage` 0 |
| R-10 | Gemini 분석 | `--analyze 10` | 모두 200, p90 ≤ 10초 |
| S-1~5 | 인증·CORS·보안 헤더 | smoke·full | 각 항목 |
| S-6~8 | 다른 사용자 경로 403, `..` 400, Storage RLS, 본문 10MB 초과 413 | full | 각 항목 |

**전체 완료 기준(배포 승인 → 베타 사용 가능):** D-1 + R-1~R-10 + S-1~S-8 모두 pass(의도된 skip 없음), OOM 재시작 0, 보고서(JSON)를 `docs/launch/verification/`에 보관.

### 실행 순서 (⛔ = 승인 필요)

```bash
# 0) (Docker 있는 PC) 배포 전 이미지 검증
bash backend/scripts/docker-verify.sh                        # Railway와 같게: PLATFORM=linux/amd64

# 1) ⛔ Railway 서비스 생성(8GB, 싱가포르), QA Supabase 변수 입력(PO), 배포
# 2) 변수 확인(값 출력 없음)
railway run node backend/scripts/check-env.mjs --target qa     # 로컬에서 Railway 변수를 주입해 실행(값은 출력하지 않음)

# 3) smoke → full (QA)
export OPS_METRICS_TOKEN=…  QA_SUPABASE_URL=…  QA_SUPABASE_PUBLISHABLE_KEY=…  QA_SUPABASE_SECRET_KEY=…
node backend/scripts/verify-deploy.mjs --api https://<host> --suite smoke --report smoke-qa.json
node backend/scripts/make-samples.mjs --out /tmp/styleseed-samples
node backend/scripts/verify-deploy.mjs --api https://<host> --suite full --samples /tmp/styleseed-samples \
  --sequential 50 --concurrency 2,3,5 --rounds 2 --soak-minutes 30 --analyze 10 --with-bria --report full-qa.json

# 4) R-7: 감시를 켜 둔 채 대시보드에서 Restart
node backend/scripts/watch-health.mjs --api https://<host> --minutes 5

# 5) ⛔ 운영 전환: 변수를 운영 값으로 교체 → 재배포 → check-env --target production → smoke만
node backend/scripts/verify-deploy.mjs --api https://<host> --suite smoke --report smoke-prod.json
# 6) OPS_METRICS_TOKEN 교체(또는 삭제), QA Secret key 폐기
```

검증 비용: Gemini 10회(유료 등급 기준 약 60원), BRIA 1회(약 $0.02), Railway 약 $0.1.

### 실패 시 처리

| 증상 | 조치 |
|---|---|
| 8GB에서도 OOM 또는 최대 > 6GB | 동시 처리 1건 제한(개발 트랙 H-1) 적용 후 재측정. 그래도 넘으면 SlimSAM 워커 분리(PRD TR-03) |
| R-8 사설 IP | `TRUST_PROXY=1` 확인 |
| R-9 실패 | 관리자 키·버킷 권한 확인, 남은 테스트 계정은 러너가 관리자 키로 정리 |
| 롤백 | Railway 대시보드에서 이전 배포로 되돌리기. 앱은 아직 배포 전이라 사용자 영향 없음 |

## 5. 배포 환경에서의 계정 삭제·동의·데이터 보호 검증 계획

| 기능 | 자동(러너) | 수동(실기기·대시보드) | 완료 기준 |
|---|---|---|---|
| 앱 내 탈퇴 | R-9(앱 경로, 최근 인증 토큰) | preview 빌드: 로그인 → 옷 저장 → 계정 → 회원 탈퇴 → 비밀번호 → 삭제 → 홈. Supabase 대시보드에서 사용자·파일·행 0 확인 | 둘 다 통과 |
| 웹 삭제 페이지 | R-9(웹 경로), S-5 헤더 | 휴대폰 브라우저로 공개 주소 열기(가독성), Play Console에 주소 등록 | 공개 주소 200, 삭제 동작 |
| 사진 AI 동의 | — (앱 로컬 기능) | ① 새 설치 → 분석하기 → 동의 화면 ② **동의하지 않음 → Railway 로그에 `/analyze-clothing` 요청이 없어야 함** ③ 동의 → 분석 ④ 계정 화면에서 철회 → 다음 분석 때 다시 묻기 ⑤ `demo` 화면 숨김 확인(P1) | ①~⑤ 통과 |
| 무료 등급 고지 | — | Gemini 등급과 `EXPO_PUBLIC_GEMINI_PAID_TIER` 일치 | 일치 |
| 인증·경로·RLS·본문 크기 | S-2·3·6·7·8 | — | pass |
| 비밀값 비노출 | check-env(키 중복·EXPO_PUBLIC 비밀값), S-1 | 빌드 산출물 검색(2026-10-19 웹 번들 검사: 서버 키 문자열 0건 — `sb_secret_`는 supabase-js의 접두어 비교 코드뿐) | 0건 |
| 로그 개인정보 | — | Railway 로그 30분 표본에 이메일·토큰·사진 데이터 없음(계정 삭제는 사용자 ID 해시만) | 0건 |
| 프록시 IP 한도 | R-8 | 서로 다른 네트워크 2곳에서 비로그인 분석 | 한도 분리 |
