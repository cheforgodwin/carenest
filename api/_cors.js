const defaultOrigins = [
  'https://carenest237.com',
  'https://www.carenest237.com',
  'https://carenest-ashy-two.vercel.app',
  'https://carenest.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]

function allowedOrigins() {
  const configured = String(process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean)
  const vercelOrigin = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : ''
  return new Set([...defaultOrigins, ...configured, vercelOrigin].filter(Boolean))
}

export function handleCors(req, res, methods = ['POST']) {
  const origin = String(req.headers?.origin || '').trim().replace(/\/$/, '')
  const methodList = [...new Set([...methods, 'OPTIONS'])]

  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', methodList.join(', '))
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  res.setHeader('Access-Control-Max-Age', '86400')

  if (origin) {
    if (!allowedOrigins().has(origin)) {
      res.statusCode = 403
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ error: 'Origin is not allowed.' }))
      return true
    }
    res.setHeader('Access-Control-Allow-Origin', origin)
  }

  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return true
  }
  return false
}
