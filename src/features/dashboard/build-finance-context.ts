import type {
  FinanceContext,
  MonthlyPoint,
} from '@/features/dashboard/insights-schema'

/** Round integer paise to whole rupees (for a compact, LLM-friendly payload). */
const toRupees = (paise: number) => Math.round(paise / 100)

export interface FinanceContextInput {
  /** Selected month as YYYY-MM. */
  selectedMonth: string
  /** Human label, e.g. "August 2026". */
  monthLabel: string
  /** "the whole family" or a member's first name. */
  scopeLabel: string
  totalIncomePaise: number
  totalExpensePaise: number
  /** This month's expense-by-category (value in paise), highest first. */
  expenseByCategory: { name: string; value: number }[]
  /** 12-month income/expense for the year (paise), index 0 = January. */
  monthlyIncomeExpense: { month: string; income: number; expense: number }[]
}

/**
 * Build the compact, rupee-denominated context sent to the AI. Everything is
 * pre-aggregated here so the model only writes language, never does arithmetic.
 */
export function buildFinanceContext(
  input: FinanceContextInput,
): FinanceContext {
  const income = toRupees(input.totalIncomePaise)
  const expense = toRupees(input.totalExpensePaise)
  const net = income - expense
  const savingsRatePct =
    income > 0 ? Math.round((net / income) * 100) : null

  const monthIndex = Number(input.selectedMonth.slice(5, 7)) - 1

  // Months up to and including the selected one that had any activity.
  const series: MonthlyPoint[] = input.monthlyIncomeExpense
    .slice(0, monthIndex + 1)
    .map((m) => ({
      month: m.month,
      income: toRupees(m.income),
      expense: toRupees(m.expense),
    }))

  const prev = monthIndex > 0 ? input.monthlyIncomeExpense[monthIndex - 1] : null
  const previousMonth = prev
    ? { month: prev.month, expense: toRupees(prev.expense) }
    : null

  const activeExpenses = series
    .map((m) => m.expense)
    .filter((value) => value > 0)
  const averageMonthlyExpense =
    activeExpenses.length > 0
      ? Math.round(
          activeExpenses.reduce((sum, value) => sum + value, 0) /
            activeExpenses.length,
        )
      : null

  return {
    month: input.monthLabel,
    scope: input.scopeLabel,
    income,
    expense,
    net,
    savingsRatePct,
    topExpenseCategories: input.expenseByCategory
      .slice(0, 8)
      .map((c) => ({ name: c.name, amount: toRupees(c.value) })),
    previousMonth,
    averageMonthlyExpense,
    monthlySeries: series,
  }
}
