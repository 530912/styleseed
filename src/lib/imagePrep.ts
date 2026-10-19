import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

import {
  UPLOAD_JPEG_QUALITY,
  UPLOAD_MAX_SIDE,
  base64ToBytes,
  computeTargetSize,
  isWithinAnalyzeLimit,
} from "./imageSizing";

import { now, perfLog } from "./perf";

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

// 사진 선택 직후 한 번 실행한다(Sprint 1A-3, KI-9).
// 긴 변을 최대 1600px로 줄이고 JPEG로 다시 저장한다. 다시 저장하면서 HEIC 등도 JPEG가 된다.
// 이 결과(uri, base64)를 분석과 옷장 저장에 똑같이 쓴다.
//
// 크기는 선택기 값 대신 이미지 조작 라이브러리가 실제로 렌더링한 크기로 잰다.
// 선택기 값은 EXIF 회전 전일 수 있고, 한 변만 지정하는 resize는 웹에서 실패한다(2026-10-19 확인).
export const prepareClothingImage = async (
  sourceUri: string,
): Promise<PreparedImage> => {
  const startedAt = now();

  const source = await ImageManipulator.manipulate(sourceUri).renderAsync();

  const target = computeTargetSize(source.width, source.height, UPLOAD_MAX_SIDE);

  const rendered = target.resized
    ? await ImageManipulator.manipulate(sourceUri)
        .resize({ width: target.width, height: target.height })
        .renderAsync()
    : source;

  const saved = await rendered.saveAsync({
    format: SaveFormat.JPEG,
    compress: UPLOAD_JPEG_QUALITY,
    base64: true,
  });

  const base64 = saved.base64 ?? "";

  perfLog("image.prepare", startedAt, {
    from: [source.width, source.height],
    to: [saved.width, saved.height],
    bytes: base64ToBytes(base64.length),
  });

  if (!base64 || !isWithinAnalyzeLimit(base64.length)) {
    throw new ImageTooLargeError();
  }

  return {
    uri: saved.uri,
    base64,
    width: saved.width,
    height: saved.height,
    bytes: base64ToBytes(base64.length),
  };
};
