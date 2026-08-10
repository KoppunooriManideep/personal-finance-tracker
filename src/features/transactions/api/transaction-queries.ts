import { supabase } from '@/lib/supabase'
import type { TransactionType } from '@/types/database.types'

export interface Transaction {
  id: string
  familyId: string
  type: TransactionType
  /** Positive integer paise. Direction is implied by `type`. */
  amount: number
  occurredAt: string
  note: string | null
  accountId: string | null
  categoryId: string | null
  fromAccountId: string | null
  toAccountId: string | null
  createdBy: string | null
  creator: TransactionCreator | null
}

export interface TransactionCreator {
  fullName: string | null
  avatarUrl: string | null
}

type TransactionRow = {
  id: string
  family_id: string
  type: TransactionType
  amount: number
  occurred_at: string
  note: string | null
  account_id: string | null
  category_id: string | null
  from_account_id: string | null
  to_account_id: string | null
  created_by: string | null
  creator: {
    full_name: string | null
    avatar_url: string | null
  } | null
}

/** Columns fetched for a transaction (shared by the list + dashboard queries). */
export const TRANSACTION_SELECT =
  'id, family_id, type, amount, occurred_at, note, account_id, category_id, from_account_id, to_account_id, created_by, creator:profiles!transactions_created_by_profiles_fkey(full_name, avatar_url)'

/**
 * Supabase caps a single request at the project's "Max rows" (1000 by default),
 * so we page through with .range() until a short page comes back. A stable
 * secondary sort by id keeps pages from overlapping when occurred_at ties.
 */
export const PAGE_SIZE = 1000

/**
 * Fetch ALL active transactions (paginated so nothing is dropped past 1000).
 * Related names are resolved from cached lists.
 */
export async function fetchTransactions(
  familyId: string,
): Promise<Transaction[]> {
  const rows: TransactionRow[] = []

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('transactions')
      .select(TRANSACTION_SELECT)
      .eq('family_id', familyId)
      .is('deleted_at', null)
      .order('occurred_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw error

    const page = (data ?? []) as unknown as TransactionRow[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
  }

  return rows.map(mapTransactionRow)
}

/** Map Supabase transaction rows, tolerating missing profile rows. */
export function mapTransactionRow(row: TransactionRow): Transaction {
  return {
    id: row.id,
    familyId: row.family_id,
    type: row.type,
    amount: row.amount,
    occurredAt: row.occurred_at,
    note: row.note,
    accountId: row.account_id,
    categoryId: row.category_id,
    fromAccountId: row.from_account_id,
    toAccountId: row.to_account_id,
    createdBy: row.created_by,
    creator: row.creator
      ? {
          fullName: row.creator.full_name,
          avatarUrl: row.creator.avatar_url,
        }
      : null,
  }
}
