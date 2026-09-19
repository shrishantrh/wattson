import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base './' so the static export works from any path (GitHub Pages, a USB stick, a laptop).
export default defineConfig({ plugins: [react()], base: './', server: { port: 5174 } })
