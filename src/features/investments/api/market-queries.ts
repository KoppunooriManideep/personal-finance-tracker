import { supabase } from '@/lib/supabase'
import type { MarketHoldingKind } from '@/types/database.types'

/** A stock or mutual-fund holding (money in paise; quantity may be fractional). */
export interface MarketHolding {
  id: string
  ownerId: string | null
  kind: MarketHoldingKind
  /** Universal id — INE… = stock, INF… = mutual fund. */
  isin: string | null
  /** Trading symbol (stock) or fund name (MF). */
  symbol: string
  exchange: string | null
  name: string | null
  quantity: number
  /** Total amount invested (avg price × quantity), in paise. */
  investedPaise: number
  notes: string | null
  tags: string[]
}

/** Fetch all (non-deleted) market holdings for a family. */
export async function fetchMarketHoldings(
  familyId: string,
): Promise<MarketHolding[]> {
  const { data, error } = await supabase
    .from('market_holdings')
    .select(
      'id, owner_id, kind, isin, symbol, exchange, name, quantity, invested_paise, notes, tags',
    )
    .eq('family_id', familyId)
    .is('deleted_at', null)
    .order('kind', { ascending: true })
    .order('symbol', { ascending: true })

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id,
    ownerId: row.owner_id ?? null,
    kind: row.kind,
    isin: row.isin ?? null,
    symbol: row.symbol,
    exchange: row.exchange ?? null,
    name: row.name ?? null,
    quantity: Number(row.quantity),
    investedPaise: row.invested_paise,
    notes: row.notes ?? null,
    tags: row.tags ?? [],
  }))
}
