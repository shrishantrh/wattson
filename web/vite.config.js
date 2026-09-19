import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base './' so the static export works from any path (GitHub Pages, a USB stick, a laptop).
// Dev proxy: live FastAPI on :8000. public/api/*.json stays on Vite (bypass when URL ends in .json).
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        bypass(req) {
          const u = req.url || ''
          // Static export copies live under public/api/**.json — do not proxy those.
          if (/\.json($|\?)/.test(u)) return u
          return null
        },
      },
    },
  },
})
