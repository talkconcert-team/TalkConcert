create table talkconcert_private.admin_accounts (
  email text primary key check (email = lower(btrim(email)))
);
alter table talkconcert_private.admin_accounts enable row level security;
revoke all on talkconcert_private.admin_accounts from public, anon, authenticated;

-- 사용자 입력 이메일이나 수정 가능한 user_metadata 대신 검증된 Google identity를 확인한다.
create function talkconcert_private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.identities i
    join auth.users u on u.id = i.user_id
    join talkconcert_private.admin_accounts a on a.email = lower(i.identity_data->>'email')
    where i.user_id = (select auth.uid()) and i.provider = 'google'
      and u.email_confirmed_at is not null and not u.is_anonymous
      and coalesce((i.identity_data->>'email_verified')::boolean, false)
  );
$$;
revoke all on function talkconcert_private.is_admin() from public, anon;
grant usage on schema talkconcert_private to authenticated;
grant execute on function talkconcert_private.is_admin() to authenticated;
create function public.is_talkconcert_admin() returns boolean
language sql stable security invoker set search_path = '' as $$
  select talkconcert_private.is_admin();
$$;
revoke all on function public.is_talkconcert_admin() from public, anon;
grant execute on function public.is_talkconcert_admin() to authenticated;

-- 기존 서버 토큰만으로는 관리 API를 호출할 수 없게 권한 검증을 DB에도 추가한다.
alter function talkconcert_private.manage_board(text, jsonb, text) rename to manage_board_internal;
revoke all on function talkconcert_private.manage_board_internal(text, jsonb, text) from public, anon, authenticated;
create function talkconcert_private.manage_board(p_action text, p_data jsonb, p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not talkconcert_private.is_admin() then raise insufficient_privilege using message = '허용된 Google 관리자 계정으로 로그인해 주세요.'; end if;
  return talkconcert_private.manage_board_internal(p_action, p_data, p_token);
end $$;
revoke all on function talkconcert_private.manage_board(text, jsonb, text) from public, anon;
grant execute on function talkconcert_private.manage_board(text, jsonb, text) to authenticated;
revoke all on function public.manage_talkconcert_board(text, jsonb, text) from public, anon;
grant execute on function public.manage_talkconcert_board(text, jsonb, text) to authenticated;

alter function public.set_talkconcert_setting(text, boolean, text) set schema talkconcert_private;
revoke all on function talkconcert_private.set_talkconcert_setting(text, boolean, text) from public, anon, authenticated;
create function talkconcert_private.set_admin_setting(p_key text, p_enabled boolean, p_token text)
returns table (draw boolean, topics boolean)
language plpgsql security definer set search_path = '' as $$
begin
  if not talkconcert_private.is_admin() then raise insufficient_privilege using message = '허용된 Google 관리자 계정으로 로그인해 주세요.'; end if;
  return query select * from talkconcert_private.set_talkconcert_setting(p_key, p_enabled, p_token);
end $$;
revoke all on function talkconcert_private.set_admin_setting(text, boolean, text) from public, anon;
grant execute on function talkconcert_private.set_admin_setting(text, boolean, text) to authenticated;
create function public.set_talkconcert_setting(p_key text, p_enabled boolean, p_token text)
returns table (draw boolean, topics boolean)
language sql security invoker set search_path = '' as $$
  select * from talkconcert_private.set_admin_setting(p_key, p_enabled, p_token);
$$;
revoke all on function public.set_talkconcert_setting(text, boolean, text) from public, anon;
grant execute on function public.set_talkconcert_setting(text, boolean, text) to authenticated;
