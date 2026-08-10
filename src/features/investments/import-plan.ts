import type { MarketHolding } from '@/features/investments/api/market-queries'
import type { MarketHoldingWrite } from '@/features/investments/api/market-mutations'

export interface MarketImportPlan {
  /** Holdings not already tracked (by ISIN) → insert. */
  inserts: MarketHoldingWrite[]
  /** Holdings that already exist (by ISIN) → update units/invested in place. */
  updates: { id: string; input: MarketHoldingWrite }[]
}

/**
 * Diff a set of imported rows against existing holdings so re-importing a broker
 * export is idempotent (e.g. monthly after SIPs): rows whose ISIN already exists
 * UPDATE that holding's quantity/invested; new ISINs are inserted. Duplicate ISIN
 * rows within the file are collapsed. Matched holdings keep their existing owner,
 * name, notes and tags — only the position (units/cost/symbol) is refreshed.
 */
export function planMarketImport(
  rows: MarketHoldingWrite[],
  existing: MarketHolding[],
): MarketImportPlan {
  const byIsin = new Map<string, MarketHolding>()
  for (const holding of existing) {
    if (!holding.isin) continue
    const key = holding.isin.toUpperCase()
    if (!byIsin.has(key)) byIsin.set(key, holding)
  }

  const inserts: MarketHoldingWrite[] = []
  const updates: { id: string; input: MarketHoldingWrite }[] = []
  const seen = new Set<string>()

  for (const row of rows) {
    const key = row.isin ? row.isin.toUpperCase() : null
    if (key && seen.has(key)) continue // duplicate ISIN row in the file
    if (key) seen.add(key)

    const match = key ? byIsin.get(key) : undefined
    if (match) {
      updates.push({
        id: match.id,
        input: {
          ...row,
          ownerId: match.ownerId, // don't reassign owner on re-import
          name: row.name ?? match.name,
          notes: match.notes,
          tags: match.tags,
        },
      })
    } else {
      inserts.push(row)
    }
  }

  return { inserts, updates }
}
