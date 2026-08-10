import { supabase } from '@/lib/supabase'
import type { PfKind } from '@/types/database.types'
import type { PfAccount } from '@/features/investments/api/pf-queries'

export interface PfAccountWrite {
  ownerId: string | null
  kind: PfKind
  name: string | null
  balancePaise: number
  asOf: string
  monthlyContributionPaise: number
  annualRatePercent: number
  notes: string | null
}

function toRow(input: PfAccountWrite) {
  return {
    owner_id: input.ownerId,
    kind: input.kind,
    name: input.name,
    balance_paise: input.balancePaise,
    as_of: input.asOf,
    monthly_contribution_paise: input.monthlyContributionPaise,
    annual_rate: input.annualRatePercent,
    notes: input.notes,
  }
}

/** Create a PF account (client-side id, no read-back under RLS). */
export async function createPfAccount(
  familyId: string,
  input: PfAccountWrite,
): Promise<PfAccount> {
  const id = crypto.randomUUID()
  const { error } = await supabase
    .from('pf_accounts')
    .insert({ id, family_id: familyId, ...toRow(input) })
  if (error) throw error
  return { id, ...input }
}

export async function updatePfAccount(
  id: string,
  input: PfAccountWrite,
): Promise<void> {
  const { error } = await supabase
    .from('pf_accounts')
    .update(toRow(input))
    .eq('id', id)
  if (error) throw error
}

export async function deletePfAccount(id: string): Promise<void> {
  const { error } = await supabase
    .from('pf_accounts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}
