import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In production, files in /api are Vercel Functions. This serves the same
// handlers during `npm run dev` so features like the D&D Beyond import
// work locally too.
function localApi() {
  return {
    name: 'local-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost')
        if (url.pathname !== '/api/ddb-character' || req.method !== 'GET') return next()
        try {
          const { GET } = await server.ssrLoadModule('/api/ddb-character.js')
          const response = await GET(new Request(url))
          res.statusCode = response.status
          response.headers.forEach((value, key) => res.setHeader(key, value))
          res.end(await response.text())
        } catch (err) {
          next(err)
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), localApi()],
})
