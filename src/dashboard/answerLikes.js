import { requestJson } from '../lib/requestTimeout.js'

export const visitorKey = 'talkconcert-answer-like-visitor'

// 로그인 없이 브라우저를 구분한다. 저장소가 차단되면 매번 새 토큰을 만들어 중복 투표하지 않는다.
export function getLikeVisitor(storage, random = crypto) {
  try {
    storage ??= window.localStorage
    const existing = storage.getItem(visitorKey)
    if (/^[0-9a-f]{64}$/.test(existing || '')) return existing
    const token = Array.from(random.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, '0')).join('')
    storage.setItem(visitorKey, token)
    if (storage.getItem(visitorKey) !== token) throw new Error('브라우저 저장소를 사용할 수 없어요.')
    return token
  } catch { throw new Error('좋아요를 누르려면 브라우저의 사이트 데이터 저장을 허용해 주세요.') }
}

export async function answerLikesRequest(action, ids, visitorToken) {
  const { response, data } = await requestJson('/api/answer-likes', {
    method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, visitorToken, ...(action === 'like' ? { answerId: ids[0] } : { answerIds: ids }) }),
  })
  if (!response.ok) throw new Error(data?.error || '좋아요를 확인하지 못했어요. 다시 시도해 주세요.')
  const rows = action === 'like' ? [data] : data
  if (!Array.isArray(rows) || rows.some((item) => !item || !ids.includes(item.answerId) || !Number.isSafeInteger(item.likes) || item.likes < 0 || typeof item.liked !== 'boolean') || (action === 'like' && data?.liked !== true)) throw new Error('좋아요 저장 결과를 확인하지 못했어요. 다시 시도해 주세요.')
  return rows
}
