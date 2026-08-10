import { useQuery } from '@tanstack/react-query'
import { fetchQuotes, quoteKey } from '@/features/investments/api/quotes-api'
import type { MarketHolding } from '@/features/investments/api/market-queries'

/**
 * Fetch live prices for the given holdings. Keyed by the set of quote keys so it
 * caches per unique portfolio and refetches when holdings change. Prices are
 * volatile, so a 5-minute staleTime avoids hammering the endpoint.
 */
export function useMarketQuotes(holdings: MarketHolding[]) {
  const items = holdings.map((h) => ({
    kind: h.kind,
    isin: h.isin,
    symbol: h.symbol,
    exchange: h.exchange,
  }))
  const keys = [...new Set(items.map((i) => quoteKey(i.kind, i.isin, i.symbol)))].sort()

  return useQuery({
    queryKey: ['market-quotes', keys],
    queryFn: () => fetchQuotes(items),
    enabled: items.length > 0,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}
