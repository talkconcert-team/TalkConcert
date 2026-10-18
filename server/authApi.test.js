import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import { createAuthMiddleware, verifyAdmin, verifyAudience } from './authApi.js'

const env = { SUPABASE_URL: 'https://test.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'public' }
const request = (token) => ({ headers: token ? { authorization: `Bearer ${token}` } : {} })
function factory(allowed, valid = true) {
  return (_url, _key, options) => ({
    auth: { getUser: async (token) => {
      assert.equal(options.global.headers.Authorization, `Bearer ${token}`)
      return valid ? { data: { user: { id: 'verified-id', email: 'admin@example.test' } } } : { error: { message: 'invalid' } }
    } },
    rpc: async (name) => { assert.ok(['is_talkconcert_admin', 'is_talkconcert_audience'].includes(name)); return { data: allowed, error: null } },
  })
}

test('로그인 없는 요청은 역할이나 이메일 헤더를 위조해도 거부한다', async () => {
  const result = await verifyAdmin({ headers: { 'x-admin': 'true', 'x-email': 'admin@example.test' } }, env, () => { throw new Error('must not call') })
  assert.equal(result.status, 401)
})
test('유효하지 않은 토큰은 거부한다', async () => {
  assert.equal((await verifyAdmin(request('forged'), env, factory(true, false))).status, 401)
})
test('로그인되어도 DB 허용 목록에 없으면 거부한다', async () => {
  assert.equal((await verifyAdmin(request('valid'), env, factory(false))).status, 403)
})
test('DB 권한 조회가 실패하면 접근을 허용하지 않는다', async () => {
  const broken = () => ({ auth: { getUser: async () => ({ data: { user: { id: 'a' } } }) }, rpc: async () => ({ error: { message: 'unavailable' } }) })
  assert.equal((await verifyAdmin(request('valid'), env, broken)).status, 503)
})
test('검증된 관리자 요청에만 사용자별 DB 클라이언트를 제공한다', async () => {
  const result = await verifyAdmin(request('valid'), env, factory(true))
  assert.equal(result.status, 200)
  assert.equal(result.user.id, 'verified-id')
  assert.ok(result.db)
})
test('보드 읽기는 공개하고 관객 쓰기와 관리자 API는 로그인을 검사한다', async (t) => {
  const auth = createAuthMiddleware(env, factory(true))
  const server = createServer((req, res) => auth(req, res, () => { res.writeHead(200); res.end(req.adminDb ? 'admin' : 'audience') }))
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve) }))
  const url = `http://127.0.0.1:${server.address().port}`
  for (const path of ['/api/admin/settings', '/api/admin/board', '/api/auth/admin', '/api/auth/audience']) assert.equal((await fetch(url + path)).status, 401)
  assert.equal((await fetch(url + '/api/board', { method: 'POST' })).status, 401)
  assert.equal(await (await fetch(url + '/api/board')).text(), 'audience')
  assert.equal(await (await fetch(url + '/api/board', { headers: { Authorization: 'Bearer forged' } })).text(), 'audience')
  assert.equal(await (await fetch(url + '/api/board', { headers: { Authorization: 'Bearer valid' } })).text(), 'audience')
  assert.equal(await (await fetch(url + '/api/admin/board', { headers: { Authorization: 'Bearer valid' } })).text(), 'admin')
})

test('Google 관객은 관리자 허용 목록을 조회하지 않는다', async () => {
  const google = () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'audience-id' } } }) },
    rpc: async (name) => { assert.equal(name, 'is_talkconcert_audience'); return { data: true } },
  })
  assert.equal((await verifyAudience(request('audience'), env, google)).status, 200)
})

test('Google identity 또는 유효 세션이 없는 관객은 차단한다', async () => {
  assert.equal((await verifyAudience(request('valid'), env, factory(false))).status, 403)
  assert.equal((await verifyAudience(request('forged'), env, factory(true, false))).status, 401)
})
