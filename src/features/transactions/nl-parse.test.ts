import { describe, it, expect } from 'vitest'
import {
  buildTransactionPrompt,
  normalizeParsedTransaction,
} from './nl-parse'

describe('buildTransactionPrompt', () => {
  it('embeds today, categories and accounts, and escapes quotes', () => {
    const p = buildTransactionPrompt({
      text: 'paid 500 for "lunch"',
      today: '2026-08-13',
      expenseCategories: ['Groceries', 'Dining'],
      incomeCategories: ['Salary'],
      accounts: ['HDFC', 'Cash'],
    })
    expect(p).toContain('2026-08-13')
    expect(p).toContain('Groceries, Dining')
    expect(p).toContain('HDFC, Cash')
    expect(p).not.toContain('"lunch"') // double quotes replaced with single
    expect(p).toContain("'lunch'")
  })
})

describe('normalizeParsedTransaction', () => {
  it('passes through a clean expense', () => {
    expect(
      normalizeParsedTransaction({
        type: 'expense',
        amount: 500,
        date: '2026-08-12',
        category: 'Groceries',
        account: 'HDFC',
        fromAccount: null,
        toAccount: null,
        note: 'DMart',
      }),
    ).toEqual({
      type: 'expense',
      amount: 500,
      date: '2026-08-12',
      category: 'Groceries',
      account: 'HDFC',
      fromAccount: null,
      toAccount: null,
      note: 'DMart',
    })
  })

  it('nulls invalid type, non-positive amount and non-ISO date', () => {
    const r = normalizeParsedTransaction({
      type: 'refund',
      amount: 0,
      date: '12/08/2026',
    })
    expect(r.type).toBeNull()
    expect(r.amount).toBeNull()
    expect(r.date).toBeNull()
  })

  it('strips commas from an amount string', () => {
    expect(normalizeParsedTransaction({ amount: '1,500' }).amount).toBe(1500)
  })
})
