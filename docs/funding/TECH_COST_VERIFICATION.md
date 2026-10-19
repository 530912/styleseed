# STYLESEED 베타 기술비 검증

| 항목 | 내용 |
|---|---|
| 조사일 | 2026-10-19 (모든 공식 출처 이 날 열람) |
| 기준 | `docs/launch/COST_ESTIMATE.md`, `DEPLOYMENT_PLAN.md`, `BETA_LAUNCH_STATUS.md`, `RAILWAY_DEPLOY_RUNBOOK.md`, 통합 RC1(`integration/beta-rc1.1`) 실측 |
| 환율 | **[가정] 1 USD = 1,400원** |
| 표기 | **[공식]** 공급사 공식 페이지 / **[실측]** 이 저장소 측정 / **[가정]** 추정 / **[미확인]** 근거 없음 |
| 카드 | "선불카드" = 신한 클린 선불카드(모두의 창업 창업활동자금, 국내 전용). 승인 여부는 **확인된 경우에만** 확정 표시 |

---

## 1. 결론

1. **베타에 꼭 필요한 유료 기술 항목 대부분은 선불카드로 결제할 수 없거나 확인되지 않았다.**
   - **결제 불가가 공식으로 확인된 항목**
     - Google Play 등록비: "선불카드는 사용할 수 없습니다"
     - Google Cloud(Gemini API): "Prepaid cards aren't accepted"
     - Railway: 후불 카드(post-paid card) 필요
   - Supabase·BRIA·Expo: USD·Stripe 결제 → 국내 승인 [미확인], 사실상 어려움.
2. 국내 결제사(PG)로 원화 결제가 **공식 확인된 경로**: **AWS Korea**(NHN KCP, 신한카드 포함 국내 신용·체크카드), **네이버클라우드**(국내 법인, 선불 코인), **가비아**(도메인). 단 세 곳 모두 **선불카드 명시 허용은 [미확인]**.
3. 베타 운영비는 **300명 기준 월 약 9~10만 원**(VAT·Apple 연회비 월할 포함)이다. 기술비를 지원금에 맞추려고 인프라를 옮기는 것은 **비추천**이다(검증된 RC1 구성을 바꾸는 위험이 절약액보다 크다). → **기술비는 무료 등급 + 자부담, 지원금은 시장 검증·출시 장애물 해소에 쓴다**(`BUDGET_ALLOCATION_2000000.md`).

## 2. 항목별 검증

| # | 항목 | 공식 가격·출처 | 과금 방식 | 무료 활용 | 원화·국내 결제 | 선불카드 | 증빙 | 베타 필수 | 절감 대안 |
|---|---|---|---|---|---|---|---|---|---|
| T-1 | **Railway** 8GB 상한 서버 | Hobby $5/월(사용량 $5 포함), Pro $20/월($20 포함), RAM $10/GB·월, CPU $20/vCPU·월, 송신 $0.05/GB [공식] [docs.railway.com/pricing/plans](https://docs.railway.com/pricing/plans) | 사용량(+플랜료) | 무료 플랜은 커스텀 도메인 0개·자원 부족 | USD·Stripe, 국내 경로 없음 [미확인] | **불가 추정**: FAQ에 "post-paid card" 필요 [공식] | Stripe 인보이스(PDF) | ✅ (또는 대체 호스팅) | 국내 결제가 필요하면 AWS Lightsail 서울 8GB $44 정액 또는 NCP 2vCPU/8GB 90,000원+VAT(아래 3장) |
| T-2 | **Supabase Pro** | $25/월(컴퓨트 크레딧 $10 포함 = Micro), 송신 250GB 후 $0.09/GB, 저장 100GB 후 $0.021/GB [공식] [supabase.com/pricing](https://supabase.com/pricing) | 구독+초과 사용량 | Free는 1주 비활성 시 일시정지(실제 발생) → 베타 부적합 | 직접: Stripe [미확인]. **AWS Marketplace 경유 시 AWS Korea가 청구**(원화·NHN KCP) [공식, 단 Supabase 상품의 원화 표기는 추론] | 직접 [미확인] / AWS 경유도 선불카드 [미확인] | Stripe 영수증 / AWS 세금계산서·카드전표 | ✅ | 크레딧 선충전(최대 $2,000, 만료 없음)[공식] — 카드 승인 시에만 의미. Marketplace는 지출 한도 꺼짐·환불 불가 |
| T-3 | **Gemini API** | 1M 토큰당 입력/출력: `gemini-2.5-flash` $0.30/$2.50, `gemini-2.5-flash-lite` $0.10/$0.40, `gemini-3.1-flash-lite` $0.25/$1.50, `gemini-3.6-flash` $0.75/$3.75(**2027-01-01부터 2배**) [공식] [ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing) | 사용량(선불 충전 가능: $5~$5,000, 12개월 만료) [공식] | 무료 등급: 하루 한도 소진 이력(KI-6), 약관상 입력이 개선에 쓰임 | 한국 주소는 **Google Cloud Korea가 원화+VAT 10%로 청구** [공식] | **불가**: "Prepaid cards aren't accepted" [공식] | Cloud Billing 인보이스 | ✅(유료 등급, 약관·안정성) | Flash-Lite 전환(품질 실험 후), mask 출력 끔(1A-3 반영). 국내 리셀러(메가존·베스핀)는 세금계산서 송금 방식 |
| T-4 | **BRIA** 배경 제거 | $0.018/장, 무료 100장 [공식] [bria.ai/pricing](https://bria.ai/pricing) / fal.ai 동일 $0.018 | 사용량 | 100장 무료로 베타 초기 대응 | 통화·결제 수단 [미확인] | [미확인] | — | △ (SlimSAM 실패 시 대체) | 상용 가능한 자체 모델(U-2-Net Apache-2.0, rembg MIT — 기본 모델이 BRIA 비상용이라 u2net/isnet 지정 필요) — 개발 트랙 판단 |
| T-5 | **SlimSAM 구동** | 모델 Apache-2.0 무료. 서버 메모리·CPU 비용으로 이동(T-1에 포함) | — | ✅ | — | — | — | ✅ | 동시 처리 1건 제한(개발 트랙 H-1) |
| T-6 | **Expo EAS Build** | Free $0(iOS 15·Android 15 빌드, 낮은 우선순위), Starter $19/월, Production $199/월 [공식] [expo.dev/pricing](https://expo.dev/pricing) | 구독 | **Free로 충분**(베타 빌드 월 수 회) | Stripe, USD 인보이스 [공식] | [미확인], 필요 없음 | Stripe 영수증 | ✅(Free) | 로컬 빌드(`eas build --local`) |
| T-7 | **Apple Developer Program** | 연 US$99, "현지 통화로 표시" [공식] [developer.apple.com/kr/support/enrollment](https://developer.apple.com/kr/support/enrollment/). 원화 금액 [미확인] | 연 구독(자동 갱신) | 없음(면제는 비영리·교육·정부만) | 국내/해외 처리 근거가 상충 [미확인] | **[미확인]** — 신한카드·멘토기관 확인 필요 | Apple 계정 인보이스 | ✅(iOS TestFlight) | 없음. 개인/조직 계정 결정(D-15) |
| T-8 | **Google Play Console** | US$25 1회 [공식] [support.google.com/googleplay/android-developer/answer/6112435](https://support.google.com/googleplay/android-developer/answer/6112435?hl=ko) | 1회 | 없음 | 국제 브랜드 카드 | **불가: "선불카드는 사용할 수 없습니다"** [공식] | Google Payments 영수증 | ✅(Android) | 없음 → **자부담 확정** |
| T-9 | **도메인** | 가비아 .com 19,800원, .kr/.co.kr 16,500원(첫해 프로모션, VAT 포함, 갱신가 [미확인]) [공식] [domain.gabia.com](https://domain.gabia.com/) | 연 단위 | Railway 기본 `*.up.railway.app` 무료 | **국내 사업자** | 국내 가맹점이라 승인 가능성 높음, 단 업종 코드 [미확인] | 가비아 결제내역·카드전표 | △(처리방침·계정 삭제 주소를 고정하려면 권장) | 1년만 결제 |
| T-10 | **오류·가동 감시** | Sentry Developer 무료(5k 오류), UptimeRobot 무료(50개, 5분, 상업 사용 허용) [공식] [sentry.io/pricing](https://sentry.io/pricing/), [uptimerobot.com/pricing](https://uptimerobot.com/pricing/) | 구독 | **무료로 충분** | 해외 | 불필요 | — | ✅(무료) | — |
| T-11 | **저장·트래픽** | Supabase Pro 포함량(T-2) 안. 캐시 송신 $0.03/GB | 사용량 | 포함량 안 | T-2와 같음 | — | — | ✅ | 서명 URL 재사용·썸네일(별도 작업) |
| T-12 | **처리방침·약관 게시 페이지** | 정적 페이지 무료 호스팅 가능(백엔드 또는 무료 정적 호스팅) | — | ✅ | — | — | — | ✅ | 백엔드에 정적 페이지 추가(코드 작업, 별도 승인) |

추가로 필요한 유료 서비스는 **없음**. 테스트 기기는 보유 기기 사용(공기계 구입은 규정상 불가, 책자 p.32).

## 3. 국내 결제 가능 호스팅 대안 (참고 — 이전 비추천)

| 대안 | 월 비용 | 국내 결제 | 비고 |
|---|---|---|---|
| Railway 8GB 상한(현재 계획) | 약 $24~29(3.4만~4.1만 원) | 어려움(T-1) | RC1 검증 완료, 싱가포르(DB와 같은 지역) |
| AWS Lightsail 8GB(서울) | $44 정액(약 6.2만 원+VAT) [공식] | AWS Korea·NHN KCP 원화 [공식], 선불카드 [미확인] | 후불이라 11.30 이후 비용은 카드로 못 냄 |
| 네이버클라우드 Standard 2vCPU/8GB | 90,000원+VAT(99,000원) [공식] | 국내 법인, **선불 코인(VAT 포함, 3년 유효)** [공식] | 선불 코인이면 기간 내 선결제 가능. 선불카드 [미확인]. 서울↔싱가포르 DB 왕복 지연 추가 |
| 모두의 창업 AI 솔루션 "(주)에네이 CONTAINER c-4vcpu-8gb" | [미확인] | AI 솔루션 지원금(사후 정산) | 11~12월만, Docker 실행 가능 여부 [미확인] → `AI_SOLUTION_PLAN_1000000.md` |

절약 효과(월 수만 원)보다 **검증된 배포를 다시 검증하는 비용과 지연 위험이 크다**. 국내 결제가 꼭 필요할 때만 검토한다.

## 4. 월 운영비 (300 / 1,000 / 3,000명)

### 4.1 가정과 실측 구분

| 값 | 300명 | 1,000명 | 3,000명 | 구분 |
|---|---|---|---|---|
| 1인당 월 분석 수(온보딩 이후) | 6 | 6 | 6 | [가정] COST_ESTIMATE |
| 월 분석 수 | 1,800 | 6,000 | 18,000 | [가정] |
| 분석 1회 토큰(입력/출력) | 1,637 / 250 | 같음 | 같음 | 입력 [실측], 출력 250은 mask 제거 후 [가정] |
| 저장 비율 / BRIA 대체 비율 | 80% / 15% | 같음 | 같음 | [가정] — 개발 트랙 422 판정 추가로 BRIA 비율 증가 가능 |
| 서버 상시 RAM | 2.2GB | 2.2GB | 2.2GB×2(복제 또는 워커 분리) | [실측 macOS] / 3,000명은 [가정] |
| Supabase 송신·저장 | 포함량 안 | 송신 293GB | 저장 211GB·송신 879GB | [가정] COST_ESTIMATE 4.2 |

### 4.2 월 비용 (현재 모델 `gemini-3.6-flash` 2026년 가격, USD)

| 항목 | 300명 | 1,000명 | 3,000명 | 과금 |
|---|---|---|---|---|
| Railway | 27 | 30 | 55 [가정] | 사용량 |
| Supabase Pro + 초과분 | 25 | 29 | 84 | 구독+사용량 |
| Gemini(분석 1회 $0.00216) | 3.9 | 13.0 | 38.9 | 사용량 |
| BRIA(저장의 15%, $0.018) | 3.9 | 13.0 | 38.9 | 사용량 |
| Apple 연회비 월할($99/12) | 8.3 | 8.3 | 8.3 | 연 구독 |
| 도메인 월할(19,800원/12) | 1.2 | 1.2 | 1.2 | 연 |
| EAS·Sentry·UptimeRobot | 0 | 0 | 0 | 무료 |
| **합계(USD)** | **≈ $69** | **≈ $95** | **≈ $226** | |
| **원화(1,400원)** | **≈ 9.7만 원** | **≈ 13.2만 원** | **≈ 31.7만 원** | |
| 2027년 Gemini 가격(2배) 시 | +$3.9 | +$13 | +$39 | |
| `gemini-2.5-flash-lite` 전환 시 Gemini 항목 | $0.5 | $1.6 | $4.8 | 품질 실험 후 [가정] |

1회성: Google Play $25(약 3.5만 원), 첫 달 온보딩(1인 15회 분석) 추가 약 $6(300명). Gemini에는 Google Cloud Korea VAT 10%가 붙는다(위 표는 VAT 제외 USD).

### 4.3 이 중 선불카드로 낼 수 있는 것

| 항목 | 판단 |
|---|---|
| 도메인(가비아) | **가능성 높음**(국내 가맹점) — 멘토기관 비목 확인(FUNDING_RULES Q-3) |
| Apple Developer | **[미확인]** — 신한카드에 승인 가맹점 구분 문의 후 결정 |
| Railway, Supabase, Gemini, BRIA, Google Play, EAS | **불가 또는 사실상 어려움** → 자부담 |
| 대체 경로(AWS Korea·NCP 선불 코인) | 국내 결제 확인됨, **선불카드는 [미확인]** — 이전이 필요해 비추천 |

→ 베타 첫 2개월 기술비 **자부담 예상: 약 34만 원** = 운영비 2개월(Apple·도메인 월할 제외 약 $60 × 2 ≈ 16.8만 원) + Google Play 약 3.5만 원 + Apple 연회비 1년치 약 14만 원(카드 미승인 시). Apple이 카드로 승인되면 약 20만 원.

## 5. 확인 목록

| # | 확인할 것 | 대상 |
|---|---|---|
| C-1 | 선불카드가 **AWS Korea(NHN KCP)**, **네이버클라우드**, **Apple(애플코리아 또는 APPLE.COM/BILL)**, **가비아**에서 승인되는가 | 신한카드 1544-7000 |
| C-2 | 서버·DB·개발자 계정·도메인 비용의 비목 인정 | 멘토기관(FUNDING_RULES Q-1~Q-3) |
| C-3 | Gemini 국내 리셀러(메가존·베스핀 등)의 소액 고객 수용·카드 결제·선결제 가능 여부 | 각 리셀러 |
| C-4 | BRIA 결제 통화·수단 | BRIA |
| C-5 | 리눅스 컨테이너 실측 메모리(RAM 비용 재계산) | Docker 측정(런북 D-1) |
