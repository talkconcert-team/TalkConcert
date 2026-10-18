import assert from 'node:assert/strict'
import test from 'node:test'
import { presentationSelection } from './presentationSelection.js'

const original = { id: 'one', text: '수정 전' }
const updated = { ...original, text: '수정 후' }

test('일반 크게 보기는 CMS의 수정 및 삭제를 반영한다', () => {
  const selection = { mode: 'board', question: original }
  assert.equal(presentationSelection(selection, [updated]), updated)
  assert.equal(presentationSelection(selection, []), null)
})

test('추첨 크게 보기는 수정·삭제 후에도 당첨 당시 원문을 유지한다', () => {
  const selection = { mode: 'draw', question: original }
  assert.equal(presentationSelection(selection, [updated]), original)
  assert.equal(presentationSelection(selection, []), original)
})
