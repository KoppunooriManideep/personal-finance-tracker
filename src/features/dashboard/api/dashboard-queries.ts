import { supabase } from '@/lib/supabase'
import {
  mapTransactionRow,
  type Transaction,
} from '@/features/transactions/api/transaction-queries'

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

  const [reportResult, recentResult] = await Promise.all([
    supabase
      .from('transactions')
      .select(
        'id, family_id, type, amount, occurred_at, note, account_id, category_id, from_account_id, to_account_id, created_by, creator:profiles!transactions_created_by_profiles_fkey(full_name, avatar_url)',
      )
      .eq('family_id', familyId)
      .is('deleted_at', null)
      .neq('type', 'transfer')
      .gte('occurred_at', yearStart)
      .lt('occurred_at', nextYearStart)
      .order('occurred_at', { ascending: false }),
    supabase
      .from('transactions')
      .select(
        'id, family_id, type, amount, occurred_at, note, account_id, category_id, from_account_id, to_account_id, created_by, creator:profiles!transactions_created_by_profiles_fkey(full_name, avatar_url)',
      )
      .eq('family_id', familyId)
      .is('deleted_at', null)
      .order('occurred_at', { ascending: false })
      .limit(5),
  ])

  if (reportResult.error) throw reportResult.error
  if (recentResult.error) throw recentResult.error

  return {
    reportTransactions: (
      (reportResult.data ?? []) as unknown as Parameters<
        typeof mapTransactionRow
      >[0][]
    ).map(mapTransactionRow),
    recentTransactions: (
      (recentResult.data ?? []) as unknown as Parameters<
        typeof mapTransactionRow
      >[0][]
    ).map(mapTransactionRow),
  }
}

function localDateToUtcIso(date: string): string {
  return new Date(`${date}T00:00:00+05:30`).toISOString()
}
