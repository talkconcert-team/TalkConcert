-- 임시 계정과 세션으로 관객 인증을 검사하고 모든 테스트 데이터를 롤백한다.
begin;
do $$
declare
  v_user uuid := gen_random_uuid();
  v_session uuid := gen_random_uuid();
begin
  insert into auth.users(id,email,email_confirmed_at,is_anonymous,raw_user_meta_data)
    values(v_user,v_user::text || '@example.invalid',now(),false,'{"provider":"google"}');
  insert into auth.identities(provider_id,user_id,identity_data,provider)
    values(v_user::text,v_user,jsonb_build_object('sub',v_user,'email_verified',true),'google');
  insert into auth.sessions(id,user_id) values(v_session,v_user);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_user,'session_id',v_session,'role','authenticated')::text,true);
  assert not public.is_talkconcert_audience(), '학교 외 계정이 허용됨';
  assert not public.is_talkconcert_admin(), '관객에게 관리자 권한이 부여됨';
  update auth.users set email='12345@bssm.hs.kr' where id=v_user;
  assert public.is_talkconcert_audience(), '학교 Google 계정이 거부됨';
  update auth.users set email='teacher@BSSM.HS.KR' where id=v_user;
  assert public.is_talkconcert_audience(), '문자 ID 또는 대문자 학교 도메인이 거부됨';
  update auth.users set email='student@bssm.hs.kr.evil.test' where id=v_user;
  assert not public.is_talkconcert_audience(), '위장 도메인이 허용됨';
  update auth.users set email='student@sub.bssm.hs.kr' where id=v_user;
  assert not public.is_talkconcert_audience(), '학교 하위 도메인이 허용됨';
  update auth.users set email='student@bssm.hs.kr' where id=v_user;
  update auth.identities set identity_data=jsonb_build_object('sub',v_user,'email_verified',false) where user_id=v_user;
  assert not public.is_talkconcert_audience(), '미검증 이메일이 허용됨';
  update auth.identities set identity_data=jsonb_build_object('sub',v_user,'email_verified',true),provider='email' where user_id=v_user;
  assert not public.is_talkconcert_audience(), '사용자 메타데이터만으로 Google 인증을 위조함';
  update auth.identities set provider='google' where user_id=v_user;
  update auth.users set is_anonymous=true where id=v_user;
  assert not public.is_talkconcert_audience(), '익명 계정이 허용됨';
  update auth.users set is_anonymous=false where id=v_user;
  update auth.sessions set not_after=now()-interval '1 minute' where id=v_session;
  assert not public.is_talkconcert_audience(), '만료 세션이 허용됨';
  delete from auth.sessions where id=v_session;
  assert not public.is_talkconcert_audience(), '폐기된 세션이 허용됨';
  perform set_config('request.jwt.claims','{}',true);
  assert not public.is_talkconcert_audience(), '미인증 요청이 허용됨';
  assert not has_function_privilege('anon','talkconcert_private.is_audience()','execute');
  assert has_function_privilege('authenticated','talkconcert_private.is_audience()','execute');
end $$;
rollback;
