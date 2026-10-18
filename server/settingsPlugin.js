import { loadEnv } from 'vite'
import { createSettingsMiddleware } from './settingsApi.js'
import { createBoardMiddleware } from './boardApi.js'
import { createAuthMiddleware } from './authApi.js'

export default function settingsPlugin() {
  let env
  return {
    name: 'talkconcert-local-settings-api',
    configResolved(config) {
      env = loadEnv(config.mode, config.envDir, ['SUPABASE_', 'SERVER_SETTINGS_'])
    },
    configureServer(server) {
      server.middlewares.use(createAuthMiddleware(env))
      server.middlewares.use(createSettingsMiddleware(env))
      server.middlewares.use(createBoardMiddleware(env))
    },
    configurePreviewServer(server) {
      server.middlewares.use(createAuthMiddleware(env))
      server.middlewares.use(createSettingsMiddleware(env))
      server.middlewares.use(createBoardMiddleware(env))
    },
  }
}
