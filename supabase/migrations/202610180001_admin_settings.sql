-- 현재 단일 보드의 기능 설정. 테이블 변경은 기존 데이터를 덮어쓰지 않는다.
create table public.talkconcert_settings (
  id text primary key check (id = 'main'),
  draw boolean not null default true,
  topics boolean not null default true
);

insert into public.talkconcert_settings (id) values ('main');

alter table public.talkconcert_settings enable row level security;
revoke all on public.talkconcert_settings from anon, authenticated;
grant select on public.talkconcert_settings to anon, authenticated;

create policy "행사 기능 설정 읽기"
  on public.talkconcert_settings for select
  to anon, authenticated using (true);

-- 공개 API에서 접근할 수 없는 스키마에는 토큰 원문 대신 해시만 저장한다.
create schema if not exists talkconcert_private;
revoke all on schema talkconcert_private from public, anon, authenticated;
create table talkconcert_private.settings_access (
  id text primary key check (id = 'main'),
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$')
);
alter table talkconcert_private.settings_access enable row level security;
revoke all on talkconcert_private.settings_access from public, anon, authenticated;

-- 서비스 전체의 비밀 키 대신 설정 변경에만 쓸 수 있는 서버 전용 토큰을 검증한다.
create function public.set_talkconcert_setting(p_key text, p_enabled boolean, p_token text)
returns table (draw boolean, topics boolean)
language plpgsql security definer set search_path = ''
as $$
begin
  if p_token is null or not exists (
    select 1 from talkconcert_private.settings_access a
    where a.id = 'main'
      and a.token_hash = pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_token, 'UTF8')), 'hex')
  ) then
    raise insufficient_privilege using message = 'Settings access denied';
  end if;
  if p_key is null or p_key not in ('draw', 'topics') or p_enabled is null then
    raise invalid_parameter_value using message = 'Invalid setting';
  end if;
  return query
    update public.talkconcert_settings s
    set draw = case when p_key = 'draw' then p_enabled else s.draw end,
        topics = case when p_key = 'topics' then p_enabled else s.topics end
    where s.id = 'main'
    returning s.draw, s.topics;
end;
$$;
revoke all on function public.set_talkconcert_setting(text, boolean, text) from public;
grant execute on function public.set_talkconcert_setting(text, boolean, text) to anon, authenticated;

-- 토큰 해시 등록은 배포 환경별로 별도 SQL 작업에서 수행한다. 원문은 .env에만 보관한다.
