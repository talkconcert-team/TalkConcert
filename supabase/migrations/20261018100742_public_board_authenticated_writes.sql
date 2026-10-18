-- 활성 보드만 공개한다. 작성·이동의 Google 인증과 관리자 권한은 유지한다.
grant select on public.talkconcert_topics, public.talkconcert_questions to anon;
grant execute on function public.get_talkconcert_board() to anon;
drop policy "Google 관객 주제 읽기" on public.talkconcert_topics;
drop policy "Google 관객 질문 읽기" on public.talkconcert_questions;
create policy "활성 주제 공개 읽기" on public.talkconcert_topics for select to anon, authenticated
  using (deleted_at is null);
create policy "활성 질문 공개 읽기" on public.talkconcert_questions for select to anon, authenticated
  using (deleted_at is null);
