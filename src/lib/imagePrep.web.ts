import {
  UPLOAD_JPEG_QUALITY,
  UPLOAD_MAX_SIDE,
  base64ToBytes,
  computeTargetSize,
  isWithinAnalyzeLimit,
} from "./imageSizing";

import { now, perfLog } from "./perf";

// 웹(모바일 Safari) 전용 사진 준비 — imagePrep.ts와 같은 결과(긴 변 1600px JPEG, uri + base64)
//
// expo-image-manipulator 웹 구현은 원본 크기 그대로 canvas를 먼저 만든다. iPhone 기본 24MP 사진(5712×4284)은
// iOS Safari canvas 상한(약 16.7M 픽셀)을 넘어 빈 이미지가 되거나 실패한다(2026-10-27 확인).
// 그래서 원본은 <img>로만 디코딩하고, 줄인 크기의 canvas에 바로 그린다. EXIF 회전은 브라우저가 <img>에 적용한다.
// HEIC는 iOS가 사진 선택 시 JPEG로 바꿔 주거나 Safari가 직접 디코딩한다. 디코딩하지 못하는 브라우저는 오류로 안내한다.

export type PreparedImage = {
  uri: string;
  base64: string;
  width: number;
  height: number;
  bytes: number;
};

export class ImageTooLargeError extends Error {
  constructor() {
    super("사진 용량이 너무 커요. 다른 사진을 선택해주세요.");

    this.name = "ImageTooLargeError";
  }
}

const loadImage = (uri: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);

    image.onerror = () =>
      reject(new Error("이 브라우저에서 열 수 없는 사진이에요. 다른 사진(JPG·PNG)을 선택해주세요."));

    image.src = uri;
  });

export const prepareClothingImage = async (
  sourceUri: string,
): Promise<PreparedImage> => {
  const startedAt = now();

  const image = await loadImage(sourceUri);

  const target = computeTargetSize(image.naturalWidth, image.naturalHeight, UPLOAD_MAX_SIDE);

  if (target.width === 0) {
    throw new Error("사진을 읽지 못했어요. 다른 사진을 선택해주세요.");
  }

  const canvas = document.createElement("canvas");

  canvas.width = target.width;
  canvas.height = target.height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("사진을 처리하지 못했어요. 다른 사진을 선택해주세요.");
  }

  // 투명 PNG도 JPEG로 저장하므로 흰 바탕을 깐다
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, target.width, target.height);
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, target.width, target.height);

  const dataUrl = canvas.toDataURL("image/jpeg", UPLOAD_JPEG_QUALITY);

  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");

  perfLog("image.prepare", startedAt, {
    from: [image.naturalWidth, image.naturalHeight],
    to: [target.width, target.height],
    bytes: base64ToBytes(base64.length),
  });

  // 그리기에 실패하면 toDataURL이 "data:,"처럼 빈 값을 돌려준다
  if (base64.length < 100) {
    throw new Error("사진을 처리하지 못했어요. 다른 사진을 선택해주세요.");
  }

  if (!isWithinAnalyzeLimit(base64.length)) {
    throw new ImageTooLargeError();
  }

  return {
    uri: dataUrl,
    base64,
    width: target.width,
    height: target.height,
    bytes: base64ToBytes(base64.length),
  };
};
