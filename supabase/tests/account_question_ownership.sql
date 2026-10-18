-- 임시 사용자·질문은 모두 롤백한다. 실제 계정이나 질문을 재할당하지 않는다.
begin;
do $$
declare
  v_a uuid:=gen_random_uuid(); v_b uuid:=gen_random_uuid();
  v_sa uuid:=gen_random_uuid(); v_sa2 uuid:=gen_random_uuid(); v_sb uuid:=gen_random_uuid();
  v_q uuid:=gen_random_uuid(); v_legacy uuid:=gen_random_uuid(); v_topic uuid; v_target uuid;
  v_ids jsonb;
  v_token text:=repeat('a',64);
begin
  insert into auth.users(id,email,email_confirmed_at,is_anonymous) values
    (v_a,v_a::text||'@example.invalid',now(),false),(v_b,v_b::text||'@example.invalid',now(),false);
  insert into auth.identities(provider_id,user_id,identity_data,provider) values
    (v_a::text,v_a,jsonb_build_object('sub',v_a,'email_verified',true),'google'),
    (v_b::text,v_b,jsonb_build_object('sub',v_b,'email_verified',true),'google');
  insert into auth.sessions(id,user_id) values(v_sa,v_a),(v_sa2,v_a),(v_sb,v_b);
  select id into v_topic from public.talkconcert_topics where deleted_at is null order by position limit 1;
  insert into public.talkconcert_topics(title) values('계정 권한 테스트') returning id into v_target;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_a,'session_id',v_sa,'role','authenticated')::text,true);
  assert public.submit_talkconcert_question(v_q,v_topic,'계정 질문','cream',null);
  assert (select user_id=v_a from talkconcert_private.question_owners where question_id=v_q);
  assert public.submit_talkconcert_question(v_q,v_topic,'재시도','cream',null);
  assert (select count(*)=1 from public.talkconcert_questions where id=v_q);
  -- 같은 계정의 다른 세션에서는 토큰 없이 조회·이동한다.
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_a,'session_id',v_sa2,'role','authenticated')::text,true);
  v_ids:=public.sync_talkconcert_question_ownership('[]');
  assert v_ids ? v_q::text;
  assert public.move_talkconcert_question(v_q,v_target,null,true,null);
  assert (select topic_id=v_target from public.talkconcert_questions where id=v_q);
  -- 이전 질문은 올바른 토큰으로 한 번만 계정에 연결한다.
  perform talkconcert_private.submit_question_with_owner(v_legacy,v_topic,'이전 질문','mint',v_token);
  perform public.sync_talkconcert_question_ownership(jsonb_build_array(jsonb_build_object('id',v_legacy,'token',repeat('b',64))));
  assert (select user_id is null from talkconcert_private.question_owners where question_id=v_legacy);
  perform public.sync_talkconcert_question_ownership(jsonb_build_array(jsonb_build_object('id',v_legacy,'token',v_token)));
  assert (select user_id=v_a from talkconcert_private.question_owners where question_id=v_legacy);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_b,'session_id',v_sb,'role','authenticated')::text,true);
  v_ids:=public.sync_talkconcert_question_ownership(jsonb_build_array(jsonb_build_object('id',v_legacy,'token',v_token)));
  assert not (v_ids ? v_q::text) and not (v_ids ? v_legacy::text);
  begin
    perform public.move_talkconcert_question(v_legacy,v_target,null,true,v_token);
    raise exception '다른 계정의 이동을 허용함';
  exception when insufficient_privilege then null; end;
  begin
    perform public.submit_talkconcert_question(v_q,v_topic,'소유권 탈취','cream',null);
    raise exception '다른 계정의 재등록을 허용함';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claims','{}',true);
  begin
    perform public.sync_talkconcert_question_ownership('[]');
    raise exception '비로그인 소유권 조회 허용';
  exception when insufficient_privilege then null; end;
  assert not has_table_privilege('authenticated','talkconcert_private.question_owners','SELECT');
end $$;
rollback;
select '계정 간 차단·다른 기기 이동·레거시 연결·재시도·익명 차단 검증 통과' as result;
