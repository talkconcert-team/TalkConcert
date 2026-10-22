import assert from 'node:assert/strict'
import test from 'node:test'
import { loadComposeIntent, saveComposeIntent, loadPendingQuestion, savePendingQuestion } from './composeStorage.js'
import { rememberNoteOwner } from './noteOwnership.js'

function storage() {
  const values = new Map()
  return { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) }
}

test('새로고침 시 질문 초안·색·주제를 함께 복원한다', () => {
  const store = storage()
  const draft = { draft: '**한글** 질문입니다.\n\n- 두 번째 줄', color: 'mint', columnId: 'topic-1' }
  saveComposeIntent(draft, store)
  assert.deepEqual(loadComposeIntent(store), draft)
})

test('응답이 끊긴 등록은 새로고침 후에도 같은 ID와 토큰으로 재시도한다', () => {
  const store = storage()
  const pending = { id: '00000000-0000-4000-8000-000000000001', fingerprint: 'same draft', token: 'a'.repeat(64) }
  savePendingQuestion(pending, store)
  assert.deepEqual(loadPendingQuestion(store), pending)
  // 브라우저 저장이 다시 허용되어도 이미 서버에 보낸 토큰을 바꾸지 않는다.
  assert.equal(rememberNoteOwner(pending.id, store, pending.token).token, pending.token)
  assert.equal(rememberNoteOwner(pending.id, store).token, pending.token)
  savePendingQuestion(null, store)
  assert.equal(loadPendingQuestion(store), null)
})

test('저장소 차단이나 잘못된 초안은 입력 화면을 깨뜨리지 않는다', () => {
  const blocked = { getItem() { throw Error('blocked') }, setItem() { throw Error('blocked') }, removeItem() { throw Error('blocked') } }
  assert.deepEqual(loadComposeIntent(blocked), { draft: '', color: 'cream', columnId: '' })
  assert.equal(loadPendingQuestion(blocked), null)
  assert.doesNotThrow(() => { saveComposeIntent({}, blocked); savePendingQuestion(null, blocked) })
  const store = storage()
  saveComposeIntent({ draft: {}, columnId: [], color: 'invalid' }, store)
  assert.deepEqual(loadComposeIntent(store), { draft: '', color: 'cream', columnId: '' })
  savePendingQuestion({ id: 'invalid', fingerprint: 'draft' }, store)
  assert.equal(loadPendingQuestion(store), null)
})
