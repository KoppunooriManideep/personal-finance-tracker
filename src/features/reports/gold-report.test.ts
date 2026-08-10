import { describe, it, expect } from 'vitest'
import { aggregateGoldForReport } from './gold-report'
import type { GoldHolding } from '@/features/investments/api/gold-queries'

function gold(overrides: Partial<GoldHolding> = {}): GoldHolding {
  return {
    id: 'g1',
    ownerId: null,
    form: 'coin',
    name: null,
    fineness: 999,
    weightMg: 1000,
    quantity: 1,
    purchaseDate: '2026-07-10',
    priceTotalPaise: 0,
    cashbackPaise: 0,
    rewardValuePaise: 0,
    voucherSavingsPaise: 0,
    makingChargesPaise: 0,
    vaPaise: 0,
    stoneChargesPaise: 0,
    gstPercent: 0,
    discountPaise: 0,
    website: null,
    brand: null,
    notes: null,
    tags: [],
    ...overrides,
  }
}

// spot = ₹9,990/g → value in paise = weightMg × fineness (keeps assertions exact).
const SPOT = 999_000

describe('aggregateGoldForReport', () => {
  const holdings = [
    gold({ id: 'a', ownerId: 'alice', weightMg: 8000, priceTotalPaise: 5_000_000, purchaseDate: '2026-07-10' }),
    gold({ id: 'b', ownerId: 'bob', weightMg: 10_000, priceTotalPaise: 6_000_000, purchaseDate: '2026-05-02' }),
  ]

  it('counts only holdings bought within the period', () => {
    const r = aggregateGoldForReport(holdings, {
      periodKeys: ['2026-07'],
      selectedOwnerId: null,
      spotPaisePerGram: SPOT,
    })
    expect(r.boughtCount).toBe(1)
    expect(r.boughtSpentPaise).toBe(5_000_000)
    expect(r.boughtWeightMg).toBe(8000)
  })

  it('reports the full current snapshot regardless of period', () => {
    const r = aggregateGoldForReport(holdings, {
      periodKeys: ['2026-07'],
      selectedOwnerId: null,
      spotPaisePerGram: SPOT,
    })
    expect(r.count).toBe(2)
    expect(r.investedPaise).toBe(11_000_000)
    expect(r.currentValuePaise).toBe(17_982_000) // 8000×999 + 10000×999
    expect(r.hasRate).toBe(true)
  })

  it('scopes to the selected owner', () => {
    const r = aggregateGoldForReport(holdings, {
      periodKeys: ['2026-07'],
      selectedOwnerId: 'alice',
      spotPaisePerGram: SPOT,
    })
    expect(r.count).toBe(1)
    expect(r.investedPaise).toBe(5_000_000)
    expect(r.boughtCount).toBe(1)
  })

  it('flags an unknown rate', () => {
    const r = aggregateGoldForReport(holdings, {
      periodKeys: ['2026-07'],
      selectedOwnerId: null,
      spotPaisePerGram: 0,
    })
    expect(r.hasRate).toBe(false)
    expect(r.currentValuePaise).toBe(0)
  })
})
