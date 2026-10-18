-- 이동 계산은 공유하되 관객 작성자 토큰과 관리자 세션의 검증 경로를 분리한다.
create function talkconcert_private.relocate_question(p_id uuid, p_topic uuid, p_target uuid, p_after boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_ids uuid[]; v_index integer;
begin
  -- CMS의 주제 삭제와 같은 잠금 순서로 이동과 순서 변경을 한 번에 확정한다.
  perform pg_catalog.pg_advisory_xact_lock(74261903);
  perform 1 from public.talkconcert_topics where deleted_at is null order by position for update;
  if not exists (select 1 from public.talkconcert_questions where id = p_id and deleted_at is null) then raise no_data_found using message = '이 메모는 삭제되었어요.'; end if;
  if not exists (select 1 from public.talkconcert_topics where id = p_topic and deleted_at is null) then raise invalid_parameter_value using message = '이동할 주제가 삭제되었어요.'; end if;
  select coalesce(array_agg(id order by sort_order, number desc), '{}'::uuid[]) into v_ids
  from public.talkconcert_questions where topic_id = p_topic and deleted_at is null and id <> p_id;
  if p_target is null then
    v_ids := v_ids || p_id;
  else
    v_index := array_position(v_ids, p_target);
    if v_index is null then raise invalid_parameter_value using message = '이동 대상이 바뀌었어요. 다시 놓아 주세요.'; end if;
    v_index := v_index + case when coalesce(p_after, false) then 1 else 0 end;
    v_ids := coalesce(v_ids[1:v_index-1], '{}'::uuid[]) || array[p_id] || coalesce(v_ids[v_index:cardinality(v_ids)], '{}'::uuid[]);
  end if;
  update public.talkconcert_questions set topic_id = p_topic where id = p_id;
  update public.talkconcert_questions q set sort_order = v.pos
    from unnest(v_ids) with ordinality as v(id, pos) where q.id = v.id;
  return true;
end $$;
revoke all on function talkconcert_private.relocate_question(uuid,uuid,uuid,boolean) from public, anon, authenticated;

create or replace function talkconcert_private.move_question(p_id uuid, p_topic uuid, p_target uuid, p_after boolean, p_owner_token text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if p_owner_token is null or not exists (
    select 1 from talkconcert_private.question_owners where question_id = p_id
      and token_hash = pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_owner_token,'UTF8')), 'hex')
  ) then raise insufficient_privilege using message = '본인이 작성한 메모만 이동할 수 있어요.'; end if;
  return talkconcert_private.relocate_question(p_id,p_topic,p_target,p_after);
end $$;

create function talkconcert_private.move_admin_question(p_id uuid, p_topic uuid, p_target uuid, p_after boolean, p_token text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if not talkconcert_private.is_admin() or p_token is null or not exists (
    select 1 from talkconcert_private.settings_access where id = 'main'
      and token_hash = pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_token,'UTF8')), 'hex')
  ) then raise insufficient_privilege using message = '허용된 관리자 로그인이 필요해요.'; end if;
  return talkconcert_private.relocate_question(p_id,p_topic,p_target,p_after);
end $$;
revoke all on function talkconcert_private.move_admin_question(uuid,uuid,uuid,boolean,text) from public, anon;
grant execute on function talkconcert_private.move_admin_question(uuid,uuid,uuid,boolean,text) to authenticated;
create function public.move_admin_talkconcert_question(p_id uuid, p_topic uuid, p_target uuid, p_after boolean, p_token text) returns boolean
language sql security invoker set search_path = '' as $$
  select talkconcert_private.move_admin_question(p_id,p_topic,p_target,p_after,p_token);
$$;
revoke all on function public.move_admin_talkconcert_question(uuid,uuid,uuid,boolean,text) from public, anon;
grant execute on function public.move_admin_talkconcert_question(uuid,uuid,uuid,boolean,text) to authenticated;
