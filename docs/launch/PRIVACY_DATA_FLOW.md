# STYLESEED 개인정보·사진 데이터 흐름 조사 (Beta Launch)

| 항목 | 내용 |
|---|---|
| 작성일 | 2026-10-19 |
| 기준 코드 | `release/beta-prep` (기준 `sprint/1a-2` `835681e`) + 이 브랜치의 출시 준비 변경 |
| 목적 | 개인정보처리방침·스토어 개인정보 라벨·사진 AI 동의 화면의 사실 근거 |
| 상태 | **조사 결과.** 법률 판단이 아니다. ⚖️ 표시는 법률 검토(PRD OQ-20) 필요 |

표기: **[코드]** 이 저장소에서 확인, **[공식]** 공급사 문서(2026-10-19 조회), **[미확인]** 확인하지 못함.

---

## 1. 결론

1. 사진은 **분석 때 Google Gemini API**로, **저장 때 Supabase**로, **SlimSAM 실패 시에만 BRIA AI**로 간다. fal.ai는 서버 코드에 남아 있지만 **앱이 호출하지 않는다**.
2. **Gemini 무료 등급**을 쓰는 동안에는 입력 사진이 Google 제품 개선에 쓰이고 사람이 검토할 수 있다 [공식]. 동의 화면은 이 사실을 기본으로 고지한다(`EXPO_PUBLIC_GEMINI_PAID_TIER=true`인 빌드에서만 숨김).
3. ⚠️ **Gemini API 약관: 만 18세 이상만 사용 가능, 18세 미만이 쓰거나 쓸 가능성이 높은 앱에는 사용 금지** [공식]. 앱 연령 등급·이용약관 가입 연령·스토어 대상 연령을 여기에 맞춰야 한다(결정 D-4).
4. ⚠️ **EEA·스위스·영국 사용자에게는 유료 등급만 허용** [공식] → 무료 등급이면 스토어 배포 국가를 한국(또는 해당 지역 제외)으로 제한해야 한다(결정 D-5).
5. 위치 좌표는 서버로 가지 않고 **기기 → Open-Meteo**로 직접 간다. 저장하지 않는다 [코드].
6. 서버 측 동의 기록·이벤트 테이블은 없다. 사진 AI 동의는 **기기 단위 기록**(AsyncStorage)으로 구현했다. 서버 기록은 DB 변경(승인 필요)이라 보류.

---

## 2. 데이터 흐름

### 2.1 사진 분석 (로그인 전·후 공통)

```text
[앱] 사진 선택(upload.tsx) ─ 첫 분석이면 → [사진 AI 동의 화면] (동의 버전·시각을 기기에 저장)
  │  base64 JPEG + Bearer 토큰(정식 또는 익명 세션)
  ▼
[STYLESEED 백엔드 /analyze-clothing]  ─ 사진을 저장하지 않음. 사용 횟수만 ai_usage에 기록
  │  사진(inline_data) + 프롬프트, x-goog-api-key
  ▼
[Google Gemini API  generativelanguage.googleapis.com]  → 옷 속성 JSON + box_2d
```

| 근거 | 위치 |
|---|---|
| 업로드 → 분석 화면 진입, 동의 확인 | `src/app/upload.tsx` `handleAnalyze` |
| 분석 요청 | `src/app/analyze.tsx` → `apiPost("/analyze-clothing")` |
| Gemini 호출 | `backend/server.js` `/analyze-clothing` (`GEMINI_ENDPOINT`) |
| 사용량 기록(사진 없음, IP 없음) | `backend/quota.js`, `supabase/migrations/20261018000100_ai_usage.sql` |

### 2.2 옷장 저장 (정식 로그인 사용자만)

```text
[앱] 원본 업로드 → Supabase Storage clothing-images/{userId}/originals/   (싱가포르 리전, DEPLOYMENT_PLAN 기준)
  │
  ├─ 1순위: [백엔드 /segment-garment-local] 서버 내부 SlimSAM으로 배경 제거 (외부 전송 없음)
  │          → 결과 PNG를 앱이 {userId}/cutouts/ 에 업로드
  │
  └─ 실패 시: [앱] 옷 부분을 잘라 {userId}/processing/ 업로드
             → [백엔드 /remove-background] 10분 서명 URL을 BRIA로 전달
             → [BRIA AI engine.prod.bria-api.com] 서명 URL로 사진을 내려받아 배경 제거, 결과 URL 반환
             → [앱] 결과를 내려받아 {userId}/cutouts/ 업로드, processing 파일 삭제
  ▼
[Supabase Postgres public.clothes]  옷 속성 + 이미지 경로
```

| 근거 | 위치 |
|---|---|
| 업로드·분리·BRIA 대체 순서 | `src/lib/clothes.ts` `saveClothingToSupabase` |
| SlimSAM(로컬 모델, 외부 전송 없음) | `backend/server.js` `/segment-garment-local`, `getLocalSam` |
| BRIA 호출(서명 URL 전달) | `backend/server.js` `/remove-background` |
| 서명 URL 10분 | `backend/storagePaths.js` `SIGNED_URL_TTL_SECONDS` |

### 2.3 사용하지 않는 경로

| 경로 | 상태 | 권장 |
|---|---|---|
| `POST /segment-garment` → fal.ai SAM2 | 서버에 남아 있음. 앱의 `segmentGarment`는 호출되지 않음(`USE_GEMINI_SEGMENTATION = false`) [코드] | 처리방침에 넣지 않으려면 **엔드포인트·`FAL_KEY` 제거**(개발 트랙 영역, 인계 H-3) |
| `POST /apply-garment-mask` | 앱 함수(`createGarmentCutout`)는 있으나 호출 경로 없음 [코드] | 개발 트랙 판단 |

### 2.4 그 밖의 개인정보

| 데이터 | 흐름 | 저장 | 근거 |
|---|---|---|---|
| 이메일·비밀번호 | 앱 → Supabase Auth | Supabase(비밀번호는 해시) | `src/lib/authActions.ts` |
| 익명 세션 | 첫 분석 때 Supabase 익명 로그인 | `auth.users`(is_anonymous). **정리 수단 없음**(KI-4) | `src/lib/sessionPolicy.ts` |
| 위치 좌표 | 기기 → Open-Meteo(소수 4자리), 기기 OS 역지오코딩(도시명) | 저장 안 함(메모리) | `src/lib/weather.ts`, `src/store/useWeatherStore.ts` |
| 옷장 캐시·보류 중인 옷·이미지 선호 | 기기 AsyncStorage | 기기 | `src/store/*` |
| 사진 AI 동의 기록 | 기기 AsyncStorage(`styleseed-ai-consent`) | 기기 | `src/lib/aiConsent.ts` |
| 서버 로그 | Railway 로그: 경로·오류 코드·사용자 ID **해시**(계정 삭제) | 호스팅 로그 보관 기간 [미확인] | `backend/accountDeletion.js` |
| IP 주소 | 백엔드 메모리 한도 계산에만 사용 | 저장 안 함(재시작 시 초기화) | `backend/guestLimiter.js` |
| 분석·광고 SDK | **없음** [코드: package.json] | — | — |

---

## 3. 수탁자·제3자 정리 (처리방침 초안의 근거)

| 받는 곳 | 받는 정보 | 목적 | 시점 | 국가 | 보관 | 출처 |
|---|---|---|---|---|---|---|
| Google (Gemini API) | 옷 사진, 분석 요청 | 옷 속성 분석 | 분석할 때마다 | [미확인] 미국 등 | 무료 등급: 제품 개선 사용·사람 검토 가능. 유료: 개선 미사용, 남용 감시용 "제한된 기간" 로그 | [공식] Gemini API 추가 약관(2026-04-28 갱신) |
| Supabase | 계정, 옷 데이터, 사진 | 데이터 저장·인증 | 가입·저장 시 | 싱가포르(프로젝트 리전, DEPLOYMENT_PLAN) | 계정 삭제 시 삭제 | [코드]·계획 문서 |
| BRIA AI | 잘라낸 옷 사진(서명 URL) | 배경 제거 | SlimSAM 실패 시에만 | [미확인] (이스라엘·미국 사무소) | 처리방침에 API 입력 보관 기간 명시 없음 | [공식] bria.ai/privacy-policy |
| Railway | 요청 내용 통과·로그 | 백엔드 호스팅 | 모든 API 요청 | 싱가포르(계획) | 로그 보관 [미확인] | 계획 |
| Open-Meteo | 위치 좌표 | 날씨 조회 | 홈 화면 | [미확인] | [미확인] | [코드] |
| Expo (EAS) | 앱 빌드 | 빌드·배포 | 빌드 시 | — | 개인정보 미전송(업데이트 기능 미사용) | [코드] |

표의 업체명은 서비스명이다. 처리방침에는 계약 상대 법인명을 적어야 하므로 각 약관에서 확인한다 [미확인].

⚖️ 위 각 업체가 "처리위탁"인지 "제3자 제공"인지, 국외 이전 고지 방식은 법률 검토로 확정한다(개인정보보호법 제26조·제28조의8).

---

## 4. 사진 AI 동의 UI (구현)

| 항목 | 내용 |
|---|---|
| 화면 | `src/app/ai-consent.tsx` |
| 표시 시점 | 업로드 화면에서 **분석하기**를 누를 때, 현재 버전 동의 기록이 없으면 |
| 고지 내용 | 보내는 정보(옷 사진 1장, 얼굴·주소 등 함께 찍히면 함께 전송), 받는 곳 3곳과 목적·시점, 국외 처리 가능성, 분석만 하면 STYLESEED가 보관하지 않음, 무료 등급 고지(설정에 따라), 거부 시 영향, 철회 방법 |
| 동의 | **동의하고 분석하기** → 기록 저장 후 분석 화면 / **동의하지 않음** → 이전 화면(분석 요청 없음) |
| 재동의 | `AI_CONSENT_VERSION`(`src/constants/legal.ts`)을 올리면 모든 사용자에게 다시 묻는다 |
| 철회 | 내 옷장 → 계정 → 사진 AI 분석 안내·동의 → **동의 철회** |
| 기록 | 기기 AsyncStorage `{ version, acceptedAt }`. 서버 기록 없음 |
| 알려진 한계 | ① 개발용 `demo` 화면은 업로드 화면을 거치지 않고 분석 화면으로 갈 수 있다(운영 빌드에서 demo 경로 숨김 권장, 인계 H-4) ② 기기 기록이라 앱 삭제·다른 기기에서는 다시 묻는다 ③ Apple 5.1.2(i) 요구 수준은 심사로 확인 |

---

## 5. 법률 검토가 필요한 항목 ⚖️

| # | 항목 | 이유 |
|---|---|---|
| L-1 | 수탁자/제3자 구분, 국외 이전 고지 항목 | 개인정보보호법 제26조·제28조의8 |
| L-2 | 착용 사진의 얼굴 = 민감정보·생체정보 여부, 별도 동의 필요성 | 얼굴 사진을 Gemini·BRIA로 전송 |
| L-3 | Gemini 무료 등급 사용 시 사람 검토 가능성 고지로 충분한지 | 약관상 "개인정보를 무료 서비스에 보내지 말라" |
| L-4 | 가입 연령 제한(만 14세 / 만 18세) | 국내법 만 14세 미만 법정대리인 동의 + Gemini 약관 18세 |
| L-5 | 동의 기록을 기기에만 두는 방식의 입증력 | 서버 기록은 DB 변경 필요 |
| L-6 | 계정 삭제 후 로그(해시)·백업 보관 기간 | Supabase 백업, Railway 로그 |
| L-7 | 위치정보법 적용 여부(좌표를 Open-Meteo로 전송) | 위치기반서비스 신고 대상인지 |
