-- 2026-11 사용자 조사 전용 Supabase 프로젝트 구성 확인 (읽기 전용)
-- 조사 프로젝트의 SQL Editor에서 마이그레이션 5개 적용 후 실행한다. 데이터를 바꾸지 않는다.
-- 기대값은 운영 프로젝트(2026-10-26 조회)와 같다. 모든 행의 ok가 true여야 한다.
select 'RLS clothes·ai_usage' as item,
       (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relname in ('clothes', 'ai_usage') and c.relrowsecurity) = 2 as ok
union all
select 'clothes 정책 5개(본인 4 + 익명 차단 1)',
       (select count(*) from pg_policies where schemaname = 'public' and tablename = 'clothes') = 5
union all
select 'storage 정책 5개(본인 4 + 익명 차단 1)',
       (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects'
         and policyname like '%clothing images%') = 5
union all
select '버킷 비공개·10MB·이미지 5종',
       exists (select 1 from storage.buckets where id = 'clothing-images' and public = false
               and file_size_limit = 10485760 and cardinality(allowed_mime_types) = 5)
union all
select 'anon은 clothes 권한 없음',
       not has_table_privilege('anon', 'public.clothes', 'select')
       and not has_table_privilege('anon', 'public.clothes', 'insert')
union all
select 'ai_usage 직접 접근 불가',
       not has_table_privilege('authenticated', 'public.ai_usage', 'select')
       and not has_table_privilege('authenticated', 'public.ai_usage', 'update')
union all
select 'consume_ai_quota: authenticated만 실행, SECURITY DEFINER',
       has_function_privilege('authenticated', 'public.consume_ai_quota(text)', 'execute')
       and not has_function_privilege('anon', 'public.consume_ai_quota(text)', 'execute')
       and (select prosecdef from pg_proc where proname = 'consume_ai_quota')
union all
select '조사 시작 전 사용자 0명(진행자 테스트 계정은 삭제 후)',
       (select count(*) from auth.users) = 0;
