import { allowedRequest, sameOriginJson, readJsonBody } from './requestPolicy.js'

function reply(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(body))
}

export function createOwnershipMiddleware(env) {
  return async (req, res, next) => {
    if (req.url?.split('?')[0] !== '/api/board/ownership') return next()
    if (!req.audienceDb) return reply(res, 401, { error: 'Google 로그인이 필요해요.' })
    if (req.method !== 'POST') return reply(res, 405, { error: '지원하지 않는 요청이에요.' })
    if (!allowedRequest(req, env) || !sameOriginJson(req, env)) return reply(res, 403, { error: '질문 페이지에서 다시 시도해 주세요.' })
    try {
      const body = await readJsonBody(req, 32768)
      const owners = body?.owners
      if (!Array.isArray(owners) || owners.length > 200 || !owners.every((item) => item &&
        typeof item.id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id) &&
        typeof item.token === 'string' && /^[0-9a-f]{64}$/.test(item.token))) return reply(res, 400, { error: '작성자 확인 정보를 확인해 주세요.' })
      // 계정 ID는 요청에서 받지 않는다. DB가 검증한 JWT의 auth.uid()만 사용한다.
      const { data, error } = await req.audienceDb.rpc('sync_talkconcert_question_ownership', { p_owners: owners.map(({ id, token }) => ({ id, token })) })
      if (error || !Array.isArray(data)) return reply(res, error?.code === '42501' ? 403 : 502, { error: '내 질문을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.' })
      return reply(res, 200, { questionIds: data })
    } catch (error) {
      return reply(res, [400, 413].includes(error.status) ? error.status : 502, { error: [400, 413].includes(error.status) ? error.message : '내 질문 정보를 불러오지 못했어요.' })
    }
  }
}
