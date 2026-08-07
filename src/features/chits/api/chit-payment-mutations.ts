import { supabase } from '@/lib/supabase'
import type { ChitPayment } from '@/features/chits/api/chit-payment-queries'

export interface CreateChitPaymentInput {
  chitId: string
  familyId: string
  monthNumber: number
  /** Net amount paid, in integer paise. */
  amountPaidPaise: number
  /** ISO date (YYYY-MM-DD) or null. */
  paymentDate: string | null
}

export interface UpdateChitPaymentInput {
  id: string
  amountPaidPaise: number
  paymentDate: string | null
}

/**
 * Create a payment row. The id is generated client-side so we avoid a
 * `.select()` read-back under the chit_payments SELECT RLS policy.
 */
export async function createChitPayment(
  input: CreateChitPaymentInput,
): Promise<ChitPayment> {
  const id = crypto.randomUUID()

  const { error } = await supabase.from('chit_payments').insert({
    id,
    chit_id: input.chitId,
    family_id: input.familyId,
    month_number: input.monthNumber,
    amount_paid: input.amountPaidPaise,
    payment_date: input.paymentDate,
  })

  if (error) throw error

  return {
    id,
    chitId: input.chitId,
    monthNumber: input.monthNumber,
    amountPaid: input.amountPaidPaise,
    paymentDate: input.paymentDate,
  }
}

/** Update a payment's amount and date. */
export async function updateChitPayment(
  input: UpdateChitPaymentInput,
): Promise<void> {
  const { error } = await supabase
    .from('chit_payments')
    .update({
      amount_paid: input.amountPaidPaise,
      payment_date: input.paymentDate,
    })
    .eq('id', input.id)

  if (error) throw error
}

/** Soft-delete a payment (clears a month; queries then hide it). */
export async function deleteChitPayment(id: string): Promise<void> {
  const { error } = await supabase
    .from('chit_payments')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}
