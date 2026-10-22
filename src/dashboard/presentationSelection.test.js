import assert from 'node:assert/strict'
import test from 'node:test'
import { presentationSelection, presentationTopic } from './presentationSelection.js'

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

test('추첨 제목은 이동·주제명 변경 이후에도 당시 제목을 유지한다', () => {
  const question = { columnId: 'one', topicTitle: '신희성 선배에게 질문하기' }
  assert.equal(presentationTopic(question, [{ id: 'one', title: '바뀐 제목' }]), '신희성 선배에게 질문하기')
  assert.equal(presentationTopic(question, []), '신희성 선배에게 질문하기')
})

test('카드 및 예전 추첨은 현재 주제명을 표시하고 삭제된 주제는 기본 제목을 사용한다', () => {
  assert.equal(presentationTopic({ columnId: 'one' }, [{ id: 'one', title: '이지우 선배에게 질문하기' }]), '이지우 선배에게 질문하기')
  assert.equal(presentationTopic(null, []), '오늘의 질문')
})
