import { adminHeaders } from '../lib/adminAuth.js'
import { requestJson } from '../lib/requestTimeout.js'

export function validSettings(value) {
  return value && typeof value.draw === 'boolean' && typeof value.topics === 'boolean'
}

// DB 성공 응답만 저장 완료로 취급하고 로컬 저장으로 대체하지 않는다.
export async function requestSettings(patch, fetcher = fetch, getHeaders = adminHeaders) {
  const auth = patch ? await getHeaders() : {}
  const { response, data } = await requestJson(patch ? '/api/admin/settings' : '/api/settings', {
    method: patch ? 'PATCH' : 'GET',
    cache: 'no-store',
    ...(patch ? { headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify(patch) } : {}),
  }, fetcher)
  if (!response.ok) throw new Error(data?.error || '설정 요청에 실패했어요. 다시 시도해 주세요.')
  if (!validSettings(data)) throw new Error('저장된 설정 형식을 확인할 수 없어요.')
  return { draw: data.draw, topics: data.topics }
}
