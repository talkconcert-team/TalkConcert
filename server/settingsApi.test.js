import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import { createSettingsMiddleware } from './settingsApi.js'

const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'public-test', SERVER_SETTINGS_ADMIN_TOKEN: 'server-test' }

async function fixture(t, config = env, dbError = false) {
  let row = { draw: true, topics: false }
  const usedKeys = []
  const factory = (_url, key) => {
    usedKeys.push(key)
    return {
      rpc(name, params) {
        assert.equal(name, 'set_talkconcert_setting')
        assert.equal(params.p_token, 'server-test')
        return {
          async single() {
            if (dbError) return { error: { message: 'private database detail' } }
            row = { ...row, [params.p_key]: params.p_enabled }
            return { data: row, error: null }
          },
        }
      },
      from(name) {
        assert.equal(name, 'talkconcert_settings')
        let patch
        return {
          select() { return this },
          update(value) { patch = value; return this },
          eq(key, value) { assert.equal(key, 'id'); assert.equal(value, 'main'); return this },
          async single() {
            if (dbError) return { error: { message: 'private database detail' } }
            if (patch) row = { ...row, ...patch }
            return { data: row, error: null }
          },
        }
      },
    }
  }
  const middleware = createSettingsMiddleware(config, factory)
  const server = createServer((req, res) => {
    // 인증 미들웨어 통합은 authApi.test.js에서 검증하고 여기서는 승인된 요청만 전달한다.
    req.adminDb = { rpc: (...args) => factory(config.SUPABASE_URL, 'public-test').rpc(...args) }
    middleware(req, res, () => { res.writeHead(404); res.end() })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve) }))
  const origin = `http://127.0.0.1:${server.address().port}`
  const patch = (value, headers = {}) => fetch(`${origin}/api/admin/settings`, {
    method: 'PATCH', headers: { Origin: origin, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(value),
  })
  return { origin, patch, usedKeys }
}

test('연결 정보가 없으면 로컬 저장으로 대체하지 않고 오류를 반환한다', async (t) => {
  const { origin } = await fixture(t, {})
  const response = await fetch(`${origin}/api/admin/settings`)
  assert.equal(response.status, 503)
})

test('공개 키로 저장된 설정을 읽는다', async (t) => {
  const { origin, usedKeys } = await fixture(t)
  const response = await fetch(`${origin}/api/admin/settings`)
  assert.deepEqual(await response.json(), { draw: true, topics: false })
  assert.deepEqual(usedKeys, ['public-test'])
})

test('설정 전용 서버 토큰으로 바뀐 항목만 저장하고 다른 항목은 유지한다', async (t) => {
  const { origin, patch, usedKeys } = await fixture(t)
  assert.deepEqual(await (await patch({ draw: false })).json(), { draw: false, topics: false })
  assert.deepEqual(await (await fetch(`${origin}/api/admin/settings`)).json(), { draw: false, topics: false })
  assert.deepEqual(usedKeys, ['public-test', 'public-test'])
})

test('외부 출처의 저장 요청은 DB에 전달하지 않는다', async (t) => {
  const { patch, usedKeys } = await fixture(t)
  assert.equal((await patch({ draw: false }, { Origin: 'https://other.example' })).status, 403)
  assert.deepEqual(usedKeys, [])
})

test('잘못된 필드와 값은 저장하지 않는다', async (t) => {
  const { patch, usedKeys } = await fixture(t)
  for (const value of [{ admin: true }, { draw: 'true' }, { draw: true, topics: true }, {}, null]) {
    assert.equal((await patch(value)).status, 400)
  }
  assert.deepEqual(usedKeys, [])
})

test('서버 토큰이 없으면 저장 성공을 반환하지 않는다', async (t) => {
  const { patch } = await fixture(t, { ...env, SERVER_SETTINGS_ADMIN_TOKEN: '' })
  assert.equal((await patch({ draw: false })).status, 503)
})

test('DB 실패 시 비공개 오류나 키를 응답에 노출하지 않는다', async (t) => {
  const { patch } = await fixture(t, env, true)
  const response = await patch({ draw: false })
  assert.equal(response.status, 502)
  assert.doesNotMatch(await response.text(), /private database detail|server-test/)
})
