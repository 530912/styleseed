# Figma UI 적용 — 회귀 기준선 (design/apply-figma-ui)

- 2026-11-01 · 기준 브랜치 `app/mvp-2026-11` @ 7db59f3 → 작업 브랜치 `design/apply-figma-ui` (워크트리 `STYLESEED-Design-Apply`). 커밋 없음.
- 배포 `styleseed-research.pages.dev` = 커밋 8047b70(기준 브랜치의 조상). 이후 5커밋(문서 3, 날씨 추천 `weatherRecommendation.ts`·`today.tsx`·`index.tsx`·`today-look-card.tsx`, 아이콘 폰트 경로)만 다르며 **라우트·화면 구성은 동일**.

## 테스트·타입 기준선 (작업 전)
| 항목 | 결과 |
|---|---|
| `npm run test:client` | 68 통과 / 0 실패 |
| `npm run test:engine` | 43 통과 / 0 실패 |
| `npx tsc --noEmit` | 오류 2건(기존, 미사용 템플릿): `animated-icon.web.tsx` css 모듈, `theme.ts` `@/global.css` |
| 미실행 | `test:backend`, `test:e2e`, `test:quality`(서버·외부 서비스 필요) |

## 라우트·파라미터 기준선 (UI 작업 중 바뀌면 안 되는 것)
라우트 = 앱 주소(`/closet` 등). 파라미터 = 주소에 붙여 넘기는 값(`/styling?clothingId=…`). 파일 이름이 곧 라우트이므로 파일 이름·`router.push` 경로·파라미터 이름을 유지해야 한다.

| 라우트 | 받는 파라미터 | 주요 이동(보내는 곳) |
|---|---|---|
| `/` | — | /onboarding(첫 실행) /today /upload /login /closet /research(로고 길게) |
| `/onboarding` | — | back 또는 `/` |
| `/login` | `redirectTo?`("closet") | /closet, /signup, `/` |
| `/signup` | — | /login, /closet, `/` |
| `/ai-consent` | `next?`("analyze") | /analyze, back, `/` |
| `/upload` | — | /ai-consent?next=analyze, /analyze |
| `/analyze` | — (스토어 사용) | /signup, /closet, /upload, `/` |
| `/closet` | — | /styling?clothingId, /item?clothingId, /login?redirectTo, /upload, /saved-looks, /account, `/` |
| `/item` | `clothingId` | /edit-item?clothingId, /closet, back |
| `/edit-item` | `clothingId` | /closet, back |
| `/today` | — | /login, /upload, /styling?clothingId |
| `/styling` | `clothingId` | /looks?clothingId, /missing?clothingId, /ideal-style, /closet |
| `/looks` | `clothingId?` | /styling?clothingId, /login, /upload |
| `/missing` | `clothingId` | /shop?clothingId&missingCategory&missingSubCategory&missingColor&missingStyle, /closet, back |
| `/shop` | `clothingId?` `missingCategory?` `missingSubCategory?` `missingColor?` `missingStyle?` | — |
| `/saved-looks` | — | /styling?clothingId, /login, /closet |
| `/account` | — | /login, /ai-consent, /delete-account |
| `/delete-account` | — | `/`, /login |
| `/research` `/demo` `/ideal-style` `/core-look` `/core-match` `/core-shop`(`replaceId?`) | 내부·데모(UI 교체 대상 아님) | — |
| (기본) 404 / `/_sitemap` | Expo 기본 | — |

앱 스킴 `styleseed`, `typedRoutes: true`.

## 작업 범위 (PO 지시 2026-11-01)
- 진행: 404 한국어화, 디자인 토큰·공통 컴포넌트 이식, A 등급 화면 UI 교체, 신규 화면 3(저장 성공·저장한 코디 상세·탈퇴 완료).
- 보류: 기존 화면 구조 수정(B), 구조 결정 필요(탭바·마이/코디 탭), 기능 개발(비밀번호 재설정·착용 기록·링크 코디), 속성 영어 표기(속성 사전 작업 후).
- 하지 않음: 서버·DB·배포·Gemini 연결, `Desktop/styleseed`·Beta-Launch 워크트리 수정.

## 변경 내역 (2026-11-01)
- 신규: `constants/tokens.ts`(Figma v0.3 토큰), `app/+not-found.tsx`(404 한국어), `app/save-success.tsx`(파라미터 `clothingId`), `app/saved-look.tsx`(`lookKey`), `app/account-deleted.tsx`.
- 수정: `constants/ui.ts`(palette 값을 토큰에서 가져옴, 기존 이름 유지), `components/styleseed/ui.tsx`(Button: primary Coral / secondary 검정 / disabled 회색, 높이 52), `app/login.tsx`·`app/signup.tsx`(공통 Button·토큰 사용), `app/analyze.tsx`(저장 후 `/closet` → `/save-success?clothingId`), `app/delete-account.tsx`(탈퇴 후 알림 창+`/` → `/account-deleted`), `app/saved-looks.tsx`(카드를 누르면 `/saved-look`).
- 기존 라우트 이름·파라미터는 변경 없음(신규 라우트 4개 추가). 저장 후 이동 목적지와 탈퇴 후 이동 목적지만 바뀜.
- 검증: client 68 / engine 43 통과, tsc 기존 2건 외 추가 오류 없음. 8082 미리보기(가짜 DB, 샘플 데이터 주입)에서 404·저장 성공·저장한 코디 상세 렌더 확인.
- 선택 상태 색을 Coral로: 옷장 선택 테두리·"선택됨" 태그, 분석 결과 편집 카드 테두리·선택 칩, 저장한 코디 버튼(saved). 토큰 `action.selected`·`selectedSubtle` 추가.
- 인트로 v3 적용: `components/SplashIntro.tsx`를 Figma `211:3011` 키프레임(5.2초, Green box·Pink ball 중력 반전·글자별 워드마크)으로 교체. `index.tsx`의 사용 방식(`onFinish`, 세션 내 1회)은 그대로. 동작 줄이기 설정이면 완성 장면만 0.8초. 종료 시 0.2초 페이드아웃 추가(Figma에는 없음). 워드마크는 Bricolage Grotesque ExtraBold 미탑재로 시스템 폰트 800(폰트 적용 후 `letter` 스타일에 fontFamily 지정 필요).
- 홈 교체(Figma 07 `PROTO FULL · H` 262:12473): `app/index.tsx`의 HomeScreen을 Coral×Green 날씨 블록 + 추천 코디(이름·버튼) + Quick Actions 2카드 + 4탭 탭바로 교체. 신규 `components/styleseed/home-blocks.tsx`, `Screen`에 `bottomBar` 속성 추가. 기존 `TodayLookCard`는 홈에서 더 이상 쓰지 않음(파일 유지). 날씨 실패/로딩은 기존 안내 문구를 회색 면 위에 유지. 탭 연결: 오늘=홈, 옷장=`/closet`(비로그인이면 `/login?redirectTo=closet`), 코디=`/looks`, 마이=`/account`(코디·마이 탭 루트 화면은 아직 없음). "상품 링크로 코디하기"는 `/link-look`이 없어 "준비 중" 표시로 누를 수 없음. 홈에서 빠진 것: 썸네일 보드, MATCH 점수, 날씨 이유 문구, "내 옷장 보기" 버튼, "내 옷에서 시작하는 스타일링" 문구. 유지: 날씨 부족 안내 2줄, 연구 모드 로고 길게 누르기.
- 탭바 전체 적용(임시, 탭 구조 확정 전): `app/_layout.tsx`가 Stack 아래에 `AppTabBar`를 붙임(`components/styleseed/app-tab-bar.tsx`, `tab-bar-context.ts`). 숨김: `/onboarding`·`/research`·`/demo`·`/ideal-style`·`/core-*`, 인트로 재생 중(`useIntroStore`). 탭별 소속 화면은 `TAB_BY_PATH`(오늘: `/`·`/today`, 옷장: closet·item·edit-item·upload·analyze·ai-consent·save-success, 코디: styling·looks·missing·shop·saved-looks·saved-look, 마이: account·delete-account·account-deleted·login·signup). 탭 이동은 `router.navigate`, 옷장 탭은 비로그인이면 `/login?redirectTo=closet`. `Screen`은 탭바가 있으면 하단 안전 영역을 탭바에 맡김(고정 CTA가 탭바 바로 위). 홈 자체의 탭바 코드는 제거(전역 탭바 사용). 탭 구조가 바뀌면 `app-tab-bar.tsx`의 `HIDDEN_PATHS`·`TAB_BY_PATH`·`handleSelect`만 고치면 됨.
- 미완: 폰트(Pretendard·Bricolage 파일 미탑재), 선택 상태(ink) 색, 그 외 A 등급 화면의 화면별 스타일, 저장→저장 성공 실제 흐름(Gemini 연결 전이라 실행 불가), 375/320 확인.

## Figma 07 미리보기 배포 (2026-11-06, PO 지시)
- 첫 배포 `07494791`은 미커밋 작업본에서 올렸다(Cloudflare 표시 7db59f3은 실제 내용이 아님). PO 승인 후 커밋하고 그 커밋으로 다시 배포했다. 되돌릴 이전 운영 배포는 `5722e54e`(d7f41a6, 폰트).
- 폰트 커밋 d7f41a6을 작업본에 3-way로 합침(충돌: index·login·signup·ui.tsx 해결). 새 화면에도 `fonts.sans` 지정.
- 신규: `app/prototype.tsx`(뷰어, `?s=<화면 id>`), `data/figma07.ts`(32화면·연결표, figma/added 구분), `public/figma07/*.png`(3배 내보내기).
- 플래그 `EXPO_PUBLIC_FIGMA_PREVIEW=true`일 때 `/`는 인트로 뒤 `/prototype`(처음이면 온보딩 OB1, 이후 H)으로 간다. `/?app=1`이면 실제 홈. 끄고 다시 빌드하면 실제 앱이 첫 화면으로 돌아온다. 이 값은 `.env.research.web`에 없고, 이번 배포만 복사본에 넣었다.
- 프레임은 이미지다. Figma를 고치면 `public/figma07`를 다시 내보내고 재배포해야 반영된다.
