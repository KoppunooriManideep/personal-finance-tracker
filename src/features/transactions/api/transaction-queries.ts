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

/** Fetch active transactions. Related names are resolved from cached lists. */
export async function fetchTransactions(
  familyId: string,
): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select(
      'id, family_id, type, amount, occurred_at, note, account_id, category_id, from_account_id, to_account_id, created_by, creator:profiles!transactions_created_by_profiles_fkey(full_name, avatar_url)',
    )
    .eq('family_id', familyId)
    .is('deleted_at', null)
    .order('occurred_at', { ascending: false })

  if (error) throw error

  return ((data ?? []) as unknown as TransactionRow[]).map(mapTransactionRow)
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
