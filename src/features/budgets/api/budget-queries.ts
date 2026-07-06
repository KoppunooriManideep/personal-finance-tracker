import { supabase } from '@/lib/supabase'

export interface Budget {
  id: string
  familyId: string
  categoryId: string
  /** Budget limit in integer paise. */
  amount: number
  /** First day of the budget month, YYYY-MM-01. */
  periodMonth: string
}

export interface BudgetWithSpending extends Budget {
  /** Expense transaction total for the category/month in integer paise. */
  spent: number
}

/** Fetch budgets and expense-only spending for one month. Transfers excluded. */
export async function fetchBudgets(
  familyId: string,
  selectedMonth: string,
): Promise<BudgetWithSpending[]> {
  const periodMonth = toPeriodMonth(selectedMonth)
  const monthStart = localDateToUtcIso(periodMonth)
  const [year, month] = selectedMonth.split('-').map(Number)
  const nextMonth = new Date(Date.UTC(year, month, 1))
  const nextMonthStart = localDateToUtcIso(
    `${nextMonth.getUTCFullYear()}-${String(nextMonth.getUTCMonth() + 1).padStart(2, '0')}-01`,
  )

  const [budgetsResult, spendingResult] = await Promise.all([
    supabase
      .from('budgets')
      .select('id, family_id, category_id, amount, period_month')
      .eq('family_id', familyId)
      .eq('period_month', periodMonth)
      .is('deleted_at', null)
      .order('created_at', { ascending: true }),
    supabase
      .from('transactions')
      .select('category_id, amount')
      .eq('family_id', familyId)
      .eq('type', 'expense')
      .is('deleted_at', null)
      .gte('occurred_at', monthStart)
      .lt('occurred_at', nextMonthStart),
  ])

  if (budgetsResult.error) throw budgetsResult.error
  if (spendingResult.error) throw spendingResult.error

  const spendingByCategory = new Map<string, number>()
  ;(spendingResult.data ?? []).forEach((row) => {
    if (!row.category_id) return
    spendingByCategory.set(
      row.category_id,
      (spendingByCategory.get(row.category_id) ?? 0) + row.amount,
    )
  })

  return (budgetsResult.data ?? []).map((row) => ({
    id: row.id,
    familyId: row.family_id,
    categoryId: row.category_id,
    amount: row.amount,
    periodMonth: row.period_month,
    spent: spendingByCategory.get(row.category_id) ?? 0,
  }))
}

function toPeriodMonth(selectedMonth: string): string {
  return `${selectedMonth}-01`
}

function localDateToUtcIso(date: string): string {
  return new Date(`${date}T00:00:00+05:30`).toISOString()
}
