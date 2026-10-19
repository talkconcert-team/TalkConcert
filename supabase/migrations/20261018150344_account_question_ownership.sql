-- 작성자 정보는 공개 질문에 넣지 않고 비공개 테이블에서 Google 계정과 연결한다.
alter table talkconcert_private.question_owners add column user_id uuid references auth.users(id) on delete set null;
create index question_owners_user_idx on talkconcert_private.question_owners(user_id) where user_id is not null;

create or replace function talkconcert_private.submit_question(p_id uuid,p_topic uuid,p_text text,p_color text,p_owner_token text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_owner uuid; v_token text;
begin
  if not talkconcert_private.is_audience() then raise insufficient_privilege using message='Google 로그인이 필요해요.'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text,0));
  select user_id into v_owner from talkconcert_private.question_owners where question_id=p_id for update;
  if v_owner is not null then
    if v_owner <> auth.uid() then raise insufficient_privilege; end if;
    return true;
  end if;
  -- 새 클라이언트는 로컬 저장소가 없어도 등록한다. 이전 클라이언트의 토큰도 호환한다.
  v_token := coalesce(p_owner_token,pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(gen_random_uuid()::text,'UTF8')),'hex'));
  perform talkconcert_private.submit_question_with_owner(p_id,p_topic,p_text,p_color,v_token);
  update talkconcert_private.question_owners set user_id=auth.uid() where question_id=p_id and user_id is null;
  return true;
end $$;

create or replace function talkconcert_private.move_question(p_id uuid,p_topic uuid,p_target uuid,p_after boolean,p_owner_token text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_owner uuid;
begin
  if not talkconcert_private.is_audience() then raise insufficient_privilege using message='Google 로그인이 필요해요.'; end if;
  -- 예전 토큰은 미연결 질문에만 사용한다. 연결 후 다른 계정은 토큰이 있어도 이동할 수 없다.
  update talkconcert_private.question_owners set user_id=auth.uid()
  where question_id=p_id and user_id is null and p_owner_token is not null
    and token_hash=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_owner_token,'UTF8')),'hex');
  select user_id into v_owner from talkconcert_private.question_owners where question_id=p_id;
  if v_owner is null or v_owner <> auth.uid() then raise insufficient_privilege using message='본인이 작성한 질문만 이동할 수 있어요.'; end if;
  return talkconcert_private.relocate_question(p_id,p_topic,p_target,p_after);
end $$;

create function talkconcert_private.sync_question_ownership(p_owners jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_item jsonb;
begin
  if not talkconcert_private.is_audience() then raise insufficient_privilege; end if;
  if p_owners is null or jsonb_typeof(p_owners)<>'array' then raise invalid_parameter_value; end if;
  if jsonb_array_length(p_owners)>200 then raise invalid_parameter_value; end if;
  for v_item in select value from jsonb_array_elements(p_owners) order by value->>'id' loop
    if coalesce(v_item->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or coalesce(v_item->>'token','') !~ '^[0-9a-f]{64}$' then raise invalid_parameter_value; end if;
    update talkconcert_private.question_owners set user_id=auth.uid()
    where question_id=(v_item->>'id')::uuid and user_id is null
      and token_hash=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(v_item->>'token','UTF8')),'hex');
  end loop;
  return coalesce((select jsonb_agg(o.question_id order by o.question_id)
    from talkconcert_private.question_owners o join public.talkconcert_questions q on q.id=o.question_id
    where o.user_id=auth.uid() and q.deleted_at is null),'[]'::jsonb);
end $$;
revoke all on function talkconcert_private.sync_question_ownership(jsonb) from public,anon;
grant execute on function talkconcert_private.sync_question_ownership(jsonb) to authenticated;
create function public.sync_talkconcert_question_ownership(p_owners jsonb) returns jsonb
language sql security invoker set search_path = '' as $$
  select talkconcert_private.sync_question_ownership(p_owners);
$$;
revoke all on function public.sync_talkconcert_question_ownership(jsonb) from public,anon;
grant execute on function public.sync_talkconcert_question_ownership(jsonb) to authenticated;
