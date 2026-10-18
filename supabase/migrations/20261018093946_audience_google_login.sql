-- 관객은 이메일 허용 목록 없이 검증된 Google 계정과 살아 있는 세션으로 참여한다.
create function talkconcert_private.is_audience() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.identities i
    join auth.users u on u.id = i.user_id
    join auth.sessions s on s.user_id = i.user_id and s.id::text = (select auth.jwt()->>'session_id')
    where i.user_id = (select auth.uid()) and i.provider = 'google'
      and u.email_confirmed_at is not null and not u.is_anonymous
      and coalesce((i.identity_data->>'email_verified')::boolean, false)
      and (s.not_after is null or s.not_after > now())
  );
$$;
revoke all on function talkconcert_private.is_audience() from public, anon;
grant execute on function talkconcert_private.is_audience() to authenticated;
create function public.is_talkconcert_audience() returns boolean
language sql stable security invoker set search_path = '' as $$
  select talkconcert_private.is_audience();
$$;
revoke all on function public.is_talkconcert_audience() from public, anon;
grant execute on function public.is_talkconcert_audience() to authenticated;

revoke select on public.talkconcert_questions, public.talkconcert_topics from anon;
drop policy "공개 주제 읽기" on public.talkconcert_topics;
drop policy "공개 질문 읽기" on public.talkconcert_questions;
drop policy "관객 질문 등록" on public.talkconcert_questions;
create policy "Google 관객 주제 읽기" on public.talkconcert_topics for select to authenticated
  using (deleted_at is null and (select talkconcert_private.is_audience()));
create policy "Google 관객 질문 읽기" on public.talkconcert_questions for select to authenticated
  using (deleted_at is null and (select talkconcert_private.is_audience()));
revoke execute on function public.get_talkconcert_board() from anon;

-- 기존 작성자 토큰 검증을 보존하며 인증 없이 내부 함수를 직접 실행하지 못하게 한다.
alter function talkconcert_private.submit_question(uuid,uuid,text,text,text) rename to submit_question_with_owner;
revoke all on function talkconcert_private.submit_question_with_owner(uuid,uuid,text,text,text) from public, anon, authenticated;
create function talkconcert_private.submit_question(p_id uuid, p_topic uuid, p_text text, p_color text, p_owner_token text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if not talkconcert_private.is_audience() then raise insufficient_privilege using message = 'Google 로그인이 필요해요.'; end if;
  return talkconcert_private.submit_question_with_owner(p_id,p_topic,p_text,p_color,p_owner_token);
end $$;
revoke all on function talkconcert_private.submit_question(uuid,uuid,text,text,text) from public, anon;
grant execute on function talkconcert_private.submit_question(uuid,uuid,text,text,text) to authenticated;
revoke execute on function public.submit_talkconcert_question(uuid,uuid,text,text,text) from anon;

alter function talkconcert_private.move_question(uuid,uuid,uuid,boolean,text) rename to move_question_with_owner;
revoke all on function talkconcert_private.move_question_with_owner(uuid,uuid,uuid,boolean,text) from public, anon, authenticated;
create function talkconcert_private.move_question(p_id uuid, p_topic uuid, p_target uuid, p_after boolean, p_owner_token text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if not talkconcert_private.is_audience() then raise insufficient_privilege using message = 'Google 로그인이 필요해요.'; end if;
  return talkconcert_private.move_question_with_owner(p_id,p_topic,p_target,p_after,p_owner_token);
end $$;
revoke all on function talkconcert_private.move_question(uuid,uuid,uuid,boolean,text) from public, anon;
grant execute on function talkconcert_private.move_question(uuid,uuid,uuid,boolean,text) to authenticated;
revoke execute on function public.move_talkconcert_question(uuid,uuid,uuid,boolean,text) from anon;
