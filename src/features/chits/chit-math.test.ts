import { describe, it, expect } from 'vitest'
import {
  buildCashFlows,
  dateForMonth,
  projectChit,
  summarizeChit,
  xirr,
  type ChitInput,
} from './chit-math'

/** Build a chit input paying a flat monthly amount for `months` months. */
function flatChit(
  overrides: Partial<ChitInput> & { months: number; monthlyPaise: number },
): ChitInput {
  const { months, monthlyPaise, ...rest } = overrides
  return {
    chitValue: 100_000_000, // ₹10,00,000
    tenureMonths: 25,
    startDate: '2024-01-01',
    payments: Array.from({ length: months }, (_, i) => ({
      monthNumber: i + 1,
      amountPaid: monthlyPaise,
    })),
    ...rest,
  }
}

describe('dateForMonth', () => {
  it('treats month 1 as the start date', () => {
    expect(dateForMonth('2024-01-15', 1).toISOString().slice(0, 10)).toBe(
      '2024-01-15',
    )
  })

  it('advances one month per installment', () => {
    expect(dateForMonth('2024-01-15', 3).toISOString().slice(0, 10)).toBe(
      '2024-03-15',
    )
  })

  it('clamps the day for shorter months (Jan 31 + 1 → Feb 29 in a leap year)', () => {
    expect(dateForMonth('2024-01-31', 2).toISOString().slice(0, 10)).toBe(
      '2024-02-29',
    )
  })
})

describe('buildCashFlows', () => {
  it('emits one negative flow per payment plus a positive payout when received', () => {
    const flows = buildCashFlows(
      flatChit({
        months: 3,
        monthlyPaise: 4_000_000,
        receivedMonth: 2,
        receivedAmount: 80_000_000,
      }),
    )
    expect(flows).toHaveLength(4)
    expect(flows.filter((f) => f.amount < 0)).toHaveLength(3)
    expect(flows.filter((f) => f.amount > 0)).toHaveLength(1)
    // Sorted ascending by date
    for (let i = 1; i < flows.length; i++) {
      expect(flows[i].date.getTime()).toBeGreaterThanOrEqual(
        flows[i - 1].date.getTime(),
      )
    }
  })

  it('ignores zero-value payments', () => {
    const flows = buildCashFlows(flatChit({ months: 2, monthlyPaise: 0 }))
    expect(flows).toHaveLength(0)
  })

  it('uses an explicit payment date over the derived one', () => {
    const flows = buildCashFlows({
      chitValue: 100_000_000,
      tenureMonths: 25,
      startDate: '2024-01-01',
      payments: [
        { monthNumber: 1, amountPaid: 100, paymentDate: '2024-01-20' },
      ],
    })
    expect(flows[0].date.toISOString().slice(0, 10)).toBe('2024-01-20')
  })
})

describe('xirr', () => {
  it('returns null with fewer than two flows', () => {
    expect(xirr([{ date: new Date(), amount: -100 }])).toBeNull()
  })

  it('returns null when all flows share a sign (no payout yet)', () => {
    expect(
      xirr([
        { date: dateForMonth('2024-01-01', 1), amount: -100 },
        { date: dateForMonth('2024-01-01', 2), amount: -100 },
      ]),
    ).toBeNull()
  })

  it('recovers a known ~10% annual rate', () => {
    // Invest 1000 today, receive 1100 exactly one year later → 10% p.a.
    const rate = xirr([
      { date: new Date(Date.UTC(2024, 0, 1)), amount: -1000 },
      { date: new Date(Date.UTC(2025, 0, 1)), amount: 1100 },
    ])
    expect(rate).not.toBeNull()
    expect(rate as number).toBeCloseTo(0.1, 3)
  })

  it('is invariant to scale (paise vs rupees)', () => {
    const flows = (k: number) => [
      { date: new Date(Date.UTC(2024, 0, 1)), amount: -1000 * k },
      { date: new Date(Date.UTC(2025, 0, 1)), amount: 1100 * k },
    ]
    expect(xirr(flows(1))).toBeCloseTo(xirr(flows(100)) as number, 6)
  })
})

describe('summarizeChit', () => {
  it('computes totals, net position, simple return and XIRR for a completed "never taken" chit', () => {
    // Paid ₹34,000 for all 25 months, received ₹10,00,000 at month 25.
    const s = summarizeChit(
      flatChit({
        months: 25,
        monthlyPaise: 3_400_000,
        receivedMonth: 25,
        receivedAmount: 100_000_000,
      }),
    )
    expect(s.totalPaid).toBe(85_000_000) // ₹8,50,000
    expect(s.totalReceived).toBe(100_000_000)
    expect(s.netPosition).toBe(15_000_000) // ₹1,50,000
    expect(s.monthsPaid).toBe(25)
    expect(s.monthsRemaining).toBe(0)
    expect(s.isReceived).toBe(true)
    expect(s.isComplete).toBe(true)
    expect(s.simpleReturnPct).toBeCloseTo(17.647, 2)
    expect(s.xirrPct).not.toBeNull()
    expect(s.xirrPct as number).toBeGreaterThan(15)
    expect(s.xirrPct as number).toBeLessThan(20)
  })

  it('reports an in-progress chit (not yet received) with null XIRR', () => {
    const s = summarizeChit(flatChit({ months: 6, monthlyPaise: 3_800_000 }))
    expect(s.totalPaid).toBe(22_800_000)
    expect(s.totalReceived).toBe(0)
    expect(s.netPosition).toBe(-22_800_000)
    expect(s.monthsPaid).toBe(6)
    expect(s.monthsRemaining).toBe(19)
    expect(s.isReceived).toBe(false)
    expect(s.isComplete).toBe(false)
    expect(s.simpleReturnPct).toBe(-100)
    expect(s.xirrPct).toBeNull()
  })

  it('handles taking the chit early (money out then a mid-tenure payout)', () => {
    const s = summarizeChit(
      flatChit({
        months: 25,
        monthlyPaise: 4_000_000, // full ₹40,000 EMI
        receivedMonth: 3,
        receivedAmount: 80_000_000, // ₹8,00,000 early
      }),
    )
    expect(s.totalPaid).toBe(100_000_000) // ₹10,00,000
    expect(s.netPosition).toBe(-20_000_000) // paid 10L, got 8L
    // Early payout while little has been paid → high annualised return
    expect(s.xirrPct).not.toBeNull()
    expect(s.xirrPct as number).toBeGreaterThan(20)
  })

  it('returns safe zeros/nulls for a chit with no payments', () => {
    const s = summarizeChit({
      chitValue: 100_000_000,
      tenureMonths: 25,
      startDate: '2024-01-01',
      payments: [],
    })
    expect(s.totalPaid).toBe(0)
    expect(s.netPosition).toBe(0)
    expect(s.monthsPaid).toBe(0)
    expect(s.simpleReturnPct).toBeNull()
    expect(s.xirrPct).toBeNull()
  })

  it('projects a not-yet-taken chit to a complete hold-to-end outcome', () => {
    // Paid 6 months of ₹38,000; assume ₹38,000 for the rest and a ₹10,00,000
    // payout in the final month.
    const s = projectChit({
      ...flatChit({ months: 6, monthlyPaise: 3_800_000 }),
      assumedMonthlyPaise: 3_800_000,
      assumedFinalReceivePaise: 100_000_000,
    })
    expect(s.isComplete).toBe(true)
    expect(s.monthsPaid).toBe(25)
    expect(s.totalPaid).toBe(95_000_000) // 25 × ₹38,000
    expect(s.totalReceived).toBe(100_000_000)
    expect(s.netPosition).toBe(5_000_000)
    expect(s.xirrPct).not.toBeNull()
    expect(s.xirrPct as number).toBeGreaterThan(0)
  })

  it('keeps recorded actuals and only fills the gaps when projecting', () => {
    const s = projectChit({
      chitValue: 100_000_000,
      tenureMonths: 4,
      startDate: '2024-01-01',
      payments: [{ monthNumber: 1, amountPaid: 5_000_000 }],
      assumedMonthlyPaise: 1_000_000,
      assumedFinalReceivePaise: 100_000_000,
    })
    // ₹50,000 recorded + 3 × ₹10,000 assumed = ₹80,000
    expect(s.totalPaid).toBe(8_000_000)
    expect(s.monthsPaid).toBe(4)
  })

  it('counts distinct months when duplicate month rows exist', () => {
    const s = summarizeChit({
      chitValue: 100_000_000,
      tenureMonths: 25,
      startDate: '2024-01-01',
      payments: [
        { monthNumber: 1, amountPaid: 1_000_000 },
        { monthNumber: 1, amountPaid: 500_000 },
        { monthNumber: 2, amountPaid: 1_000_000 },
      ],
    })
    expect(s.totalPaid).toBe(2_500_000)
    expect(s.monthsPaid).toBe(2)
  })
})
