import assert from 'node:assert/strict'
import test from 'node:test'
import { requestSettings } from './settingsStore.js'

test('저장 성공 시 서버에서 확인한 설정을 반환한다', async () => {
  const result = await requestSettings({ draw: false }, async (url, options) => {
    assert.equal(url, '/api/admin/settings')
    assert.equal(options.method, 'PATCH')
    assert.equal(options.body, '{"draw":false}')
    return Response.json({ draw: false, topics: true })
  }, async () => ({ Authorization: 'Bearer test' }))
  assert.deepEqual(result, { draw: false, topics: true })
})

test('저장 실패를 성공으로 취급하지 않는다', async () => {
  await assert.rejects(requestSettings({ draw: false }, async () => Response.json({ error: '저장 실패' }, { status: 502 }), async () => ({ Authorization: 'Bearer test' })), /저장 실패/)
})

test('불완전한 설정 응답을 허용하지 않는다', async () => {
  await assert.rejects(requestSettings(undefined, async () => Response.json({ draw: true })), /설정 형식/)
})
