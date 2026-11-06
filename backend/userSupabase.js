const { createClient } = require("@supabase/supabase-js");

// 요청한 사용자 본인의 토큰으로 Supabase를 호출하는 클라이언트.
// RLS와 함수 권한이 그 사용자 기준으로 적용되므로 관리자 키(Secret)가 필요 없다.
const createUserSupabaseFactory = ({ url, publishableKey }) => {
  if (!url || !publishableKey) {
    return () => {
      throw new Error("Supabase URL 또는 Publishable key가 설정되지 않았습니다.");
    };
  }

  return (accessToken) =>
    createClient(url, publishableKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    });
};

module.exports = { createUserSupabaseFactory };
