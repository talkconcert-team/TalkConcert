import assert from 'node:assert/strict'
import test from 'node:test'
import { createSlotDraw } from './slotDraw.js'

const questions = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

test('질문이 없으면 추첨하지 않는다', () => {
  assert.equal(createSlotDraw([], null), null)
})

test('현재 선택을 제외한 후보의 처음과 끝도 추첨할 수 있다', () => {
  assert.equal(createSlotDraw(questions, 'a', () => 0).target.id, 'b')
  assert.equal(createSlotDraw(questions, 'a', () => 0.999).target.id, 'c')
})

test('하나뿐인 질문은 다시 표시할 수 있다', () => {
  const result = createSlotDraw([questions[0]], 'a')
  assert.equal(result.target.id, 'a')
  assert.equal(result.items[result.targetIndex], result.target)
})

test('많은 질문도 트랙 크기를 제한하고 정지 위치에 당첨 질문을 배치한다', () => {
  const many = Array.from({ length: 10000 }, (_, id) => ({ id: String(id) }))
  const result = createSlotDraw(many, null, () => 0.9999)
  assert.equal(result.target.id, '9999')
  assert.ok(result.items.length < 100)
  assert.equal(result.items[result.targetIndex], result.target)
  assert.equal(many.length, 10000)
})
