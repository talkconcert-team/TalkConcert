import { createApiHandler } from '../server/apiHandler.js'

const handle = createApiHandler(process.env)
export default function handler(request, response) {
  const url = new URL(request.url, 'http://localhost')
  const route = url.searchParams.get('route') || request.query?.route
  if (typeof route === 'string') request.url = `/api/${route}`
  return handle(request, response)
}
