import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import { createOwnershipMiddleware } from './ownershipApi.js'

async function fixture(t, authenticated = true) {
  const calls = []
  const middleware = createOwnershipMiddleware({})
  const server = createServer((req, res) => {
    if (authenticated) req.audienceDb = { rpc: async (name, args) => { calls.push({ name, args }); return { data: ['owned-id'] } } }
    void middleware(req, res, () => { res.writeHead(404); res.end() })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise((resolve) => server.close(resolve)))
  const origin = `http://127.0.0.1:${server.address().port}`
  return { calls, post: (body = { owners: [] }, source = origin) => fetch(origin + '/api/board/ownership', {
    method: 'POST', headers: { Origin: source, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }) }
}

test('비로그인 상태에서는 내 질문 ID도 조회하지 않는다', async (t) => {
  const f = await fixture(t, false)
  assert.equal((await f.post()).status, 401)
  assert.deepEqual(f.calls, [])
})

test('다른 기기의 빈 토큰 목록도 검증된 계정의 질문을 조회한다', async (t) => {
  const f = await fixture(t)
  const response = await f.post({ owners: [], userId: 'forged-user' })
  assert.deepEqual(await response.json(), { questionIds: ['owned-id'] })
  assert.deepEqual(f.calls, [{ name: 'sync_talkconcert_question_ownership', args: { p_owners: [] } }])
})

test('외부 출처와 잘못된 레거시 토큰은 DB 호출 전에 차단한다', async (t) => {
  const f = await fixture(t)
  assert.equal((await f.post({ owners: [] }, 'https://attacker.example')).status, 403)
  assert.equal((await f.post({ owners: [{ id: 'invalid', token: 'bad' }] })).status, 400)
  assert.deepEqual(f.calls, [])
})
