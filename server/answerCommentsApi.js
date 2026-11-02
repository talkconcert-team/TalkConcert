import { createClient } from '@supabase/supabase-js'
import { allowedRequest, sameOriginJson, readJsonBody } from './requestPolicy.js'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function reply(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(data))
}

export function createAnswerCommentsMiddleware(env, factory = createClient) {
  let db
  return async (req, res, next) => {
    if (req.url?.split('?')[0] !== '/api/answer-comments') return next()
    if (!allowedRequest(req, env)) return reply(res, 403, { error: '허용된 행사 주소에서 접속해 주세요.' })
    if (req.method !== 'POST') return reply(res, 405, { error: '지원하지 않는 요청이에요.' })
    if (!sameOriginJson(req, env)) return reply(res, 403, { error: '페이지에서 다시 시도해 주세요.' })
    try {
      const body = await readJsonBody(req, 16384)
      if (!body || !['list', 'create'].includes(body.action) || typeof body.answerId !== 'string' || !uuid.test(body.answerId)) return reply(res, 400, { error: '답변을 다시 선택해 주세요.' })
      const { action, answerId, before, id, text, authorName, visitorToken } = body
      if (action === 'list' && before != null && (typeof before !== 'string' || !/^[1-9][0-9]{0,17}$/.test(before))) return reply(res, 400, { error: '댓글 목록을 다시 불러와 주세요.' })
      if (action === 'create' && (typeof id !== 'string' || !uuid.test(id) || typeof text !== 'string' || !text.trim() || text.length > 1000 || typeof authorName !== 'string' || !/^[가-힣]{1,16} 부소마인$/.test(authorName) || typeof visitorToken !== 'string' || !/^[0-9a-f]{64}$/.test(visitorToken))) return reply(res, 400, { error: '댓글은 1~1000자로 입력해 주세요.' })
      if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) return reply(res, 503, { error: '댓글 기능에 연결하지 못했어요.' })
      db ??= factory(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
      const result = await db.rpc(action === 'list' ? 'get_talkconcert_answer_comments' : 'create_talkconcert_answer_comment', action === 'list' ? { p_answer: answerId, p_before: before || null } : { p_answer: answerId, p_id: id, p_text: text.trim(), p_name: authorName, p_token: visitorToken })
      if (result.error) {
        if (result.error.code === 'PGRST202') return reply(res, 503, { error: '댓글 기능을 준비하고 있어요.' })
        if (result.error.code === 'P0002') return reply(res, 404, { error: '이 답변에 댓글을 남길 수 없어요. 목록을 다시 확인해 주세요.' })
        if (['42501', '22023'].includes(result.error.code)) return reply(res, 409, { error: '댓글 등록 정보를 다시 확인해 주세요.' })
        return reply(res, 502, { error: '댓글을 확인하지 못했어요. 다시 시도해 주세요.' })
      }
      return reply(res, 200, result.data)
    } catch (error) {
      return reply(res, [400, 413].includes(error.status) ? error.status : 502, { error: [400, 413].includes(error.status) ? error.message : '댓글을 확인하지 못했어요. 다시 시도해 주세요.' })
    }
  }
}
