import { describe, it, expect } from 'vitest'
import { matchParsedTransaction } from './nl-match'
import type { ParsedTransaction } from './nl-parse'
import type { Category } from '@/features/categories/api/category-queries'
import type { AccountWithBalance } from '@/features/accounts/api/account-queries'

const categories: Category[] = [
  { id: 'c-groc', name: 'Groceries', kind: 'expense', icon: null, color: null, isDefault: true },
  { id: 'c-din', name: 'Dining', kind: 'expense', icon: null, color: null, isDefault: true },
  { id: 'c-sal', name: 'Salary', kind: 'income', icon: null, color: null, isDefault: true },
]

const accounts: AccountWithBalance[] = [
  { id: 'a-hdfc', name: 'HDFC', type: 'bank', ownerId: null, openingBalance: 0, currentBalance: 0 },
  { id: 'a-cash', name: 'Cash', type: 'cash', ownerId: null, openingBalance: 0, currentBalance: 0 },
]

const base: ParsedTransaction = {
  type: null,
  amount: null,
  date: null,
  category: null,
  account: null,
  fromAccount: null,
  toAccount: null,
  note: null,
}

describe('matchParsedTransaction', () => {
  it('maps names to ids for an expense (kind-aware category)', () => {
    const patch = matchParsedTransaction(
      { ...base, type: 'expense', amount: 500, date: '2026-08-12', category: 'groceries', account: 'hdfc', note: 'DMart' },
      { categories, accounts },
    )
    expect(patch).toEqual({
      type: 'expense',
      amount: 500,
      occurredOn: '2026-08-12',
      note: 'DMart',
      accountId: 'a-hdfc',
      categoryId: 'c-groc',
    })
  })

  it('resolves transfer source and destination accounts', () => {
    const patch = matchParsedTransaction(
      { ...base, type: 'transfer', amount: 2000, fromAccount: 'HDFC', toAccount: 'Cash' },
      { categories, accounts },
    )
    expect(patch.fromAccountId).toBe('a-hdfc')
    expect(patch.toAccountId).toBe('a-cash')
    expect(patch.categoryId).toBeUndefined()
  })

  it('omits fields it cannot confidently resolve', () => {
    const patch = matchParsedTransaction(
      { ...base, type: 'expense', category: 'Nonexistent', account: 'Nowhere' },
      { categories, accounts },
    )
    expect(patch.type).toBe('expense')
    expect(patch.categoryId).toBeUndefined()
    expect(patch.accountId).toBeUndefined()
  })

  it('will not match an income category name against an expense', () => {
    const patch = matchParsedTransaction(
      { ...base, type: 'expense', category: 'Salary' },
      { categories, accounts },
    )
    expect(patch.categoryId).toBeUndefined()
  })
})
