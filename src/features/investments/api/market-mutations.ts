import { supabase } from '@/lib/supabase'
import type { MarketHoldingKind } from '@/types/database.types'
import type { MarketHolding } from '@/features/investments/api/market-queries'

export interface MarketHoldingWrite {
  ownerId: string | null
  kind: MarketHoldingKind
  isin: string | null
  symbol: string
  exchange: string | null
  name: string | null
  quantity: number
  investedPaise: number
  notes: string | null
  tags: string[]
}

function toRow(input: MarketHoldingWrite) {
  return {
    owner_id: input.ownerId,
    kind: input.kind,
    isin: input.isin,
    symbol: input.symbol,
    exchange: input.exchange,
    name: input.name,
    quantity: input.quantity,
    invested_paise: input.investedPaise,
    notes: input.notes,
    tags: input.tags,
  }
}

/** Create one market holding (client-side id, no read-back under RLS). */
export async function createMarketHolding(
  familyId: string,
  input: MarketHoldingWrite,
): Promise<MarketHolding> {
  const id = crypto.randomUUID()
  const { error } = await supabase
    .from('market_holdings')
    .insert({ id, family_id: familyId, ...toRow(input) })
  if (error) throw error
  return { id, ...input }
}

export async function updateMarketHolding(
  id: string,
  input: MarketHoldingWrite,
): Promise<void> {
  const { error } = await supabase
    .from('market_holdings')
    .update(toRow(input))
    .eq('id', id)
  if (error) throw error
}

export async function deleteMarketHolding(id: string): Promise<void> {
  const { error } = await supabase
    .from('market_holdings')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

/** Bulk-insert holdings (CSV import). Returns the number of rows inserted. */
export async function bulkCreateMarketHoldings(
  familyId: string,
  inputs: MarketHoldingWrite[],
): Promise<number> {
  if (inputs.length === 0) return 0
  const rows = inputs.map((input) => ({
    id: crypto.randomUUID(),
    family_id: familyId,
    ...toRow(input),
  }))
  const { error } = await supabase.from('market_holdings').insert(rows)
  if (error) throw error
  return rows.length
}
