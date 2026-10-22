import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import { createBoardMiddleware } from './boardApi.js'

const env = { SUPABASE_URL: 'https://test.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'public', SERVER_SETTINGS_ADMIN_TOKEN: 'server-only' }
const payload = { action: 'question.move', data: { id: '00000000-0000-4000-8000-000000000001', columnId: '00000000-0000-4000-8000-000000000002', after: true, ownerToken: 'a'.repeat(64) } }

async function fixture(t, admin, audience = true) {
  const calls = []
  const client = (scope) => ({ rpc: async (name, args) => {
    calls.push({ scope, name, args })
    return { data: name === 'get_talkconcert_board' ? { columns: [], questions: [] } : true }
  } })
  const middleware = createBoardMiddleware(env, () => client('public-read'))
  const server = createServer((req, res) => {
    if (admin) req.adminDb = client('verified-admin')
    if (audience) req.audienceDb = client('verified-audience')
    void middleware(req, res, () => { res.writeHead(404); res.end() })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise((resolve) => server.close(resolve)))
  const origin = `http://127.0.0.1:${server.address().port}`
  return { calls, get: (path) => fetch(origin + path), post: (path, body = payload) => fetch(origin + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) }
}

test('로그인 없는 관리자 이동은 DB 호출 전에 차단한다', async (t) => {
  const f = await fixture(t, false)
  assert.equal((await f.post('/api/admin/board')).status, 401)
  assert.deepEqual(f.calls, [])
})

test('관객 이동은 로그인 없이 비밀 토큰으로 검증하고 관리자 RPC를 호출하지 않는다', async (t) => {
  const f = await fixture(t, false)
  assert.equal((await f.post('/api/board')).status, 200)
  assert.deepEqual(f.calls.map(({ scope, name }) => [scope, name]), [['public-read', 'move_talkconcert_question'], ['public-read', 'get_talkconcert_board']])
  assert.equal(f.calls[0].args.p_owner_token, 'a'.repeat(64))
})

test('작성자 토큰이 없는 이동은 DB 호출 전에 차단한다', async (t) => {
  const f = await fixture(t, false, false)
  const response = await f.post('/api/board', { ...payload, data: { ...payload.data, ownerToken: undefined } })
  assert.equal(response.status, 400)
  assert.deepEqual(f.calls, [])
})

test('로그인 없이 보드를 읽을 때 공개 조회 RPC만 호출한다', async (t) => {
  const f = await fixture(t, false, false)
  assert.equal((await f.get('/api/board')).status, 200)
  assert.deepEqual(f.calls.map(({ scope, name }) => [scope, name]), [['public-read', 'get_talkconcert_board']])
})

test('관리자 이동은 검증된 사용자 DB와 서버 토큰을 사용한다', async (t) => {
  const f = await fixture(t, true)
  const response = await f.post('/api/admin/board')
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { columns: [], questions: [] })
  assert.equal(f.calls[0].scope, 'verified-admin')
  assert.equal(f.calls[0].name, 'move_admin_talkconcert_question')
  assert.equal(f.calls[0].args.p_token, env.SERVER_SETTINGS_ADMIN_TOKEN)
})

const submission = { action: 'question.create', data: { ...payload.data, text: '질문입니다.', color: 'cream', authorName: '찬란한 부소마인' } }

test('비로그인 등록은 별명과 토큰을 공개 RPC에 전달한다', async (t) => {
  const f = await fixture(t, false, false)
  assert.equal((await f.post('/api/board', submission)).status, 200)
  assert.equal(f.calls[0].scope, 'public-read')
  assert.equal(f.calls[0].name, 'submit_talkconcert_question')
  assert.equal(f.calls[0].args.p_author_name, '찬란한 부소마인')
  assert.equal(f.calls[0].args.p_owner_token, 'a'.repeat(64))
})

test('이름 형식이 잘못되면 등록하지 않는다', async (t) => {
  const f = await fixture(t, false, false)
  for (const authorName of [undefined, '', '찬란한 관객', '<script> 부소마인']) {
    assert.equal((await f.post('/api/board', { ...submission, data: { ...submission.data, authorName } })).status, 400)
  }
  assert.deepEqual(f.calls, [])
})

test('작성자 토큰이 있어도 관객 삭제·수정·복구는 허용하지 않는다', async (t) => {
  const f = await fixture(t, false, false)
  for (const action of ['question.delete', 'question.update', 'question.restore']) {
    assert.equal((await f.post('/api/board', { ...submission, action })).status, 400)
  }
  assert.deepEqual(f.calls, [])
})

test('관리자 삭제는 관리자 인증과 서버 토큰을 통해서만 처리한다', async (t) => {
  const f = await fixture(t, true)
  assert.equal((await f.post('/api/admin/board', { action: 'question.delete', data: { id: payload.data.id } })).status, 200)
  assert.equal(f.calls[0].scope, 'verified-admin')
  assert.equal(f.calls[0].name, 'manage_talkconcert_board')
  assert.equal(f.calls[0].args.p_token, env.SERVER_SETTINGS_ADMIN_TOKEN)
})
