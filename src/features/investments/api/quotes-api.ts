import {
  quoteKey,
  type QuoteItem,
  type QuotesPayload,
} from '@/features/investments/quotes-shared'

/**
 * Fetch live prices for a set of holdings from our /api/quotes function.
 * Only works where the function is deployed (Vercel) or under `vite dev` (the
 * dev middleware mirrors it) — not a bare static preview.
 */
export async function fetchQuotes(items: QuoteItem[]): Promise<QuotesPayload> {
  if (items.length === 0) {
    return {
      quotes: {},
      prevCloses: {},
      names: {},
      fetchedAt: new Date().toISOString(),
    }
  }
  const response = await fetch('/api/quotes', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ items }),
  })
  if (!response.ok) {
    throw new Error(`Could not fetch prices (${response.status})`)
  }
  return response.json() as Promise<QuotesPayload>
}

export { quoteKey }
export type { QuoteItem }
