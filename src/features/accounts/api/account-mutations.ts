import { supabase } from '@/lib/supabase'
import type { AccountType } from '@/types/database.types'
import type { AccountWithBalance } from '@/features/accounts/api/account-queries'

export interface CreateAccountInput {
  familyId: string
  userId: string
  name: string
  type: AccountType
  /** Opening balance in integer paise. */
  openingBalancePaise: number
}

export interface UpdateAccountInput {
  id: string
  name: string
  type: AccountType
  /** Opening balance in integer paise. */
  openingBalancePaise: number
}

/**
 * Create an account. The id is generated client-side so we don't need a
 * `.select()` read-back (which would run under the accounts SELECT RLS policy).
 */
export async function createAccount(
  input: CreateAccountInput,
): Promise<AccountWithBalance> {
  const id = crypto.randomUUID()

  const { error } = await supabase.from('accounts').insert({
    id,
    family_id: input.familyId,
    name: input.name,
    type: input.type,
    opening_balance: input.openingBalancePaise,
    created_by: input.userId,
  })

  if (error) throw error

  // A brand-new account has no transactions, so current == opening.
  return {
    id,
    name: input.name,
    type: input.type,
    openingBalance: input.openingBalancePaise,
    currentBalance: input.openingBalancePaise,
  }
}

/** Update an account's name, type and opening balance. */
export async function updateAccount(input: UpdateAccountInput): Promise<void> {
  const { error } = await supabase
    .from('accounts')
    .update({
      name: input.name,
      type: input.type,
      opening_balance: input.openingBalancePaise,
    })
    .eq('id', input.id)

  if (error) throw error
}

/** Soft-delete an account (sets `deleted_at`; the view then hides it). */
export async function deleteAccount(id: string): Promise<void> {
  const { error } = await supabase
    .from('accounts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}
