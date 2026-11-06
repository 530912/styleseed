import { ScrollViewStyleReset } from "expo-router/html";

import type { PropsWithChildren } from "react";

// 웹 정적 빌드의 HTML 뼈대. Expo 기본값(meta 3개 + 스크롤 리셋)은 그대로 두고
// Pretendard 웹 폰트(공식 pretendard 1.3.9 가변 폰트, 동적 서브셋)만 추가한다.
// 동적 서브셋: 화면에 쓰인 글자 범위의 woff2 조각만 내려받는다(전체 2MB를 한 번에 받지 않음)
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />

        <link
          rel="stylesheet"
          href="/fonts/pretendard/1.3.9/pretendardvariable-dynamic-subset.css"
        />

        <ScrollViewStyleReset />
      </head>

      <body>{children}</body>
    </html>
  );
}
