import { sessionHeaders } from '../lib/adminAuth'
import { requestJson } from '../lib/requestTimeout'
import { loadNoteOwners } from './noteOwnership'

export async function syncQuestionOwnership() {
  const legacy = Object.entries(loadNoteOwners()).map(([id, token]) => ({ id, token }))
  // 이전 브라우저 메모가 많아도 계정 확인 요청의 크기를 제한한다.
  const batches = legacy.length ? Array.from({ length: Math.ceil(legacy.length / 200) }, (_, i) => legacy.slice(i * 200, (i + 1) * 200)) : [[]]
  let questionIds = []
  for (const owners of batches) {
    const { response, data } = await requestJson('/api/board/ownership', {
      method: 'POST', headers: { ...await sessionHeaders(), 'Content-Type': 'application/json' },
      cache: 'no-store', body: JSON.stringify({ owners }),
    })
    if (!response.ok || !Array.isArray(data?.questionIds)) throw new Error(data?.error || '내 질문을 확인하지 못했어요.')
    questionIds = data.questionIds
  }
  return questionIds
}
