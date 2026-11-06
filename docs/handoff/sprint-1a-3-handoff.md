# Sprint 1A-3 → Claude B 연동 안내

- 작성: 2026-10-19 (Claude A, 브랜치 `sprint/1a-3`, 로컬 커밋 · Push 안 함)
- 대상: Claude B 담당 영역(배포용 Dockerfile·인프라, Railway·클라우드 배포, EAS·스토어, TestFlight·Google Play, 계정 삭제 페이지, 개인정보처리방침·약관)
- Claude A는 위 영역의 파일을 만들거나 고치지 않았다. 아래는 **공유 파일·API가 바뀐 내용**과 Claude B 쪽에서 반영할 일이다.

## 1. 공유 파일 변경 요약

| 파일 | 변경 | Claude B 영향 |
|---|---|---|
| `backend/server.js` | `/segment-garment-local` 재작성(아래 2), Gemini `mask` 요청 기본 끔, 사용량 로그 1줄 | 배포 이미지 메모리, 로그 수집 |
| `backend/cutout.js` (신규) | 서버가 `require("./cutout")` | **Dockerfile COPY 대상에 포함**(backend 폴더 전체를 복사하면 자동) |
| `package.json` | 스크립트만 추가·변경(`test:engine`, `test:quality`, `test:backend` 범위). **의존성 변경 없음** | 없음 |
| `.env.example` | `GEMINI_REQUEST_MASK` 추가 | 배포 환경변수 목록 |
| `src/app/upload.tsx`, `src/lib/imagePrep.ts` | 사진 선택 직후 1600px JPEG로 재저장 | 네이티브 빌드에서 `expo-image-manipulator` 동작 확인(아래 4) |
| `src/lib/api.ts` | **변경 없음** | — |

## 2. API 변경: `/segment-garment-local`

요청 형식은 그대로(`{ imagePath, box2d }`, 정식 로그인 토큰 필수).

| 응답 | 이전 | 이후 |
|---|---|---|
| 200 | PNG | PNG + 헤더 `X-Cutout-Strategy`(`multi_point`/`center_point`), `X-Cutout-Box-Fill`, `X-Cutout-Outside`, `X-Cutout-Holes-Filled` |
| **422 (신규)** | 없음(품질이 나빠도 200) | `{ code: "LOW_QUALITY_CUTOUT", message, reason: "too_small" | "background", metrics }` |

- 앱은 422를 다른 실패와 같게 처리해 BRIA로 대체한다(앱 수정 불필요).
- 헬스 체크·모니터링에서 422를 **서버 오류로 집계하지 말 것**(정상적인 품질 판정 결과). 422 비율은 분리 품질 지표로 따로 보면 좋다.
- `X-Cutout-*` 헤더는 앱이 읽지 않는다. 웹 CORS `exposedHeaders` 추가 불필요.

## 3. 환경변수

| 이름 | 기본 | 설명 |
|---|---|---|
| `GEMINI_REQUEST_MASK` | 비움(=false) | Gemini에 윤곽 좌표를 요청할지. 운영도 **비워 둔다**. 정확도 문제가 확인되면 `true`로 즉시 되돌림(재배포 없이 환경변수만) |

Gemini 모델·추론 수준(`GEMINI_MODEL`, `GEMINI_THINKING_LEVEL`)은 바꾸지 않았다. 비밀값 추가·변경 없음.

## 4. 배포 이미지(Dockerfile)에 반영할 것

| # | 항목 | 이유·근거 | 권장 |
|---|---|---|---|
| H-1 | **SlimSAM 모델을 이미지에 포함** | 모델(`Xenova/slimsam-77-uniform`)은 첫 요청 때 Hugging Face에서 내려받는다. 로컬 캐시 위치 `node_modules/@huggingface/transformers/.cache`(약 38MB) | 빌드 단계에서 한 번 로딩해 캐시를 만들거나 캐시 폴더를 복사. 런타임 외부 다운로드에 의존하지 않기 |
| H-2 | **메모리** | 품질 테스트 프로세스 최대 RSS **약 3.06GB**(macOS arm64, 7장 연속 + 422 1회). 새 방식은 후보마다 마스크 통계를 계산하고, 품질 미달 시 한 번 더 실행한다 | 최소 3GB, 권장 4GB. `COST_ESTIMATE.md`의 2.5GB 가정 갱신 필요. 리눅스 x64에서 다시 측정 |
| H-3 | **libvips 중복 로드(KI-10)** | `sharp` 8.18.6과 `@huggingface/transformers` 내부 sharp(libvips 8.17.3)가 한 프로세스에 함께 올라온다. sharp 경고: “may cause mysterious crashes”. 로컬 테스트에서는 충돌 0회 | 배포 이미지에서 `npm ls sharp`로 확인 후 `overrides`로 버전 하나로 맞추는 방안 검토(이 변경은 `package.json` 공유 파일이므로 Claude A에 알려 주면 회귀 테스트를 함께 돌린다) |
| H-4 | 처리 시간 | `/segment-garment-local` 약 2.5초(모델 로딩 후). 첫 요청은 모델 로딩 시간 추가 | 앱 시간 제한 `LOCAL_SEGMENT_TIMEOUT_MS`는 그대로. 콜드스타트 환경이면 시작 시 모델을 미리 로딩 |
| H-5 | `TRUST_PROXY` | 1A-2부터 기본 0(프록시 헤더 무시). Railway 등 프록시 뒤에서는 단계 수 지정 필요 | 기존 안내 그대로(`backend/README.md`) |

## 5. 앱 빌드(EAS) 쪽 확인 요청

| # | 항목 | 확인 방법 |
|---|---|---|
| H-6 | `expo-image-manipulator` 네이티브 동작 | 개발 빌드에서 사진 선택 → 콘솔 `[perf] image.prepare {"ms":…,"from":[…],"to":[…],"bytes":…}`. 긴 변 1600 이하·JPEG, 세로 사진 방향 정상(EXIF) |
| H-7 | HEIC(iPhone 기본) | 위와 같은 확인. 결과 uri가 `.jpg`이고 업로드 `contentType`이 `image/jpeg` |
| H-8 | 운영 빌드 로그 | `[perf]` 로그는 `__DEV__`에서만 출력 → 운영 빌드에는 남지 않음 |

결과는 `docs/sprints/known-issues.md` PQ-8에 기록하면 Claude A가 닫는다.

## 6. 회귀 확인 명령 (Claude B가 공유 파일을 바꾼 뒤)

```bash
npm run test:backend    # 46
npm run test:client     # 25
npm run test:engine     # 2
npm run test:quality    # 8 (실제 SlimSAM, 외부 네트워크 불필요)
npx tsc --noEmit
# QA 전용(운영 주소면 거부): E2E_SUPABASE_URL / E2E_SUPABASE_PUBLISHABLE_KEY 설정 후
npm run test:e2e        # 26
```
