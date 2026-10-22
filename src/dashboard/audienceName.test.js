import assert from 'node:assert/strict'
import test from 'node:test'
import { audienceAdjectives, loadAudienceName } from './audienceName.js'

test('별명은 부소마인으로 끝나고 같은 브라우저에서 유지된다', () => {
  const values = new Map()
  const storage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) }
  const name = loadAudienceName(storage)
  assert.ok(audienceAdjectives.some((word) => name === `${word} 부소마인`))
  assert.equal(loadAudienceName(storage), name)
})

test('저장소가 차단되거나 기존 별명이 잘못되어도 올바른 이름을 만든다', () => {
  const blocked = { getItem() { throw Error('blocked') }, setItem() { throw Error('blocked') } }
  assert.match(loadAudienceName(blocked), /^[가-힣]+ 부소마인$/)
  assert.match(loadAudienceName({ getItem: () => '이전 이름', setItem() {} }), /^[가-힣]+ 부소마인$/)
})
