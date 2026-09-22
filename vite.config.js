import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import { createHash } from 'node:crypto'
import path from 'path'
import fapshiHandler from './api/fapshi.js'
import financeHandler from './api/finance.js'
import translateHandler from './api/translate.js'

function fapshiDevApi() {
  return {
    name: 'carenest-fapshi-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/finance', (req, res) => {
        const chunks = []
        req.on('data', (chunk) => chunks.push(chunk))
        req.on('end', async () => {
          try { req.body = JSON.parse(Buffer.concat(chunks).toString() || '{}') } catch { req.body = {} }
          await financeHandler(req, res)
        })
      })
      server.middlewares.use('/api/translate', (req, res) => {
        const chunks = []
        req.on('data', (chunk) => chunks.push(chunk))
        req.on('end', async () => {
          try {
            req.body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {}
          } catch {
            req.body = {}
          }
          try {
            await translateHandler(req, res)
          } catch {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Translation development API error.' }))
          }
        })
      })
      server.middlewares.use('/api/payments', (req, res) => {
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

function versionedServiceWorker() {
  return {
    name: 'versioned-service-worker',
    writeBundle(output, bundle) {
      const source = fs.readFileSync('public/sw.js', 'utf8')
      const version = createHash('sha256').update(source + Object.keys(bundle).sort().join('|')).digest('hex').slice(0, 16)
      fs.writeFileSync(path.join(output.dir || 'dist', 'sw.js'), source.replaceAll('__BUILD_ID__', version))
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  Object.assign(process.env, env)
  const appVersion = env.VITE_APP_VERSION || process.env.npm_package_version || '0.0.0'

  return {
    plugins: [react(), fapshiDevApi(), versionedServiceWorker()],
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
