-- 운영 데이터에 변경을 남기지 않는 통합 검증. 기존 Google 관리자 세션이 필요하다.
begin;
select set_config('request.jwt.claims', jsonb_build_object('sub',s.user_id,'session_id',s.id,'role','authenticated')::text,true)
from auth.sessions s join auth.users u on u.id=s.user_id
join talkconcert_private.admin_accounts a on a.email=lower(u.email)
order by s.created_at desc limit 1;
update talkconcert_private.settings_access set token_hash=encode(sha256(convert_to('draw-transaction-test','UTF8')),'hex') where id='main';
update public.talkconcert_settings set draw=true where id='main';

do $$
declare
  v_topic uuid;
  v_id uuid;
  v_request uuid := gen_random_uuid();
  v_empty uuid := gen_random_uuid();
  v_first jsonb;
  v_result jsonb;
  v_seen uuid[] := '{}';
  v_claims text := current_setting('request.jwt.claims');
begin
  assert talkconcert_private.is_admin(), '유효한 Google 관리자 세션이 필요합니다.';
  assert not has_function_privilege('anon','public.draw_talkconcert_question(uuid,text)','EXECUTE');
  assert not has_table_privilege('authenticated','talkconcert_private.draw_requests','INSERT');
  select id into v_topic from public.talkconcert_topics where deleted_at is null order by position limit 1;
  -- 기존 질문을 이 트랜잭션 안에서만 후보에서 제외한다. 실제 이력은 롤백으로 보존한다.
  insert into talkconcert_private.draw_requests(request_id,question_id,question,requested_by)
  select gen_random_uuid(),q.id,jsonb_build_object('id',q.id),auth.uid()
  from public.talkconcert_questions q where not exists (
    select 1 from talkconcert_private.draw_requests d where d.question_id=q.id);
  for i in 1..3 loop
    insert into public.talkconcert_questions(topic_id,text) values(v_topic,'추첨 트랜잭션 테스트 '||i);
  end loop;
  v_first := public.draw_talkconcert_question(v_request,'draw-transaction-test');
  assert v_first#>>'{draw,question,topicTitle}'=(select title from public.talkconcert_topics where id=v_topic), '당첨 주제명을 함께 저장해야 함';
  assert jsonb_array_length(v_first->'remainingIds')=2;
  v_id := (v_first#>>'{draw,question,id}')::uuid;
  begin
    insert into talkconcert_private.draw_requests(request_id,question_id,question,requested_by)
    values(gen_random_uuid(),v_id,v_first#>'{draw,question}',auth.uid());
    raise exception '동일 질문 중복 기록을 허용함';
  exception when unique_violation then null; end;
  v_seen := array_append(v_seen,v_id);
  update public.talkconcert_questions set text='수정해도 다시 뽑히지 않음',deleted_at=now() where id=v_id;
  update public.talkconcert_questions set deleted_at=null where id=v_id;
  update public.talkconcert_topics set title='추첨 이후 변경한 제목' where id=v_topic;
  v_result := public.draw_talkconcert_question(v_request,'draw-transaction-test');
  assert v_result->'draw'=v_first->'draw', '재시도는 수정 전 당첨 스냅샷을 재사용해야 함';
  for i in 1..2 loop
    v_result := public.draw_talkconcert_question(gen_random_uuid(),'draw-transaction-test');
    v_id := (v_result#>>'{draw,question,id}')::uuid;
    assert v_id is not null and not (v_id=any(v_seen)), '같은 질문 재당첨';
    v_seen := array_append(v_seen,v_id);
  end loop;
  assert jsonb_array_length(v_result->'remainingIds')=0;
  v_result := public.draw_talkconcert_question(v_empty,'draw-transaction-test');
  assert v_result->'draw'='null'::jsonb, '소진 후 재추첨 금지';
  insert into public.talkconcert_questions(topic_id,text) values(v_topic,'나중에 등록한 질문') returning id into v_id;
  v_result := public.draw_talkconcert_question(v_empty,'draw-transaction-test');
  assert v_result->'draw'='null'::jsonb, '빈 추첨 재시도로 새 질문 소비 금지';
  v_result := public.draw_talkconcert_question(gen_random_uuid(),'draw-transaction-test');
  assert v_result#>>'{draw,question,id}'=v_id::text, '새 질문만 추첨';
  assert jsonb_array_length(public.get_talkconcert_draw_state('draw-transaction-test')->'remainingIds')=0;
  update public.talkconcert_settings set draw=false where id='main';
  begin
    perform public.draw_talkconcert_question(gen_random_uuid(),'draw-transaction-test');
    raise exception '제한된 추첨을 허용함';
  exception when sqlstate 'PT409' then null; end;
  assert public.draw_talkconcert_question(v_request,'draw-transaction-test')->'draw'=v_first->'draw';
  begin
    perform public.get_talkconcert_draw_state('wrong-token');
    raise exception '잘못된 토큰을 허용함';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claims','{}',true);
  begin
    perform public.draw_talkconcert_question(gen_random_uuid(),'draw-transaction-test');
    raise exception '비로그인 추첨을 허용함';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claims',v_claims,true);
end $$;
rollback;
select '중복·멱등성·소진·새 질문·삭제/복원·권한·설정 검증 통과, 변경 롤백' as result;
