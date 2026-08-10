import type { GoldReportSlice } from '@/features/reports/gold-report'
import type { MarketPortfolioSummary } from '@/features/investments/market-math'

/** One asset class's snapshot for the investments report table. */
export interface InvestmentClassRow {
  key: string
  label: string
  color: string
  investedPaise: number
  /** Current value (falls back to invested when the price is unknown). */
  currentValuePaise: number
  gainPaise: number
  gainPct: number | null
  /** Whether a live price was available (else current/gain are cost-only). */
  priced: boolean
}

export interface InvestmentsReport {
  /** Only classes the family actually holds (invested > 0). */
  rows: InvestmentClassRow[]
  totalInvestedPaise: number
  totalCurrentPaise: number
  totalGainPaise: number
  totalGainPct: number | null
  hasAny: boolean
}

/**
 * Combine the gold snapshot + stock/MF portfolios into one report table. Gold's
 * "invested" is its effective cost; stocks/MF use amount invested. All values
 * are point-in-time (a portfolio's worth doesn't depend on the report period).
 */
export function buildInvestmentsReport(
  gold: GoldReportSlice,
  stock: MarketPortfolioSummary,
  mf: MarketPortfolioSummary,
): InvestmentsReport {
  const rows: InvestmentClassRow[] = []

  if (gold.investedPaise > 0) {
    rows.push({
      key: 'gold',
      label: 'Gold',
      color: '#d4a017',
      investedPaise: gold.investedPaise,
      currentValuePaise: gold.hasRate
        ? gold.currentValuePaise
        : gold.investedPaise,
      gainPaise: gold.hasRate ? gold.gainPaise : 0,
      gainPct: gold.hasRate ? gold.gainPct : null,
      priced: gold.hasRate,
    })
  }

  const market: [string, string, string, MarketPortfolioSummary][] = [
    ['stocks', 'Stocks', '#3b82f6', stock],
    ['mutual-funds', 'Mutual Funds', '#8b5cf6', mf],
  ]
  for (const [key, label, color, p] of market) {
    if (p.investedPaise <= 0) continue
    const priced = p.pricedCount > 0
    rows.push({
      key,
      label,
      color,
      investedPaise: p.investedPaise,
      currentValuePaise: p.currentValuePaise,
      gainPaise: priced ? p.gainPaise : 0,
      gainPct: priced ? p.gainPct : null,
      priced,
    })
  }

  const totalInvestedPaise = rows.reduce((s, r) => s + r.investedPaise, 0)
  const totalCurrentPaise = rows.reduce((s, r) => s + r.currentValuePaise, 0)
  const totalGainPaise = totalCurrentPaise - totalInvestedPaise

  return {
    rows,
    totalInvestedPaise,
    totalCurrentPaise,
    totalGainPaise,
    totalGainPct:
      totalInvestedPaise > 0
        ? (totalGainPaise / totalInvestedPaise) * 100
        : null,
    hasAny: rows.length > 0,
  }
}
