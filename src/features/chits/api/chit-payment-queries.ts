import { supabase } from '@/lib/supabase'

/** A single recorded monthly chit payment (money in integer paise). */
export interface ChitPayment {
  id: string
  chitId: string
  monthNumber: number
  /** Net amount paid that month, in integer paise. */
  amountPaid: number
  /** ISO date (YYYY-MM-DD) the payment was made, or null. */
  paymentDate: string | null
}

/**
 * Fetch all (non-deleted) chit payments for a family in one query. Callers
 * group by `chitId` client-side (see `groupPaymentsByChit`).
 */
export async function fetchChitPayments(
  familyId: string,
): Promise<ChitPayment[]> {
  const { data, error } = await supabase
    .from('chit_payments')
    .select('id, chit_id, month_number, amount_paid, payment_date')
    .eq('family_id', familyId)
    .is('deleted_at', null)
    .order('month_number', { ascending: true })

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id,
    chitId: row.chit_id,
    monthNumber: row.month_number,
    amountPaid: row.amount_paid,
    paymentDate: row.payment_date ?? null,
  }))
}

/** Group a flat payment list into a map keyed by chit id. */
export function groupPaymentsByChit(
  payments: ChitPayment[],
): Map<string, ChitPayment[]> {
  const map = new Map<string, ChitPayment[]>()
  for (const payment of payments) {
    const list = map.get(payment.chitId)
    if (list) list.push(payment)
    else map.set(payment.chitId, [payment])
  }
  return map
}
