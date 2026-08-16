import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import fapshiHandler from './api/fapshi.js'

function fapshiDevApi() {
  return {
    name: 'carenest-fapshi-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/fapshi', (req, res) => {
        const chunks = []

        req.on('data', (chunk) => chunks.push(chunk))
        req.on('end', async () => {
          try {
            req.body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {}
          } catch {
            req.body = {}
          }

          try {
            await fapshiHandler(req, res)
          } catch (error) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Fapshi development API error.', details: String(error) }))
          }
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const appVersion = env.VITE_APP_VERSION || process.env.npm_package_version || '0.0.0'

  return {
    plugins: [react(), fapshiDevApi()],
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
    },
    build: {
      // Chunk splitting strategy
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            // Vendor chunks
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom')) {
              return 'vendor-react'
            }
            if (id.includes('node_modules/firebase')) {
              return 'vendor-firebase'
            }
            if (id.includes('node_modules/react-icons')) {
              return 'vendor-icons'
            }
          },
        },
      },
      // Reduce chunk size threshold warnings
      chunkSizeWarningLimit: 1000,
    },
    // Optimize dependencies
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-router-dom', 'firebase', 'react-icons'],
    },
  }
})
