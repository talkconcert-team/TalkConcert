import { createClient } from '@supabase/supabase-js'

function reply(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(data))
}

// 요청마다 Auth 서버의 JWT 검증과 DB 허용 목록 확인을 거친다. 클라이언트 역할 값은 믿지 않는다.
async function verifyGoogle(request, env, factory, admin) {
  const match = /^Bearer ([^\s]+)$/i.exec(request.headers.authorization || '')
  if (!match) return { status: 401, error: 'Google 로그인이 필요해요.' }
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) return { status: 503, error: '로그인 서버 연결 정보를 확인해 주세요.' }
  try {
    const db = factory(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
      global: { headers: { Authorization: `Bearer ${match[1]}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data, error } = await db.auth.getUser(match[1])
    if (error || !data?.user) return { status: 401, error: '로그인이 만료되었어요. 다시 로그인해 주세요.' }
    const allowed = await db.rpc(admin ? 'is_talkconcert_admin' : 'is_talkconcert_audience')
    if (allowed.error) return { status: 503, error: '로그인 권한을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.' }
    if (allowed.data !== true) return { status: 403, error: admin ? '관리자로 허용된 Google 계정이 아니에요.' : 'Google 계정으로 다시 로그인해 주세요.' }
    return { status: 200, db, user: data.user }
  } catch {
    return { status: 503, error: '로그인 서버에 연결하지 못했어요.' }
  }
}

export const verifyAdmin = (request, env, factory = createClient) => verifyGoogle(request, env, factory, true)
export const verifyAudience = (request, env, factory = createClient) => verifyGoogle(request, env, factory, false)

export function createAuthMiddleware(env, factory = createClient) {
  return async (request, response, next) => {
    const path = request.url?.split('?')[0]
    // 관객 보드는 공개로 읽고, 작성·이동에만 Google 세션을 요구한다.
    if (path === '/api/board' && request.method === 'GET') return next()
    const admin = path === '/api/auth/admin' || path?.startsWith('/api/admin/')
    const audience = path === '/api/auth/audience' || path === '/api/board' || path === '/api/board/ownership'
    if (!admin && !audience) return next()
    const result = await (admin ? verifyAdmin(request, env, factory) : verifyAudience(request, env, factory))
    if (result.status !== 200) return reply(response, result.status, { error: result.error })
    if (admin) { request.adminDb = result.db; request.adminUser = result.user }
    else { request.audienceDb = result.db; request.audienceUser = result.user }
    if (path === '/api/auth/admin') return reply(response, 200, { admin: true, email: result.user.email })
    if (path === '/api/auth/audience') return reply(response, 200, { audience: true })
    return next()
  }
}
