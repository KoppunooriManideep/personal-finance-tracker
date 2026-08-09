import { describe, it, expect } from 'vitest'
import {
  currentValuePaise,
  effectiveCostPaise,
  pureWeightMg,
  summarizeGoldHolding,
  summarizeGoldPortfolio,
  totalWeightMg,
  type GoldHoldingInput,
} from './gold-math'

/** A gold line with sensible defaults; override per test. */
function gold(overrides: Partial<GoldHoldingInput> = {}): GoldHoldingInput {
  return {
    form: 'coin',
    fineness: 999,
    weightMg: 1000, // 1 g
    quantity: 1,
    priceTotalPaise: 0,
    cashbackPaise: 0,
    rewardValuePaise: 0,
    voucherSavingsPaise: 0,
    ...overrides,
  }
}

// A clean 24K rate: ₹9,990/g. With spot = 999000 paise/g the value of a line is
// exactly weightMg × quantity × fineness paise, which keeps assertions exact.
const SPOT = 999_000

describe('weight helpers', () => {
  it('multiplies unit weight by quantity', () => {
    expect(totalWeightMg(gold({ weightMg: 8000, quantity: 2 }))).toBe(16000)
  })

  it('scales pure content by fineness', () => {
    expect(pureWeightMg(gold({ weightMg: 16000, fineness: 916 }))).toBe(14656)
  })
})

describe('effectiveCostPaise', () => {
  it('subtracts every reward from the paid price', () => {
    const h = gold({
      priceTotalPaise: 5_000_000,
      cashbackPaise: 50_000,
      rewardValuePaise: 20_000,
      voucherSavingsPaise: 30_000,
    })
    expect(effectiveCostPaise(h)).toBe(4_900_000) // 5,000,000 − 100,000
  })
})

describe('currentValuePaise', () => {
  it('values 24K at the full rate per gram', () => {
    // 10 g of 999 at ₹9,990/g = ₹99,900
    expect(currentValuePaise(gold({ weightMg: 10_000 }), SPOT)).toBe(9_990_000)
  })

  it('scales value down by fineness for 22K', () => {
    // 1 g of 916 → 916000 paise at this rate
    expect(currentValuePaise(gold({ fineness: 916 }), SPOT)).toBe(916_000)
  })

  it('returns 0 when the rate is unknown', () => {
    expect(currentValuePaise(gold({ weightMg: 10_000 }), 0)).toBe(0)
  })
})

describe('summarizeGoldHolding', () => {
  it('computes effective cost, live value, gain and per-gram figures', () => {
    const h = gold({
      fineness: 916,
      weightMg: 8000, // 8 g, 22K
      priceTotalPaise: 5_000_000, // ₹50,000
      cashbackPaise: 50_000, // ₹500
    })
    const s = summarizeGoldHolding(h, SPOT)

    expect(s.totalWeightMg).toBe(8000)
    expect(s.pureWeightMg).toBe(7328) // 8000 × 916 / 1000
    expect(s.investedPaise).toBe(5_000_000)
    expect(s.benefitsPaise).toBe(50_000)
    expect(s.effectiveCostPaise).toBe(4_950_000)
    expect(s.currentValuePaise).toBe(7_328_000) // 8000 × 916
    expect(s.gainPaise).toBe(2_378_000)
    expect(s.gainPct as number).toBeCloseTo(48.04, 1)
    expect(s.pricePerGramPaise).toBe(625_000) // ₹6,250/g
    expect(s.effectivePerGramPaise).toBe(618_750)
  })

  it('reports a null gain % when nothing was effectively spent', () => {
    const s = summarizeGoldHolding(gold({ priceTotalPaise: 0 }), SPOT)
    expect(s.gainPct).toBeNull()
  })
})

describe('summarizeGoldPortfolio', () => {
  const holdings = [
    gold({ form: 'bar', fineness: 999, weightMg: 10_000, priceTotalPaise: 6_000_000 }),
    gold({ form: 'coin', fineness: 916, weightMg: 8000, priceTotalPaise: 5_000_000, cashbackPaise: 50_000 }),
  ]

  it('aggregates totals across holdings', () => {
    const p = summarizeGoldPortfolio(holdings, SPOT)
    expect(p.count).toBe(2)
    expect(p.totalWeightMg).toBe(18_000)
    expect(p.investedPaise).toBe(11_000_000)
    expect(p.benefitsPaise).toBe(50_000)
    expect(p.effectiveCostPaise).toBe(10_950_000)
    expect(p.currentValuePaise).toBe(17_318_000) // 9,990,000 + 7,328,000
    expect(p.gainPaise).toBe(6_368_000)
  })

  it('breaks allocation down by form, largest value first', () => {
    const p = summarizeGoldPortfolio(holdings, SPOT)
    expect(p.byForm.map((s) => s.key)).toEqual(['bar', 'coin'])
    expect(p.byForm[0].currentValuePaise).toBe(9_990_000)
    expect(p.byForm[0].pct).toBeCloseTo(57.69, 1)
    expect(p.byForm[1].pct).toBeCloseTo(42.31, 1)
  })

  it('breaks allocation down by purity (fineness key)', () => {
    const p = summarizeGoldPortfolio(holdings, SPOT)
    expect(p.byPurity.map((s) => s.key)).toEqual(['999', '916'])
  })

  it('sums percentages to ~100 across a non-empty portfolio', () => {
    const p = summarizeGoldPortfolio(holdings, SPOT)
    const total = p.byForm.reduce((sum, s) => sum + s.pct, 0)
    expect(total).toBeCloseTo(100, 6)
  })
})
