import { describe, it, expect } from 'vitest'
import {
  buildInsightsPrompt,
  normalizeInsights,
  type FinanceContext,
} from './insights-schema'

const context: FinanceContext = {
  month: 'August 2026',
  scope: 'the whole family',
  income: 100000,
  expense: 60000,
  net: 40000,
  savingsRatePct: 40,
  topExpenseCategories: [{ name: 'Groceries', amount: 30000 }],
  previousMonth: { month: 'Jul', expense: 70000 },
  averageMonthlyExpense: 65000,
  monthlySeries: [{ month: 'Aug', income: 100000, expense: 60000 }],
}

describe('buildInsightsPrompt', () => {
  it('embeds the context for a summary', () => {
    const p = buildInsightsPrompt({ mode: 'summary', context })
    expect(p).toContain('August 2026')
    expect(p).toContain('not financial advice')
    expect(p).toContain('Groceries')
  })

  it('includes and quote-escapes the question', () => {
    const p = buildInsightsPrompt({
      mode: 'question',
      question: 'why is "dining" high?',
      context,
    })
    expect(p).toContain("why is 'dining' high?")
    expect(p).not.toContain('"dining"')
  })
})

describe('normalizeInsights', () => {
  it('keeps a clean answer and trims empty points', () => {
    const r = normalizeInsights({
      answer: '  You saved 40% this month.  ',
      points: ['Groceries were biggest', '', '  ', 'Down vs July'],
    })
    expect(r.answer).toBe('You saved 40% this month.')
    expect(r.points).toEqual(['Groceries were biggest', 'Down vs July'])
  })

  it('is safe on garbage input', () => {
    expect(normalizeInsights(null)).toEqual({ answer: '', points: [] })
    expect(normalizeInsights({ points: 'nope' })).toEqual({
      answer: '',
      points: [],
    })
  })
})
