const crypto = require("node:crypto");

const { createClient } = require("@supabase/supabase-js");

// 계정 삭제 (PRD SEC-09, FR-AUTH-05, TR-13)
//
// 삭제 범위
// - Storage clothing-images/{userId}/ 아래 모든 파일(originals, processing, cutouts)
// - Auth 사용자(auth.users). public.clothes·public.ai_usage는 user_id 외래 키가
//   on delete cascade라 Auth 사용자를 지우면 함께 지워진다
//
// 순서
// 1) Storage 파일 삭제 — Storage 객체를 소유한 Auth 사용자는 지울 수 없다(Supabase 제약)
// 2) Auth 사용자 영구 삭제(soft delete 아님) → clothes·ai_usage 연쇄 삭제
// 3) Storage를 한 번 더 비운다 — 삭제 직전에 올라간 파일 대비(토큰은 만료 전까지 유효)
//
// 실패 복구: 모든 단계가 반복 실행해도 안전하다. 중간에 실패하면 계정은 남아 있으므로
// 사용자가 다시 로그인해 같은 요청을 보내면 남은 단계부터 이어서 끝난다.
// 이미 삭제된 사용자는 성공으로 본다.
//
// 관리자 키(SUPABASE_SECRET_KEY)는 서버 환경변수로만 받고 로그·응답에 남기지 않는다.

const BUCKET = "clothing-images";

const LIST_PAGE_SIZE = 1000;

const REMOVE_BATCH_SIZE = 100;

// 폴더가 비정상적으로 깊거나 많을 때 무한히 돌지 않게 하는 안전 한도
const MAX_LISTED_ENTRIES = 50_000;

class AccountDeletionError extends Error {
  constructor(step, cause) {
    super(`계정 삭제 실패 (${step})`);

    this.name = "AccountDeletionError";

    this.step = step;

    this.cause = cause;
  }
}

// 로그에는 사용자 ID 대신 짧은 해시를 남긴다(운영자가 같은 요청끼리 묶어 볼 수 있을 정도)
const userTag = (userId) =>
  crypto.createHash("sha256").update(String(userId)).digest("hex").slice(0, 12);

const errorSummary = (error) =>
  error?.code ?? error?.status ?? error?.name ?? "unknown";

// {userId}/ 아래 파일 경로를 모두 모은다. list는 폴더 항목을 id가 null인 항목으로 돌려준다
const listUserFiles = async (storage, userId) => {
  const files = [];

  const folders = [userId];

  let listed = 0;

  while (folders.length > 0) {
    const folder = folders.pop();

    for (let offset = 0; ; offset += LIST_PAGE_SIZE) {
      const { data, error } = await storage.list(folder, {
        limit: LIST_PAGE_SIZE,
        offset,
        sortBy: { column: "name", order: "asc" },
      });

      if (error) {
        throw error;
      }

      const entries = data ?? [];

      listed += entries.length;

      if (listed > MAX_LISTED_ENTRIES) {
        throw new Error("Storage 항목이 너무 많습니다.");
      }

      for (const entry of entries) {
        const entryPath = `${folder}/${entry.name}`;

        if (entry.id === null || entry.id === undefined) {
          folders.push(entryPath);
        } else {
          files.push(entryPath);
        }
      }

      if (entries.length < LIST_PAGE_SIZE) {
        break;
      }
    }
  }

  return files;
};

const removeUserFiles = async (storage, userId) => {
  const files = await listUserFiles(storage, userId);

  for (let index = 0; index < files.length; index += REMOVE_BATCH_SIZE) {
    const { error } = await storage.remove(
      files.slice(index, index + REMOVE_BATCH_SIZE),
    );

    if (error) {
      throw error;
    }
  }

  return files.length;
};

const isUserNotFound = (error) =>
  error?.status === 404 || error?.code === "user_not_found";

// getAdminClient: 관리자 키로 만든 Supabase 클라이언트를 돌려준다(테스트에서 가짜로 바꾼다)
const createAccountDeleter = ({ getAdminClient }) => {
  // 같은 사용자의 삭제가 동시에 들어오면 진행 중인 작업 하나를 함께 기다린다
  const inFlight = new Map();

  const run = async (userId) => {
    const admin = getAdminClient();

    const storage = admin.storage.from(BUCKET);

    const tag = userTag(userId);

    let removedFiles = 0;

    try {
      removedFiles += await removeUserFiles(storage, userId);
    } catch (error) {
      console.error(`[account-delete ${tag}] Storage 삭제 실패: ${errorSummary(error)}`);

      throw new AccountDeletionError("storage", error);
    }

    let alreadyDeleted = false;

    const { error: deleteError } = await admin.auth.admin.deleteUser(
      userId,
      false,
    );

    if (deleteError) {
      if (!isUserNotFound(deleteError)) {
        console.error(
          `[account-delete ${tag}] Auth 사용자 삭제 실패: ${errorSummary(deleteError)}`,
        );

        throw new AccountDeletionError("auth", deleteError);
      }

      alreadyDeleted = true;
    }

    // 계정은 이미 지워졌으므로 마지막 정리가 실패해도 요청은 성공으로 끝낸다(운영 로그로 후속 정리)
    let cleanupFailed = false;

    try {
      removedFiles += await removeUserFiles(storage, userId);
    } catch (error) {
      cleanupFailed = true;

      console.error(
        `[account-delete ${tag}] 삭제 후 Storage 재정리 실패(수동 확인 필요): ${errorSummary(error)}`,
      );
    }

    console.log(
      `[account-delete ${tag}] 완료 (파일 ${removedFiles}개${alreadyDeleted ? ", 이미 삭제된 계정" : ""})`,
    );

    return { removedFiles, alreadyDeleted, cleanupFailed };
  };

  return async (userId) => {
    const existing = inFlight.get(userId);

    if (existing) {
      return existing;
    }

    const job = run(userId).finally(() => inFlight.delete(userId));

    inFlight.set(userId, job);

    return job;
  };
};

// 서버 환경변수의 관리자 키로 클라이언트를 만든다. 키가 없으면 null(삭제 기능 비활성)
const createAdminClientFactory = ({ url, secretKey }) => {
  if (!url || !secretKey) {
    return () => null;
  }

  let client = null;

  return () => {
    if (!client) {
      client = createClient(url, secretKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });
    }

    return client;
  };
};

// 검증을 마친 토큰의 payload만 읽는다(서명 검증은 auth.js가 이미 했다)
const readVerifiedClaims = (accessToken) => {
  try {
    const payload = String(accessToken).split(".")[1];

    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
};

// 최근 로그인 확인: 토큰의 amr(인증 방법·시각) 중 가장 최근 시각이 maxAgeSeconds 이내인지.
// 토큰 갱신(refresh)으로는 amr 시각이 바뀌지 않으므로, 삭제 직전에 비밀번호를 다시 입력해야 통과한다.
const isRecentlyAuthenticated = (
  claims,
  maxAgeSeconds,
  nowSeconds = Math.floor(Date.now() / 1000),
) => {
  const timestamps = (Array.isArray(claims?.amr) ? claims.amr : [])
    .map((entry) => Number(entry?.timestamp))
    .filter(Number.isFinite);

  if (timestamps.length === 0) {
    return false;
  }

  const age = nowSeconds - Math.max(...timestamps);

  // 서버·Auth 시계 차이를 1분까지 허용
  return age <= maxAgeSeconds && age >= -60;
};

module.exports = {
  AccountDeletionError,
  BUCKET,
  createAccountDeleter,
  createAdminClientFactory,
  isRecentlyAuthenticated,
  listUserFiles,
  readVerifiedClaims,
  userTag,
};
