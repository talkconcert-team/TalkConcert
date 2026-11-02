import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import { createAnswerLikesMiddleware } from './answerLikesApi.js'
const id = '00000000-0000-4000-8000-000000000001'
const token = 'a'.repeat(64)
async function fixture(t, result = { data: { answerId: id, likes: 1, liked: true } }) {
  const calls = []
  const middleware = createAnswerLikesMiddleware({ SUPABASE_URL: 'https://test.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'public' }, () => ({ rpc: async (name, args) => { calls.push({ name, args }); return result } }))
  const server = createServer((req, res) => middleware(req, res, () => { res.writeHead(404); res.end() }))
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise(resolve => server.close(resolve)))
  const origin = `http://127.0.0.1:${server.address().port}`
  return { calls, post: (body, overrides = {}) => fetch(origin + '/api/answer-likes', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...overrides }, body: JSON.stringify(body) }) }
}
test('로그인 없이 답변 좋아요를 저장하고 취소 동작은 거부한다', async t => {
  const f = await fixture(t)
  assert.equal((await f.post({ action: 'like', answerId: id, visitorToken: token })).status, 200)
  assert.deepEqual(f.calls[0], { name: 'like_talkconcert_answer', args: { p_id: id, p_token: token } })
  for (const action of ['unlike','delete','toggle']) assert.equal((await f.post({ action, answerId: id, visitorToken: token })).status, 400)
  assert.equal(f.calls.length, 1)
})
test('브라우저의 기존 좋아요 상태 조회는 저장 RPC를 호출하지 않는다', async t => {
  const f = await fixture(t, { data: [] })
  assert.equal((await f.post({ action: 'status', answerIds: [id], visitorToken: token })).status, 200)
  assert.equal(f.calls[0].name, 'get_talkconcert_answer_likes')
})
test('잘못된 토큰·답변·외부 사이트 요청을 DB 호출 전에 거부한다', async t => {
  const f = await fixture(t)
  for (const visitorToken of ['', null, 'a'.repeat(65), 'z'.repeat(64)]) assert.equal((await f.post({ action:'like', answerId:id, visitorToken })).status, 400)
  assert.equal((await f.post({ action:'like', answerId:[id], visitorToken:token })).status, 400)
  assert.equal((await f.post({ action:'status', answerIds:Array(11).fill(id), visitorToken:token })).status, 400)
  assert.equal((await f.post({ action:'like', answerId:id, visitorToken:token }, { Origin:'https://external.example' })).status, 403)
  assert.equal(f.calls.length, 0)
})
test('DB 실패를 좋아요 성공으로 표시하지 않는다', async t => {
  const f = await fixture(t, { error: { code:'XX000', message:'private' } })
  const response = await f.post({ action:'like', answerId:id, visitorToken:token })
  assert.equal(response.status, 502)
  assert.ok(!(await response.text()).includes('private'))
})
