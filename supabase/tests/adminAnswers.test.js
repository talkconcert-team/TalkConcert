import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../../', import.meta.url))
// 네트워크 연결 없이 실행되는 임시 메모리 Postgres.
test('운영 연결 없이 답변 저장·권한·관리자 이름과 기존 질문 보존을 검증한다', async (t) => {
  const db = new PGlite()
  t.after(() => db.close())
  await db.exec(`
  create role anon; create role authenticated;
  create schema auth; create schema talkconcert_private;
  grant usage on schema public, auth, talkconcert_private to anon, authenticated;
  create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz, is_anonymous boolean default false);
  create table auth.identities(user_id uuid, provider text, identity_data jsonb);
  create table auth.sessions(id uuid, user_id uuid, not_after timestamptz);
  create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
  create table talkconcert_private.admin_accounts(email text primary key);
  insert into talkconcert_private.admin_accounts values ('shinhuiseong07@gmail.com'), ('livei0307@gmail.com');
  create table public.talkconcert_topics(id uuid primary key, deleted_at timestamptz, title text default '기존 주제');
  create table public.talkconcert_questions(id uuid primary key, topic_id uuid references public.talkconcert_topics, deleted_at timestamptz, text text default '기존 학생 질문', color text default 'mint');
  insert into public.talkconcert_topics(id,deleted_at) values ('00000000-0000-4000-8000-000000000001', null);
  insert into public.talkconcert_questions(id,topic_id,deleted_at) values ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', null);
  `)
  await db.exec(await readFile(root+'supabase/migrations/20261018090531_admin_session_revocation.sql','utf8'))
  const originalQuestions = (await db.query('select * from public.talkconcert_questions order by id')).rows
  const originalTopics = (await db.query('select * from public.talkconcert_topics order by id')).rows
  await db.exec(await readFile(root+'supabase/migrations/20261030095907_admin_question_answers.sql','utf8'))
  assert.deepEqual((await db.query('select * from public.talkconcert_questions order by id')).rows, originalQuestions)
  assert.deepEqual((await db.query('select * from public.talkconcert_topics order by id')).rows, originalTopics)
  const q='00000000-0000-4000-8000-000000000002'
  const ids=['10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003']
  const emails=['shinhuiseong07@gmail.com','livei0307@gmail.com','audience@example.invalid']
  for(let i=0;i<3;i++) {
   await db.query('insert into auth.users values ($1,$2,now(),false)',[ids[i],emails[i]])
   await db.query("insert into auth.identities values ($1,'google',$2)",[ids[i],JSON.stringify({email:emails[i],email_verified:true})])
   await db.query('insert into auth.sessions values ($1,$1,null)',[ids[i]])
  }
  async function login(i,role='authenticated') {
   await db.exec('reset role')
   await db.query("select set_config('request.jwt.claims',$1,false)",[i===null?'{}':JSON.stringify({sub:ids[i],session_id:ids[i]})])
   await db.exec('set role '+role)
  }
  async function answers(){return (await db.query('select public.get_talkconcert_answers() as data')).rows[0].data}
  await login(0)
  await db.query('select public.save_talkconcert_answer($1,$2)',[q,'첫 답변'])
  await login(1)
  await db.query('select public.save_talkconcert_answer($1,$2)',[q,'두 번째 답변'])
  assert.deepEqual((await answers()).map(a=>a.authorName).sort(),['신희성','이지우'])
  assert.equal((await answers()).filter(a=>a.mine).length,1)
  await login(0)
  await db.query('select public.save_talkconcert_answer($1,$2)',[q,'수정한 답변'])
  assert.equal((await answers()).length,2)
  assert.equal((await answers()).find(a=>a.authorName==='이지우').text,'두 번째 답변')
  await assert.rejects(db.query('select public.save_talkconcert_answer($1,$2)',[q,'  ']),e=>e.code==='22023')
  await assert.rejects(db.query('select public.save_talkconcert_answer($1,$2)',[q,'x'.repeat(4001)]),e=>e.code==='22023')
  await login(2)
  await assert.rejects(db.query('select public.save_talkconcert_answer($1,$2)',[q,'위조']),e=>e.code==='42501')
  await login(null,'anon')
  assert.equal((await answers()).length,2)
  assert.ok((await answers()).every(a=>!a.authorId && !a.email && !a.mine))
  await assert.rejects(db.query('select public.save_talkconcert_answer($1,$2)',[q,'익명']),e=>e.code==='42501')
  await assert.rejects(db.query('select * from talkconcert_private.question_answers'),e=>e.code==='42501')
  await db.exec('reset role')
  // 운영 답변을 모사한 기존 행을 만든 뒤 좋아요 마이그레이션의 비파괴성을 검사한다.
  const savedAnswers = (await db.query('select * from talkconcert_private.question_answers order by author_id')).rows
  const savedQuestions = (await db.query('select * from public.talkconcert_questions order by id')).rows
  const savedTopics = (await db.query('select * from public.talkconcert_topics order by id')).rows
  await db.exec(await readFile(root+'supabase/migrations/20261102022024_anonymous_answer_likes.sql','utf8'))
  assert.deepEqual((await db.query('select * from talkconcert_private.question_answers order by author_id')).rows, savedAnswers)
  assert.deepEqual((await db.query('select * from public.talkconcert_questions order by id')).rows, savedQuestions)
  assert.deepEqual((await db.query('select * from public.talkconcert_topics order by id')).rows, savedTopics)
  await login(null, 'anon')
  const visibleAnswers = await answers()
  const firstId = visibleAnswers.find(a => a.authorName === '신희성').answerId
  const secondId = visibleAnswers.find(a => a.authorName === '이지우').answerId
  const token = 'a'.repeat(64)
  const vote = async (id, visitor = token) => (await db.query('select public.like_talkconcert_answer($1,$2) as data', [id,visitor])).rows[0].data
  const statuses = async () => (await db.query('select public.get_talkconcert_answer_likes($1,$2) as data', [[firstId,secondId],token])).rows[0].data
  assert.ok((await statuses()).every(a => a.likes === 0 && a.liked === false))
  assert.deepEqual(await vote(firstId), { answerId: firstId, likes: 1, liked: true })
  await Promise.all([vote(firstId),vote(firstId)])
  assert.equal((await vote(firstId)).likes, 1, '중복 요청은 1개로 유지')
  assert.equal((await vote(secondId)).likes, 1, '관리자별 답변에 독립적으로 투표')
  assert.equal((await vote(firstId, 'b'.repeat(64))).likes, 2, '다른 브라우저는 별도 집계')
  assert.ok((await statuses()).every(a => a.liked))
  await assert.rejects(vote(firstId, ''), e => e.code === '22023')
  await assert.rejects(vote('00000000-0000-4000-8000-000000000099'), e => e.code === 'P0002')
  await assert.rejects(db.exec('delete from talkconcert_private.answer_likes'), e => e.code === '42501')
  await assert.rejects(db.exec('update talkconcert_private.answer_likes set visitor_hash=visitor_hash'), e => e.code === '42501')
  await assert.rejects(db.exec('select * from talkconcert_private.answer_likes'), e => e.code === '42501')
  await login(0)
  await db.query('select public.save_talkconcert_answer($1,$2)', [q, '답변 수정 후에도 좋아요 유지'])
  assert.equal((await answers()).find(a => a.answerId === firstId).likes, 2)
  await db.exec('reset role')
  const hashes = (await db.query('select visitor_hash from talkconcert_private.answer_likes')).rows
  assert.ok(hashes.every(row => row.visitor_hash !== token && row.visitor_hash.length === 64))
  const beforeComments = {}
  for (const table of ['public.talkconcert_questions','public.talkconcert_topics','talkconcert_private.question_answers','talkconcert_private.answer_likes']) beforeComments[table] = (await db.query(`select * from ${table}`)).rows
  await db.exec(await readFile(root+'supabase/migrations/20261102030443_anonymous_answer_comments.sql','utf8'))
  for (const [table, rows] of Object.entries(beforeComments)) assert.deepEqual((await db.query(`select * from ${table}`)).rows, rows)
  await login(null, 'anon')
  const commentId = '20000000-0000-4000-8000-000000000001'
  const createComment = async (answer = firstId, id = commentId, text = '자세한 답변 감사합니다.', visitor = token) => (await db.query('select public.create_talkconcert_answer_comment($1,$2,$3,$4,$5) as data', [answer,id,text,'찬란한 부소마인',visitor])).rows[0].data
  const listComments = async (answer = firstId, before = null) => (await db.query('select public.get_talkconcert_answer_comments($1,$2) as data', [answer,before])).rows[0].data
  assert.deepEqual(await listComments(), {comments:[],hasMore:false})
  const firstComment = await createComment()
  assert.equal(firstComment.authorName, '찬란한 부소마인')
  assert.equal(firstComment.visitor_hash, undefined)
  assert.equal(firstComment.likes, undefined)
  assert.deepEqual(await createComment(), firstComment, '재시도는 같은 댓글을 반환')
  assert.equal((await listComments()).comments.length, 1)
  assert.equal((await listComments(secondId)).comments.length, 0, '답변별 댓글 분리')
  await assert.rejects(createComment(q), e => e.code === 'P0002')
  await assert.rejects(createComment(firstId, commentId, '변경된 내용'), e => e.code === '22023')
  await assert.rejects(createComment(firstId, commentId, '자세한 답변 감사합니다.', 'b'.repeat(64)), e => e.code === '42501')
  await assert.rejects(createComment(firstId, commentId, ' '), e => e.code === '22023')
  await assert.rejects(createComment(firstId, commentId, 'x'.repeat(1001)), e => e.code === '22023')
  await assert.rejects(vote(commentId), e => e.code === 'P0002', '댓글에는 좋아요를 달 수 없음')
  await assert.rejects(db.exec('delete from talkconcert_private.answer_comments'), e => e.code === '42501')
  await assert.rejects(db.exec('update talkconcert_private.answer_comments set text=text'), e => e.code === '42501')
  await assert.rejects(db.exec('select * from talkconcert_private.answer_comments'), e => e.code === '42501')
  for (let i=2;i<=23;i++) await createComment(firstId,`20000000-0000-4000-8000-${String(i).padStart(12,'0')}`,`댓글 ${i}`)
  const recent = await listComments()
  assert.equal(recent.comments.length, 20)
  assert.equal(recent.hasMore, true)
  const earlier = await listComments(firstId,recent.comments[0].cursor)
  assert.equal(earlier.comments.length, 3)
  assert.equal(earlier.hasMore, false)
  assert.equal(new Set([...earlier.comments,...recent.comments].map(c=>c.id)).size,23)
  await login(0)
  await db.query('select public.save_talkconcert_answer($1,$2)',[q,'댓글 작성 후 관리자 답변 수정'])
  assert.equal((await listComments()).comments.length,20, '답변 수정 시 댓글 유지')
  assert.equal((await answers()).find(a=>a.answerId===firstId).likes,2, '댓글 등록 시 좋아요 유지')
  await db.exec('reset role')
  await db.query('update public.talkconcert_questions set deleted_at=now() where id=$1',[q])
  await login(0)
  assert.equal((await answers()).length,0)
  assert.deepEqual(await statuses(), [])
  await assert.rejects(listComments(), e => e.code === 'P0002')
  await assert.rejects(createComment(), e => e.code === 'P0002')
  await assert.rejects(vote(firstId), e => e.code === 'P0002')
  await assert.rejects(db.query('select public.save_talkconcert_answer($1,$2)',[q,'삭제된 질문']),e=>e.code==='P0002')
  await db.exec('reset role')
  await db.query('update public.talkconcert_questions set deleted_at=null where id=$1',[q])
  await db.query("update auth.sessions set not_after=now()-interval '1 minute' where id=$1",[ids[0]])
  await login(0)
  await assert.rejects(db.query('select public.save_talkconcert_answer($1,$2)',[q,'만료 세션']),e=>e.code==='42501')
})
