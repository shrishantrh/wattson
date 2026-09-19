import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base './' so the built site works from any static path (GitHub Pages, a USB stick, a laptop)
export default defineConfig({ plugins: [react()], base: './' })
