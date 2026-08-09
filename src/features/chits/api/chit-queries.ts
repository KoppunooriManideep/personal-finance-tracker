import { supabase } from '@/lib/supabase'
import type { ChitStatus } from '@/types/database.types'

/** A chit's definition (money in integer paise; dates as ISO YYYY-MM-DD). */
export interface Chit {
  id: string
  /** Family member who owns this chit; null means Shared / Family. */
  ownerId: string | null
  name: string
  /** Total chit value in integer paise. */
  chitValue: number
  tenureMonths: number
  /** Base EMI: the flat monthly instalment agreed for the chit, in paise. */
  baseMonthly: number
  /** ISO date (YYYY-MM-DD) of the first installment. */
  startDate: string
  organizer: string | null
  notes: string | null
  /** 1-based month the chit was taken, or null if not yet taken. */
  receivedMonth: number | null
  /** Amount received when taken, in paise, or null. */
  receivedAmount: number | null
  status: ChitStatus
}

/** Fetch all (non-deleted) chits for a family, newest start date first. */
export async function fetchChits(familyId: string): Promise<Chit[]> {
  const { data, error } = await supabase
    .from('chits')
    .select(
      'id, owner_id, name, chit_value, tenure_months, base_monthly, start_date, organizer, notes, received_month, received_amount, status',
    )
    .eq('family_id', familyId)
    .is('deleted_at', null)
    .order('start_date', { ascending: false })
    .order('name', { ascending: true })

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id,
    ownerId: row.owner_id ?? null,
    name: row.name,
    chitValue: row.chit_value,
    tenureMonths: row.tenure_months,
    baseMonthly: row.base_monthly,
    startDate: row.start_date,
    organizer: row.organizer ?? null,
    notes: row.notes ?? null,
    receivedMonth: row.received_month ?? null,
    receivedAmount: row.received_amount ?? null,
    status: row.status,
  }))
}
