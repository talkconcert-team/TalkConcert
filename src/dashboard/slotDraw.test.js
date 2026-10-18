import assert from 'node:assert/strict'
import test from 'node:test'
import { createSlotDraw, slotTiming } from './slotDraw.js'

test('DB 결과가 없으면 브라우저에서 대신 추첨하지 않는다', () => {
  assert.equal(createSlotDraw([{ id: 'a' }], null), null)
})

test('보드가 갱신되지 않았어도 DB에서 받은 결과를 정지 위치에 표시한다', () => {
  const target = { id: 'server-winner', text: '저장된 질문' }
  for (const questions of [[], [{ id: 'old' }]]) {
    const result = createSlotDraw(questions, target)
    assert.equal(result.target, target)
    assert.equal(result.items[result.targetIndex], target)
  }
})

test('많은 질문도 트랙 크기를 제한하고 정지 위치에 당첨 질문을 배치한다', () => {
  const many = Array.from({ length: 10000 }, (_, id) => ({ id: String(id) }))
  const result = createSlotDraw(many, many[9999])
  assert.equal(result.target.id, '9999')
  assert.ok(result.items.length < 100)
  assert.equal(result.items[result.targetIndex], result.target)
  assert.equal(many.length, 10000)
})

test('마지막 미추첨 질문도 기존 보드 전체를 굴리고 DB 결과에서 멈춘다', () => {
  const board = [{ id: 'already-drawn', text: '이전 질문' }, { id: 'last', text: '마지막 질문' }]
  const result = createSlotDraw(board, board[1])
  assert.ok(result.items.some((item) => item.id === 'already-drawn'))
  assert.equal(result.items[result.targetIndex], board[1])
})

test('일반 슬롯은 기존 6초 연출과 주변 질문이 사라질 시간을 보장한다', () => {
  assert.deepEqual(slotTiming(), { roll: 6000, finish: 6650 })
})
