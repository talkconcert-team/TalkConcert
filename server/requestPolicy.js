// 로컬에서는 루프백만, Vercel에서는 서버 환경변수에 등록된 HTTPS 도메인만 받는다.
export function allowedRequest(request, env) {
  const host = request.headers.host
  if (typeof host !== 'string') return false
  if (env.VERCEL === '1') {
    // 기존 운영 주소와 승인한 한글 도메인을 함께 허용하며 와일드카드로 넓히지 않는다.
    const origins = [env.APP_ORIGIN, ...(env.APP_ORIGINS || '').split(',').map((value) => value.trim()), env.VERCEL_URL && `https://${env.VERCEL_URL}`, env.VERCEL_BRANCH_URL && `https://${env.VERCEL_BRANCH_URL}`, env.VERCEL_PROJECT_PRODUCTION_URL && `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`]
    return origins.some((value) => {
      try { const url = new URL(value); return url.protocol === 'https:' && url.host === host } catch { return false }
    })
  }
  try {
    return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.socket?.remoteAddress) && ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(`http://${host}`).hostname)
  } catch { return false }
}

export function sameOriginJson(request, env) {
  const origin = env.VERCEL === '1' ? `https://${request.headers.host}` : `http://${request.headers.host}`
  return allowedRequest(request, env) && request.headers.origin === origin && request.headers['content-type']?.split(';')[0] === 'application/json'
}

// Vercel은 body를 미리 해석할 수 있고 Vite는 Node 스트림을 제공한다.
export async function readJsonBody(request, limit) {
  let raw
  if (request.body !== undefined) {
    raw = Buffer.isBuffer(request.body) ? request.body : Buffer.from(typeof request.body === 'string' ? request.body : JSON.stringify(request.body))
  } else {
    const chunks = []
    let size = 0
    for await (const chunk of request) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      size += bytes.length
      if (size > limit) throw Object.assign(new Error('입력 내용이 너무 길어요.'), { status: 413 })
      chunks.push(bytes)
    }
    raw = Buffer.concat(chunks)
  }
  if (raw.length > limit) throw Object.assign(new Error('입력 내용이 너무 길어요.'), { status: 413 })
  try { return JSON.parse(raw.toString('utf8')) } catch { throw Object.assign(new Error('입력 형식을 확인해 주세요.'), { status: 400 }) }
}
