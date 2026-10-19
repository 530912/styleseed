// 업로드 전 이미지 크기 규칙 (Sprint 1A-3, KI-9)
// 외부 모듈을 import하지 않는 순수 함수만 둔다(Node 테스트에서 직접 불러온다).
//
// - 분석(Gemini)과 저장(Storage)에 같은 처리 이미지를 쓴다 → 분석 상자 좌표와 저장 이미지가 항상 일치
// - SlimSAM은 내부적으로 긴 변 1024px로 줄여 처리하므로 그 이상은 분리 품질에 도움이 적다
// - 옷장 화면 표시에는 1600px이면 충분하다고 본다[가정]

export const UPLOAD_MAX_SIDE = 1600;

export const UPLOAD_JPEG_QUALITY = 0.8;

// 백엔드 분석 요청 본문 한도 10MB에서 JSON 여유분을 뺀 base64 길이 상한
export const ANALYZE_BASE64_LIMIT = Math.floor(9.5 * 1024 * 1024);

// 긴 변을 maxSide 이하로 줄인 크기. 이미 작으면 그대로(확대하지 않음)
export const computeTargetSize = (
  width: number,
  height: number,
  maxSide: number = UPLOAD_MAX_SIDE,
) => {
  if (!(width > 0) || !(height > 0)) {
    return { width: 0, height: 0, resized: false };
  }

  const longest = Math.max(width, height);

  if (longest <= maxSide) {
    return { width, height, resized: false };
  }

  const scale = maxSide / longest;

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    resized: true,
  };
};

// base64 문자열 길이 → 원래 바이트 수
export const base64ToBytes = (base64Length: number) =>
  Math.floor((base64Length * 3) / 4);

export const isWithinAnalyzeLimit = (base64Length: number) =>
  base64Length <= ANALYZE_BASE64_LIMIT;
