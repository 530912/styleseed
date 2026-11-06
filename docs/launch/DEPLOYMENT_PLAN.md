# STYLESEED 배포·출시 계획 (iOS·Android)

| 항목 | 내용 |
|---|---|
| 작성일 | 2026-10-19 |
| 목표 | 300명 Closed Beta → 1,000명 공개 서비스를 안정적으로 운영할 수 있는 구조 |
| 기준 코드 | 브랜치 `sprint/1a-2` (`1b59284`), Expo SDK 57 / React Native 0.86 |
| 함께 볼 문서 | `docs/launch/COST_ESTIMATE.md`, `PRD.md`(Phase 1A·2), `docs/sprints/known-issues.md` |
| 상태 | **계획.** 유료 전환·배포·DB 변경·스토어 등록은 각각 사전 승인 후 진행 |

표기: **[공식]** 공급사 문서(2026-10-19 조회), **[실측]** 이 저장소에서 측정, **[가정]** 추정, **[코드]** 현재 소스 확인.

---

## 1. 결론

1. **기술적으로 Beta 배포 가능한 상태에 가깝지만, 스토어 정책 차단 요소 3개가 남아 있다.** 앱 내 계정 삭제(+웹 삭제 요청), 개인정보처리방침·이용약관, **사진을 제3자 AI(Gemini·BRIA)로 보내기 전 명시적 동의**(Apple 5.1.2(i)). 셋 다 PRD Phase 1A 항목(SEC-08·09·11)과 같다.
2. **운영 필수 유료 전환 2건:** Gemini 유료 등급(무료 한도는 하루 테스트로 소진됨, [실측]), Supabase Pro(Free는 1주 비활성 시 정지, 실제 발생).
3. **권장 구조(Beta):** Expo EAS 빌드 → TestFlight·Play 비공개 테스트 / Node 백엔드는 **Railway 단일 서비스(싱가포르, 4GB)** / Supabase Pro(싱가포르) / Gemini 유료.
4. **출시까지 예상:** 개발 약 **12~17 작업일** + 스토어 일정(Google 신규 개인 계정은 **12명 × 14일 비공개 테스트** 의무, Apple 심사 보통 1~3일 [가정]). 조직 계정으로 등록하면 D-U-N-S 발급 기간이 추가된다.

---

## 2. 현재 구조와 배포 시 바꿔야 할 점 [코드]

| 구성 | 현재 | 배포 시 |
|---|---|---|
| 앱 | Expo SDK 57, `app.json`만 있음 | `eas.json` 추가, iOS `bundleIdentifier`·Android `package` 지정(현재 없음), 빌드 번호 자동 증가 |
| 백엔드 주소 | `EXPO_PUBLIC_API_URL`(기본 localhost) | EAS 환경변수로 HTTPS 주소 주입 |
| 백엔드 | `backend/server.js`(Express 5, CommonJS). 앱과 `package.json` 공유 | **Dockerfile** 필요(백엔드 의존성만 설치), 리눅스용 `sharp`·`onnxruntime-node` 바이너리 |
| SlimSAM 모델 | 첫 요청 때 Hugging Face에서 내려받아 캐시 | **이미지 빌드 시 모델 포함**(실행 중 외부 다운로드 제거, 콜드스타트 단축) |
| 프록시 | `TRUST_PROXY` 기본 0 | **호스팅 프록시 뒤에서는 `TRUST_PROXY=1` 필수.** 안 하면 모든 사용자가 프록시 IP 하나로 보여 IP 한도를 공유한다 |
| Gemini | 무료 등급, `GEMINI_MODEL=gemini-3.5-flash`(실제 응답 `gemini-3.6-flash`) | 유료 등급(별도 승인). 모델은 3장 실험으로 결정 |
| 비밀값 | 루트 `.env` | 호스팅 비밀값 저장소(`GEMINI_API_KEY`, `BRIA_API_TOKEN`). `FAL_KEY`는 쓰지 않으므로 제거 검토 |
| Supabase | Free, 싱가포르, Sprint 1A-2 정책 적용됨 | Pro 전환(별도 승인). 마이그레이션 이력 등록(KI-7) |
| 로그·모니터링 | `console` | 앱 오류 수집(무료 등급 도구), 백엔드 헬스 체크(`GET /`) |

---

## 3. Gemini 모델 선택 실험 설계 (품질·비용)

### 3.1 목적과 비교 대상

현재 모델(`gemini-3.6-flash`)은 2027년부터 가격이 2배가 된다([공식]). 더 싼 모델이 **추천에 쓰이는 속성과 배경 제거용 박스 품질**을 유지하는지 확인한다.

| 후보 | 1회 원가(현재 형식) [공식×실측] | 비고 |
|---|---|---|
| A. `gemini-3.6-flash` (기준) | 5.8원 (2027: 11.7원) | 현재 운영 |
| B. `gemini-2.5-flash` | 3.4원 | 요청 |
| C. `gemini-2.5-flash-lite` | 0.7원 | 요청 |
| D. `gemini-3.1-flash-lite` (선택) | 2.2원 | 3.x 계열 저가 모델 |

**구현 주의 [코드]:** 현재 요청은 3.x 전용 `thinkingConfig.thinkingLevel`을 보낸다. 2.5 계열은 `thinkingBudget`을 쓰므로 **모델별 설정 분기가 필요**하다(코드 변경). 실험은 앱을 바꾸지 않고 같은 프롬프트·스키마로 Gemini를 직접 호출하는 실험 스크립트로 한다.

### 3.2 평가 데이터

| 항목 | 내용 |
|---|---|
| 이미지 수 | 60장 [가정] |
| 구성 | 상품 사진 20 / 착용 사진 20 / 바닥에 펼친 사진 10 / 어려운 사례 10(흰 옷 + 흰 배경, 패턴, 여러 벌, 어두운 조명, 액세서리) |
| 카테고리 | 상의·하의·아우터·원피스·신발·가방·액세서리 고르게 |
| 정답 | 대표자가 9개 속성 + 옷 박스를 직접 라벨링(PRD FR-DS-06 평가 세트와 함께 쓸 수 있게) |
| 실사진 | 실제 휴대폰 원본 해상도 포함(이미지 토큰·크기 측정, PQ-6) |
| 개인정보 | 얼굴이 나오지 않거나 동의를 받은 사진만 사용 |

### 3.3 지표와 판정 기준 [가정]

| 지표 | 정의 | 판정 |
|---|---|---|
| 핵심 속성 정확도 | category, subCategory, color 일치율 | 기준(A) 대비 **−3%p 이내** |
| 보조 속성 | fit, material, colorTone 일치율. season·tpo·style은 Jaccard 유사도 | 기준 대비 −5%p 이내 |
| 분류 일관성 | category ↔ subCategory 모순 비율 | 기준 이하 |
| 박스 품질 | 정답 박스와의 IoU, 그리고 **그 박스로 SlimSAM을 돌렸을 때 옷 영역 25% 이상 분리 성공률**(KI-1 기준) | 기준 대비 −3%p 이내 |
| 형식 안정성 | 스키마에 맞지 않는 응답 비율 | 0% |
| 시간 | p50·p90 | p90 10초 이하 |
| 오류 | 503·429 비율 | 기록 |
| 원가 | 실제 `usageMetadata` × 공식 가격 | 기록 |

**반복:** 모델당 이미지마다 3회 호출(응답 흔들림 측정). **결정 규칙:** 판정을 모두 통과한 모델 중 가장 싼 것. 통과 모델이 없으면 A를 유지하고 `mask` 출력 제거만 적용한다.

### 3.4 비용·승인

| 항목 | 값 |
|---|---|
| 호출 수 | 60장 × 4모델 × 3회 = 720회 |
| 예상 비용 | **약 $2~6 (3천~8천 원)** [공식×실측] |
| 필요 | **Gemini 유료 등급(과금)** — 무료 한도(하루 약 20회)로는 실험 불가. **사전 승인 필요** |
| 소요 | 라벨링 1~2일(대표자) + 실행·분석 1일 |

---

## 4. 배포 아키텍처

### 4.1 Closed Beta (300명) — 권장

```text
[iOS / Android 앱 (EAS 빌드)]
   │  HTTPS, Bearer 토큰(정식·익명 세션)
   ▼
[Railway: Node 백엔드 1개, 싱가포르, 메모리 4GB 한도]
   │  - /analyze-clothing → Gemini (유료 등급)
   │  - 이미지 처리 → SlimSAM(컨테이너 내부) / 실패 시 BRIA API
   │  - 사용량 기록 → Supabase consume_ai_quota (사용자 토큰)
   ▼
[Supabase Pro, 싱가포르: Auth · Postgres(clothes, ai_usage) · Storage(clothing-images)]
```

| 결정 | 이유 |
|---|---|
| Railway 상시 실행 1개 | SlimSAM 모델이 늘 메모리에 있어 저장이 빠름. 메모리 기반 IP 상한이 하나로 일관됨. 설정이 단순 |
| 싱가포르 리전 | Supabase가 싱가포르(ap-southeast-1). 백엔드 → Supabase 왕복 최소화 |
| 4GB 한도 | SlimSAM 처리 중 최대 RSS 약 2.0~2.8GB [실측] |
| 헬스 체크 | `GET /`(이미 있음) |
| 배포 방식 | Dockerfile 빌드, `main`이 아닌 승인된 브랜치에서 수동 배포(Git Push·외부 배포는 승인 후) |

### 4.2 공개 서비스 (1,000~3,000명) — 확장안

| 단계 | 변경 |
|---|---|
| 1,000명 | Railway 유지 + 인스턴스 메모리·CPU 상향. Supabase 이미지 캐시·썸네일로 트래픽 절감 |
| 저장 지연이 눈에 띌 때 | **SlimSAM을 별도 워커로 분리**(PRD TR-03): 분석 API(가벼움)와 이미지 처리(무거움)를 따로 확장 |
| 3,000명 이상 또는 급증 | Cloud Run(서울 `asia-northeast3`) 자동 확장 검토. 모델을 이미지에 포함하고 최소 인스턴스 0~1 |
| 공통 | `TRUST_PROXY` 설정, 백엔드 다중 인스턴스 시 IP 상한은 인스턴스별(영구 한도는 DB라 영향 없음) |

### 4.3 플랫폼 비교 요약 (상세 비용은 COST_ESTIMATE 3장)

| | Railway | Cloud Run |
|---|---|---|
| 과금 [공식] | RAM $10/GB·월, CPU $20/vCPU·월(사용량) | 요청 처리 중 vCPU-초·GiB-초, 넉넉한 무료 구간 |
| Beta 월 비용 | 약 $30~40 [가정] | 최소 인스턴스 0: 약 $0 / 1: 약 $60~115 [가정] |
| 콜드스타트 | 없음(상시) | 있음(최소 인스턴스 0일 때) |
| 확장 | 수동·제한적 | 자동 |
| 운영 난이도 | 낮음 | 중간(GCP 프로젝트·IAM·Artifact Registry) |

---

## 5. Expo EAS: TestFlight·Android 비공개 테스트 배포 절차

> Expo SDK 57 공식 문서 기준으로 진행한다(`AGENTS.md`). 아래 명령은 계획이며, 계정 로그인·결제·업로드는 사용자 승인·직접 로그인이 필요하다.

### 5.1 준비 (한 번)

| 단계 | 내용 | 담당 |
|---|---|---|
| 1 | Apple Developer Program 가입($99/년), Google Play Console 등록($25 1회). 개인 vs 조직 계정 결정(6장) | PO(결제·본인 인증) |
| 2 | `eas-cli` 설치, `eas login`(Expo 계정) | PO 로그인 / Claude 설정 |
| 3 | `eas init` → `app.json`에 EAS projectId 기록 | Claude(승인 후) |
| 4 | `app.json`: `ios.bundleIdentifier`, `android.package`(예: `com.styleseed.app` [가정]), 앱 이름 "STYLESEED", 권한 설명 문구 한국어화(위치·사진), `ios.config.usesNonExemptEncryption: false`(HTTPS만 사용) | Claude |
| 5 | `eas.json` 프로필: `development` / `preview`(내부 배포) / `production`(스토어). `appVersionSource: remote` + `autoIncrement` | Claude |
| 6 | EAS 환경변수: `EXPO_PUBLIC_API_URL`(배포 백엔드), `EXPO_PUBLIC_SUPABASE_URL`·`_PUBLISHABLE_KEY` | Claude(승인 후) |
| 7 | 인증서·서명: `eas credentials`가 Apple 인증서·프로비저닝 프로필과 Android keystore를 자동 생성·보관 | PO(Apple 로그인 2단계 인증) |

### 5.2 iOS → TestFlight

1. `eas build -p ios --profile production`
2. `eas submit -p ios --latest` → App Store Connect 업로드
3. TestFlight **내부 테스터**(App Store Connect 사용자, 최대 100명)는 바로 설치 가능
4. **외부 테스터**(Beta 300명): 그룹을 만들고 **베타 앱 심사**를 통과한 뒤 공개 링크 또는 이메일 초대. 심사에 테스트 계정·설명 제출
5. 빌드 만료(90일) 전 갱신

### 5.3 Android → Play 비공개 테스트

1. Play Console에서 앱 생성, 앱 콘텐츠(개인정보처리방침 URL, 데이터 보안 양식, 대상 연령, 광고 여부, 앱 접근 권한 안내) 작성
2. `eas build -p android --profile production`(AAB)
3. `eas submit -p android` — 서비스 계정 키가 필요하다. **첫 업로드는 Play Console에서 직접 해야 할 수 있다**(확인 필요)
4. **비공개 테스트 트랙**에 테스터 이메일 목록·Google 그룹 등록 → 참여 링크 배포
5. **신규 개인 개발자 계정**은 프로덕션 신청 전 **12명 이상이 14일 연속 참여한 비공개 테스트**가 필수([공식]). 신청 시 테스트 피드백 요약 제출, 심사 보통 7일 이내

### 5.4 업데이트

- 네이티브 변경이 없는 JS 수정은 EAS Update(OTA)로 배포할 수 있다. 다만 심사 정책에 맞는 범위(기능 변경 없는 수정)로만 쓴다
- 백엔드 API 변경은 구버전 앱과 호환되게 유지한다(예: `ALLOW_TOKENLESS_GUEST` 전환 시점)

---

## 6. 앱스토어 등록 준비 점검

### 6.1 공통 정책 항목

| 항목 | Apple | Google | 현재 상태 | 차단? |
|---|---|---|---|---|
| **앱 내 계정 삭제** | 계정 생성 앱은 앱 안에서 삭제 제공 필수(5.1.1(v)), 비활성화만으로는 안 됨 | 앱 안 + **웹 삭제 요청 링크** 필수, Play Console에 URL 등록 | **없음**(PRD SEC-09, 1A-11. 서버 관리자 권한 필요 → Secret 추가 승인 필요) | **차단** |
| **개인정보처리방침** | URL 필수, 수집·이용·제3자 제공 명시 | URL 필수 + 데이터 보안 양식 | **없음**(SEC-08) | **차단** |
| **제3자 AI 데이터 공유 동의** | 개인 데이터를 제3자 AI로 보내기 전 **누구에게 무엇을 보내는지 밝히고 명시적 동의**(5.1.2(i)). 심사자가 동의 화면을 볼 수 있어야 함 | 데이터 보안 양식에 공유 대상 기재 | **없음**(SEC-11). 사진이 Gemini·BRIA로 전송됨 | **차단(Apple)** |
| 개인정보 라벨 / 데이터 보안 | App Privacy: 이메일, 사진, 대략적 위치(날씨용, 저장 안 함), 사용자 ID, 사용 데이터 | 같은 항목 + 암호화 전송, 삭제 요청 가능 여부 | 미작성 | 차단(제출 시 필수) |
| 권한 설명 | 사진 라이브러리·위치 사용 목적 문구 | 같은 목적 고지 | 위치 문구만 있고 **영어**. 사진 권한 플러그인 설정 없음(`expo-image-picker`) | 높음(빌드 후 Info.plist 확인) |
| 개인정보 매니페스트 | Required Reason API 선언(Expo 모듈이 대부분 처리) | — | 빌드 결과 확인 필요 | 확인 |
| 심사용 계정 | 로그인 필요한 기능 → 테스트 계정·설명 제출 | 앱 접근 안내 | 없음 | 제출 시 필요 |
| 연령 등급 | 설문 | 콘텐츠 등급 설문 | 미작성 | 제출 시 필요 |
| 암호화 수출 규정 | HTTPS만 → 면제 선언 | — | 미설정 | 낮음 |
| 앱 아이콘·스크린샷·설명 | 필수 | 필수 | 아이콘 있음(`assets/`), 스크린샷 없음 | 제출 시 필요 |
| Sign in with Apple | 제3자 소셜 로그인 제공 시 필요 | — | 이메일·익명만 → **해당 없음**[가정] | — |
| 이메일 인증 꺼짐 | 정책 차단은 아님 | — | 남의 이메일로 가입 가능(AUDIT S-10) | 권장 결정 |

### 6.2 운영 준비 항목

| 항목 | 상태 | 비고 |
|---|---|---|
| Gemini 유료 등급 | 무료(하루 한도 소진 경험) | **Beta 전 필수**, 승인 필요. 무료 등급은 입력이 제품 개선에 쓰일 수 있음(SEC-11) |
| Supabase Pro | Free(일시정지 발생) | **Beta 전 필수**, 승인 필요 |
| 배포 백엔드 HTTPS | 없음 | TR-01·02, 1A-12 |
| 익명 로그인 CAPTCHA | 없음 | Supabase 권장(KI-5). Beta 전 결정 |
| 토큰 없는 분석 호환 모드 | 켜짐 | 앱 배포 후 끄기 결정(KI-3) |
| 배경 제거 품질(KI-1) | 일부 사진에서 단추만 남음 | 사용자 데이터 품질 문제. Beta 전 수정 권장 |
| 이미지 크기 | 원본 해상도 그대로 업로드 | 업로드 전 리사이즈 권장(요청 크기 10MB, Gemini 토큰, 저장 용량) |
| 화면 회귀 QA | PQ-1~7 대기 | 실기기에서 확인 |

---

## 7. 출시 차단 요소와 예상 해결 시간

예상 시간은 Claude 개발 기준 작업일 [가정]. 외부 대기(심사, 계정 발급, 법률 검토)는 따로 표시한다.

| # | 차단 요소 | 플랫폼 | 해결 작업 | 개발 | 외부 대기·의존 | 승인 필요 |
|---|---|---|---|---|---|---|
| B1 | 앱 내 계정 삭제 + 웹 삭제 요청 | 둘 다 | 서버 삭제 엔드포인트(DB·Storage·`ai_usage`·Auth), 앱 메뉴, 웹 요청 페이지 | 3~4일 | — | **Secret(서버 관리자 키) 추가** |
| B2 | 개인정보처리방침·이용약관 | 둘 다 | 문서 초안, 웹 게시, 앱 링크, 가입 시 동의 기록 | 1~2일 | 법률 검토(OQ-20) 1~2주 [가정] | 게시(외부 공개) |
| B3 | 제3자 AI 전송 동의 | Apple | 첫 분석 전 동의 화면(Gemini·BRIA로 사진 전송 명시), 동의 기록, 거부 시 분석 불가 안내 | 1~2일 | — | — |
| B4 | 백엔드 배포(HTTPS) | 둘 다 | Dockerfile(모델 포함), Railway 설정, `TRUST_PROXY`, 비밀값, 헬스 체크 | 2~3일 | — | **외부 배포, 유료 호스팅** |
| B5 | Gemini 유료 등급 | 둘 다 | 결제 연결, 한도 값 재검토, (선택) 3장 실험 | 0.5일 (+실험 2~3일) | — | **유료 활성화** |
| B6 | Supabase Pro | 둘 다 | 플랜 전환, 지출 한도 확인 | 0.5일 | — | **유료 활성화** |
| B7 | EAS·앱 설정 | 둘 다 | `eas.json`, 번들 ID·패키지명, 권한 문구 한국어화, 사진 권한 플러그인, 암호화 선언 | 1일 | — | 계정 로그인(PO) |
| B8 | 스토어 계정·메타데이터 | 둘 다 | 개발자 등록, 개인정보 라벨·데이터 보안·등급 설문, 스크린샷, 심사용 계정 | 1~2일 | 조직 계정이면 D-U-N-S 수일~2주 [가정] | **결제, 외부 제출** |
| B9 | Google 비공개 테스트 12명 × 14일 | Android(개인 계정) | 테스터 모집·유지, 피드백 요약 | — | **14일 + 심사 약 7일** | — |
| B10 | 실기기 QA(PQ-1~7) | 둘 다 | TestFlight·비공개 테스트 빌드로 확인 | 1일 | — | — |
| (권장) R1 | KI-1 배경 제거 품질 | 둘 다 | 품질 게이트 → BRIA 대체 | 1~2일 | — | — |
| (권장) R2 | 업로드 전 이미지 리사이즈 | 둘 다 | 최대 변 길이 제한 후 업로드 | 0.5~1일 | — | — |
| (권장) R3 | 익명 로그인 CAPTCHA | 둘 다 | Supabase CAPTCHA + 앱 연동 | 1일 | — | 설정 변경 |

**합계:** 필수 개발 약 **10~14일** + 권장 **3~4일** → **12~17 작업일**.

**달력 기준 [가정]:**
- iOS TestFlight 외부 Beta: 개발 완료 후 약 1주(베타 심사 포함)
- Android: 비공개 테스트(Beta 300명)는 바로 가능. 프로덕션 공개는 비공개 테스트 14일 + 심사 약 7일
- 법률 검토가 가장 긴 외부 대기일 수 있다 → B2를 가장 먼저 시작

**권장 순서:**
1. B2(문서 초안 → 법률 검토 요청), B5·B6(유료 전환 승인)
2. B4 백엔드 배포 → B7 EAS 설정 → 내부 테스트 빌드
3. B1·B3(앱 기능) + R1·R2
4. B8 스토어 메타데이터 → TestFlight 외부 테스트·Play 비공개 테스트 시작(B9 14일 카운트 시작)
5. B10 실기기 QA → 공개 출시 신청

---

## 8. 승인이 필요한 결정

| 결정 | 선택지 | 권장 |
|---|---|---|
| Gemini 유료 전환 | 지금 / Beta 직전 | Beta 직전(모델 실험 포함 시 지금) |
| 모델 실험 실행(약 $2~6) | 진행 / 보류 | 진행(2027년 가격 2배 대비) |
| Supabase Pro 전환 | 지금 / Beta 직전 | Beta 직전(일시정지 위험 때문에 앞당겨도 좋음) |
| 호스팅 | Railway / Cloud Run | Beta는 Railway |
| 스토어 계정 유형 | 개인 / 조직 | 사업자가 있으면 조직(Google 12명×14일 의무 면제 여부는 확인 필요, 스토어에 회사명 표시) |
| 계정 삭제용 서버 관리자 키 | 추가 / 다른 방식 | 추가(서버 비밀값으로만 보관) |
| 이메일 인증 | 꺼짐 유지 / 켜기 | 공개 출시 전 켜기 검토 |

---

## 출처 (2026-10-19 조회)

- [Gemini Developer API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), [Updated App Review Guidelines (third-party AI)](https://developer.apple.com/news/?id=ey6d8onl), [Account deletion within apps](https://developer.apple.com/news/upcoming-requirements/?id=06302022b), [Account deletion requirement starts June 30](https://developer.apple.com/news/?id=12m75xbj), [Privacy updates for App Store submissions](https://developer.apple.com/news/?id=3d8a9yyh), [User Privacy and Data Use](https://developer.apple.com/app-store/user-privacy-and-data-use/), [Developer forum: rejected for third-party AI](https://developer.apple.com/forums/thread/815842)
- [Google Play: testing requirements for new personal developer accounts](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en), [Google Play: account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en), [Set up open/closed/internal tests](https://support.google.com/googleplay/android-developer/answer/9845334?hl=en)
- [Expo pricing](https://expo.dev/pricing), [Expo plans](https://docs.expo.dev/billing/plans/)
- [Railway Pricing Plans](https://docs.railway.com/pricing/plans), [Cloud Run pricing](https://cloud.google.com/run/pricing)
- [Supabase Pricing](https://supabase.com/pricing), [Supabase billing FAQ](https://supabase.com/docs/guides/platform/billing-faq)
- [Xenova/slimsam-77-uniform](https://huggingface.co/Xenova/slimsam-77-uniform), [czg1225/SlimSAM](https://github.com/czg1225/SlimSAM), [Bria RMBG commercial use](https://bria.ai/rmbg-for-commercial-use)
