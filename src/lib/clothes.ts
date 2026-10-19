import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

import type { Clothing } from "../types";

import { apiPost } from "./api";

import { now, perfLog } from "./perf";

import { supabase } from "./supabase";

const STORAGE_BUCKET = "clothing-images";

const USE_GEMINI_SEGMENTATION = false;

// 이미지 처리 요청 대기 시간. 로컬 SlimSAM은 첫 요청에서 모델을 불러오므로 길게 잡는다.
const LOCAL_SEGMENT_TIMEOUT_MS = 90_000;

const IMAGE_TASK_TIMEOUT_MS = 60_000;

const cropMainGarment = async (
  imageUri: string,
  box2d?: [number, number, number, number],
) => {
  if (!box2d) {
    return imageUri;
  }

  const sourceContext = ImageManipulator.manipulate(imageUri);

  const sourceImage = await sourceContext.renderAsync();

  const sourceWidth = sourceImage.width;

  const sourceHeight = sourceImage.height;

  const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value));

  const yMin = clamp(box2d[0], 0, 1000);

  const xMin = clamp(box2d[1], 0, 1000);

  const yMax = clamp(box2d[2], 0, 1000);

  const xMax = clamp(box2d[3], 0, 1000);

  const rawX = (xMin / 1000) * sourceWidth;

  const rawY = (yMin / 1000) * sourceHeight;

  const rawWidth = ((xMax - xMin) / 1000) * sourceWidth;

  const rawHeight = ((yMax - yMin) / 1000) * sourceHeight;

  // 옷의 끝부분이 잘리지 않도록
  // 8% 정도 여유를 둠
  const paddingX = rawWidth * 0.08;

  const paddingY = rawHeight * 0.08;

  const originX = Math.max(0, Math.floor(rawX - paddingX));

  const originY = Math.max(0, Math.floor(rawY - paddingY));

  const width = Math.max(
    1,
    Math.floor(Math.min(sourceWidth - originX, rawWidth + paddingX * 2)),
  );

  const height = Math.max(
    1,
    Math.floor(Math.min(sourceHeight - originY, rawHeight + paddingY * 2)),
  );

  const cropContext = ImageManipulator.manipulate(imageUri);

  cropContext.crop({
    originX,
    originY,
    width,
    height,
  });

  const croppedImage = await cropContext.renderAsync();

  const result = await croppedImage.saveAsync({
    format: SaveFormat.JPEG,
    compress: 0.9,
  });

  return result.uri;
};

const uploadProcessingImage = async (imageUri: string, userId: string) => {
  const response = await fetch(imageUri);

  if (!response.ok) {
    throw new Error("Crop 이미지를 불러오지 못했습니다.");
  }

  const arrayBuffer = await response.arrayBuffer();

  const filePath = `${userId}/processing/${Date.now()}.jpg`;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, arrayBuffer, {
      contentType: "image/jpeg",
      upsert: false,
    });

  if (error) {
    throw error;
  }

  return filePath;
};

/**
 * 원본 이미지를 Supabase Storage에 저장
 */
const uploadOriginalImage = async (imageUri: string, userId: string) => {
  const response = await fetch(imageUri);

  if (!response.ok) {
    throw new Error("원본 이미지를 불러오지 못했습니다.");
  }

  const arrayBuffer = await response.arrayBuffer();

  // 버킷은 이미지 형식만 허용한다(Sprint 1A-2 DB-3). 형식을 알 수 없으면 JPEG로 올린다.
  const reportedType = response.headers.get("content-type") ?? "";

  const contentType = reportedType.includes("png") ? "image/png" : "image/jpeg";

  const extension = contentType === "image/png" ? "png" : "jpg";

  const fileName = `${Date.now()}.${extension}`;

  const filePath = `${userId}/originals/${fileName}`;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, arrayBuffer, {
      contentType,
      upsert: false,
    });

  if (error) {
    throw error;
  }

  return filePath;
};

// 이미지 처리 요청에는 URL 대신 Storage 경로를 보낸다.
// 서버가 경로 소유자를 확인하고 서명 URL을 직접 만든다(Sprint 1A-2 S2-09, SSRF 차단).
const segmentGarmentLocally = async (
  imagePath: string,
  box2d: [number, number, number, number],
) => {
  return await apiPost(
    "/segment-garment-local",
    {
      imagePath,
      box2d,
    },
    {
      auth: "required",
      timeoutMs: LOCAL_SEGMENT_TIMEOUT_MS,
      responseType: "arrayBuffer",
    },
  );
};

const createGarmentCutout = async (
  imagePath: string,
  box2d: [number, number, number, number],
  mask: [number, number][],
) => {
  return await apiPost(
    "/apply-garment-mask",
    {
      imagePath,
      box2d,
      mask,
    },
    {
      auth: "required",
      timeoutMs: IMAGE_TASK_TIMEOUT_MS,
      responseType: "arrayBuffer",
    },
  );
};

const getImageDimensions = async (imageUri: string) => {
  const context = ImageManipulator.manipulate(imageUri);

  const image = await context.renderAsync();

  return {
    width: image.width,
    height: image.height,
  };
};

const segmentGarment = async (
  imagePath: string,
  box2d: [number, number, number, number],
  imageWidth: number,
  imageHeight: number,
) => {
  const data = (await apiPost(
    "/segment-garment",
    {
      imagePath,
      box2d,
      imageWidth,
      imageHeight,
    },
    {
      auth: "required",
      timeoutMs: IMAGE_TASK_TIMEOUT_MS,
    },
  )) as { cutoutImageUrl?: string } | null;

  if (!data?.cutoutImageUrl) {
    throw new Error("의류 분리 결과 이미지가 없습니다.");
  }

  return data.cutoutImageUrl as string;
};

/**
 * 우리 backend의 배경 제거 API 호출
 */
const removeBackground = async (imagePath: string) => {
  const data = (await apiPost(
    "/remove-background",
    {
      imagePath,
    },
    {
      auth: "required",
      timeoutMs: IMAGE_TASK_TIMEOUT_MS,
    },
  )) as { cutoutUrl?: string } | null;

  if (!data?.cutoutUrl) {
    throw new Error("배경 제거 결과 이미지가 없습니다.");
  }

  return data.cutoutUrl as string;
};

/**
 * BRIA가 만든 투명 이미지를
 * Supabase Storage에 다시 저장
 */
const uploadCutoutImage = async (cutoutUrl: string, userId: string) => {
  const response = await fetch(cutoutUrl);

  if (!response.ok) {
    throw new Error("배경 제거 이미지를 불러오지 못했습니다.");
  }

  const arrayBuffer = await response.arrayBuffer();

  const fileName = `${Date.now()}.png`;

  const filePath = `${userId}/cutouts/${fileName}`;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, arrayBuffer, {
      contentType: "image/png",
      upsert: false,
    });

  if (error) {
    throw error;
  }

  return filePath;
};

const uploadCutoutBuffer = async (arrayBuffer: ArrayBuffer, userId: string) => {
  const filePath = `${userId}/cutouts/${Date.now()}.png`;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, arrayBuffer, {
      contentType: "image/png",
      upsert: false,
    });

  if (error) {
    throw error;
  }

  return filePath;
};

export const saveClothingToSupabase = async (
  clothing: Clothing,
  userId: string,
): Promise<Clothing> => {
  let originalImagePath: string | null = null;

  let cutoutImagePath: string | null = null;

  const saveStartedAt = now();

  let cutoutVia = "none";

  /**
   * 1. 이미지가 있을 때만
   * 원본 업로드 + 의류 분리 실행
   */
  if (clothing.imageUri) {
    const uploadStartedAt = now();

    originalImagePath = await uploadOriginalImage(clothing.imageUri, userId);

    perfLog("save.uploadOriginal", uploadStartedAt);

    let localSamSucceeded = false;

    if (clothing.box2d) {
      const samStartedAt = now();

      try {
        const cutoutBuffer = await segmentGarmentLocally(
          originalImagePath,
          clothing.box2d,
        );

        cutoutImagePath = await uploadCutoutBuffer(cutoutBuffer, userId);

        localSamSucceeded = true;

        cutoutVia = "slimsam";

        perfLog("save.slimsam", samStartedAt, { ok: true });
      } catch (error) {
        perfLog("save.slimsam", samStartedAt, { ok: false });

        console.warn("Local SlimSAM 실패 - BRIA fallback:", error);
      }
    }

    /**
     * 2-2. SAM 2가 실패하면
     * 기존 Crop + BRIA 방식 사용
     */
    if (!localSamSucceeded) {
      let processingImagePath: string | null = null;

      const briaStartedAt = now();

      try {
        const croppedImageUri = await cropMainGarment(
          clothing.imageUri,
          clothing.box2d,
        );

        processingImagePath = await uploadProcessingImage(
          croppedImageUri,
          userId,
        );

        const cutoutUrl = await removeBackground(processingImagePath);

        cutoutImagePath = await uploadCutoutImage(cutoutUrl, userId);

        cutoutVia = "bria";

        perfLog("save.bria", briaStartedAt, { ok: true });
      } catch (error) {
        cutoutVia = "original";

        perfLog("save.bria", briaStartedAt, { ok: false });

        console.error("BRIA fallback 실패 - 원본 이미지로 저장:", error);
      } finally {
        if (processingImagePath) {
          const { error: cleanupError } = await supabase.storage
            .from(STORAGE_BUCKET)
            .remove([processingImagePath]);

          if (cleanupError) {
            console.warn("임시 Crop 이미지 삭제 실패:", cleanupError);
          }
        }
      }
    }
  }

  /**
   * 3. DB 저장
   *
   * 중요:
   * 이 부분은 위의 if (clothing.imageUri)
   * 바깥에 있어야 함
   */
  const { data, error } = await supabase
    .from("clothes")
    .insert({
      user_id: userId,

      category: clothing.category,

      sub_category: clothing.subCategory,

      color: clothing.color,

      color_tone: clothing.colorTone,

      fit: clothing.fit,

      material: clothing.material,

      season: clothing.season,

      tpo: clothing.tpo,

      style: clothing.style,

      original_image_path: originalImagePath,

      cutout_image_path: cutoutImagePath,
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  perfLog("save.total", saveStartedAt, { cutoutVia });

  /**
   * 4. 반드시 Clothing 반환
   */
  return {
    ...clothing,
    id: Number(data.id),
  };
};
/**
 * Storage path를
 * 화면에서 사용할 Signed URL로 변환
 */
const getSignedImageUrl = async (imagePath: string | null | undefined) => {
  if (!imagePath) {
    return undefined;
  }

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(imagePath, 60 * 60);

  if (error) {
    console.error("이미지 URL 생성 실패:", error);

    return undefined;
  }

  return data.signedUrl;
};

/**
 * 로그인한 사용자의 옷장 조회
 */
export const fetchClothesFromSupabase = async (): Promise<Clothing[]> => {
  const { data, error } = await supabase
    .from("clothes")
    .select("*")
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw error;
  }

  const clothes = await Promise.all(
    (data ?? []).map(async (item) => {
      // 배경 제거 이미지와 원본을 모두 내려준다. (사진 수정 화면에서 전환)
      const cutoutImageUri = await getSignedImageUrl(item.cutout_image_path);

      const originalImageUri = await getSignedImageUrl(
        item.original_image_path,
      );

      // 기본은 배경 제거 이미지, 없으면 원본
      const imageUri = cutoutImageUri ?? originalImageUri;

      return {
        id: Number(item.id),

        category: item.category,

        subCategory: item.sub_category,

        color: item.color,

        colorTone: item.color_tone,

        fit: item.fit,

        material: item.material,

        season: item.season ?? [],

        tpo: item.tpo ?? [],

        style: item.style ?? [],

        imageUri,

        originalImageUri,

        cutoutImageUri,
      };
    }),
  );

  return clothes as Clothing[];
};

/**
 * 옷 사진 교체
 *
 * 사용자가 자르기 화면에서 직접 맞춘 사진을 그대로 사용한다.
 * (배경 제거를 다시 실행하지 않아 의도치 않게 잘리지 않는다)
 */
export const replaceClothingImage = async (
  clothingId: number,
  userId: string,
  imageUri: string,
): Promise<
  Pick<Clothing, "imageUri" | "originalImageUri" | "cutoutImageUri">
> => {
  const { data: current, error: fetchError } = await supabase
    .from("clothes")
    .select("original_image_path, cutout_image_path")
    .eq("id", clothingId)
    .single();

  if (fetchError) {
    throw fetchError;
  }

  const originalImagePath = await uploadOriginalImage(imageUri, userId);

  const { error: updateError } = await supabase
    .from("clothes")
    .update({
      original_image_path: originalImagePath,

      cutout_image_path: null,
    })
    .eq("id", clothingId);

  if (updateError) {
    // DB 반영에 실패하면 방금 올린 이미지는 쓰이지 않으므로 정리
    await supabase.storage.from(STORAGE_BUCKET).remove([originalImagePath]);

    throw updateError;
  }

  // 이전 이미지 정리 (실패해도 교체 자체는 성공)
  const previousPaths = [
    current.original_image_path,
    current.cutout_image_path,
  ].filter((path): path is string => Boolean(path));

  if (previousPaths.length > 0) {
    const { error: cleanupError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove(previousPaths);

    if (cleanupError) {
      console.warn("이전 이미지 삭제 실패:", cleanupError);
    }
  }

  const newImageUri = await getSignedImageUrl(originalImagePath);

  return {
    imageUri: newImageUri,

    originalImageUri: newImageUri,

    cutoutImageUri: undefined,
  };
};

/**
 * 옷 + 연결된 Storage 이미지 삭제
 */
export const deleteClothingFromSupabase = async (clothingId: number) => {
  const { data, error: fetchError } = await supabase
    .from("clothes")
    .select("original_image_path, cutout_image_path")
    .eq("id", clothingId)
    .single();

  if (fetchError) {
    throw fetchError;
  }

  const imagePaths = [data.original_image_path, data.cutout_image_path].filter(
    (path): path is string => Boolean(path),
  );

  // Storage 이미지 삭제
  if (imagePaths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove(imagePaths);

    if (storageError) {
      throw storageError;
    }
  }

  // DB row 삭제
  const { error: deleteError } = await supabase
    .from("clothes")
    .delete()
    .eq("id", clothingId);

  if (deleteError) {
    throw deleteError;
  }
};
