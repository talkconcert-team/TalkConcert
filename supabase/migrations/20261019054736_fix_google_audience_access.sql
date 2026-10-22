-- Google 인증과 실제 세션 검증은 유지하고, 배포 DB에 남은 학교 이메일 제한만 제거한다.
create or replace function talkconcert_private.is_audience() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.identities i
    join auth.users u on u.id = i.user_id
    join auth.sessions s on s.user_id = i.user_id and s.id::text = (select auth.jwt()->>'session_id')
    where i.user_id = (select auth.uid()) and i.provider = 'google'
      and u.email is not null
      and u.email_confirmed_at is not null and not u.is_anonymous
      and coalesce((i.identity_data->>'email_verified')::boolean, false)
      and (s.not_after is null or s.not_after > now())
  );
$$;
revoke all on function talkconcert_private.is_audience() from public, anon;
grant execute on function talkconcert_private.is_audience() to authenticated;
