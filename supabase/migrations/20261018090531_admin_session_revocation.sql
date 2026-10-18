-- 로그아웃으로 세션이 폐기되면 아직 유효한 JWT가 남아 있어도 관리 API를 거부한다.
create or replace function talkconcert_private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.identities i
    join auth.users u on u.id = i.user_id
    join talkconcert_private.admin_accounts a on a.email = lower(i.identity_data->>'email')
    join auth.sessions s on s.user_id = i.user_id and s.id::text = (select auth.jwt()->>'session_id')
    where i.user_id = (select auth.uid()) and i.provider = 'google'
      and u.email_confirmed_at is not null and not u.is_anonymous
      and coalesce((i.identity_data->>'email_verified')::boolean, false)
      and (s.not_after is null or s.not_after > now())
  );
$$;
