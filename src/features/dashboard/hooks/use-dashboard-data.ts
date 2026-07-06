import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchDashboardData } from '@/features/dashboard/api/dashboard-queries'
import type { Transaction } from '@/features/transactions/api/transaction-queries'
import { useCurrentFamily } from '@/features/family/hooks/use-current-family'
import type { Category } from '@/features/categories/api/category-queries'

export interface CategoryExpenseDatum {
  categoryId: string
  name: string
  value: number
  color: string
}

export interface MonthlyDatum {
  month: string
  income: number
  expense: number
}

export interface TrendDatum {
  day: string
  expense: number
}

export interface MemberIncomeExpenseDatum {
  userId: string
  name: string
  avatarUrl: string | null
  income: number
  expense: number
}

export interface DashboardAggregates {
  totalIncome: number
  totalExpense: number
  netBalance: number
  expenseByCategory: CategoryExpenseDatum[]
  monthlyIncomeExpense: MonthlyDatum[]
  spendingTrend: TrendDatum[]
  memberIncomeExpense: MemberIncomeExpenseDatum[]
  recentTransactions: Transaction[]
}

export function dashboardQueryKey(
  familyId: string | undefined,
  selectedMonth: string,
) {
  return ['dashboard', familyId, selectedMonth] as const
}

/** Fetch and aggregate dashboard data for the selected month. */
export function useDashboardData(
  selectedMonth: string,
  categories: Category[] | undefined,
) {
  const { data: family } = useCurrentFamily()
  const familyId = family?.id

  const query = useQuery({
    queryKey: dashboardQueryKey(familyId, selectedMonth),
    queryFn: () => fetchDashboardData(familyId!, selectedMonth),
    enabled: Boolean(familyId),
  })

  const aggregates = useMemo<DashboardAggregates | undefined>(() => {
    if (!query.data) return undefined
    return aggregateDashboardData(
      query.data.reportTransactions,
      query.data.recentTransactions,
      selectedMonth,
      categories ?? [],
    )
  }, [query.data, selectedMonth, categories])

  return { ...query, data: aggregates }
}

function aggregateDashboardData(
  reportTransactions: Transaction[],
  recentTransactions: Transaction[],
  selectedMonth: string,
  categories: Category[],
): DashboardAggregates {
  const selectedYear = Number(selectedMonth.slice(0, 4))
  const selectedMonthIndex = Number(selectedMonth.slice(5, 7)) - 1
  const monthTransactions = reportTransactions.filter((transaction) => {
    const parts = getIstParts(transaction.occurredAt)
    return parts.year === selectedYear && parts.monthIndex === selectedMonthIndex
  })

  const categoriesById = new Map(
    categories.map((category) => [category.id, category]),
  )

  const totalIncome = monthTransactions
    .filter((transaction) => transaction.type === 'income')
    .reduce((sum, transaction) => sum + transaction.amount, 0)
  const totalExpense = monthTransactions
    .filter((transaction) => transaction.type === 'expense')
    .reduce((sum, transaction) => sum + transaction.amount, 0)

  return {
    totalIncome,
    totalExpense,
    netBalance: totalIncome - totalExpense,
    expenseByCategory: buildExpenseByCategory(
      monthTransactions,
      categoriesById,
    ),
    monthlyIncomeExpense: buildMonthlyIncomeExpense(
      reportTransactions,
      selectedYear,
    ),
    spendingTrend: buildSpendingTrend(monthTransactions, selectedMonth),
    memberIncomeExpense: buildMemberIncomeExpense(monthTransactions),
    recentTransactions,
  }
}

function buildExpenseByCategory(
  transactions: Transaction[],
  categoriesById: Map<string, Category>,
): CategoryExpenseDatum[] {
  const totals = new Map<string, number>()

  transactions.forEach((transaction) => {
    if (transaction.type !== 'expense' || !transaction.categoryId) return
    totals.set(
      transaction.categoryId,
      (totals.get(transaction.categoryId) ?? 0) + transaction.amount,
    )
  })

  return Array.from(totals.entries())
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
}

function buildMonthlyIncomeExpense(
  transactions: Transaction[],
  year: number,
): MonthlyDatum[] {
  const data: MonthlyDatum[] = Array.from({ length: 12 }, (_item, index) => ({
    month: new Intl.DateTimeFormat('en-IN', { month: 'short' }).format(
      new Date(Date.UTC(year, index, 1)),
    ),
    income: 0,
    expense: 0,
  }))

  transactions.forEach((transaction) => {
    const parts = getIstParts(transaction.occurredAt)
    if (parts.year !== year) return
    if (transaction.type === 'income') data[parts.monthIndex].income += transaction.amount
    if (transaction.type === 'expense') data[parts.monthIndex].expense += transaction.amount
  })

  return data
}

function buildSpendingTrend(
  transactions: Transaction[],
  selectedMonth: string,
): TrendDatum[] {
  const year = Number(selectedMonth.slice(0, 4))
  const monthIndex = Number(selectedMonth.slice(5, 7)) - 1
  const dayCount = new Date(year, monthIndex + 1, 0).getDate()
  const data: TrendDatum[] = Array.from({ length: dayCount }, (_item, index) => ({
    day: String(index + 1).padStart(2, '0'),
    expense: 0,
  }))

  transactions.forEach((transaction) => {
    if (transaction.type !== 'expense') return
    const parts = getIstParts(transaction.occurredAt)
    data[parts.day - 1].expense += transaction.amount
  })

  return data
}

function buildMemberIncomeExpense(
  transactions: Transaction[],
): MemberIncomeExpenseDatum[] {
  const totals = new Map<string, MemberIncomeExpenseDatum>()

  transactions.forEach((transaction) => {
    if (transaction.type === 'transfer') return

    const userId = transaction.createdBy ?? 'unknown'
    const existing = totals.get(userId)
    const next =
      existing ??
      ({
        userId,
        name: transaction.creator?.fullName?.trim() || 'Unknown',
        avatarUrl: transaction.creator?.avatarUrl ?? null,
        income: 0,
        expense: 0,
      } satisfies MemberIncomeExpenseDatum)

    if (transaction.type === 'income') next.income += transaction.amount
    if (transaction.type === 'expense') next.expense += transaction.amount

    totals.set(userId, next)
  })

  return Array.from(totals.values()).sort(
    (a, b) => b.income + b.expense - (a.income + a.expense),
  )
}

function getIstParts(input: string) {
  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(input))

  return {
    year: Number(parts.find((part) => part.type === 'year')?.value),
    monthIndex: Number(parts.find((part) => part.type === 'month')?.value) - 1,
    day: Number(parts.find((part) => part.type === 'day')?.value),
  }
}
