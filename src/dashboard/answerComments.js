import { requestJson } from '../lib/requestTimeout.js'

const draftKey = (answerId) => `talkconcert-answer-comment:${answerId}`
export function loadCommentDraft(answerId, storage) {
  try {
    const draft = JSON.parse((storage || localStorage).getItem(draftKey(answerId)))
    if (draft && typeof draft.text === 'string' && draft.text.length <= 1000) return draft
  } catch { /* 저장소가 없어도 현재 화면의 초안은 유지한다. */ }
  return { text: '' }
}
export function saveCommentDraft(answerId, draft, storage) {
  try {
    const target = storage || localStorage
    if (draft) target.setItem(draftKey(answerId), JSON.stringify(draft))
    else target.removeItem(draftKey(answerId))
  } catch { /* 네트워크 실패 시 현재 폼에는 초안과 요청 ID가 남는다. */ }
}

export function mergeComments(current, incoming) {
  const byId = new Map(current.map((comment) => [comment.id, comment]))
  for (const comment of incoming) byId.set(comment.id, comment)
  return [...byId.values()].sort((a, b) => BigInt(a.cursor) < BigInt(b.cursor) ? -1 : BigInt(a.cursor) > BigInt(b.cursor) ? 1 : 0)
}
function validComment(comment) {
  return comment && typeof comment.id === 'string' && typeof comment.text === 'string' && typeof comment.authorName === 'string' && typeof comment.createdAt === 'string' && typeof comment.cursor === 'string' && /^[1-9][0-9]{0,17}$/.test(comment.cursor)
}
export async function commentsRequest(action, answerId, payload = {}) {
  const { response, data } = await requestJson('/api/answer-comments', {
    method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, action, answerId }),
  })
  if (!response.ok) throw new Error(data?.error || '댓글을 확인하지 못했어요. 다시 시도해 주세요.')
  const valid = action === 'create' ? validComment(data) : data && Array.isArray(data.comments) && data.comments.every(validComment) && typeof data.hasMore === 'boolean'
  if (!valid) throw new Error('댓글 저장 결과를 확인하지 못했어요. 다시 시도해 주세요.')
  return data
}
