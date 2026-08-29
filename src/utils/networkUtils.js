export async function postJson(url, body, { timeoutMs = 30000 } = {}) {
  if (!navigator.onLine) {
    throw new Error('You are offline. Reconnect before making a payment.')
  }

  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const result = await response.json().catch(() => null)
    if (!response.ok) {
      throw new Error(result?.error || 'The service could not complete your request.')
    }
    return result
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('The connection is taking too long. Check your network and try again.', { cause: error })
    }
    if (error instanceof TypeError) {
      throw new Error('The network request failed. Check your connection and try again.', { cause: error })
    }
    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }
}
