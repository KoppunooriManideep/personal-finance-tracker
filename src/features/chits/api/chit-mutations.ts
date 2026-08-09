import { supabase } from '@/lib/supabase'
import type { Chit } from '@/features/chits/api/chit-queries'

export interface CreateChitInput {
  familyId: string
  name: string
  ownerId: string | null
  /** Total chit value in integer paise. */
  chitValuePaise: number
  tenureMonths: number
  /** Base EMI (flat monthly instalment) in integer paise. */
  baseMonthlyPaise: number
  /** ISO date (YYYY-MM-DD). */
  startDate: string
  organizer: string | null
  notes: string | null
}

export interface UpdateChitInput {
  id: string
  name: string
  ownerId: string | null
  chitValuePaise: number
  tenureMonths: number
  baseMonthlyPaise: number
  startDate: string
  organizer: string | null
  notes: string | null
}

/**
 * Create a chit. The id is generated client-side so we avoid a `.select()`
 * read-back (which would run under the chits SELECT RLS policy).
 */
export async function createChit(input: CreateChitInput): Promise<Chit> {
  const id = crypto.randomUUID()

  const { error } = await supabase.from('chits').insert({
    id,
    family_id: input.familyId,
    owner_id: input.ownerId,
    name: input.name,
    chit_value: input.chitValuePaise,
    tenure_months: input.tenureMonths,
    base_monthly: input.baseMonthlyPaise,
    start_date: input.startDate,
    organizer: input.organizer,
    notes: input.notes,
  })

  if (error) throw error

  return {
    id,
    ownerId: input.ownerId,
    name: input.name,
    chitValue: input.chitValuePaise,
    tenureMonths: input.tenureMonths,
    baseMonthly: input.baseMonthlyPaise,
    startDate: input.startDate,
    organizer: input.organizer,
    notes: input.notes,
    receivedMonth: null,
    receivedAmount: null,
    status: 'active',
  }
}

/** Update a chit's definition fields. */
export async function updateChit(input: UpdateChitInput): Promise<void> {
  const { error } = await supabase
    .from('chits')
    .update({
      name: input.name,
      owner_id: input.ownerId,
      chit_value: input.chitValuePaise,
      tenure_months: input.tenureMonths,
      base_monthly: input.baseMonthlyPaise,
      start_date: input.startDate,
      organizer: input.organizer,
      notes: input.notes,
    })
    .eq('id', input.id)

  if (error) throw error
}

export interface SetChitReceivedInput {
  id: string
  /** 1-based month the chit was taken. */
  receivedMonth: number
  /** Amount received when taken, in integer paise. */
  receivedAmountPaise: number
}

/** Record that a chit was taken in a given month for a given amount. */
export async function setChitReceived(
  input: SetChitReceivedInput,
): Promise<void> {
  const { error } = await supabase
    .from('chits')
    .update({
      received_month: input.receivedMonth,
      received_amount: input.receivedAmountPaise,
    })
    .eq('id', input.id)

  if (error) throw error
}

/** Clear a chit's "taken" record (both received columns must clear together). */
export async function clearChitReceived(id: string): Promise<void> {
  const { error } = await supabase
    .from('chits')
    .update({ received_month: null, received_amount: null })
    .eq('id', id)

  if (error) throw error
}

/** Soft-delete a chit (sets `deleted_at`; queries then hide it). */
export async function deleteChit(id: string): Promise<void> {
  const { error } = await supabase
    .from('chits')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}
