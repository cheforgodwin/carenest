function ensureResponseHelpers(res) {
  if (typeof res.status !== 'function') {
    res.status = function (code) {
      this.statusCode = code
      return this
    }
  }

  if (typeof res.json !== 'function') {
    res.json = function (payload) {
      this.setHeader('Content-Type', 'application/json')
      this.end(typeof payload === 'string' ? payload : JSON.stringify(payload))
      return this
    }
  }

  if (typeof res.send !== 'function') {
    res.send = function (payload) {
      if (typeof payload === 'object') {
        this.setHeader('Content-Type', 'application/json')
        this.end(JSON.stringify(payload))
      } else {
        this.end(String(payload))
      }
      return this
    }
  }

  return res
}

export default async function handler(req, res) {
  ensureResponseHelpers(res)
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed. Use POST.' })
  }

  const mode = String(process.env.FAPSHI_MODE || 'sandbox').trim()
  const sandboxUrl = String(process.env.FAPSHI_SANDBOX_API_URL || '').trim()
  const sandboxUser = String(process.env.FAPSHI_SANDBOX_API_USER || '').trim()
  const sandboxKey = String(process.env.FAPSHI_SANDBOX_SECRET_KEY || '').trim()
  const liveUrl = String(process.env.FAPSHI_LIVE_API_URL || '').trim()
  const liveUser = String(process.env.FAPSHI_LIVE_API_USER || '').trim()
  const liveKey = String(process.env.FAPSHI_LIVE_SECRET_KEY || '').trim()

  const apiUrl = mode === 'live' ? liveUrl : sandboxUrl
  const apiUser = mode === 'live' ? liveUser : sandboxUser
  const apiKey = mode === 'live' ? liveKey : sandboxKey

  if (!apiUrl || !apiUser || !apiKey) {
    return res.status(500).json({
      error: 'Missing FAPSHI configuration. Set FAPSHI_MODE and the corresponding API URL, API user, and API key on the server.',
      mode,
    })
  }

  const payload = req.body || {}
  const order = payload.order || {}
  const fapshiPayload = {
    amount: order.amount || payload.amount || 0,
    email: order.customerEmail || payload.email || '',
    userId: order.customerUid || payload.userId || order.id || '',
    metadata: {
      customerName: order.customerName || payload.customerName,
      service: order.service || payload.service,
      serviceType: order.serviceType || payload.serviceType,
      paymentMethod: order.paymentMethod || payload.paymentMethod,
    },
  }

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apiuser: apiUser,
        apikey: apiKey,
      },
      body: JSON.stringify(fapshiPayload),
    })

    const data = await response.text()
    const parsed = data ? JSON.parse(data) : {}

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Fapshi request failed.',
        status: response.status,
        details: parsed,
      })
    }

    return res.status(200).json(parsed)
  } catch (error) {
    return res.status(500).json({
      error: 'Fapshi proxy error.',
      details: String(error),
    })
  }
}
