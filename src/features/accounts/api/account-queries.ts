import { supabase } from '@/lib/supabase'
import type { AccountType } from '@/types/database.types'

/** A single account plus its computed live balance (all money in paise). */
export interface AccountWithBalance {
  id: string
  name: string
  type: AccountType
  /** Family member who owns this account; null means Shared / Family. */
  ownerId: string | null
  /** Opening balance in integer paise. */
  openingBalance: number
  /** Current balance in integer paise (opening ± transactions/transfers). */
  currentBalance: number
}

/**
 * Fetch all (non-deleted) accounts for a family with their current balances.
 * Uses the `account_balances` view, which already excludes soft-deleted rows
 * and folds in income/expense/transfer activity.
 */
export async function fetchAccounts(
  familyId: string,
): Promise<AccountWithBalance[]> {
  const { data, error } = await supabase
    .from('account_balances')
    .select('account_id, name, type, owner_id, opening_balance, current_balance')
    .eq('family_id', familyId)
    .order('name', { ascending: true })

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.account_id!,
    name: row.name!,
    type: row.type!,
    ownerId: row.owner_id ?? null,
    openingBalance: row.opening_balance ?? 0,
    currentBalance: row.current_balance ?? 0,
  }))
}
