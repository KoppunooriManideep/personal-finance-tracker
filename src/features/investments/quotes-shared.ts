/**
 * Shared quote logic for stocks & mutual funds. Deliberately dependency-free (no
 * `@/` or relative imports) so it can be pulled into the Vercel Edge function,
 * the Vite dev middleware AND the client without module-resolution friction.
 *
 * - Mutual funds: NAV by ISIN from AMFI's daily NAVAll.txt (free, reliable).
 * - Stocks: quote from Yahoo Finance's chart endpoint (unofficial, best-effort).
 */

export type QuoteKind = 'stock' | 'mutual_fund'

export interface QuoteItem {
  kind: QuoteKind
  isin: string | null
  symbol: string
  exchange: string | null
}

export interface QuotesPayload {
  /** key → price in paise per unit (null = unknown). */
  quotes: Record<string, number | null>
  /** key → previous close in paise (for day's P&L); null when unavailable. */
  prevCloses: Record<string, number | null>
  /** key → resolved display name (company / scheme). */
  names: Record<string, string>
  fetchedAt: string
}

const AMFI_URL = 'https://www.amfiindia.com/spages/NAVAll.txt'
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36'

// NSE trade series suffixes (…-EQ, …-BE, …-T for trade-to-trade, etc.). Zerodha
// appends these to the symbol, but Yahoo wants the base ticker. Only these short
// known codes are stripped, so real hyphenated symbols (e.g. BAJAJ-AUTO) survive.
const NSE_SERIES_SUFFIX = /-(EQ|BE|BZ|BL|IL|GC|GB|SM|ST|GS|T|N[0-9])$/

/** Base NSE/BSE symbol with any trade-series suffix removed. */
export function baseSymbol(symbol: string): string {
  return symbol.trim().toUpperCase().replace(NSE_SERIES_SUFFIX, '')
}

/** Yahoo Finance ticker for a symbol (NSE → .NS, BSE → .BO). */
export function yahooTicker(symbol: string, exchange: string | null): string {
  const suffix = exchange === 'BSE' ? '.BO' : '.NS'
  return `${baseSymbol(symbol)}${suffix}`
}

/** Stable key for a holding's quote (MF by ISIN, stock by symbol). */
export function quoteKey(
  kind: QuoteKind,
  isin: string | null,
  symbol: string,
): string {
  return kind === 'mutual_fund'
    ? `mf:${(isin ?? symbol).trim().toUpperCase()}`
    : `stk:${symbol.trim().toUpperCase()}`
}

/** Parse AMFI NAVAll.txt (semicolon-delimited) into ISIN → { navPaise, name }. */
export function parseAmfiNav(
  text: string,
): Map<string, { navPaise: number; name: string }> {
  const map = new Map<string, { navPaise: number; name: string }>()
  for (const line of text.split(/\r?\n/)) {
    const parts = line.split(';')
    if (parts.length < 5) continue
    const name = (parts[3] ?? '').trim()
    const nav = Number((parts[4] ?? '').trim())
    if (!Number.isFinite(nav) || nav <= 0) continue
    const navPaise = Math.round(nav * 100)
    for (const raw of [parts[1], parts[2]]) {
      const isin = (raw ?? '').trim().toUpperCase()
      if (isin.startsWith('INF')) map.set(isin, { navPaise, name })
    }
  }
  return map
}

const toPaise = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.round(value * 100)
    : null

/** Extract price + previous close (paise) + name from a Yahoo chart response. */
export function parseYahooPrice(json: unknown): {
  pricePaise: number | null
  prevClosePaise: number | null
  name?: string
} {
  const meta = (json as YahooChart)?.chart?.result?.[0]?.meta
  return {
    pricePaise: toPaise(meta?.regularMarketPrice),
    prevClosePaise: toPaise(meta?.previousClose ?? meta?.chartPreviousClose),
    name: meta?.longName || meta?.shortName || undefined,
  }
}

interface YahooChart {
  chart?: {
    result?: {
      meta?: {
        regularMarketPrice?: number
        previousClose?: number
        chartPreviousClose?: number
        longName?: string
        shortName?: string
      }
    }[]
  }
}

/**
 * Fetch live prices for a set of holdings. MF NAVs come from one AMFI file
 * fetch; stock quotes are fetched from Yahoo in parallel. Any failure yields a
 * null price for that holding rather than throwing.
 */
export async function resolveQuotes(items: QuoteItem[]): Promise<{
  quotes: Record<string, number | null>
  prevCloses: Record<string, number | null>
  names: Record<string, string>
}> {
  const quotes: Record<string, number | null> = {}
  const prevCloses: Record<string, number | null> = {}
  const names: Record<string, string> = {}

  const mfItems = items.filter((i) => i.kind === 'mutual_fund')
  const stockItems = items.filter((i) => i.kind === 'stock')

  if (mfItems.length > 0) {
    let navByIsin = new Map<string, { navPaise: number; name: string }>()
    try {
      const res = await fetch(AMFI_URL, { headers: { 'user-agent': BROWSER_UA } })
      if (res.ok) navByIsin = parseAmfiNav(await res.text())
    } catch {
      // Leave the map empty → all MF quotes null.
    }
    for (const item of mfItems) {
      const key = quoteKey(item.kind, item.isin, item.symbol)
      const hit = item.isin ? navByIsin.get(item.isin.toUpperCase()) : undefined
      quotes[key] = hit?.navPaise ?? null
      prevCloses[key] = null // AMFI gives today's NAV only, no previous close
      if (hit?.name) names[key] = hit.name
    }
  }

  await Promise.all(
    stockItems.map(async (item) => {
      const key = quoteKey(item.kind, item.isin, item.symbol)
      const ticker = yahooTicker(item.symbol, item.exchange)
      try {
        const res = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1d&interval=1d`,
          { headers: { 'user-agent': BROWSER_UA } },
        )
        if (!res.ok) {
          quotes[key] = null
          prevCloses[key] = null
          return
        }
        const parsed = parseYahooPrice(await res.json())
        quotes[key] = parsed.pricePaise
        prevCloses[key] = parsed.prevClosePaise
        if (parsed.name) names[key] = parsed.name
      } catch {
        quotes[key] = null
        prevCloses[key] = null
      }
    }),
  )

  return { quotes, prevCloses, names }
}
