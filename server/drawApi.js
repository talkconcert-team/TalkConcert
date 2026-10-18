import { allowedRequest, sameOriginJson, readJsonBody } from './requestPolicy.js'

function reply(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  response.end(JSON.stringify(body))
}

// 당첨자를 클라이언트에서 받지 않는다. 결과 선택과 중복 방지는 DB 트랜잭션이 맡는다.
export function createDrawMiddleware(env) {
  return async (request, response, next) => {
    if (request.url?.split('?')[0] !== '/api/admin/draw') return next()
    if (!request.adminDb) return reply(response, 401, { error: '관리자 로그인이 필요해요.' })
    if (!allowedRequest(request, env)) return reply(response, 403, { error: '허용된 행사 주소에서 접속해 주세요.' })
    if (!['GET', 'POST'].includes(request.method)) {
      response.setHeader('Allow', 'GET, POST')
      return reply(response, 405, { error: '지원하지 않는 요청이에요.' })
    }
    if (!env.SERVER_SETTINGS_ADMIN_TOKEN) return reply(response, 503, { error: '서버의 추첨 저장 설정을 확인해 주세요.' })
    try {
      const args = { p_token: env.SERVER_SETTINGS_ADMIN_TOKEN }
      if (request.method === 'POST') {
        if (!sameOriginJson(request, env)) return reply(response, 403, { error: '진행 화면에서 다시 시도해 주세요.' })
        const body = await readJsonBody(request, 1024)
        if (!body || Object.keys(body).length !== 1 || typeof body.requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.requestId)) {
          return reply(response, 400, { error: '추첨 요청 정보를 확인해 주세요.' })
        }
        args.p_request_id = body.requestId
      }
      const { data, error } = await request.adminDb.rpc(request.method === 'POST' ? 'draw_talkconcert_question' : 'get_talkconcert_draw_state', args)
      if (error) {
        if (error.code === '42501') return reply(response, 403, { error: '관리자 권한을 다시 확인해 주세요.' })
        if (error.code === 'PT409') return reply(response, 409, { error: '관리자 설정에서 랜덤 추첨을 허용해 주세요.' })
        return reply(response, 502, { error: '추첨 결과를 확인하지 못했어요. 다시 누르면 같은 요청의 결과를 확인해요.' })
      }
      if (!data) return reply(response, 502, { error: '추첨 결과를 확인하지 못했어요. 다시 시도해 주세요.' })
      return reply(response, 200, data)
    } catch (error) {
      if ([400, 413].includes(error.status)) return reply(response, error.status, { error: error.message })
      return reply(response, 502, { error: '추첨 서버에 연결하지 못했어요. 같은 요청으로 다시 확인해 주세요.' })
    }
  }
}
