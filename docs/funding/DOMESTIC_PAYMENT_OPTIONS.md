# 해외 서비스 국내 결제 경로 조사

| 항목 | 내용 |
|---|---|
| 조사일 | 2026-10-19 (공개 웹페이지만 열람, 가입·로그인·결제 없음) |
| 기준 규정 | 선불카드는 **국내 전용** — 해외 가맹점·외화 결제 불승인, **국내 인앱결제·국내 결제대행(PG)·국내 총판·리셀러**를 통한 원화 결제만 가능(책자 p.13, p.18, p.19) |

## 판정 기준 (세 가지를 구분)

| 기호 | 뜻 |
|---|---|
| **(a) 원화 표시** | 가격·청구서가 원화로 표시될 뿐, 결제 주체·처리 경로는 해외일 수 있음 → **승인 근거가 아님** |
| **(b) 국내 처리** | 국내 법인이 판매하고 국내 PG·국내 카드망으로 처리됨이 공식 문서로 확인됨 → 국내 카드 승인 가능 경로 |
| **(c) 미확인** | 근거 없음 |
| **✖ 거절 명시** | 공급사가 선불카드를 받지 않는다고 공식 명시 |

"선불카드 승인"은 (b)여도 별개다. (b)는 **국내 카드 결제 경로**가 있다는 뜻이고, **선불카드 자체를 받는지**는 따로 확인해야 한다.

## 1. 서비스별 결과

| 서비스 | 판매 주체(한국 고객) | 통화 | 처리 경로 | 선불카드 | 판정 | 근거 URL |
|---|---|---|---|---|---|---|
| **Google Play Console 등록비** | 구글페이먼트코리아(유)가 결제 처리 담당(등록비 적용 여부 미확인) | USD $25 | 국제 카드 브랜드 | **✖ "선불카드는 사용할 수 없습니다"** | **불가(확인됨)** | [support.google.com/…/6112435](https://support.google.com/googleplay/android-developer/answer/6112435?hl=ko) |
| **Gemini API(Google Cloud Billing)** | **Google Cloud Korea LLC**(리셀러로서 Google Asia Pacific 대체) | **KRW + VAT 10%** | 카드(Amex·Master·Visa) — 국내 PG 명시 없음 | **✖ "Prepaid cards aren't accepted"** | (a) + ✖ → **불가(확인됨)** | [support.google.com/cloud/answer/9334954](https://support.google.com/cloud/answer/9334954), [결제 수단](https://docs.cloud.google.com/billing/docs/how-to/payment-methods), [통화](https://docs.cloud.google.com/billing/docs/resources/currency?hl=ko) |
| Gemini — 국내 Google Cloud 리셀러 | 메가존소프트: 원화 세금계산서, **"카드결제가 아닌"** 방식 / 베스핀글로벌: 원화 결제(세금계산서), 카드 [미확인] | KRW | 송금(계산서) | 메가존: 카드 아님 / 베스핀: [미확인] | (b) 경로 있음, **선불카드 사용 불가 또는 미확인** | [megazonesoft.com](https://www.megazonesoft.com/google-cloud-consolidated-billing-service/), [bespinglobal.com/google](https://www.bespinglobal.com/google/) |
| **Railway** | Railway Corp.(해외) | USD(추정) | Stripe | **✖ 사실상**: "post-paid card" 필요(공식 FAQ) | **불가(사실상)** | [docs.railway.com/pricing/plans](https://docs.railway.com/pricing/plans), [FAQ](https://docs.railway.com/reference/pricing/faqs) |
| **Supabase(직접)** | Supabase(해외) | USD(추정) | Stripe | [미확인] | (c), 사실상 어려움 | [supabase.com/pricing](https://supabase.com/pricing) |
| **Supabase(AWS Marketplace 경유)** | **Amazon Web Services Korea LLC**가 마켓플레이스 상품 청구 | **KRW** | **NHN KCP(국내 PG)** | 국내 발급 **신용·체크카드**(신한카드 포함) 명시, **선불 [미확인]** | **(b)**, 선불 미확인 | [AWS 한국 FAQ](https://aws.amazon.com/ko/legal/awsk/)(FAQ 8·37·40), [Supabase 마켓플레이스](https://aws.amazon.com/marketplace/pp/prodview-zjciuce2qsb3q), [AWS 공지](https://aws.amazon.com/about-aws/whats-new/2025/04/aws-automates-vat-korean-won-south-korea-marketplace/) |
| AWS Lightsail·EC2(서울) — 호스팅 대안 | AWS Korea LLC | KRW | NHN KCP | 신용·체크 명시, 선불 [미확인] | **(b)**, 선불 미확인 | 위 FAQ, [lightsail/pricing](https://aws.amazon.com/lightsail/pricing/) |
| **네이버클라우드(NCP)** — 호스팅·CLOVA 대안 | NAVER Cloud Corp.(국내) | KRW | 신용카드·계좌이체·가상계좌·**선불 코인**·간편결제 | [미확인] | **(b)**, 선불 미확인 | [ncloud.com/charge](https://www.ncloud.com/charge), [가격](https://www.ncloud.com/charge/region/ko) |
| **BRIA**(직접 / fal.ai) | 해외 | USD(추정) | [미확인] | [미확인] | (c) | [bria.ai/pricing](https://bria.ai/pricing), [fal.ai](https://fal.ai/models/fal-ai/bria/background/remove/llms.txt) |
| **Apple Developer Program** | 웹: Apple Store Online 또는 USD 카드 양식 / 앱: App Store 구독(한국 약관상 운영자 Apple Services Pte. Ltd., 싱가포르) | "현지 통화로 표시" | 근거 상충(국내 결제 시작 보도 vs 해외 자회사 정산 보도) | [미확인] | (a) 가능성 / **(c)** | [developer.apple.com/kr/support/enrollment](https://developer.apple.com/kr/support/enrollment/), [Apple 한국 약관](https://www.apple.com/kr/legal/internet-services/itunes/kr/terms.html) |
| **Expo EAS** | 해외 | USD 인보이스 | Stripe | [미확인] | (c) — **무료 플랜으로 결제 불필요** | [docs.expo.dev/billing/invoices-and-receipts](https://docs.expo.dev/billing/invoices-and-receipts/) |
| Sentry / UptimeRobot | 해외 | USD | Stripe 등 | — | **무료 플랜으로 결제 불필요** | [sentry.io/pricing](https://sentry.io/pricing/), [uptimerobot.com/pricing](https://uptimerobot.com/pricing/) |
| **가비아(도메인)** | (주)가비아(국내) | KRW(VAT 포함) | 국내 가맹점 | [미확인](국내 가맹점이라 가능성 높음) | **(b)** | [domain.gabia.com](https://domain.gabia.com/) |

조사한 범위에서 **Railway·Supabase·BRIA·Expo의 국내 총판·공식 리셀러는 찾지 못했다**(Supabase는 APAC 파트너 담당자를 채용 중 — 한국 파트너 없음을 시사).

## 2. 원화 표시 ≠ 국내 승인 (사례)

| 사례 | 원화 표시 | 국내 처리 | 선불카드 |
|---|---|---|---|
| Google Cloud(Gemini) | ✅ KRW+VAT | 국내 법인(Google Cloud Korea LLC)이 청구하지만 PG 미공개 | **✖ 명시 거절** |
| AWS Korea | ✅ | ✅ NHN KCP | 신용·체크만 명시 → [미확인] |
| Apple | "현지 통화로 표시" | 근거 상충 | [미확인] |

→ **원화 가격이 보여도 결제하지 말고, 카드사 확인부터 한다.** 승인이 거절되면 결제는 안 되지만, 승인됐는데 사용처가 해외 가맹점으로 찍히면 적정성 문제가 생길 수 있다(책자 p.13: 해외 가맹점은 원칙적으로 불승인).

## 3. 결론

| 구분 | 서비스 |
|---|---|
| **선불카드 불가(공식)** | Google Play 등록비, Gemini API(Google Cloud) |
| **사실상 불가** | Railway(후불 카드 요구), Supabase·BRIA·Expo 직접 결제(USD·Stripe) |
| **국내 결제 경로 확인, 선불카드만 미확인** | AWS Korea(Supabase 마켓플레이스·Lightsail), 네이버클라우드(선불 코인), 가비아 |
| **결제 불필요(무료로 충분)** | Expo EAS, Sentry, UptimeRobot |
| **미확인** | Apple Developer Program, BRIA |

**권장:** 운영 인프라는 지금 계획(Railway·Supabase 직접·Gemini 직접)을 유지하고 **자부담**으로 결제한다. 선불카드는 국내 가맹점 항목(도메인, Apple은 승인 확인 시)에만 쓴다. 국내 결제를 위해 인프라를 옮기는 것은 절약액(월 수만 원)보다 재검증 비용이 커 비추천.

## 4. 문의 문구 (그대로 사용)

**신한카드(1544-7000)**
> 모두의 창업 창업활동자금 선불카드로 ① AWS Korea(결제대행 NHN KCP) ② 네이버클라우드 ③ 가비아 ④ Apple 개발자 프로그램(애플코리아 또는 APPLE.COM/BILL) 결제가 승인되나요? 각각 국내 가맹점으로 분류되나요?

**멘토기관**
> STYLESEED 앱 베타 운영을 위한 ① 서버·DB 구독 ② 앱스토어 개발자 계정 연회비 ③ 도메인을 지급수수료로 집행할 수 있나요? 책자 p.19의 "단순 홈페이지 운영"과 구분되는 앱 서비스 개발·테스트 목적입니다.

**Google Cloud 리셀러(베스핀글로벌 등)**
> 개인 예비창업자가 Gemini API 사용료를 소액(월 10만 원 이하)으로 원화 결제할 수 있나요? 카드(국내 선불카드) 결제와 11월 중 선결제가 가능한가요?
