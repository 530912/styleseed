# 출시 트랙(release/beta-prep) → 개발 트랙 연동 안내

- 작성: 2026-10-19 (출시 트랙 Claude B, 브랜치 `release/beta-prep`, 기준 `sprint/1a-2` `835681e`, 커밋·Push 안 함)
- 대상: 개발 트랙(Claude A, `sprint/1a-3`)
- 출시 트랙은 추천엔진·Fashion Knowledge Dataset·코디 점수·SlimSAM 분리 로직·Gemini 분석 코드를 수정하지 않았다.
- 답신: 개발 트랙 `docs/handoff/sprint-1a-3-handoff.md`의 H-1~H-8 반영 결과는 `docs/launch/BACKEND_DEPLOY.md` 4장 끝 표.

## 1. 출시 트랙이 고친 공유 파일 (최소 변경)

병합 시뮬레이션(2026-10-19, `git merge-file`, 기준 `835681e` / 출시 트랙 / 개발 트랙 작업 트리 `942a11c`+미커밋): **6개 파일 모두 충돌 0건.**

| 파일 | 변경 | 위치 |
|---|---|---|
| `backend/server.js` | `require("./accountRoutes").registerAccountRoutes(app, {...})` **7줄** 추가 | 파일 끝 오류 처리기(`// 본문 파싱 오류를…`) 바로 앞. 다른 줄은 그대로 |
| `src/app/upload.tsx` | `handleAnalyze`를 `async`로 바꾸고 첫 분석 전 동의 확인(`hasAiConsent` → `/ai-consent?next=analyze`) + import 1줄 | `pickImage`는 건드리지 않음 |
| `src/app/closet.tsx` | 헤더 오른쪽에 **계정** 링크(→ `/account`) | 로그아웃 링크 앞 |
| `app.json` | iOS·Android 식별자(후보), 권한 문구 한국어, `expo-image-picker` 플러그인(카메라·마이크 권한 제거), 위치 Always·동작 권한 제거, `SYSTEM_ALERT_WINDOW` 차단, 암호화 면제 | |
| `.env.example` | 파일 끝에 출시용 변수 7개 추가 | 개발 트랙의 `GEMINI_REQUEST_MASK` 추가와 다른 위치 |
| `.gitignore` | 파일 끝에 스토어 자격 증명·`.env.*` 제외 추가(`.env.example`은 예외로 유지) | |

새 파일(출시 트랙 소유): `backend/accountDeletion.js`, `backend/accountRoutes.js`, `backend/webPages.js`, `backend/package.json`, `backend/package-lock.json`, `backend/scripts/*`, `backend/test/account.test.js`, `backend/test/deps.test.js`, `backend/test/e2e/account-deletion.e2e.js`, `src/app/account.tsx`, `src/app/ai-consent.tsx`, `src/app/delete-account.tsx`, `src/constants/legal.ts`, `src/lib/accountDeletion*.ts`, `src/lib/aiConsent*.ts`, `src/lib/__tests__/launchPolicies.test.mjs`, `Dockerfile`, `.dockerignore`, `eas.json`, `docs/launch/*`, `docs/legal/*`.

새 라우트(`backend/accountRoutes.js`): `GET /healthz`, `POST /account/delete`, `GET·POST /account-deletion`. 기존 라우트·미들웨어 동작은 바꾸지 않았다(`authenticate`, `requireUser`를 그대로 재사용).

## 2. 개발 트랙에 부탁하는 것

| # | 항목 | 이유 | 우선순위 |
|---|---|---|---|
| H-1 | `/segment-garment-local` **동시 처리 1건 제한**(대기열) | 1600px 사진 2건 동시 처리 시 최대 RSS 3.59GB(구 방식, macOS 측정). 새 방식은 순차 3.06GB(개발 트랙 측정) → 4GB 컨테이너에서 동시 2건이면 OOM 위험 | **Beta 전** |
| H-2 | sharp 중복(KI-10) 정리 여부 결정 | 배포용 설치에서도 `transformers → sharp@0.34.5` + `sharp@0.35.4` 재현. 루트 버전을 바꾸면 `backend/package.json`도 같이 갱신(아래 H-7) | Beta 전 권장 |
| H-3 | 미사용 `POST /segment-garment`(fal.ai)와 `FAL_KEY` 제거 검토 | 앱이 호출하지 않는데 남아 있으면 처리방침에 fal.ai를 적어야 하는지 판단이 필요해진다 | 중간 |
| H-4 | 운영 빌드에서 `demo` 화면 숨김 | `demo`에서 `/analyze`로 바로 가면 사진 AI 동의 화면을 거치지 않는다(동의는 `upload.tsx`에서 확인) | Beta 전 |
| H-5 | 카메라 촬영(FR-UPL-02)을 추가할 때 | `app.json`의 `expo-image-picker` `cameraPermission: false`를 한국어 문구로 바꾸고, 촬영 경로에도 동의 확인(`hasAiConsent`) 적용 | Phase 2 |
| H-6 | 사용자 데이터 테이블을 새로 만들 때(이벤트·코디 저장 등, FR-DATA) | `user_id uuid references auth.users(id) on delete cascade`로 만들면 계정 삭제에 자동 포함. 사용자 파일은 반드시 Storage `clothing-images/{userId}/` 아래에 둘 것(다른 버킷·경로는 삭제 코드 수정 필요) | 해당 시 |
| H-7 | 백엔드에 npm 패키지를 추가·변경할 때 | 배포 이미지는 `backend/package.json`만 설치한다. `npm run test:backend`의 `deps.test.js`(DP-01~03)가 누락·버전 차이를 알려 준다 → `backend/package.json` 수정 후 `cd backend && npm install --package-lock-only --ignore-scripts` | 해당 시 |
| H-8 | 시작 시 SlimSAM warm-up(TR-04) | 모델은 이미지에 있어 로딩 0.24초지만 첫 추론 약 2초 | 1B |
| H-9 | `/analyze-clothing`이 받은 사진을 저장·로그하지 않는 현재 동작 유지 | 동의 화면·처리방침이 "분석만 하면 보관하지 않음"으로 고지함. 바꾸면 출시 트랙에 알려 줄 것 | 유지 |

## 3. 병합 후 회귀 확인

```bash
npm run test:backend    # 출시 트랙 단독 61(기존 37 + 계정 삭제 21 + 의존성 3). 개발 트랙과 병합 후 합계 증가
npm run test:client     # 출시 트랙 단독 29(기존 21 + 출시 8)
npx tsc --noEmit        # 기존 오류 2건(animated-icon.module.css, global.css) 외 없음
```
