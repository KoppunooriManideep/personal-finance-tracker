/**
 * POST /api/quotes — live prices for a set of stock/MF holdings.
 *
 * Body: { items: [{ kind, isin, symbol, exchange }] }
 * Returns: { quotes: { key: paise|null }, names: { key: string }, fetchedAt }
 *
 * MF NAVs come from AMFI (by ISIN); stock quotes from Yahoo (by symbol). Parsing
 * + fetching lives in the shared, unit-tested quotes module. Edge runtime.
 */
import {
  resolveQuotes,
  type QuoteItem,
} from '../src/features/investments/quotes-shared'

export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  let items: QuoteItem[] = []
  try {
    const body = (await req.json()) as { items?: QuoteItem[] }
    if (Array.isArray(body?.items)) items = body.items
  } catch {
    // Bad/empty body → treat as no items.
  }

  const { quotes, prevCloses, names } = await resolveQuotes(items)

  return new Response(
    JSON.stringify({
      quotes,
      prevCloses,
      names,
      fetchedAt: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      },
    },
  )
}
