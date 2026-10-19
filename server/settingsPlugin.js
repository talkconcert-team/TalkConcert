import { loadEnv } from 'vite'
import { createApiHandler } from './apiHandler.js'

export default function settingsPlugin() {
  let env
  return {
    name: 'talkconcert-local-settings-api',
    configResolved(config) {
      env = loadEnv(config.mode, config.envDir, ['SUPABASE_', 'SERVER_SETTINGS_'])
    },
    configureServer(server) {
      const handler = createApiHandler(env)
      server.middlewares.use((req, res, next) => req.url?.startsWith('/api/') ? handler(req, res) : next())
    },
    configurePreviewServer(server) {
      const handler = createApiHandler(env)
      server.middlewares.use((req, res, next) => req.url?.startsWith('/api/') ? handler(req, res) : next())
    },
  }
}
