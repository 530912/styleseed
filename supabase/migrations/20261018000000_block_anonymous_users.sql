-- =============================================================================
-- Sprint 1A-2 / S2-02 (DB-1): 익명 사용자(Supabase anonymous sign-in)의 옷장·사진 접근 차단
--
-- 익명 사용자도 Postgres 역할은 `authenticated`이므로 기존 정책
-- ("Users can ... own clothes", "... own clothing images")만으로는 자기 행·폴더에 쓸 수 있다.
-- 기존 정책은 수정하지 않고 RESTRICTIVE 정책을 추가한다. Restrictive 정책은 기존
-- permissive 정책과 AND로 결합되므로, 정식 사용자는 기존과 똑같이 동작하고
-- 익명 사용자는 모든 동작이 거절된다.
--
-- is_anonymous 클레임이 없거나 false인 토큰(정식 사용자)은 통과한다.
--
-- 롤백:
--   drop policy if exists "Block anonymous users on clothes" on public.clothes;
--   drop policy if exists "Block anonymous users on clothing images" on storage.objects;
-- =============================================================================

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'clothes'
      and policyname = 'Block anonymous users on clothes'
  ) then
    create policy "Block anonymous users on clothes"
      on public.clothes
      as restrictive
      for all
      to authenticated
      using ((select (auth.jwt() ->> 'is_anonymous')::boolean) is not true)
      with check ((select (auth.jwt() ->> 'is_anonymous')::boolean) is not true);
  end if;

  -- 다른 버킷에는 영향을 주지 않도록 clothing-images에만 적용한다
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Block anonymous users on clothing images'
  ) then
    create policy "Block anonymous users on clothing images"
      on storage.objects
      as restrictive
      for all
      to authenticated
      using (
        bucket_id <> 'clothing-images'
        or (select (auth.jwt() ->> 'is_anonymous')::boolean) is not true
      )
      with check (
        bucket_id <> 'clothing-images'
        or (select (auth.jwt() ->> 'is_anonymous')::boolean) is not true
      );
  end if;
end
$$;
