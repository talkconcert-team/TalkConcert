import { createClient } from '@supabase/supabase-js'
import { allowedRequest, sameOriginJson, readJsonBody } from './requestPolicy.js'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const colors = /^(cream|rose|mint|sky|lavender|white|#[0-9a-f]{6})$/i
const actions = new Set(['topic.create', 'topic.update', 'topic.delete', 'question.create', 'question.update', 'question.delete', 'question.restore', 'question.move'])

export function validBoardAction(action, data) {
  if (!actions.has(action) || !data || typeof data !== 'object' || Array.isArray(data)) return false
  if (action !== 'topic.create' && !uuid.test(data.id)) return false
  if (['topic.create', 'topic.update'].includes(action)) return typeof data.title === 'string' && data.title.trim().length > 0 && data.title.trim().length <= 40
  if (action === 'topic.delete') return !data.targetId || uuid.test(data.targetId)
  if (action === 'question.move') return uuid.test(data.columnId) && (!data.targetId || uuid.test(data.targetId)) && typeof data.after === 'boolean'
  if (['question.create', 'question.update'].includes(action)) return uuid.test(data.columnId) && typeof data.text === 'string' && data.text.trim().length > 0 && data.text.length <= 4000 && typeof data.color === 'string' && colors.test(data.color)
  return true
}

function reply(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(value))
}

export function createBoardMiddleware(env, factory = createClient) {
  let publicDb
  return async (req, res, next) => {
    const path = req.url?.split('?')[0]
    if (!['/api/board', '/api/admin/board'].includes(path)) return next()
    const admin = path === '/api/admin/board'
    const publicRead = !admin && req.method === 'GET'
    if (admin && !req.adminDb) return reply(res, 401, { error: '관리자 로그인이 필요해요.' })
    if (!admin && !publicRead && !req.audienceDb) return reply(res, 401, { error: 'Google 로그인이 필요해요.' })
    if (!allowedRequest(req, env)) return reply(res, 403, { error: '허용된 행사 주소에서 접속해 주세요.' })
    if (!['GET', 'POST'].includes(req.method)) return reply(res, 405, { error: '지원하지 않는 요청이에요.' })
    if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY || (admin && !env.SERVER_SETTINGS_ADMIN_TOKEN)) return reply(res, 503, { error: 'Supabase 연결 정보를 확인해 주세요.' })
    try {
      const db = publicRead
        ? (publicDb ??= factory(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }))
        : admin ? req.adminDb : req.audienceDb
      let action = 'snapshot'
      let data = {}
      if (req.method === 'POST') {
        if (!sameOriginJson(req, env)) return reply(res, 403, { error: '페이지에서 다시 시도해 주세요.' })
        const body = await readJsonBody(req, 32768)
        action = body?.action
        data = body?.data
        if (!validBoardAction(action, data) || (!admin && !['question.create', 'question.move'].includes(action))) return reply(res, 400, { error: '내용·주제·색을 확인해 주세요.' })
        if (!admin && data.ownerToken != null && !/^[0-9a-f]{64}$/.test(data.ownerToken)) return reply(res, 400, { error: '작성자 확인 정보를 확인해 주세요.' })
      }
      let result
      if (admin) {
        if (action.startsWith('topic.')) {
          const allowed = await db.from('talkconcert_settings').select('topics').eq('id', 'main').single()
          if (allowed.error) return reply(res, 502, { error: '주제 관리 설정을 확인하지 못했어요.' })
          if (!allowed.data?.topics) return reply(res, 403, { error: '기능 설정에서 주제 관리를 이용 가능으로 바꿔 주세요.' })
        }
        if (action === 'question.move') {
          result = await req.adminDb.rpc('move_admin_talkconcert_question', { p_id: data.id, p_topic: data.columnId, p_target: data.targetId || null, p_after: data.after, p_token: env.SERVER_SETTINGS_ADMIN_TOKEN })
          if (!result.error) result = await db.rpc('get_talkconcert_board')
        } else result = await req.adminDb.rpc('manage_talkconcert_board', { p_action: action, p_data: data, p_token: env.SERVER_SETTINGS_ADMIN_TOKEN })
      } else if (req.method === 'GET') {
        result = await db.rpc('get_talkconcert_board')
      } else {
        result = action === 'question.move'
          ? await db.rpc('move_talkconcert_question', { p_id: data.id, p_topic: data.columnId, p_target: data.targetId || null, p_after: data.after, p_owner_token: data.ownerToken || null })
          : await db.rpc('submit_talkconcert_question', { p_id: data.id, p_topic: data.columnId, p_text: data.text.trim(), p_color: data.color, p_owner_token: data.ownerToken || null })
        if (!result.error) result = await db.rpc('get_talkconcert_board')
      }
      if (result.error) {
        if (result.error.code === '42501') return reply(res, 403, { error: '본인이 작성한 메모만 이동할 수 있어요.' })
        const known = ['22023', 'P0002', '23514', '23502', '23503'].includes(result.error.code)
        return reply(res, known ? 409 : 502, { error: known ? (result.error.code === '22023' || result.error.code === 'P0002' ? result.error.message : '입력 내용을 확인해 주세요.') : 'Supabase 작업 결과를 확인하지 못했어요. 목록을 다시 확인해 주세요.' })
      }
      return reply(res, 200, result.data)
    } catch (error) {
      if ([400, 413].includes(error.status)) return reply(res, error.status, { error: error.message })
      return reply(res, 502, { error: 'Supabase에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.' })
    }
  }
}
