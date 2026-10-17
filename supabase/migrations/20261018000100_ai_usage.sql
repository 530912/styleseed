-- =============================================================================
-- Sprint 1A-2 / S2-03 (DB-2): 서버 재시작 후에도 유지되는 AI 사용량 기록
--
-- - ai_usage: 사용자별·종류별·1시간 구간별 호출 횟수. 직접 조회·쓰기 불가(정책 없음 + 권한 회수).
-- - consume_ai_quota(kind): 호출한 사용자(auth.uid())의 현재 구간 횟수를 1 늘리고 결과를 돌려준다.
--   사용자 ID를 인자로 받지 않으므로 다른 사용자의 사용량을 바꿀 수 없다.
--   한도 판단(몇 회까지 허용할지)은 백엔드가 한다(backend/quota.js).
-- - 백엔드는 사용자 본인의 토큰으로 이 함수를 호출한다. 관리자 키(Secret)가 필요 없다.
-- - IP 주소는 저장하지 않는다.
--
-- 롤백:
--   drop function if exists public.consume_ai_quota(text);
--   drop table if exists public.ai_usage;
-- =============================================================================

create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('analyze')),
  window_start timestamptz not null,
  count integer not null default 0 check (count >= 0),
  updated_at timestamptz not null default now(),
  constraint ai_usage_pkey primary key (user_id, kind, window_start)
);

alter table public.ai_usage enable row level security;

-- 정책을 만들지 않으므로 RLS가 모든 직접 접근을 거절한다. 권한도 함께 회수한다.
revoke all on table public.ai_usage from anon, authenticated;

create or replace function public.consume_ai_quota(p_kind text)
returns table (used_count integer, window_started_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_window timestamptz := date_trunc('hour', now());
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if p_kind is null or p_kind not in ('analyze') then
    raise exception 'invalid usage kind' using errcode = '22023';
  end if;

  return query
  insert into public.ai_usage as u (user_id, kind, window_start, count)
  values (v_user_id, p_kind, v_window, 1)
  on conflict (user_id, kind, window_start)
  do update set count = u.count + 1, updated_at = now()
  returning u.count, u.window_start;
end;
$$;

revoke all on function public.consume_ai_quota(text) from public, anon;

grant execute on function public.consume_ai_quota(text) to authenticated;
