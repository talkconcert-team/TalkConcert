import assert from 'node:assert/strict'
import test from 'node:test'
import { allowedRequest, sameOriginJson, readJsonBody } from './requestPolicy.js'

const deployed = { VERCEL: '1', APP_ORIGIN: 'https://talkconcert.vercel.app', VERCEL_URL: 'talkconcert-preview.vercel.app', VERCEL_BRANCH_URL: 'talkconcert-git-feature.vercel.app' }
const request = (host, origin = `https://${host}`) => ({ headers: { host, origin, 'content-type': 'application/json' }, socket: { remoteAddress: '203.0.113.2' } })

test('배포된 API는 등록된 도메인만 허용하고 쓰기는 같은 출처로 제한한다', () => {
  assert.equal(allowedRequest(request('talkconcert.vercel.app'), deployed), true)
  assert.equal(allowedRequest(request('talkconcert-preview.vercel.app'), deployed), true)
  assert.equal(allowedRequest(request('talkconcert-git-feature.vercel.app'), deployed), true)
  assert.equal(sameOriginJson(request('talkconcert-git-feature.vercel.app'), deployed), true)
  assert.equal(sameOriginJson(request('talkconcert-git-feature.vercel.app', 'https://attacker.example'), deployed), false)
  assert.equal(allowedRequest(request('attacker.example'), deployed), false)
  assert.equal(sameOriginJson(request('talkconcert.vercel.app'), deployed), true)
  assert.equal(sameOriginJson(request('talkconcert.vercel.app', 'https://attacker.example'), deployed), false)
  assert.equal(sameOriginJson(request('talkconcert.vercel.app', 'http://talkconcert.vercel.app'), deployed), false)
})

test('로컬 환경은 외부 접속과 위조된 프록시 헤더를 신뢰하지 않는다', () => {
  assert.equal(allowedRequest(request('localhost:5173'), {}), false)
  assert.equal(allowedRequest({ ...request('localhost:5173'), socket: { remoteAddress: '127.0.0.1' } }, {}), true)
  const forged = request('attacker.example')
  forged.headers['x-forwarded-host'] = 'talkconcert.vercel.app'
  assert.equal(allowedRequest(forged, deployed), false)
  assert.equal(allowedRequest(request('talkconcert.vercel.app'), { VERCEL: '1' }), false)
})

test('Vercel이 해석한 body와 Node 스트림 모두 크기를 검사한다', async () => {
  assert.deepEqual(await readJsonBody({ body: { topics: true } }, 1024), { topics: true })
  assert.deepEqual(await readJsonBody({ body: '{"topics":true}' }, 1024), { topics: true })
  const stream = { async *[Symbol.asyncIterator]() { yield Buffer.from('{"topics":'); yield Buffer.from('false}') } }
  assert.deepEqual(await readJsonBody(stream, 1024), { topics: false })
  await assert.rejects(readJsonBody({ body: '{bad' }, 1024), { status: 400 })
  await assert.rejects(readJsonBody({ body: 'x'.repeat(1025) }, 1024), { status: 413 })
})
