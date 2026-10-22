-- 질문 소속과 고유 번호를 유지하면서 기존 기본 주제명만 바꾼다.
update public.talkconcert_topics set title=case title
  when '자유롭게 질문해요' then '신희성 선배에게 질문하기'
  when '오늘의 발표' then '이지우 선배에게 질문하기'
  when '경험이 궁금해요' then '둘 다에게 질문하기'
end where deleted_at is null and title in ('자유롭게 질문해요','오늘의 발표','경험이 궁금해요');

-- 당첨 당시 주제명을 함께 보관한다. 이후 이동·주제 변경에도 결과 제목을 유지한다.
create or replace function talkconcert_private.question_draw(p_request_id uuid, p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_request talkconcert_private.draw_requests%rowtype;
  v_question public.talkconcert_questions%rowtype;
  v_draw jsonb;
begin
  if not talkconcert_private.is_admin() or p_token is null or not exists (
    select 1 from talkconcert_private.settings_access a where a.id = 'main'
    and a.token_hash = pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_token, 'UTF8')), 'hex')
  ) then raise insufficient_privilege using message = '관리자 권한이 없어요.'; end if;

  if p_request_id is not null then
    -- CMS 수정과 같은 잠금을 사용해 삭제·복원 및 동시 추첨을 순서대로 확정한다.
    perform pg_catalog.pg_advisory_xact_lock(74261903);
    select * into v_request from talkconcert_private.draw_requests where request_id = p_request_id;
    if found then
      if v_request.requested_by <> auth.uid() then raise insufficient_privilege; end if;
    else
      perform 1 from public.talkconcert_settings where id = 'main' and draw for share;
      if not found then raise sqlstate 'PT409' using message = '관리자 설정에서 랜덤 추첨을 허용해 주세요.'; end if;
      select q.* into v_question from public.talkconcert_questions q
      join public.talkconcert_topics t on t.id = q.topic_id and t.deleted_at is null
      where q.deleted_at is null and not exists (
        select 1 from talkconcert_private.draw_requests d where d.question_id = q.id
      ) order by pg_catalog.random() limit 1 for update of q;
      -- 빈 후보도 요청 결과로 기록해 통신 재시도 때 새 질문을 뜻하지 않게 소비하지 않는다.
      insert into talkconcert_private.draw_requests(request_id, question_id, question, requested_by)
      values (p_request_id, v_question.id, case when v_question.id is not null then
        jsonb_build_object('id',v_question.id,'columnId',v_question.topic_id,'number',v_question.number,'text',v_question.text,'color',v_question.color,'topicTitle',(select title from public.talkconcert_topics where id=v_question.topic_id))
        else null end, auth.uid()) returning * into v_request;
    end if;
    if v_request.question_id is not null then
      v_draw := jsonb_build_object('requestId',v_request.request_id,'question',v_request.question,'drawnAt',v_request.created_at);
    end if;
  end if;

  return jsonb_build_object(
    'draw', v_draw,
    'remainingIds', coalesce((select jsonb_agg(q.id order by q.number) from public.talkconcert_questions q
      join public.talkconcert_topics t on t.id = q.topic_id and t.deleted_at is null
      where q.deleted_at is null and not exists (select 1 from talkconcert_private.draw_requests d where d.question_id = q.id)), '[]'::jsonb),
    'latest', (select jsonb_build_object('requestId',d.request_id,'question',d.question,'drawnAt',d.created_at)
      from talkconcert_private.draw_requests d where d.question_id is not null order by d.created_at desc limit 1)
  );
end $$;
