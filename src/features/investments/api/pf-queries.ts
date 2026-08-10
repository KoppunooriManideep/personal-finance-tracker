import { supabase } from '@/lib/supabase'
import type { PfKind } from '@/types/database.types'

/** A Provident Fund account (manually-anchored balance, money in paise). */
export interface PfAccount {
  id: string
  ownerId: string | null
  kind: PfKind
  name: string | null
  balancePaise: number
  /** ISO date (YYYY-MM-DD) the balance was accurate. */
  asOf: string
  monthlyContributionPaise: number
  /** Annual interest rate as a percentage. */
  annualRatePercent: number
  notes: string | null
}

/** Fetch all (non-deleted) PF accounts for a family. */
export async function fetchPfAccounts(familyId: string): Promise<PfAccount[]> {
  const { data, error } = await supabase
    .from('pf_accounts')
    .select(
      'id, owner_id, kind, name, balance_paise, as_of, monthly_contribution_paise, annual_rate, notes',
    )
    .eq('family_id', familyId)
    .is('deleted_at', null)
    .order('kind', { ascending: true })

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id,
    ownerId: row.owner_id ?? null,
    kind: row.kind,
    name: row.name ?? null,
    balancePaise: row.balance_paise,
    asOf: row.as_of,
    monthlyContributionPaise: row.monthly_contribution_paise,
    annualRatePercent: Number(row.annual_rate),
    notes: row.notes ?? null,
  }))
}
