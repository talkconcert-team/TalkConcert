import assert from 'node:assert/strict'
import test from 'node:test'
import { requestJson, withTimeout } from './requestTimeout.js'

test('응답하지 않는 요청은 제한 시간이 지나면 종료하고 연결도 취소한다', async () => {
  let signal
  await assert.rejects(requestJson('/hung', {}, async (_url, options) => {
    signal = options.signal
    return new Promise(() => {})
  }, 20), { code: 'REQUEST_TIMEOUT' })
  assert.equal(signal.aborted, true)
})

test('본문 수신이 멈춘 경우도 제한 시간에 포함한다', async () => {
  await assert.rejects(requestJson('/hung-body', {}, async () => ({ json: () => new Promise(() => {}) }), 20), { code: 'REQUEST_TIMEOUT' })
})

test('로그인 확인처럼 취소를 지원하지 않는 작업도 대기를 끝낸다', async () => {
  await assert.rejects(withTimeout(() => new Promise(() => {}), 20), { code: 'REQUEST_TIMEOUT' })
})
