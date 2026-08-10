import { describe, it, expect } from 'vitest'
import { monthsBetween, projectPf, summarizePf } from './pf-math'

describe('monthsBetween', () => {
  it('counts whole months, not partial', () => {
    expect(monthsBetween('2026-04-01', '2026-08-10')).toBe(4)
    expect(monthsBetween('2026-04-15', '2026-08-10')).toBe(3) // day 10 < 15
    expect(monthsBetween('2026-04-01', '2026-04-30')).toBe(0)
  })

  it('is zero when the anchor is in the future', () => {
    expect(monthsBetween('2026-09-01', '2026-08-10')).toBe(0)
  })
})

describe('projectPf', () => {
  it('adds monthly contributions since the anchor', () => {
    const p = projectPf(
      {
        balancePaise: 5_00_000_00, // ₹5,00,000
        asOf: '2026-04-01',
        monthlyContributionPaise: 15_000_00, // ₹15,000/mo
        annualRatePercent: 0,
      },
      '2026-08-10',
    )
    expect(p.monthsElapsed).toBe(4)
    expect(p.contributionsPaise).toBe(60_000_00) // 4 × 15,000
    expect(p.interestPaise).toBe(0)
    expect(p.projectedBalancePaise).toBe(5_60_000_00)
  })

  it('accrues simple interest on the opening balance when a rate is set', () => {
    const p = projectPf(
      {
        balancePaise: 12_00_000_00, // ₹12,00,000
        asOf: '2026-04-01',
        monthlyContributionPaise: 0,
        annualRatePercent: 8.25,
      },
      '2026-10-01',
    )
    expect(p.monthsElapsed).toBe(6)
    // 12,00,000 × 8.25% × 6/12 = ₹49,500
    expect(p.interestPaise).toBe(49_500_00)
    expect(p.projectedBalancePaise).toBe(12_49_500_00)
  })

  it('returns the entered balance when nothing has elapsed', () => {
    const p = projectPf(
      { balancePaise: 100, asOf: '2026-08-10', monthlyContributionPaise: 50, annualRatePercent: 8 },
      '2026-08-10',
    )
    expect(p.projectedBalancePaise).toBe(100)
  })
})

describe('summarizePf', () => {
  it('sums projected balances across accounts', () => {
    const today = '2026-08-01'
    const s = summarizePf(
      [
        { balancePaise: 5_00_000_00, asOf: '2026-04-01', monthlyContributionPaise: 15_000_00, annualRatePercent: 0 },
        { balancePaise: 2_00_000_00, asOf: '2026-04-01', monthlyContributionPaise: 5_000_00, annualRatePercent: 0 },
      ],
      today,
    )
    expect(s.count).toBe(2)
    expect(s.balancePaise).toBe(7_00_000_00)
    // acc1: 5L + 4×15k = 5.6L ; acc2: 2L + 4×5k = 2.2L → 7.8L
    expect(s.projectedBalancePaise).toBe(7_80_000_00)
  })
})
