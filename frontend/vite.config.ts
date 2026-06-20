import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// In dev, proxy the obfuscate API to the running BitMono.Web.Api (standalone http profile).
// Under Aspire orchestration the URL is injected; this is the local-dev fallback.
const apiTarget = process.env.VITE_API_URL ?? 'http://localhost:5128'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/obfuscate': { target: apiTarget, changeOrigin: true },
      '/version': { target: apiTarget, changeOrigin: true },
      '/protections': { target: apiTarget, changeOrigin: true },
    },
  },
})
