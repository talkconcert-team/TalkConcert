-- 공개 질문에는 별명만 저장한다. 작성자 토큰은 비공개 테이블의 해시로만 검증한다.
alter table public.talkconcert_questions add column if not exists author_name text;
alter table public.talkconcert_questions alter column author_name set default
  ((array['찬란한','빛나는','용감한','다정한','유쾌한','씩씩한','따뜻한','멋진','설레는','꿈꾸는','반짝이는','활기찬'])[1 + floor(random()*12)::int] || ' 부소마인');
update public.talkconcert_questions set author_name=default where author_name is null or author_name !~ '^[가-힣]{1,16} 부소마인$';
alter table public.talkconcert_questions alter column author_name set not null;
alter table public.talkconcert_questions add constraint anonymous_author_name_format check (author_name ~ '^[가-힣]{1,16} 부소마인$');

create function talkconcert_private.submit_anonymous_question(p_id uuid,p_topic uuid,p_text text,p_color text,p_owner_token text,p_author_name text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_hash text;
begin
  if p_author_name is null or p_author_name !~ '^[가-힣]{1,16} 부소마인$' then
    raise invalid_parameter_value using message='작성자 이름을 확인해 주세요.';
  end if;
  if p_owner_token is null or p_owner_token !~ '^[0-9a-f]{64}$' then
    raise invalid_parameter_value using message='작성자 확인 정보가 필요해요.';
  end if;
  v_hash := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_owner_token,'UTF8')),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text,0));
  -- 재시도는 같은 작성자만 허용하고 내용·별명·삭제 상태·추첨 이력을 보존한다.
  if exists(select 1 from public.talkconcert_questions where id=p_id) then
    if not exists(select 1 from talkconcert_private.question_owners where question_id=p_id and token_hash=v_hash) then
      raise insufficient_privilege using message='이 메모의 작성자를 확인할 수 없어요.';
    end if;
    return true;
  end if;
  insert into public.talkconcert_questions(id,topic_id,text,color,author_name)
    values(p_id,p_topic,btrim(p_text),p_color,p_author_name);
  insert into talkconcert_private.question_owners(question_id,token_hash) values(p_id,v_hash);
  return true;
end $$;
revoke all on function talkconcert_private.submit_anonymous_question(uuid,uuid,text,text,text,text) from public;
grant execute on function talkconcert_private.submit_anonymous_question(uuid,uuid,text,text,text,text) to anon,authenticated;

create or replace function public.submit_talkconcert_question(p_id uuid,p_topic uuid,p_text text,p_color text,p_owner_token text,p_author_name text) returns boolean
language sql security invoker set search_path = '' as $$
  select talkconcert_private.submit_anonymous_question(p_id,p_topic,p_text,p_color,p_owner_token,p_author_name);
$$;
revoke all on function public.submit_talkconcert_question(uuid,uuid,text,text,text,text) from public;
grant execute on function public.submit_talkconcert_question(uuid,uuid,text,text,text,text) to anon,authenticated;

create or replace function talkconcert_private.move_question(p_id uuid,p_topic uuid,p_target uuid,p_after boolean,p_owner_token text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_owner uuid;
begin
  select user_id into v_owner from talkconcert_private.question_owners where question_id=p_id;
  if v_owner is not null then
    -- 기존 Google 계정에 연결한 질문의 소유권은 그대로 보호한다.
    if not talkconcert_private.is_audience() or v_owner <> auth.uid() then raise insufficient_privilege; end if;
    return talkconcert_private.relocate_question(p_id,p_topic,p_target,p_after);
  end if;
  if p_owner_token is null or not exists (
    select 1 from talkconcert_private.question_owners where question_id=p_id
      and token_hash=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_owner_token,'UTF8')),'hex')
  ) then raise insufficient_privilege using message='본인이 작성한 메모만 이동할 수 있어요.'; end if;
  return talkconcert_private.relocate_question(p_id,p_topic,p_target,p_after);
end $$;
grant usage on schema talkconcert_private to anon;
grant execute on function talkconcert_private.move_question(uuid,uuid,uuid,boolean,text) to anon;
grant execute on function public.move_talkconcert_question(uuid,uuid,uuid,boolean,text) to anon;

create or replace function public.get_talkconcert_board() returns jsonb
language sql security invoker set search_path = '' as $$
  select jsonb_build_object(
    'columns', coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'title',t.title) order by t.position) from public.talkconcert_topics t where t.deleted_at is null),'[]'::jsonb),
    'questions', coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'columnId',q.topic_id,'number',q.number,'text',q.text,'color',q.color,'authorName',q.author_name,'deletedAt',q.deleted_at) order by q.sort_order,q.number desc) from public.talkconcert_questions q where q.deleted_at is null),'[]'::jsonb)
  );
$$;

-- 삭제·수정・복구는 기존 관리자 RPC만 통과한다. 작성자 토큰으로도 테이블 변경을 허용하지 않는다.
revoke insert,update,delete on public.talkconcert_questions from anon,authenticated;
