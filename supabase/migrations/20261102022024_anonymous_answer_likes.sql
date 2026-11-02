-- 질문·답변 원문은 변경하지 않는다. 좋아요만 별도 보관하고 취소 권한은 제공하지 않는다.
create table talkconcert_private.answer_likes (
  question_id uuid not null,
  author_id uuid not null,
  visitor_hash text not null check (visitor_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  primary key (question_id, author_id, visitor_hash),
  foreign key (question_id, author_id) references talkconcert_private.question_answers(question_id, author_id)
);
alter table talkconcert_private.answer_likes enable row level security;
revoke all on talkconcert_private.answer_likes from public, anon, authenticated;

-- 기존 답변에 새 ID를 쓰지 않고, 공개용 식별자를 계산한다. 관리자 계정 UUID는 공개하지 않는다.
create function talkconcert_private.answer_public_id(p_question uuid, p_author uuid) returns uuid
language sql immutable strict security invoker set search_path = '' as $$
  select md5(p_question::text || ':' || p_author::text)::uuid;
$$;
revoke all on function talkconcert_private.answer_public_id(uuid, uuid) from public, anon, authenticated;

create or replace function talkconcert_private.read_question_answers() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'answerId', talkconcert_private.answer_public_id(a.question_id, a.author_id),
    'questionId', a.question_id, 'authorName', a.author_name, 'text', a.text,
    'createdAt', a.created_at, 'updatedAt', a.updated_at,
    'mine', a.author_id = (select auth.uid()),
    'likes', (select count(*) from talkconcert_private.answer_likes l where l.question_id=a.question_id and l.author_id=a.author_id)
  ) order by a.created_at, a.author_id), '[]'::jsonb)
  from talkconcert_private.question_answers a
  join public.talkconcert_questions q on q.id=a.question_id and q.deleted_at is null
  join public.talkconcert_topics t on t.id=q.topic_id and t.deleted_at is null;
$$;

-- 익명 브라우저 토큰은 해시로만 저장한다. 토큰이나 좋아요를 누른 사람 목록은 공개하지 않는다.
create function talkconcert_private.answer_like_state(p_ids uuid[], p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' or p_ids is null or cardinality(p_ids) not between 1 and 10
     or array_position(p_ids, null) is not null then
    raise invalid_parameter_value using message = '좋아요 확인 정보를 확인해 주세요.';
  end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
    'answerId', talkconcert_private.answer_public_id(a.question_id,a.author_id),
    'likes', (select count(*) from talkconcert_private.answer_likes l where l.question_id=a.question_id and l.author_id=a.author_id),
    'liked', exists(select 1 from talkconcert_private.answer_likes l where l.question_id=a.question_id and l.author_id=a.author_id
      and l.visitor_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex'))
  )), '[]'::jsonb)
  from talkconcert_private.question_answers a
  join public.talkconcert_questions q on q.id=a.question_id and q.deleted_at is null
  join public.talkconcert_topics t on t.id=q.topic_id and t.deleted_at is null
  where talkconcert_private.answer_public_id(a.question_id,a.author_id)=any(p_ids));
end $$;
revoke all on function talkconcert_private.answer_like_state(uuid[],text) from public;
grant execute on function talkconcert_private.answer_like_state(uuid[],text) to anon, authenticated;
create function public.get_talkconcert_answer_likes(p_ids uuid[],p_token text) returns jsonb
language sql security invoker set search_path = '' as $$
  select talkconcert_private.answer_like_state(p_ids,p_token);
$$;
revoke all on function public.get_talkconcert_answer_likes(uuid[],text) from public;
grant execute on function public.get_talkconcert_answer_likes(uuid[],text) to anon, authenticated;

create function talkconcert_private.like_answer(p_id uuid,p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_question uuid; v_author uuid;
begin
  if p_id is null or p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    raise invalid_parameter_value using message = '좋아요 확인 정보를 확인해 주세요.';
  end if;
  select a.question_id,a.author_id into v_question,v_author
  from talkconcert_private.question_answers a
  join public.talkconcert_questions q on q.id=a.question_id and q.deleted_at is null
  join public.talkconcert_topics t on t.id=q.topic_id and t.deleted_at is null
  where talkconcert_private.answer_public_id(a.question_id,a.author_id)=p_id for share of a,q,t;
  if not found then raise no_data_found using message = '이 답변을 더 이상 볼 수 없어요.'; end if;
  -- 같은 브라우저의 재시도·동시 클릭은 한 건으로 처리하며 삭제·감소 경로를 두지 않는다.
  insert into talkconcert_private.answer_likes(question_id,author_id,visitor_hash)
  values(v_question,v_author,encode(sha256(convert_to(p_token,'UTF8')),'hex'))
  on conflict (question_id,author_id,visitor_hash) do nothing;
  return talkconcert_private.answer_like_state(array[p_id],p_token)->0;
end $$;
revoke all on function talkconcert_private.like_answer(uuid,text) from public;
grant execute on function talkconcert_private.like_answer(uuid,text) to anon, authenticated;
create function public.like_talkconcert_answer(p_id uuid,p_token text) returns jsonb
language sql security invoker set search_path = '' as $$
  select talkconcert_private.like_answer(p_id,p_token);
$$;
revoke all on function public.like_talkconcert_answer(uuid,text) from public;
grant execute on function public.like_talkconcert_answer(uuid,text) to anon, authenticated;
