// 이미지 처리 입력 검증 (PRD SEC-03, Sprint 1A-2 S2-09)
//
// 서버는 요청 본문의 임의 URL을 가져오지 않는다. 앱은 Storage 경로만 보내고,
// 서버가 경로를 검사한 뒤 "요청한 사용자 본인의 토큰으로" 서명 URL을 직접 만든다.
// 서명 URL 발급 단계에서 Storage RLS가 한 번 더 소유자를 확인한다.

const BUCKET = "clothing-images";

const SIGNED_URL_TTL_SECONDS = 60 * 10;

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

// {userId}/{originals|processing}/{파일명}.{이미지 확장자}
const IMAGE_PATH_PATTERN = new RegExp(
  `^(${UUID})/(originals|processing)/([A-Za-z0-9_-][A-Za-z0-9._-]{0,127})\\.(jpg|jpeg|png|webp|heic|heif)$`,
  "i",
);

const invalid = (message) => ({
  ok: false,
  status: 400,
  code: "INVALID_IMAGE_PATH",
  message,
});

const validateImagePath = (imagePath, userId) => {
  if (typeof imagePath !== "string" || imagePath.length === 0) {
    return invalid("이미지 경로가 필요합니다.");
  }

  if (imagePath.length > 300 || imagePath.includes("..") || imagePath.includes("//")) {
    return invalid("이미지 경로 형식이 올바르지 않습니다.");
  }

  const match = IMAGE_PATH_PATTERN.exec(imagePath);

  if (!match) {
    return invalid("이미지 경로 형식이 올바르지 않습니다.");
  }

  if (!userId || match[1].toLowerCase() !== String(userId).toLowerCase()) {
    return {
      ok: false,
      status: 403,
      code: "IMAGE_PATH_FORBIDDEN",
      message: "다른 사용자의 이미지에는 접근할 수 없습니다.",
    };
  }

  return { ok: true };
};

// 서명 URL이 설정된 Supabase 주소로만 향하는지 확인(방어적 확인)
const isExpectedOrigin = (signedUrl, supabaseUrl) => {
  try {
    return new URL(signedUrl).origin === new URL(supabaseUrl).origin;
  } catch {
    return false;
  }
};

// 요청 본문의 imagePath를 검사하고 서명 URL을 req.imageUrl에 넣는다.
// 요청 본문에 imageUrl이 와도 쓰지 않는다.
const createResolveImagePath =
  ({ getUserClient, getSupabaseUrl }) =>
  async (req, res, next) => {
    const { imagePath } = req.body ?? {};

    const check = validateImagePath(imagePath, req.auth?.userId);

    if (!check.ok) {
      return res
        .status(check.status)
        .json({ code: check.code, message: check.message });
    }

    try {
      const { data, error } = await getUserClient(req.auth.accessToken)
        .storage.from(BUCKET)
        .createSignedUrl(imagePath, SIGNED_URL_TTL_SECONDS);

      if (error || !data?.signedUrl) {
        return res.status(404).json({
          code: "IMAGE_NOT_FOUND",
          message: "이미지를 찾을 수 없습니다.",
        });
      }

      if (!isExpectedOrigin(data.signedUrl, getSupabaseUrl())) {
        console.error("예상하지 못한 서명 URL 주소");

        return res.status(502).json({
          code: "UPSTREAM_FAILED",
          message: "이미지를 불러오지 못했습니다.",
        });
      }

      req.imageUrl = data.signedUrl;

      return next();
    } catch (error) {
      console.error("서명 URL 생성 실패:", error?.message ?? error);

      return res.status(502).json({
        code: "UPSTREAM_FAILED",
        message: "이미지를 불러오지 못했습니다.",
      });
    }
  };

module.exports = { validateImagePath, createResolveImagePath, BUCKET };
