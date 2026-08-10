import { supabase } from '@/lib/supabase'
import {
  mapTransactionRow,
  PAGE_SIZE,
  TRANSACTION_SELECT,
  type Transaction,
} from '@/features/transactions/api/transaction-queries'

type TransactionRow = Parameters<typeof mapTransactionRow>[0]

export interface DashboardQueryResult {
  /** Income/expense only for the selected year; transfers excluded at query time. */
  reportTransactions: Transaction[]
  /** Last five transactions of all types, so transfers still appear in activity. */
  recentTransactions: Transaction[]
}

/** Fetch dashboard reporting rows plus recent activity for one family. */
export async function fetchDashboardData(
  familyId: string,
  selectedMonth: string,
): Promise<DashboardQueryResult> {
  const year = Number(selectedMonth.slice(0, 4))
  const yearStart = localDateToUtcIso(`${year}-01-01`)
  const nextYearStart = localDateToUtcIso(`${year + 1}-01-01`)

  // Report rows drive the whole-year charts, so page through them (a busy family
  // easily exceeds the 1000-row cap in a year) rather than silently truncating.
  const fetchReportRows = async (): Promise<TransactionRow[]> => {
    const rows: TransactionRow[] = []
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from('transactions')
        .select(TRANSACTION_SELECT)
        .eq('family_id', familyId)
        .is('deleted_at', null)
        .neq('type', 'transfer')
        .gte('occurred_at', yearStart)
        .lt('occurred_at', nextYearStart)
        .order('occurred_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, from + PAGE_SIZE - 1)

      if (error) throw error
      const page = (data ?? []) as unknown as TransactionRow[]
      rows.push(...page)
      if (page.length < PAGE_SIZE) break
    }
    return rows
  }

  const [reportRows, recentResult] = await Promise.all([
    fetchReportRows(),
    supabase
      .from('transactions')
      .select(TRANSACTION_SELECT)
      .eq('family_id', familyId)
      .is('deleted_at', null)
      .order('occurred_at', { ascending: false })
      .limit(5),
  ])

  if (recentResult.error) throw recentResult.error

  return {
    reportTransactions: reportRows.map(mapTransactionRow),
    recentTransactions: (
      (recentResult.data ?? []) as unknown as TransactionRow[]
    ).map(mapTransactionRow),
  }
}

function localDateToUtcIso(date: string): string {
  return new Date(`${date}T00:00:00+05:30`).toISOString()
}
