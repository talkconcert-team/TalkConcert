import { createClient } from '@supabase/supabase-js'
import { allowedRequest, sameOriginJson, readJsonBody } from './requestPolicy.js'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function reply(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(data))
}

// 관객은 로그인하지 않는다. 브라우저 식별자는 본문으로만 받고 URL·로그에 남기지 않는다.
export function createAnswerLikesMiddleware(env, factory = createClient) {
  let db
  return async (req, res, next) => {
    if (req.url?.split('?')[0] !== '/api/answer-likes') return next()
    if (!allowedRequest(req, env)) return reply(res, 403, { error: '허용된 행사 주소에서 접속해 주세요.' })
    if (req.method !== 'POST') return reply(res, 405, { error: '지원하지 않는 요청이에요.' })
    if (!sameOriginJson(req, env)) return reply(res, 403, { error: '페이지에서 다시 시도해 주세요.' })
    try {
      const body = await readJsonBody(req, 4096)
      if (!body || !/^[0-9a-f]{64}$/.test(body.visitorToken || '') || typeof body.visitorToken !== 'string') return reply(res, 400, { error: '좋아요 확인 정보를 확인해 주세요.' })
      const { action, answerId, answerIds, visitorToken } = body
      if (action !== 'like' && action !== 'status') return reply(res, 400, { error: '지원하지 않는 요청이에요.' })
      if (action === 'like' ? typeof answerId !== 'string' || !uuid.test(answerId) : !Array.isArray(answerIds) || answerIds.length < 1 || answerIds.length > 10 || !answerIds.every((id) => typeof id === 'string' && uuid.test(id))) return reply(res, 400, { error: '답변을 다시 선택해 주세요.' })
      if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) return reply(res, 503, { error: '좋아요 기능에 연결하지 못했어요.' })
      db ??= factory(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
      const result = await db.rpc(action === 'like' ? 'like_talkconcert_answer' : 'get_talkconcert_answer_likes', action === 'like' ? { p_id: answerId, p_token: visitorToken } : { p_ids: answerIds, p_token: visitorToken })
      if (result.error) {
        if (result.error.code === 'PGRST202') return reply(res, 503, { error: '좋아요 기능을 준비하고 있어요.' })
        if (result.error.code === 'P0002') return reply(res, 404, { error: '이 답변을 더 이상 볼 수 없어요.' })
        return reply(res, 502, { error: '좋아요를 확인하지 못했어요. 다시 시도해 주세요.' })
      }
      return reply(res, 200, result.data)
    } catch (error) {
      return reply(res, [400, 413].includes(error.status) ? error.status : 502, { error: [400, 413].includes(error.status) ? error.message : '좋아요를 확인하지 못했어요. 다시 시도해 주세요.' })
    }
  }
}
