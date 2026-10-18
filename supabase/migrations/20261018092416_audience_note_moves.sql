alter table public.talkconcert_questions add column sort_order numeric not null default 0;
update public.talkconcert_questions set sort_order = -number;
create index talkconcert_questions_board_order_idx on public.talkconcert_questions(topic_id, sort_order, number desc) where deleted_at is null;

-- 작성자 이동 권한은 메모별 임의 토큰으로 확인한다. 토큰 원문은 작성 브라우저에만 남긴다.
create table talkconcert_private.question_owners (
  question_id uuid primary key references public.talkconcert_questions(id) on delete cascade,
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$')
);
alter table talkconcert_private.question_owners enable row level security;
revoke all on talkconcert_private.question_owners from public, anon, authenticated;
revoke insert (id, topic_id, text, color) on public.talkconcert_questions from anon, authenticated;
revoke usage on sequence public.talkconcert_questions_number_seq from anon, authenticated;

create or replace function talkconcert_private.check_question_topic() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.talkconcert_topics where id = new.topic_id and deleted_at is null for share;
  if not found then raise invalid_parameter_value using message = '사용 가능한 주제를 선택해 주세요.'; end if;
  if tg_op = 'INSERT' then new.sort_order := -new.number; end if;
  new.updated_at := now();
  return new;
end $$;

create function talkconcert_private.submit_question(p_id uuid, p_topic uuid, p_text text, p_color text, p_owner_token text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_hash text;
begin
  if p_owner_token is null or p_owner_token !~ '^[0-9a-f]{64}$' then raise invalid_parameter_value using message = '작성자 확인 정보가 필요해요.'; end if;
  v_hash := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_owner_token, 'UTF8')), 'hex');
  -- 등록과 재시도가 겹쳐도 동일 메모가 두 번 생성되거나 작성자가 바뀌지 않는다.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text, 0));
  if exists (select 1 from public.talkconcert_questions where id = p_id) then
    if not exists (select 1 from talkconcert_private.question_owners where question_id = p_id and token_hash = v_hash) then
      raise insufficient_privilege using message = '이 메모의 작성자를 확인할 수 없어요.';
    end if;
    return true;
  end if;
  insert into public.talkconcert_questions(id, topic_id, text, color) values (p_id, p_topic, btrim(p_text), p_color);
  insert into talkconcert_private.question_owners(question_id, token_hash) values (p_id, v_hash);
  return true;
end $$;
revoke all on function talkconcert_private.submit_question(uuid,uuid,text,text,text) from public;
grant execute on function talkconcert_private.submit_question(uuid,uuid,text,text,text) to anon, authenticated;
create function public.submit_talkconcert_question(p_id uuid, p_topic uuid, p_text text, p_color text, p_owner_token text) returns boolean
language sql security invoker set search_path = '' as $$
  select talkconcert_private.submit_question(p_id, p_topic, p_text, p_color, p_owner_token);
$$;
revoke all on function public.submit_talkconcert_question(uuid,uuid,text,text,text) from public;
grant execute on function public.submit_talkconcert_question(uuid,uuid,text,text,text) to anon, authenticated;

create function talkconcert_private.move_question(p_id uuid, p_topic uuid, p_target uuid, p_after boolean, p_owner_token text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_ids uuid[]; v_index integer;
begin
  if p_owner_token is null or not exists (
    select 1 from talkconcert_private.question_owners where question_id = p_id
      and token_hash = pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_owner_token,'UTF8')), 'hex')
  ) then raise insufficient_privilege using message = '본인이 작성한 메모만 이동할 수 있어요.'; end if;
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
revoke all on function talkconcert_private.move_question(uuid,uuid,uuid,boolean,text) from public;
grant execute on function talkconcert_private.move_question(uuid,uuid,uuid,boolean,text) to anon, authenticated;
create function public.move_talkconcert_question(p_id uuid, p_topic uuid, p_target uuid, p_after boolean, p_owner_token text) returns boolean
language sql security invoker set search_path = '' as $$
  select talkconcert_private.move_question(p_id, p_topic, p_target, p_after, p_owner_token);
$$;
revoke all on function public.move_talkconcert_question(uuid,uuid,uuid,boolean,text) from public;
grant execute on function public.move_talkconcert_question(uuid,uuid,uuid,boolean,text) to anon, authenticated;

create or replace function public.get_talkconcert_board() returns jsonb
language sql security invoker set search_path = '' as $$
  select jsonb_build_object(
    'columns', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title) order by t.position) from public.talkconcert_topics t where t.deleted_at is null), '[]'::jsonb),
    'questions', coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'columnId', q.topic_id, 'number', q.number, 'text', q.text, 'color', q.color, 'deletedAt', q.deleted_at) order by q.sort_order, q.number desc) from public.talkconcert_questions q where q.deleted_at is null), '[]'::jsonb)
  );
$$;
