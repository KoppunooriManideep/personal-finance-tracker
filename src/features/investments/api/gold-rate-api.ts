/**
 * Client for the /api/gold-rate serverless function (GoodReturns scraper).
 * Only works where the function is deployed (Vercel), not in a bare `vite dev`.
 */
export interface LiveGoldRate {
  /** 24K (999) rate in paise per gram — the value we store. */
  rate24kPaise: number
  perGramRupees: {
    '24k': number
    '22k': number | null
    '18k': number | null
  }
  source: string
  /** ISO timestamp the rate was fetched. */
  fetchedAt: string
}

/** Fetch today's live gold rate from our serverless GoodReturns scraper. */
export async function fetchLiveGoldRate(): Promise<LiveGoldRate> {
  const response = await fetch('/api/gold-rate', {
    headers: { accept: 'application/json' },
  })

  if (!response.ok) {
    let message = `Gold rate request failed (${response.status})`
    try {
      const body = (await response.json()) as { error?: string }
      if (body?.error) message = body.error
    } catch {
      // Non-JSON error body (e.g. 404 in local dev) — keep the generic message.
    }
    throw new Error(message)
  }

  const data = (await response.json()) as LiveGoldRate
  if (typeof data?.rate24kPaise !== 'number' || data.rate24kPaise <= 0) {
    throw new Error('Unexpected gold rate response')
  }
  return data
}
