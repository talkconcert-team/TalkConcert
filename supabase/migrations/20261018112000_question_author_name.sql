-- Google 계정에서 확정한 작성자 표시명을 질문과 함께 보관한다.

-- 관객은 학교 Google 계정만 사용할 수 있게 하고, 학번은 이메일 앞 숫자에서 만든다.
create or replace function talkconcert_private.is_audience() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.identities i
    join auth.users u on u.id = i.user_id
    join auth.sessions s on s.user_id = i.user_id and s.id::text = (select auth.jwt()->>'session_id')
    where i.user_id = (select auth.uid()) and i.provider = 'google'
      and lower(u.email) ~ '^[0-9]+@bssm\.hs\.kr$'
      and u.email_confirmed_at is not null and not u.is_anonymous
      and coalesce((i.identity_data->>'email_verified')::boolean, false)
      and (s.not_after is null or s.not_after > now())
  );
$$;

-- 재시도 시 작성자 정보가 바뀌지 않도록 최초 등록 때만 Google 프로필을 저장한다.
create or replace function talkconcert_private.submit_question_with_owner(p_id uuid, p_topic uuid, p_text text, p_color text, p_owner_token text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_hash text;
  v_email text;
  v_name text;
  v_author text;
begin
  if p_owner_token is null or p_owner_token !~ '^[0-9a-f]{64}$' then raise invalid_parameter_value using message = '작성자 확인 정보가 필요해요.'; end if;
  v_hash := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_owner_token, 'UTF8')), 'hex');
  select lower(email), btrim(coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', ''))
    into v_email, v_name from auth.users where id = (select auth.uid());
  if v_email !~ '^[0-9]+@bssm\.hs\.kr$' or v_name = '' then raise insufficient_privilege using message = '학교 Google 계정 정보를 확인할 수 없어요.'; end if;
  v_author := (regexp_match(v_email, '^([0-9]+)@bssm\.hs\.kr$'))[1] || '-' || left(v_name, 70);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text, 0));
  if exists (select 1 from public.talkconcert_questions where id = p_id) then
    if not exists (select 1 from talkconcert_private.question_owners where question_id = p_id and token_hash = v_hash) then
      raise insufficient_privilege using message = '이 메모의 작성자를 확인할 수 없어요.';
    end if;
    return true;
  end if;
  insert into public.talkconcert_questions(id, topic_id, text, color, author_name)
    values (p_id, p_topic, btrim(p_text), p_color, v_author);
  insert into talkconcert_private.question_owners(question_id, token_hash) values (p_id, v_hash);
  return true;
end $$;

create or replace function public.get_talkconcert_board() returns jsonb
language sql security invoker set search_path = '' as $$
  select jsonb_build_object(
    'columns', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title) order by t.position) from public.talkconcert_topics t where t.deleted_at is null), '[]'::jsonb),
    'questions', coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'columnId', q.topic_id, 'number', q.number, 'text', q.text, 'color', q.color, 'authorName', q.author_name, 'deletedAt', q.deleted_at) order by q.sort_order, q.number desc) from public.talkconcert_questions q where q.deleted_at is null), '[]'::jsonb)
  );
$$;
