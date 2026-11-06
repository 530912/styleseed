-- =============================================================================
-- Sprint 1A-2 (DB-5, 선택): 비로그인(anon) 역할의 clothes 테이블 권한 회수
--
-- 현재도 anon용 RLS 정책이 없어 anon은 0건만 보지만, RLS가 실수로 꺼지면 바로
-- 노출된다(AUDIT S-9). 권한을 회수해 이중으로 막는다. 앱은 anon으로 clothes에
-- 접근하지 않는다(로그인·익명 세션은 모두 authenticated 역할).
--
-- 롤백:
--   grant select, insert, update, delete on table public.clothes to anon;
-- =============================================================================

revoke all on table public.clothes from anon;
