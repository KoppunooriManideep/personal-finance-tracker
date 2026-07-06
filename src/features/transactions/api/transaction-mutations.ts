import { supabase } from '@/lib/supabase'
import type { TransactionType } from '@/types/database.types'
import type { Transaction } from '@/features/transactions/api/transaction-queries'

interface BaseTransactionInput {
  familyId: string
  userId: string
  type: TransactionType
  amountPaise: number
  occurredAt: string
  note: string | null
  accountId: string | null
  categoryId: string | null
  fromAccountId: string | null
  toAccountId: string | null
}

export type CreateTransactionInput = BaseTransactionInput
export type UpdateTransactionInput = Omit<BaseTransactionInput, 'familyId' | 'userId'> & {
  id: string
}

/** Create a transaction row. Balance effects are derived by the DB view. */
export async function createTransaction(
  input: CreateTransactionInput,
): Promise<Transaction> {
  const id = crypto.randomUUID()

  const { error } = await supabase.from('transactions').insert({
    id,
    family_id: input.familyId,
    type: input.type,
    amount: input.amountPaise,
    occurred_at: input.occurredAt,
    note: input.note,
    account_id: input.accountId,
    category_id: input.categoryId,
    from_account_id: input.fromAccountId,
    to_account_id: input.toAccountId,
    created_by: input.userId,
  })

  if (error) throw error

  return {
    id,
    familyId: input.familyId,
    type: input.type,
    amount: input.amountPaise,
    occurredAt: input.occurredAt,
    note: input.note,
    accountId: input.accountId,
    categoryId: input.categoryId,
    fromAccountId: input.fromAccountId,
    toAccountId: input.toAccountId,
    createdBy: input.userId,
    creator: null,
  }
}

/** Update a transaction. Replacing the row shape reverses old balance effects. */
export async function updateTransaction(
  input: UpdateTransactionInput,
): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .update({
      type: input.type,
      amount: input.amountPaise,
      occurred_at: input.occurredAt,
      note: input.note,
      account_id: input.accountId,
      category_id: input.categoryId,
      from_account_id: input.fromAccountId,
      to_account_id: input.toAccountId,
    })
    .eq('id', input.id)

  if (error) throw error
}

/** Soft-delete a transaction. The account balance view then excludes it. */
export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}
