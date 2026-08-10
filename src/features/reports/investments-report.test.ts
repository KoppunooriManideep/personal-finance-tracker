import { describe, it, expect } from 'vitest'
import { buildInvestmentsReport } from './investments-report'
import type { GoldReportSlice } from './gold-report'
import type { MarketPortfolioSummary } from '@/features/investments/market-math'

const gold = (over: Partial<GoldReportSlice> = {}): GoldReportSlice => ({
  count: 1,
  boughtCount: 0,
  boughtSpentPaise: 0,
  boughtWeightMg: 0,
  investedPaise: 1_000_000,
  currentValuePaise: 1_200_000,
  gainPaise: 200_000,
  gainPct: 20,
  totalWeightMg: 8000,
  hasRate: true,
  ...over,
})

const market = (
  over: Partial<MarketPortfolioSummary> = {},
): MarketPortfolioSummary => ({
  count: 1,
  investedPaise: 0,
  currentValuePaise: 0,
  gainPaise: 0,
  gainPct: null,
  pricedCount: 0,
  dayChangePaise: 0,
  dayChangePct: null,
  ...over,
})

describe('buildInvestmentsReport', () => {
  it('includes only classes with holdings and totals them', () => {
    const r = buildInvestmentsReport(
      gold(),
      market({ investedPaise: 5_000_000, currentValuePaise: 6_000_000, gainPaise: 1_000_000, gainPct: 20, pricedCount: 3 }),
      market(), // no MF holdings
      1_000_000, // PF projected
    )
    expect(r.rows.map((x) => x.key)).toEqual(['gold', 'stocks', 'pf'])
    expect(r.totalInvestedPaise).toBe(7_000_000)
    expect(r.totalCurrentPaise).toBe(8_200_000)
    expect(r.totalGainPaise).toBe(1_200_000) // PF adds equally to invested + current
    expect(r.rows.find((x) => x.key === 'pf')?.gainPct).toBeNull()
  })

  it('marks an unpriced class and treats current as cost', () => {
    const r = buildInvestmentsReport(
      gold({ investedPaise: 0, currentValuePaise: 0 }), // no gold
      market({ investedPaise: 5_000_000, currentValuePaise: 5_000_000, pricedCount: 0 }),
      market(),
      0,
    )
    const stocks = r.rows.find((x) => x.key === 'stocks')!
    expect(stocks.priced).toBe(false)
    expect(stocks.gainPct).toBeNull()
    expect(r.totalCurrentPaise).toBe(5_000_000)
  })

  it('reports nothing when there are no holdings', () => {
    const r = buildInvestmentsReport(
      gold({ investedPaise: 0 }),
      market(),
      market(),
      0,
    )
    expect(r.hasAny).toBe(false)
  })
})
