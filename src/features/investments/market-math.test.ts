import { describe, it, expect } from 'vitest'
import {
  summarizeMarketHolding,
  summarizeMarketPortfolio,
  yahooSymbol,
  priceSourceFor,
} from './market-math'

describe('summarizeMarketHolding', () => {
  it('computes avg cost, live value and gain', () => {
    // 10 shares, invested ₹24,505 (avg ₹2450.50), live ₹2600 → +₹1495
    const s = summarizeMarketHolding(
      { quantity: 10, investedPaise: 2_450_500 },
      260_000,
    )
    expect(s.avgCostPaise).toBe(245_050)
    expect(s.currentValuePaise).toBe(2_600_000)
    expect(s.gainPaise).toBe(149_500)
    expect(s.gainPct as number).toBeCloseTo(6.1, 1)
  })

  it('handles fractional MF units', () => {
    // 150.256 units, invested ₹6,806.60, NAV ₹48.00 → 150.256×4800 paise
    const s = summarizeMarketHolding(
      { quantity: 150.256, investedPaise: 680_660 },
      4_800,
    )
    expect(s.currentValuePaise).toBe(Math.round(150.256 * 4_800))
  })

  it('returns nulls when the price is unknown', () => {
    const s = summarizeMarketHolding({ quantity: 5, investedPaise: 100_000 }, null)
    expect(s.currentValuePaise).toBeNull()
    expect(s.gainPaise).toBeNull()
    expect(s.gainPct).toBeNull()
    expect(s.avgCostPaise).toBe(20_000)
  })

  it("computes today's change from the previous close", () => {
    // 10 shares, price ₹7435 vs prev close ₹7450 → −₹15/sh × 10 = −₹150
    const s = summarizeMarketHolding(
      { quantity: 10, investedPaise: 2_450_500 },
      743_500,
      745_000,
    )
    expect(s.dayChangePaise).toBe(-15_000)
    expect(s.dayChangePct as number).toBeCloseTo(-0.2, 2)
  })

  it('leaves day change null when previous close is unknown', () => {
    const s = summarizeMarketHolding({ quantity: 10, investedPaise: 100 }, 260_000)
    expect(s.dayChangePaise).toBeNull()
    expect(s.dayChangePct).toBeNull()
  })
})

describe('summarizeMarketPortfolio', () => {
  it('sums invested and value, counting priced vs unpriced', () => {
    const p = summarizeMarketPortfolio([
      { quantity: 10, investedPaise: 2_450_500, pricePaisePerUnit: 260_000 },
      { quantity: 5, investedPaise: 1_800_000, pricePaisePerUnit: null }, // unknown
    ])
    expect(p.count).toBe(2)
    expect(p.pricedCount).toBe(1)
    expect(p.investedPaise).toBe(4_250_500)
    // priced: 2,600,000 ; unpriced falls back to its invested 1,800,000
    expect(p.currentValuePaise).toBe(4_400_000)
    expect(p.gainPaise).toBe(149_500)
  })

  it('gives a null gain % for an empty portfolio', () => {
    expect(summarizeMarketPortfolio([]).gainPct).toBeNull()
  })
})

describe('yahooSymbol', () => {
  it('suffixes NSE with .NS and BSE with .BO', () => {
    expect(yahooSymbol('reliance', 'NSE')).toBe('RELIANCE.NS')
    expect(yahooSymbol('AMBER', 'BSE')).toBe('AMBER.BO')
    expect(yahooSymbol('TCS', null)).toBe('TCS.NS') // default NSE
  })
})

describe('priceSourceFor', () => {
  it('routes MFs to AMFI and stocks to Yahoo', () => {
    expect(priceSourceFor('mutual_fund')).toBe('amfi')
    expect(priceSourceFor('stock')).toBe('yahoo')
  })
})
