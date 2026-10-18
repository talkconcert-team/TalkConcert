import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import { createDrawMiddleware } from './drawApi.js'

const env = { SERVER_SETTINGS_ADMIN_TOKEN: 'server-only' }
const requestId = '00000000-0000-4000-8000-000000000001'
const result = { draw: { requestId, question: { id: 'winner' } }, remainingIds: [], latest: null }

async function fixture(t, { admin = true, rpcError = null } = {}) {
  const calls = []
  const middleware = createDrawMiddleware(env)
  const server = createServer((req, res) => {
    if (admin) req.adminDb = { rpc: async (name, args) => {
      calls.push({ name, args })
      return { data: result, error: rpcError }
    } }
    void middleware(req, res, () => { res.writeHead(404); res.end() })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise((resolve) => server.close(resolve)))
  const origin = `http://127.0.0.1:${server.address().port}`
  return { calls, get: () => fetch(origin + '/api/admin/draw'), post: (body = { requestId }, source = origin) => fetch(origin + '/api/admin/draw', {
    method: 'POST', headers: { Origin: source, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }) }
}

test('비로그인 추첨·이력 조회는 DB 호출 전에 거부한다', async (t) => {
  const f = await fixture(t, { admin: false })
  assert.equal((await f.get()).status, 401)
  assert.equal((await f.post()).status, 401)
  assert.deepEqual(f.calls, [])
})

test('이력 조회는 추첨 RPC를 실행하지 않는다', async (t) => {
  const f = await fixture(t)
  assert.equal((await f.get()).status, 200)
  assert.equal(f.calls[0].name, 'get_talkconcert_draw_state')
})

test('결과는 DB에서 받고 재시도에도 동일한 요청 ID를 전달한다', async (t) => {
  const f = await fixture(t)
  for (let i = 0; i < 2; i++) {
    const response = await f.post()
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), result)
  }
  assert.deepEqual(f.calls, Array(2).fill({ name: 'draw_talkconcert_question', args: { p_request_id: requestId, p_token: env.SERVER_SETTINGS_ADMIN_TOKEN } }))
})

test('외부 출처·잘못된 ID·지정 당첨자 주입을 거부한다', async (t) => {
  const f = await fixture(t)
  assert.equal((await f.post({ requestId }, 'https://attacker.example')).status, 403)
  assert.equal((await f.post({ requestId: 'invalid' })).status, 400)
  assert.equal((await f.post({ requestId, questionId: 'chosen' })).status, 400)
  assert.deepEqual(f.calls, [])
})

test('DB의 추첨 금지 설정을 클라이언트가 우회할 수 없다', async (t) => {
  const f = await fixture(t, { rpcError: { code: 'PT409' } })
  assert.equal((await f.post()).status, 409)
})

test('DB 저장 결과를 확인하지 못하면 성공으로 표시하지 않는다', async (t) => {
  const f = await fixture(t, { rpcError: { code: '08006' } })
  assert.equal((await f.post()).status, 502)
})
