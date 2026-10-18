create table public.talkconcert_topics (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 40),
  position bigint generated always as identity,
  deleted_at timestamptz
);
create table public.talkconcert_questions (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.talkconcert_topics(id),
  number bigint generated always as identity unique,
  text text not null check (char_length(btrim(text)) between 1 and 4000),
  color text not null default 'cream' check (color in ('cream','rose','mint','sky','lavender','white') or color ~ '^#[0-9a-fA-F]{6}$'),
  deleted_at timestamptz,
  updated_at timestamptz not null default now()
);
create index talkconcert_questions_topic_idx on public.talkconcert_questions(topic_id);
alter table public.talkconcert_topics enable row level security;
alter table public.talkconcert_questions enable row level security;
revoke all on public.talkconcert_topics, public.talkconcert_questions from anon, authenticated;
grant select on public.talkconcert_topics, public.talkconcert_questions to anon, authenticated;
grant insert (id, topic_id, text, color) on public.talkconcert_questions to anon, authenticated;
grant usage on sequence public.talkconcert_questions_number_seq to anon, authenticated;
create policy "공개 주제 읽기" on public.talkconcert_topics for select to anon, authenticated using (deleted_at is null);
create policy "공개 질문 읽기" on public.talkconcert_questions for select to anon, authenticated using (deleted_at is null);
create policy "관객 질문 등록" on public.talkconcert_questions for insert to anon, authenticated
with check (deleted_at is null and exists (select 1 from public.talkconcert_topics t where t.id = topic_id and t.deleted_at is null));

-- 주제 삭제와 관객 등록이 겹쳐도 삭제된 주제에 질문이 남지 않게 행 잠금을 잡는다.
create function talkconcert_private.check_question_topic() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.talkconcert_topics where id = new.topic_id and deleted_at is null for share;
  if not found then raise invalid_parameter_value using message = '사용 가능한 주제를 선택해 주세요.'; end if;
  new.updated_at := now();
  return new;
end $$;
revoke all on function talkconcert_private.check_question_topic() from public;
create trigger check_question_topic before insert or update on public.talkconcert_questions
for each row execute function talkconcert_private.check_question_topic();

insert into public.talkconcert_topics(title) values ('자유롭게 질문해요'), ('오늘의 발표'), ('경험이 궁금해요');

create function public.get_talkconcert_board() returns jsonb
language sql security invoker set search_path = '' as $$
  select jsonb_build_object(
    'columns', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title) order by t.position) from public.talkconcert_topics t where t.deleted_at is null), '[]'::jsonb),
    'questions', coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'columnId', q.topic_id, 'number', q.number, 'text', q.text, 'color', q.color, 'deletedAt', q.deleted_at) order by q.number desc) from public.talkconcert_questions q where q.deleted_at is null), '[]'::jsonb)
  );
$$;
revoke all on function public.get_talkconcert_board() from public;
grant execute on function public.get_talkconcert_board() to anon, authenticated;

-- 로그인 없는 로컬 CMS는 서버의 전용 토큰으로 검증한다. 권한 코드는 비공개 스키마에 둔다.
create function talkconcert_private.manage_board(p_action text, p_data jsonb, p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_target uuid;
begin
  if p_token is null or not exists (
    select 1 from talkconcert_private.settings_access a where a.id = 'main'
    and a.token_hash = pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_token, 'UTF8')), 'hex')
  ) then raise insufficient_privilege using message = '관리자 권한이 없어요.'; end if;
  if p_action <> 'snapshot' then
    perform pg_catalog.pg_advisory_xact_lock(74261903);
    perform 1 from public.talkconcert_topics where deleted_at is null order by position for update;
  end if;
  case p_action
  when 'snapshot' then null;
  when 'topic.create' then
    insert into public.talkconcert_topics(title) values (btrim(p_data->>'title'));
  when 'topic.update' then
    update public.talkconcert_topics set title = btrim(p_data->>'title') where id = (p_data->>'id')::uuid and deleted_at is null;
    if not found then raise no_data_found using message = '주제가 삭제되었어요. 목록을 새로 확인해 주세요.'; end if;
  when 'topic.delete' then
    v_id := (p_data->>'id')::uuid;
    if (select count(*) from public.talkconcert_topics where deleted_at is null) <= 1 then
      raise invalid_parameter_value using message = '주제는 하나 이상 남겨 주세요.';
    end if;
    if exists (select 1 from public.talkconcert_questions where topic_id = v_id) then
      v_target := (p_data->>'targetId')::uuid;
      if v_target is null or v_target = v_id or not exists(select 1 from public.talkconcert_topics where id = v_target and deleted_at is null) then
        raise invalid_parameter_value using message = '질문을 옮길 주제를 선택해 주세요.';
      end if;
      update public.talkconcert_questions set topic_id = v_target where topic_id = v_id;
    end if;
    update public.talkconcert_topics set deleted_at = now() where id = v_id and deleted_at is null;
    if not found then raise no_data_found using message = '주제를 찾을 수 없어요.'; end if;
  when 'question.create' then
    insert into public.talkconcert_questions(id, topic_id, text, color)
    values ((p_data->>'id')::uuid, (p_data->>'columnId')::uuid, btrim(p_data->>'text'), p_data->>'color');
  when 'question.update' then
    update public.talkconcert_questions set topic_id = (p_data->>'columnId')::uuid, text = btrim(p_data->>'text'), color = p_data->>'color'
    where id = (p_data->>'id')::uuid and deleted_at is null;
    if not found then raise no_data_found using message = '질문이 삭제되었어요. 목록을 새로 확인해 주세요.'; end if;
  when 'question.delete' then
    update public.talkconcert_questions set deleted_at = now() where id = (p_data->>'id')::uuid and deleted_at is null;
    if not found then raise no_data_found using message = '질문을 찾을 수 없어요.'; end if;
  when 'question.restore' then
    update public.talkconcert_questions set deleted_at = null where id = (p_data->>'id')::uuid and deleted_at is not null;
    if not found then raise no_data_found using message = '복구할 질문을 찾을 수 없어요.'; end if;
  else raise invalid_parameter_value using message = '지원하지 않는 관리 작업이에요.';
  end case;
  return jsonb_build_object(
    'columns', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title) order by t.position) from public.talkconcert_topics t where t.deleted_at is null), '[]'::jsonb),
    'questions', coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'columnId', q.topic_id, 'number', q.number, 'text', q.text, 'color', q.color, 'deletedAt', q.deleted_at) order by q.number desc) from public.talkconcert_questions q), '[]'::jsonb)
  );
end $$;
revoke all on function talkconcert_private.manage_board(text, jsonb, text) from public;
grant usage on schema talkconcert_private to anon;
grant execute on function talkconcert_private.manage_board(text, jsonb, text) to anon;

create function public.manage_talkconcert_board(p_action text, p_data jsonb, p_token text) returns jsonb
language sql security invoker set search_path = '' as $$
  select talkconcert_private.manage_board(p_action, p_data, p_token);
$$;
revoke all on function public.manage_talkconcert_board(text, jsonb, text) from public;
grant execute on function public.manage_talkconcert_board(text, jsonb, text) to anon;
