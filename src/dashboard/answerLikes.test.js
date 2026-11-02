import test from 'node:test'
import assert from 'node:assert/strict'
import { getLikeVisitor, visitorKey } from './answerLikes.js'

function storage() {
  const values = new Map()
  return { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value) }
}
test('좋아요 브라우저 토큰은 재조회·새로고침에도 같은 값을 사용한다', () => {
  const store = storage()
  const first = getLikeVisitor(store)
  assert.match(first, /^[0-9a-f]{64}$/)
  assert.equal(getLikeVisitor(store), first)
  assert.notEqual(getLikeVisitor(storage()), first)
})
test('잘못된 토큰은 교체하고 저장 실패 시 새 토큰으로 투표하지 않는다', () => {
  const store = storage()
  store.setItem(visitorKey, 'invalid')
  assert.match(getLikeVisitor(store), /^[0-9a-f]{64}$/)
  assert.throws(() => getLikeVisitor({ getItem: () => null, setItem: () => {} }))
  assert.throws(() => getLikeVisitor({ getItem: () => { throw new Error('blocked') } }))
})
