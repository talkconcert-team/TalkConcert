-- 익명 등록·이동·권한 검증은 임시 데이터로 실행하고 모두 롤백한다.
begin;
do $$
declare v_id uuid:=gen_random_uuid(); v_topic uuid; v_before jsonb; v_number bigint;
begin
  select id into v_topic from public.talkconcert_topics where deleted_at is null order by position limit 1;
  execute 'set local role anon';
  assert public.submit_talkconcert_question(v_id,v_topic,'비로그인 테스트','mint',repeat('a',64),'찬란한 부소마인');
  assert public.submit_talkconcert_question(v_id,v_topic,'재시도','rose',repeat('a',64),'빛나는 부소마인');
  v_before := public.get_talkconcert_board();
  assert exists(select 1 from jsonb_array_elements(v_before->'questions') q where q->>'id'=v_id::text and q->>'authorName'='찬란한 부소마인' and q->>'text'='비로그인 테스트');
  select number into v_number from public.talkconcert_questions where id=v_id;
  assert public.move_talkconcert_question(v_id,v_topic,null,true,repeat('a',64));
  assert (select number=v_number from public.talkconcert_questions where id=v_id);
  begin
    perform public.move_talkconcert_question(v_id,v_topic,null,true,repeat('b',64));
    raise exception '타인 이동 허용';
  exception when insufficient_privilege then null; end;
  begin
    perform public.submit_talkconcert_question(v_id,v_topic,'탈취','mint',repeat('b',64),'찬란한 부소마인');
    raise exception '타인 재등록 허용';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.talkconcert_questions where id=v_id;
    raise exception '작성자 삭제 허용';
  exception when insufficient_privilege then null; end;
  begin
    update public.talkconcert_questions set deleted_at=now() where id=v_id;
    raise exception '작성자 소프트 삭제 허용';
  exception when insufficient_privilege then null; end;
  begin
    perform public.manage_talkconcert_board('question.delete',jsonb_build_object('id',v_id),null);
    raise exception '관리자 RPC 우회 허용';
  exception when insufficient_privilege then null; end;
  execute 'reset role';
  assert not has_table_privilege('authenticated','public.talkconcert_questions','DELETE');
  assert not has_table_privilege('authenticated','public.talkconcert_questions','UPDATE');
  assert not has_table_privilege('anon','talkconcert_private.question_owners','SELECT');
end $$;
rollback;
select '익명 등록·이름 유지·재시도·본인 이동·삭제 차단 검증 통과' as result;
