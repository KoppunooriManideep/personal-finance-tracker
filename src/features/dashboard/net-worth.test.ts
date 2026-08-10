import { describe, it, expect } from 'vitest'
import { buildNetWorth } from './net-worth'

describe('buildNetWorth', () => {
  it('sums components and totals positive assets separately', () => {
    const r = buildNetWorth([
      { key: 'cash', label: 'Cash & bank', color: '#0ea5e9', valuePaise: 3_20_000_00 },
      { key: 'gold', label: 'Gold', color: '#d4a017', valuePaise: 1_21_880_00 },
      { key: 'stocks', label: 'Stocks', color: '#3b82f6', valuePaise: 8_77_350_00 },
      { key: 'loans', label: 'Loans', color: '#ef4444', valuePaise: -2_00_000_00 },
    ])
    expect(r.netWorthPaise).toBe(3_20_000_00 + 1_21_880_00 + 8_77_350_00 - 2_00_000_00)
    expect(r.totalAssetsPaise).toBe(3_20_000_00 + 1_21_880_00 + 8_77_350_00)
  })

  it('drops zero components from the breakdown', () => {
    const r = buildNetWorth([
      { key: 'cash', label: 'Cash', color: '#0ea5e9', valuePaise: 100 },
      { key: 'loans', label: 'Loans', color: '#ef4444', valuePaise: 0 },
    ])
    expect(r.components.map((c) => c.key)).toEqual(['cash'])
  })

  it('handles a net-negative cash balance (credit-card dues)', () => {
    const r = buildNetWorth([
      { key: 'cash', label: 'Cash', color: '#0ea5e9', valuePaise: -50_000 },
      { key: 'gold', label: 'Gold', color: '#d4a017', valuePaise: 200_000 },
    ])
    expect(r.netWorthPaise).toBe(150_000)
    expect(r.totalAssetsPaise).toBe(200_000) // negative cash not counted as an asset
  })
})
