import { istPeriodKey } from '@/lib/date'
import type { Transaction } from '@/features/transactions/api/transaction-queries'
import type { AccountWithBalance } from '@/features/accounts/api/account-queries'
import type { Category } from '@/features/categories/api/category-queries'
import type { FamilyMember } from '@/features/family/api/family-queries'

export interface CategoryTotal {
  categoryId: string
  name: string
  /** Total expense in paise. */
  value: number
  color: string
}

export interface MemberTotal {
  userId: string
  name: string
  income: number
  expense: number
}

export interface MonthRow {
  /** `YYYY-MM` key. */
  key: string
  /** Short label, e.g. "Apr 2025". */
  label: string
  income: number
  expense: number
  net: number
}

export interface ReportAggregate {
  totalIncome: number
  totalExpense: number
  netSaved: number
  byCategory: CategoryTotal[]
  byMember: MemberTotal[]
}

export interface AggregateContext {
  accounts: AccountWithBalance[]
  categories: Category[]
  members: FamilyMember[]
  /** `YYYY-MM` keys (IST) that make up the reporting period. */
  periodKeys: string[]
  /** Null = whole family; otherwise scope to this account owner. */
  selectedOwnerId: string | null
}

/** The single reporting period for one calendar month. */
export function monthPeriodKeys(month: string): string[] {
  return [month]
}

/** The 12 `YYYY-MM` keys of an Indian financial year (Apr `startYear` → Mar). */
export function financialYearPeriodKeys(startYear: number): string[] {
  const keys: string[] = []
  for (let m = 4; m <= 12; m++) {
    keys.push(`${startYear}-${String(m).padStart(2, '0')}`)
  }
  for (let m = 1; m <= 3; m++) {
    keys.push(`${startYear + 1}-${String(m).padStart(2, '0')}`)
  }
  return keys
}

function memberName(
  ownerId: string | null,
  membersByUserId: Map<string, FamilyMember>,
): string {
  if (!ownerId) return 'Shared / Family'
  const member = membersByUserId.get(ownerId)
  return (
    member?.profile?.fullName?.trim() ||
    member?.displayName?.trim() ||
    'Unknown'
  )
}

/**
 * Aggregate income/expense over a set of `YYYY-MM` periods, optionally scoped to
 * one account owner. Transfers are excluded (they only move money). Category and
 * member breakdowns mirror the dashboard's rules so the numbers line up.
 */
export function aggregateReportFrom(
  transactions: Transaction[],
  {
    accounts,
    categories,
    members,
    periodKeys,
    selectedOwnerId,
  }: AggregateContext,
): ReportAggregate {
  const keySet = new Set(periodKeys)
  const accountsById = new Map(accounts.map((a) => [a.id, a]))
  const categoriesById = new Map(categories.map((c) => [c.id, c]))
  const membersByUserId = new Map(members.map((m) => [m.userId, m]))

  let totalIncome = 0
  let totalExpense = 0
  const categoryTotals = new Map<string, number>()
  const memberTotals = new Map<string, MemberTotal>()

  for (const t of transactions) {
    if (t.type === 'transfer') continue
    if (!keySet.has(istPeriodKey(t.occurredAt))) continue

    const ownerId = t.accountId
      ? (accountsById.get(t.accountId)?.ownerId ?? null)
      : null
    if (selectedOwnerId && ownerId !== selectedOwnerId) continue

    if (t.type === 'income') totalIncome += t.amount
    if (t.type === 'expense') {
      totalExpense += t.amount
      if (t.categoryId) {
        categoryTotals.set(
          t.categoryId,
          (categoryTotals.get(t.categoryId) ?? 0) + t.amount,
        )
      }
    }

    const uid = ownerId ?? 'shared'
    const entry =
      memberTotals.get(uid) ??
      ({
        userId: uid,
        name: memberName(ownerId, membersByUserId),
        income: 0,
        expense: 0,
      } satisfies MemberTotal)
    if (t.type === 'income') entry.income += t.amount
    if (t.type === 'expense') entry.expense += t.amount
    memberTotals.set(uid, entry)
  }

  const byCategory = Array.from(categoryTotals.entries())
    .map(([categoryId, value]) => {
      const category = categoriesById.get(categoryId)
      return {
        categoryId,
        name: category?.name ?? 'Uncategorized',
        value,
        color: category?.color ?? '#64748b',
      }
    })
    .sort((a, b) => b.value - a.value)

  const byMember = Array.from(memberTotals.values()).sort(
    (a, b) => b.income + b.expense - (a.income + a.expense),
  )

  return {
    totalIncome,
    totalExpense,
    netSaved: totalIncome - totalExpense,
    byCategory,
    byMember,
  }
}

/** Per-month income/expense/net for each key in `orderedKeys` (in order). */
export function monthlyBreakdown(
  transactions: Transaction[],
  {
    accounts,
    orderedKeys,
    selectedOwnerId,
  }: {
    accounts: AccountWithBalance[]
    orderedKeys: string[]
    selectedOwnerId: string | null
  },
): MonthRow[] {
  const accountsById = new Map(accounts.map((a) => [a.id, a]))
  const shortLabel = new Intl.DateTimeFormat('en-IN', {
    month: 'short',
    year: 'numeric',
  })

  const rows = new Map<string, MonthRow>(
    orderedKeys.map((key) => [
      key,
      {
        key,
        label: shortLabel.format(new Date(`${key}-01T12:00:00`)),
        income: 0,
        expense: 0,
        net: 0,
      },
    ]),
  )

  for (const t of transactions) {
    if (t.type === 'transfer') continue
    const row = rows.get(istPeriodKey(t.occurredAt))
    if (!row) continue

    const ownerId = t.accountId
      ? (accountsById.get(t.accountId)?.ownerId ?? null)
      : null
    if (selectedOwnerId && ownerId !== selectedOwnerId) continue

    if (t.type === 'income') row.income += t.amount
    if (t.type === 'expense') row.expense += t.amount
  }

  return orderedKeys.map((key) => {
    const row = rows.get(key)!
    return { ...row, net: row.income - row.expense }
  })
}
