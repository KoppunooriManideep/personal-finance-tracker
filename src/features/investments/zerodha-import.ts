/**
 * Parser for Zerodha Console holdings exports (stocks and mutual funds).
 *
 * Pure + unit-tested. Both exports share the columns we need — Symbol, ISIN,
 * Quantity Available, Average Price — but differ elsewhere (stocks have Sector +
 * several quantity columns; MFs have Instrument Type). We match columns BY HEADER
 * NAME, not position, so one parser handles both and tolerates extra columns.
 *
 * ISIN is the universal id: INF… = mutual fund, INE… = equity/stock.
 */
import type { MarketHoldingKind } from '@/types/database.types'

export interface ParsedMarketHolding {
  kind: MarketHoldingKind
  isin: string
  /** Trading symbol (stock) or fund name (MF). */
  symbol: string
  quantity: number
  /** Average buy price per unit, in paise. */
  avgPricePaise: number
}

export interface ZerodhaImportResult {
  holdings: ParsedMarketHolding[]
  /** Rows skipped (blank, zero qty, or unrecognised ISIN). */
  skipped: number
  /** Set when the file couldn't be parsed at all. */
  error?: string
}

/** Split one delimited line, honouring RFC-4180 double-quoted fields. */
function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = []
  let cell = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cell += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === delimiter) {
      cells.push(cell)
      cell = ''
    } else {
      cell += char
    }
  }
  cells.push(cell)
  return cells
}

const count = (line: string, char: string) =>
  line.split(char).length - 1

/** Parse a rupee/number cell that may contain thousands separators. */
function parseNumber(value: string | undefined): number {
  return Number((value ?? '').replace(/,/g, '').trim())
}

/**
 * Parse a Zerodha holdings export (CSV or tab-separated) into market holdings.
 * Skips rows without a valid ISIN or a positive quantity.
 */
export function parseZerodhaHoldings(text: string): ZerodhaImportResult {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '')
  if (lines.length < 2) {
    return { holdings: [], skipped: 0, error: 'No data rows found in the file.' }
  }

  const delimiter = count(lines[0], '\t') > count(lines[0], ',') ? '\t' : ','
  const header = splitLine(lines[0], delimiter).map((h) =>
    h.trim().toLowerCase(),
  )

  const indexOf = (predicate: (h: string) => boolean) =>
    header.findIndex(predicate)

  const isinIdx = indexOf((h) => h.includes('isin'))
  const symbolIdx = indexOf((h) => h === 'symbol' || h.includes('symbol'))
  // Prefer "Quantity Available"; fall back to the first "quantity" column.
  const qtyIdx =
    indexOf((h) => h.includes('quantity available')) >= 0
      ? indexOf((h) => h.includes('quantity available'))
      : indexOf((h) => h.includes('quantity'))
  const avgIdx =
    indexOf((h) => h.includes('average price')) >= 0
      ? indexOf((h) => h.includes('average price'))
      : indexOf((h) => h.includes('avg'))

  if (isinIdx < 0 || symbolIdx < 0 || qtyIdx < 0 || avgIdx < 0) {
    return {
      holdings: [],
      skipped: 0,
      error:
        'Missing required columns. Expected Symbol, ISIN, Quantity Available and Average Price.',
    }
  }

  const holdings: ParsedMarketHolding[] = []
  let skipped = 0

  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i], delimiter)
    const isin = (cells[isinIdx] ?? '').trim().toUpperCase()
    const symbol = (cells[symbolIdx] ?? '').trim()
    const quantity = parseNumber(cells[qtyIdx])
    const avgPrice = parseNumber(cells[avgIdx])

    const kind: MarketHoldingKind | null = isin.startsWith('INF')
      ? 'mutual_fund'
      : isin.startsWith('INE')
        ? 'stock'
        : null

    if (
      !kind ||
      !symbol ||
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      !Number.isFinite(avgPrice) ||
      avgPrice < 0
    ) {
      skipped++
      continue
    }

    holdings.push({
      kind,
      isin,
      symbol,
      quantity,
      avgPricePaise: Math.round(avgPrice * 100),
    })
  }

  return { holdings, skipped }
}

/** Invested amount (paise) for a parsed row: avg price × quantity. */
export function investedPaiseOf(row: ParsedMarketHolding): number {
  return Math.round((row.avgPricePaise * row.quantity))
}
