-- 기존 질문·답변·좋아요는 변경하지 않는다. 댓글은 관리자 답변을 참조하는 별도 데이터다.
create table talkconcert_private.answer_comments (
  id uuid primary key,
  sequence bigint generated always as identity unique,
  question_id uuid not null,
  author_id uuid not null,
  visitor_hash text not null check (visitor_hash ~ '^[0-9a-f]{64}$'),
  author_name text not null check (author_name ~ '^[가-힣]{1,16} 부소마인$'),
  text text not null check (char_length(btrim(text)) between 1 and 1000),
  created_at timestamptz not null default now(),
  foreign key (question_id, author_id) references talkconcert_private.question_answers(question_id, author_id)
);
create index answer_comments_answer_sequence_idx on talkconcert_private.answer_comments(question_id,author_id,sequence desc);
alter table talkconcert_private.answer_comments enable row level security;
revoke all on talkconcert_private.answer_comments from public,anon,authenticated;
revoke all on sequence talkconcert_private.answer_comments_sequence_seq from public,anon,authenticated;

create function talkconcert_private.read_answer_comments(p_answer uuid,p_before bigint default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_question uuid; v_author uuid;
begin
  if p_answer is null or p_before <= 0 then raise invalid_parameter_value using message='답변을 다시 선택해 주세요.'; end if;
  select a.question_id,a.author_id into v_question,v_author
  from talkconcert_private.question_answers a
  join public.talkconcert_questions q on q.id=a.question_id and q.deleted_at is null
  join public.talkconcert_topics t on t.id=q.topic_id and t.deleted_at is null
  where talkconcert_private.answer_public_id(a.question_id,a.author_id)=p_answer;
  if not found then raise no_data_found using message='이 답변을 더 이상 볼 수 없어요.'; end if;
  return (with page as (
    select c.* from talkconcert_private.answer_comments c
    where c.question_id=v_question and c.author_id=v_author and (p_before is null or c.sequence<p_before)
    order by c.sequence desc limit 21
  ), visible as (select * from page order by sequence desc limit 20)
  select jsonb_build_object('comments',coalesce((select jsonb_agg(jsonb_build_object(
    'id',id,'authorName',author_name,'text',text,'createdAt',created_at,'cursor',sequence::text
  ) order by sequence) from visible),'[]'::jsonb),'hasMore',(select count(*)>20 from page)));
end $$;
revoke all on function talkconcert_private.read_answer_comments(uuid,bigint) from public;
grant execute on function talkconcert_private.read_answer_comments(uuid,bigint) to anon,authenticated;
create function public.get_talkconcert_answer_comments(p_answer uuid,p_before bigint default null) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select talkconcert_private.read_answer_comments(p_answer,p_before);
$$;
revoke all on function public.get_talkconcert_answer_comments(uuid,bigint) from public;
grant execute on function public.get_talkconcert_answer_comments(uuid,bigint) to anon,authenticated;

-- 요청 ID를 재사용하는 재시도는 같은 댓글을 반환한다. 작성자 토큰은 공개하지 않는다.
create function talkconcert_private.create_answer_comment(p_answer uuid,p_id uuid,p_text text,p_name text,p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_question uuid; v_author uuid; v_comment talkconcert_private.answer_comments;
begin
  if p_answer is null or p_id is null or p_token is null or p_token !~ '^[0-9a-f]{64}$'
    or p_name is null or p_name !~ '^[가-힣]{1,16} 부소마인$'
    or p_text is null or char_length(btrim(p_text)) not between 1 and 1000 then
    raise invalid_parameter_value using message='댓글은 1~1000자로 입력해 주세요.';
  end if;
  select a.question_id,a.author_id into v_question,v_author
  from talkconcert_private.question_answers a
  join public.talkconcert_questions q on q.id=a.question_id and q.deleted_at is null
  join public.talkconcert_topics t on t.id=q.topic_id and t.deleted_at is null
  where talkconcert_private.answer_public_id(a.question_id,a.author_id)=p_answer for share of a,q,t;
  if not found then raise no_data_found using message='관리자 답변이 있는 질문에만 댓글을 남길 수 있어요.'; end if;
  insert into talkconcert_private.answer_comments(id,question_id,author_id,visitor_hash,author_name,text)
  values(p_id,v_question,v_author,encode(sha256(convert_to(p_token,'UTF8')),'hex'),p_name,btrim(p_text))
  on conflict(id) do nothing;
  select * into v_comment from talkconcert_private.answer_comments where id=p_id;
  if v_comment.visitor_hash<>encode(sha256(convert_to(p_token,'UTF8')),'hex')
     or v_comment.question_id<>v_question or v_comment.author_id<>v_author then
    raise insufficient_privilege using message='댓글 등록 정보를 다시 확인해 주세요.';
  end if;
  if v_comment.text<>btrim(p_text) or v_comment.author_name<>p_name then
    raise invalid_parameter_value using message='댓글 등록 정보를 다시 확인해 주세요.';
  end if;
  return jsonb_build_object('id',v_comment.id,'authorName',v_comment.author_name,'text',v_comment.text,'createdAt',v_comment.created_at,'cursor',v_comment.sequence::text);
end $$;
revoke all on function talkconcert_private.create_answer_comment(uuid,uuid,text,text,text) from public;
grant execute on function talkconcert_private.create_answer_comment(uuid,uuid,text,text,text) to anon,authenticated;
create function public.create_talkconcert_answer_comment(p_answer uuid,p_id uuid,p_text text,p_name text,p_token text) returns jsonb
language sql security invoker set search_path = '' as $$
  select talkconcert_private.create_answer_comment(p_answer,p_id,p_text,p_name,p_token);
$$;
revoke all on function public.create_talkconcert_answer_comment(uuid,uuid,text,text,text) from public;
grant execute on function public.create_talkconcert_answer_comment(uuid,uuid,text,text,text) to anon,authenticated;
