import http from 'node:http'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const apiPath = path.resolve(projectRoot, 'api', 'fapshi.js')

function loadDotEnvFile(envFilePath) {
  if (!fs.existsSync(envFilePath)) return
  const contents = fs.readFileSync(envFilePath, 'utf8')
  contents.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    const equalIndex = trimmed.indexOf('=')
    if (equalIndex === -1) return
    const key = trimmed.slice(0, equalIndex).trim()
    let value = trimmed.slice(equalIndex + 1).trim()
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1)
    }
    if (Object.prototype.hasOwnProperty.call(process.env, key)) return
    process.env[key] = value
  })
}

loadDotEnvFile(path.resolve(projectRoot, '.env'))
if (!fs.existsSync(path.resolve(projectRoot, '.env')) && fs.existsSync(path.resolve(projectRoot, '.env.example'))) {
  console.warn('No local .env file found. Copy .env.example to .env and set the FAPSHI_* values for local testing.')
}

if (!fs.existsSync(apiPath)) {
  throw new Error(`Unable to find API handler at ${apiPath}`)
}

const { default: handler } = await import(`file://${apiPath}`)

const createResponseAdapter = (res) => {
  res.status = function (code) {
    this.statusCode = code
    return this
  }

  res.json = function (payload) {
    this.setHeader('Content-Type', 'application/json')
    this.end(typeof payload === 'string' ? payload : JSON.stringify(payload))
    return this
  }

  res.send = function (payload) {
    if (typeof payload === 'object') {
      this.setHeader('Content-Type', 'application/json')
      this.end(JSON.stringify(payload))
    } else {
      this.end(String(payload))
    }
    return this
  }

  return res
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    return res.end()
  }

  if (req.url !== '/api/fapshi' || req.method !== 'POST') {
    res.statusCode = 404
    res.setHeader('Content-Type', 'text/plain')
    return res.end('Not Found')
  }

  const rawBody = []
  req.on('data', (chunk) => rawBody.push(chunk))
  req.on('end', async () => {
    req.body = {}
    if (rawBody.length) {
      try {
        req.body = JSON.parse(Buffer.concat(rawBody).toString() || '{}')
      } catch (error) {
        req.body = {}
      }
    }

    createResponseAdapter(res)

    try {
      await handler(req, res)
    } catch (error) {
      res.status(500).json({ error: String(error) })
    }
  })
})

const port = process.env.DEV_API_PORT || 5001
server.listen(port, () => {
  console.log(`Fapshi dev API server listening on http://localhost:${port}/api/fapshi`)
})
