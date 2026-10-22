-- API payload에도 author_name을 전달하되, DB에서는 로그인한 Google 계정으로 다시 검증한다.
create or replace function talkconcert_private.submit_question_with_owner(
  p_id uuid, p_topic uuid, p_text text, p_color text, p_owner_token text, p_author_name text
) returns boolean
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
  if v_email is null or position('@' in v_email) < 2 or v_name = '' then raise insufficient_privilege using message = 'Google 계정 정보를 확인할 수 없어요.'; end if;
  v_author := split_part(v_email, '@', 1) || '-' || left(v_name, 70);
  if p_author_name is distinct from v_author then raise insufficient_privilege using message = '작성자 정보를 확인할 수 없어요.'; end if;
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

create or replace function public.submit_talkconcert_question(
  p_id uuid, p_topic uuid, p_text text, p_color text, p_owner_token text, p_author_name text
) returns boolean
language sql security invoker set search_path = '' as $$
  select talkconcert_private.submit_question_with_owner(p_id, p_topic, p_text, p_color, p_owner_token, p_author_name);
$$;
revoke all on function public.submit_talkconcert_question(uuid,uuid,text,text,text,text) from public;
grant execute on function public.submit_talkconcert_question(uuid,uuid,text,text,text,text) to authenticated;
