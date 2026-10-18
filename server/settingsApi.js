import { createClient } from '@supabase/supabase-js'
import { allowedRequest, sameOriginJson, readJsonBody } from './requestPolicy.js'

const table = 'talkconcert_settings'

function reply(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  response.end(JSON.stringify(body))
}

// 관리자 세션은 선행 인증 미들웨어가 검증한다. 배포 주소는 서버 설정으로 제한한다.
// 요청별 관리자 JWT와 서버 전용 토큰을 함께 사용하며 익명 쓰기는 허용하지 않는다.
export function createSettingsMiddleware(env, clientFactory = createClient) {
  let reader
  const options = { auth: { persistSession: false, autoRefreshToken: false } }

  return async (request, response, next) => {
    const path = request.url?.split('?')[0]
    if (!['/api/admin/settings', '/api/settings'].includes(path)) return next()
    const admin = path === '/api/admin/settings'
    if (admin && !request.adminDb) return reply(response, 401, { error: '관리자 로그인이 필요해요.' })
    if (!admin && request.method !== 'GET') return reply(response, 405, { error: '지원하지 않는 요청이에요.' })
    if (!allowedRequest(request, env)) return reply(response, 403, { error: '허용된 행사 주소에서 접속해 주세요.' })
    if (!['GET', 'PATCH'].includes(request.method)) {
      response.setHeader('Allow', 'GET, PATCH')
      return reply(response, 405, { error: '지원하지 않는 요청이에요.' })
    }
    if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
      return reply(response, 503, { error: 'Supabase 연결 정보가 없어 설정을 불러올 수 없어요.' })
    }

    try {
      if (request.method === 'GET') {
        reader ??= clientFactory(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, options)
        const { data, error } = await reader.from(table).select('draw, topics').eq('id', 'main').single()
        if (error || !data) return reply(response, 502, { error: 'Supabase에서 설정을 불러오지 못했어요. 연결과 설정 테이블을 확인해 주세요.' })
        return reply(response, 200, data)
      }

      if (!sameOriginJson(request, env)) return reply(response, 403, { error: '관리자 설정 페이지에서 다시 시도해 주세요.' })
      if (!env.SERVER_SETTINGS_ADMIN_TOKEN) {
        return reply(response, 503, { error: '서버의 Supabase 저장 키가 없어 저장할 수 없어요.' })
      }
      const patch = await readJsonBody(request, 1024)
      if (!patch || Array.isArray(patch) || typeof patch !== 'object' || Object.keys(patch).length !== 1 || !Object.entries(patch).every(([key, value]) => ['draw', 'topics'].includes(key) && typeof value === 'boolean')) {
        return reply(response, 400, { error: '변경할 설정 하나를 선택해 주세요.' })
      }
      // 변경한 필드만 저장해 다른 관리 창에서 바꾼 설정을 덮어쓰지 않는다.
      const [key, enabled] = Object.entries(patch)[0]
      const { data, error } = await request.adminDb.rpc('set_talkconcert_setting', {
        p_key: key, p_enabled: enabled, p_token: env.SERVER_SETTINGS_ADMIN_TOKEN,
      }).single()
      if (error || !data) return reply(response, 502, { error: 'Supabase 저장 결과를 확인하지 못했어요. 잠시 후 다시 확인해 주세요.' })
      return reply(response, 200, data)
    } catch (error) {
      if ([400, 413].includes(error.status)) return reply(response, error.status, { error: error.message })
      return reply(response, 502, { error: 'Supabase 연결에 실패했어요. 잠시 후 다시 시도해 주세요.' })
    }
  }
}
