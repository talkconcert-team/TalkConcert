import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import settingsPlugin from './server/settingsPlugin.js'

// https://vite.dev/config/
export default defineConfig({
  envPrefix: ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY'],
  plugins: [react(), settingsPlugin()],
  server: { host: '127.0.0.1' },
  preview: { host: '127.0.0.1' },
})
