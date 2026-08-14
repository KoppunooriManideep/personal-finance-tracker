import { describe, it, expect } from 'vitest'
import { buildFinanceContext } from './build-finance-context'

const months = (values: [number, number][]) =>
  values.map(([income, expense], i) => ({
    month: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'][i] ?? 'M',
    income,
    expense,
  }))

describe('buildFinanceContext', () => {
  it('converts paise to whole rupees and computes savings rate', () => {
    const ctx = buildFinanceContext({
      selectedMonth: '2026-03', // index 2 (March)
      monthLabel: 'March 2026',
      scopeLabel: 'the whole family',
      totalIncomePaise: 10_000_000, // ₹100,000
      totalExpensePaise: 6_000_000, // ₹60,000
      expenseByCategory: [
        { name: 'Groceries', value: 3_000_000 },
        { name: 'Dining', value: 2_000_000 },
      ],
      monthlyIncomeExpense: months([
        [10_000_000, 5_000_000], // Jan
        [10_000_000, 7_000_000], // Feb
        [10_000_000, 6_000_000], // Mar (selected)
        [10_000_000, 9_000_000], // Apr (after selected — excluded)
      ]),
    })

    expect(ctx.income).toBe(100000)
    expect(ctx.expense).toBe(60000)
    expect(ctx.net).toBe(40000)
    expect(ctx.savingsRatePct).toBe(40)
    expect(ctx.topExpenseCategories).toEqual([
      { name: 'Groceries', amount: 30000 },
      { name: 'Dining', amount: 20000 },
    ])
    // previous month = Feb
    expect(ctx.previousMonth).toEqual({ month: 'Feb', expense: 70000 })
    // series only up to March (3 points), average of 50k/70k/60k = 60k
    expect(ctx.monthlySeries).toHaveLength(3)
    expect(ctx.averageMonthlyExpense).toBe(60000)
  })

  it('has no previous month or savings rate for January with no income', () => {
    const ctx = buildFinanceContext({
      selectedMonth: '2026-01',
      monthLabel: 'January 2026',
      scopeLabel: 'Alice',
      totalIncomePaise: 0,
      totalExpensePaise: 5_000_00,
      expenseByCategory: [],
      monthlyIncomeExpense: months([[0, 5_000_00]]),
    })
    expect(ctx.previousMonth).toBeNull()
    expect(ctx.savingsRatePct).toBeNull()
    expect(ctx.monthlySeries).toHaveLength(1)
  })
})
