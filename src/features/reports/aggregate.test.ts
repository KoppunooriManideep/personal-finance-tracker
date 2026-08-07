import { describe, it, expect } from 'vitest'
import {
  aggregateReportFrom,
  financialYearPeriodKeys,
  monthlyBreakdown,
  monthPeriodKeys,
} from './aggregate'
import type { Transaction } from '@/features/transactions/api/transaction-queries'
import type { AccountWithBalance } from '@/features/accounts/api/account-queries'
import type { Category } from '@/features/categories/api/category-queries'
import type { FamilyMember } from '@/features/family/api/family-queries'

const accounts: AccountWithBalance[] = [
  { id: 'acc-a', name: 'A', type: 'bank', ownerId: 'alice', openingBalance: 0, currentBalance: 0 },
  { id: 'acc-b', name: 'B', type: 'bank', ownerId: 'bob', openingBalance: 0, currentBalance: 0 },
  { id: 'acc-s', name: 'Shared', type: 'cash', ownerId: null, openingBalance: 0, currentBalance: 0 },
]

const categories: Category[] = [
  { id: 'cat-food', name: 'Food', kind: 'expense', icon: null, color: '#f00', isDefault: false },
  { id: 'cat-fuel', name: 'Fuel', kind: 'expense', icon: null, color: '#00f', isDefault: false },
]

const members: FamilyMember[] = [
  { id: 'm1', familyId: 'fam', userId: 'alice', role: 'owner', displayName: 'Alice', profile: { fullName: 'Alice A', avatarUrl: null }, createdAt: '' },
  { id: 'm2', familyId: 'fam', userId: 'bob', role: 'member', displayName: 'Bob', profile: { fullName: 'Bob B', avatarUrl: null }, createdAt: '' },
]

let seq = 0
function tx(overrides: Partial<Transaction>): Transaction {
  seq += 1
  return {
    id: `t${seq}`,
    familyId: 'fam',
    type: 'expense',
    amount: 0,
    occurredAt: '2025-05-10T06:30:00.000Z', // IST 2025-05
    note: null,
    accountId: 'acc-a',
    categoryId: null,
    fromAccountId: null,
    toAccountId: null,
    createdBy: null,
    creator: null,
    ...overrides,
  }
}

describe('financialYearPeriodKeys', () => {
  it('spans Apr of startYear through Mar of the next year (12 keys)', () => {
    const keys = financialYearPeriodKeys(2025)
    expect(keys).toHaveLength(12)
    expect(keys[0]).toBe('2025-04')
    expect(keys[8]).toBe('2025-12')
    expect(keys[9]).toBe('2026-01')
    expect(keys[11]).toBe('2026-03')
  })
})

const ctx = (periodKeys: string[], selectedOwnerId: string | null = null) => ({
  accounts,
  categories,
  members,
  periodKeys,
  selectedOwnerId,
})

describe('aggregateReportFrom', () => {
  const transactions = [
    tx({ type: 'income', amount: 100_000, accountId: 'acc-a' }), // Alice, May 2025
    tx({ type: 'expense', amount: 30_000, accountId: 'acc-a', categoryId: 'cat-food' }),
    tx({ type: 'expense', amount: 20_000, accountId: 'acc-b', categoryId: 'cat-fuel' }), // Bob
    tx({ type: 'transfer', amount: 999_999, fromAccountId: 'acc-a', toAccountId: 'acc-b', accountId: null }),
    tx({ type: 'expense', amount: 5_000, accountId: 'acc-a', categoryId: 'cat-food', occurredAt: '2025-08-01T06:30:00.000Z' }), // out of May period
  ]

  it('sums income/expense for the period and excludes transfers + out-of-period rows', () => {
    const r = aggregateReportFrom(transactions, ctx(monthPeriodKeys('2025-05')))
    expect(r.totalIncome).toBe(100_000)
    expect(r.totalExpense).toBe(50_000) // 30k + 20k (Aug row excluded, transfer excluded)
    expect(r.netSaved).toBe(50_000)
  })

  it('breaks expense down by category, sorted descending', () => {
    const r = aggregateReportFrom(transactions, ctx(monthPeriodKeys('2025-05')))
    expect(r.byCategory.map((c) => [c.name, c.value])).toEqual([
      ['Food', 30_000],
      ['Fuel', 20_000],
    ])
  })

  it('breaks income/expense down by account owner', () => {
    const r = aggregateReportFrom(transactions, ctx(monthPeriodKeys('2025-05')))
    const alice = r.byMember.find((m) => m.userId === 'alice')
    const bob = r.byMember.find((m) => m.userId === 'bob')
    expect(alice).toMatchObject({ name: 'Alice A', income: 100_000, expense: 30_000 })
    expect(bob).toMatchObject({ name: 'Bob B', income: 0, expense: 20_000 })
  })

  it('scopes to one owner when selectedOwnerId is set', () => {
    const r = aggregateReportFrom(transactions, ctx(monthPeriodKeys('2025-05'), 'alice'))
    expect(r.totalIncome).toBe(100_000)
    expect(r.totalExpense).toBe(30_000) // only Alice's accounts
    expect(r.byMember).toHaveLength(1)
  })

  it('aggregates across a full financial year', () => {
    const r = aggregateReportFrom(transactions, ctx(financialYearPeriodKeys(2025)))
    // May (30k Food) + Aug (5k Food) + May (20k Fuel) = 55k expense; income 100k
    expect(r.totalIncome).toBe(100_000)
    expect(r.totalExpense).toBe(55_000)
  })
})

describe('monthlyBreakdown', () => {
  it('produces one row per key with income/expense/net, in order', () => {
    const transactions = [
      tx({ type: 'income', amount: 100_000, occurredAt: '2025-04-05T06:30:00.000Z' }),
      tx({ type: 'expense', amount: 40_000, occurredAt: '2025-04-06T06:30:00.000Z' }),
      tx({ type: 'expense', amount: 10_000, occurredAt: '2025-05-06T06:30:00.000Z' }),
    ]
    const rows = monthlyBreakdown(transactions, {
      accounts,
      orderedKeys: financialYearPeriodKeys(2025),
      selectedOwnerId: null,
    })
    expect(rows).toHaveLength(12)
    expect(rows[0]).toMatchObject({ key: '2025-04', income: 100_000, expense: 40_000, net: 60_000 })
    expect(rows[1]).toMatchObject({ key: '2025-05', income: 0, expense: 10_000, net: -10_000 })
    expect(rows[0].label).toMatch(/Apr/)
  })
})
