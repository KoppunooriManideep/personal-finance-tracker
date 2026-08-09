import { istPeriodKey } from '@/lib/date'
import { summarizeGoldPortfolio } from '@/features/investments/gold-math'
import type { GoldHolding } from '@/features/investments/api/gold-queries'

/** Gold insights for a report period: what was bought + the current snapshot. */
export interface GoldReportSlice {
  /** Number of holdings currently held (scoped to the report's view). */
  count: number
  /** Holdings purchased within the report period. */
  boughtCount: number
  boughtSpentPaise: number
  boughtWeightMg: number
  /** Current-portfolio snapshot (point in time, not period-bound). */
  investedPaise: number
  currentValuePaise: number
  gainPaise: number
  gainPct: number | null
  totalWeightMg: number
  hasRate: boolean
}

export interface GoldReportContext {
  /** `YYYY-MM` keys (IST) that make up the reporting period. */
  periodKeys: string[]
  /** Null = whole family; otherwise scope to this holding owner. */
  selectedOwnerId: string | null
  /** Current 24K (999) rate in paise per gram; 0 when unknown. */
  spotPaisePerGram: number
}

/**
 * Aggregate gold for a report: "bought this period" (by purchase_date within the
 * period) plus the current-portfolio snapshot. Both are scoped to the selected
 * owner so the figure matches the report's whole-family / member view.
 */
export function aggregateGoldForReport(
  holdings: GoldHolding[],
  { periodKeys, selectedOwnerId, spotPaisePerGram }: GoldReportContext,
): GoldReportSlice {
  const scoped = selectedOwnerId
    ? holdings.filter((h) => h.ownerId === selectedOwnerId)
    : holdings
  const keySet = new Set(periodKeys)

  let boughtCount = 0
  let boughtSpentPaise = 0
  let boughtWeightMg = 0
  for (const h of scoped) {
    if (keySet.has(istPeriodKey(h.purchaseDate))) {
      boughtCount += 1
      boughtSpentPaise += h.priceTotalPaise
      boughtWeightMg += h.weightMg * h.quantity
    }
  }

  const portfolio = summarizeGoldPortfolio(scoped, spotPaisePerGram)

  return {
    count: scoped.length,
    boughtCount,
    boughtSpentPaise,
    boughtWeightMg,
    investedPaise: portfolio.effectiveCostPaise,
    currentValuePaise: portfolio.currentValuePaise,
    gainPaise: portfolio.gainPaise,
    gainPct: portfolio.gainPct,
    totalWeightMg: portfolio.totalWeightMg,
    hasRate: spotPaisePerGram > 0,
  }
}
