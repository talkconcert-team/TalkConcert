import { createAuthMiddleware } from './authApi.js'
import { createBoardMiddleware } from './boardApi.js'
import { createSettingsMiddleware } from './settingsApi.js'
import { createDrawMiddleware } from './drawApi.js'
import { createOwnershipMiddleware } from './ownershipApi.js'

// 개발 서버와 배포 함수가 같은 인증·저장 코드를 사용한다.
export function createApiHandler(env) {
  const middlewares = [createAuthMiddleware(env), createSettingsMiddleware(env), createBoardMiddleware(env), createDrawMiddleware(env), createOwnershipMiddleware(env)]
  return async (request, response) => {
    try {
      const run = async (index) => {
        if (index < middlewares.length) return middlewares[index](request, response, () => run(index + 1))
        response.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
        response.end(JSON.stringify({ error: '존재하지 않는 API예요.' }))
      }
      await run(0)
    } catch {
      if (response.headersSent) return response.end()
      response.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
      response.end(JSON.stringify({ error: '서버 요청을 처리하지 못했어요.' }))
    }
  }
}
