import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import { createBoardMiddleware } from './boardApi.js'

const env = { SUPABASE_URL: 'https://test.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'public', SERVER_SETTINGS_ADMIN_TOKEN: 'server-only' }
const payload = { action: 'question.move', data: { id: '00000000-0000-4000-8000-000000000001', columnId: '00000000-0000-4000-8000-000000000002', after: true } }

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

test('관객 이동은 브라우저 토큰 없이 계정 소유권 RPC로 검증하고 관리자 RPC를 호출하지 않는다', async (t) => {
  const f = await fixture(t, false)
  assert.equal((await f.post('/api/board')).status, 200)
  assert.deepEqual(f.calls.map(({ scope, name }) => [scope, name]), [['verified-audience', 'move_talkconcert_question'], ['verified-audience', 'get_talkconcert_board']])
  assert.equal(f.calls[0].args.p_owner_token, null)
})

test('로그인 없는 관객 이동은 작성자 토큰이 있어도 차단한다', async (t) => {
  const f = await fixture(t, false, false)
  const response = await f.post('/api/board', { ...payload, data: { ...payload.data, ownerToken: 'a'.repeat(64) } })
  assert.equal(response.status, 401)
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
