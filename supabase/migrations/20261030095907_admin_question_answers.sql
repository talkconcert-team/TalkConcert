-- 기존 질문·주제는 변경하지 않고 관리자 답변 저장 구조만 추가한다.
alter table talkconcert_private.admin_accounts add column display_name text;
-- 현재 두 계정만 이름을 연결한다. 이후 추가된 관리자를 이지우로 취급하지 않는다.
do $$ begin
  if (select count(*) from talkconcert_private.admin_accounts) <> 2
     or not exists (select 1 from talkconcert_private.admin_accounts where email = 'shinhuiseong07@gmail.com')
     or not exists (select 1 from talkconcert_private.admin_accounts where email = 'livei0307@gmail.com') then
    raise exception '관리자 두 계정의 이름 연결을 먼저 확인해 주세요.';
  end if;
  update talkconcert_private.admin_accounts
    set display_name = case email when 'shinhuiseong07@gmail.com' then '신희성' when 'livei0307@gmail.com' then '이지우' end
    where email in ('shinhuiseong07@gmail.com', 'livei0307@gmail.com');
end $$;

create table talkconcert_private.question_answers (
  question_id uuid not null references public.talkconcert_questions(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  author_name text not null,
  text text not null check (char_length(btrim(text)) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (question_id, author_id)
);
alter table talkconcert_private.question_answers enable row level security;
revoke all on talkconcert_private.question_answers from public, anon, authenticated;

-- 비공개 작성자 식별자는 공개 응답에 포함하지 않는다. 삭제한 질문의 답변도 숨긴다.
create function talkconcert_private.read_question_answers() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'questionId', a.question_id, 'authorName', a.author_name, 'text', a.text,
    'createdAt', a.created_at, 'updatedAt', a.updated_at,
    'mine', a.author_id = (select auth.uid())
  ) order by a.created_at, a.author_id), '[]'::jsonb)
  from talkconcert_private.question_answers a
  join public.talkconcert_questions q on q.id = a.question_id and q.deleted_at is null
  join public.talkconcert_topics t on t.id = q.topic_id and t.deleted_at is null;
$$;
revoke all on function talkconcert_private.read_question_answers() from public;
grant execute on function talkconcert_private.read_question_answers() to anon, authenticated;
create function public.get_talkconcert_answers() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select talkconcert_private.read_question_answers();
$$;
revoke all on function public.get_talkconcert_answers() from public;
grant execute on function public.get_talkconcert_answers() to anon, authenticated;

-- 작성자와 이름은 검증된 Google identity에서만 정한다. 같은 질문에 각 관리자 답변을 별도로 보관한다.
create function talkconcert_private.save_question_answer(p_question uuid, p_text text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_name text;
begin
  if auth.uid() is null or not talkconcert_private.is_admin() then
    raise insufficient_privilege using message = '관리자 로그인이 필요해요.';
  end if;
  select a.display_name into v_name from talkconcert_private.admin_accounts a
    join auth.identities i on lower(i.identity_data->>'email') = a.email
    where i.user_id = auth.uid() and i.provider = 'google';
  if v_name is null then raise insufficient_privilege using message = '관리자 표시 이름을 먼저 설정해 주세요.'; end if;
  if p_text is null or char_length(btrim(p_text)) not between 1 and 4000 then
    raise invalid_parameter_value using message = '답변은 1~4000자로 입력해 주세요.';
  end if;
  perform 1 from public.talkconcert_questions q join public.talkconcert_topics t on t.id=q.topic_id
    where q.id=p_question and q.deleted_at is null and t.deleted_at is null for share of q, t;
  if not found then raise no_data_found using message = '질문이 삭제되었어요. 목록을 다시 확인해 주세요.'; end if;
  insert into talkconcert_private.question_answers(question_id, author_id, author_name, text)
    values (p_question, auth.uid(), v_name, btrim(p_text))
    on conflict (question_id, author_id) do update
      set text=excluded.text, author_name=excluded.author_name, updated_at=now();
end $$;
revoke all on function talkconcert_private.save_question_answer(uuid, text) from public, anon;
grant execute on function talkconcert_private.save_question_answer(uuid, text) to authenticated;
create function public.save_talkconcert_answer(p_question uuid, p_text text) returns void
language sql security invoker set search_path = '' as $$
  select talkconcert_private.save_question_answer(p_question, p_text);
$$;
revoke all on function public.save_talkconcert_answer(uuid, text) from public, anon;
grant execute on function public.save_talkconcert_answer(uuid, text) to authenticated;
