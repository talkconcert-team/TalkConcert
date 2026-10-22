-- 관객은 검증된 Google 계정 중 bssm.hs.kr 도메인만 허용한다.
-- 정규식 이스케이프 오류를 피하고 숫자가 아닌 학교 계정도 허용한다.
create or replace function talkconcert_private.is_audience() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.identities i
    join auth.users u on u.id = i.user_id
    join auth.sessions s on s.user_id = i.user_id and s.id::text = (select auth.jwt()->>'session_id')
    where i.user_id = (select auth.uid()) and i.provider = 'google'
      and lower(u.email) ~ '^[^@[:space:]]+@bssm[.]hs[.]kr$'
      and u.email_confirmed_at is not null and not u.is_anonymous
      and coalesce((i.identity_data->>'email_verified')::boolean, false)
      and (s.not_after is null or s.not_after > now())
  );
$$;
revoke all on function talkconcert_private.is_audience() from public, anon;
grant execute on function talkconcert_private.is_audience() to authenticated;
