/**
 * Stocks & mutual-fund valuation.
 *
 * Pure functions only — unit-testable, mirroring gold-math.ts. Money is INTEGER
 * paise; `quantity` is a plain number (shares can be whole, MF units fractional).
 * The live price/NAV per unit (also paise) is fetched elsewhere and passed in;
 * `null` means "price unknown" (e.g. quote fetch failed) so we don't fake a value.
 */

import type { MarketHoldingKind } from '@/types/database.types'

/** The bits of a holding needed to value it. */
export interface MarketHoldingInput {
  quantity: number
  /** Total amount invested (avg price × quantity), in paise. */
  investedPaise: number
}

export interface MarketHoldingSummary {
  quantity: number
  investedPaise: number
  /** Average cost per unit, in paise (invested / quantity). */
  avgCostPaise: number
  /** Live value = quantity × price; null when the price is unknown. */
  currentValuePaise: number | null
  /** currentValue − invested; null when the price is unknown. */
  gainPaise: number | null
  gainPct: number | null
  /** Today's change = (price − prevClose) × qty; null when prevClose unknown. */
  dayChangePaise: number | null
  /** Today's change %, relative to the previous close. */
  dayChangePct: number | null
}

/** Live value of a holding at `pricePaisePerUnit`, or null if price unknown. */
export function currentValuePaise(
  h: MarketHoldingInput,
  pricePaisePerUnit: number | null,
): number | null {
  if (pricePaisePerUnit == null || pricePaisePerUnit < 0) return null
  return Math.round(h.quantity * pricePaisePerUnit)
}

/** Summarise one holding at the given live price + previous close (paise/unit). */
export function summarizeMarketHolding(
  h: MarketHoldingInput,
  pricePaisePerUnit: number | null,
  prevClosePaisePerUnit: number | null = null,
): MarketHoldingSummary {
  const current = currentValuePaise(h, pricePaisePerUnit)
  const gain = current == null ? null : current - h.investedPaise

  const dayComputable =
    pricePaisePerUnit != null && prevClosePaisePerUnit != null
  const dayChange = dayComputable
    ? Math.round((pricePaisePerUnit - prevClosePaisePerUnit) * h.quantity)
    : null

  return {
    quantity: h.quantity,
    investedPaise: h.investedPaise,
    avgCostPaise:
      h.quantity > 0 ? Math.round(h.investedPaise / h.quantity) : 0,
    currentValuePaise: current,
    gainPaise: gain,
    gainPct:
      gain != null && h.investedPaise > 0
        ? (gain / h.investedPaise) * 100
        : null,
    dayChangePaise: dayChange,
    dayChangePct:
      dayComputable && prevClosePaisePerUnit > 0
        ? ((pricePaisePerUnit - prevClosePaisePerUnit) / prevClosePaisePerUnit) *
          100
        : null,
  }
}

export interface MarketPortfolioSummary {
  count: number
  investedPaise: number
  /** Current value across holdings with a known price. */
  currentValuePaise: number
  gainPaise: number
  gainPct: number | null
  /** How many holdings had a known price (the rest are cost-only). */
  pricedCount: number
  /** Today's total P&L across holdings with a known previous close, in paise. */
  dayChangePaise: number
  /** Today's P&L %, relative to yesterday's value. Null when unavailable. */
  dayChangePct: number | null
}

/** A holding plus its resolved live price + previous close (paise per unit). */
export interface PricedHolding extends MarketHoldingInput {
  pricePaisePerUnit: number | null
  prevClosePaisePerUnit?: number | null
}

/**
 * Aggregate a set of priced holdings. `investedPaise` counts every holding;
 * `currentValuePaise` counts only those with a known price, and falls back to
 * invested for unpriced ones so the total value never understates the portfolio.
 */
export function summarizeMarketPortfolio(
  holdings: PricedHolding[],
): MarketPortfolioSummary {
  let invested = 0
  let current = 0
  let priced = 0
  let dayChange = 0
  let prevValue = 0

  for (const h of holdings) {
    invested += h.investedPaise
    const value = currentValuePaise(h, h.pricePaisePerUnit)
    if (value == null) {
      current += h.investedPaise // unknown price → assume flat, don't fake gain
    } else {
      current += value
      priced += 1
    }
    const prev = h.prevClosePaisePerUnit
    if (h.pricePaisePerUnit != null && prev != null) {
      dayChange += Math.round((h.pricePaisePerUnit - prev) * h.quantity)
      prevValue += Math.round(prev * h.quantity)
    }
  }

  const gain = current - invested
  return {
    count: holdings.length,
    investedPaise: invested,
    currentValuePaise: current,
    gainPaise: gain,
    gainPct: invested > 0 ? (gain / invested) * 100 : null,
    pricedCount: priced,
    dayChangePaise: dayChange,
    dayChangePct: prevValue > 0 ? (dayChange / prevValue) * 100 : null,
  }
}

/** Yahoo Finance ticker suffix for an exchange (NSE → .NS, BSE → .BO). */
export function yahooSymbol(symbol: string, exchange: string | null): string {
  const suffix = exchange === 'BSE' ? '.BO' : '.NS'
  return `${symbol.trim().toUpperCase()}${suffix}`
}

/** Which price source a holding uses. */
export function priceSourceFor(kind: MarketHoldingKind): 'amfi' | 'yahoo' {
  return kind === 'mutual_fund' ? 'amfi' : 'yahoo'
}
