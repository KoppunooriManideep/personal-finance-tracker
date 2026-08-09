/**
 * Gold holding valuation.
 *
 * Pure functions only — no React, no Supabase, no I/O — so the money math is
 * unit-testable in isolation (mirrors chit-math.ts).
 *
 * Money is INTEGER paise (see src/lib/money.ts). Weight is INTEGER milligrams
 * (1.000 g = 1000 mg). Fineness is parts-per-thousand: 999 = 24K, 916 = 22K,
 * 750 = 18K, etc.
 *
 * Live value is derived from ONE reference rate — the 24K (999) price per gram —
 * scaled by each item's fineness. So a 22K (916) item is worth 916/999 of the
 * 24K rate per gram, matching how Indian rates (e.g. GoodReturns) quote 22K vs
 * 24K.
 */

import type { GoldForm } from '@/types/database.types'

/** The 999 reference fineness the spot rate is quoted against. */
export const REFERENCE_FINENESS = 999

/** Everything the engine needs to value one gold line (all units may repeat). */
export interface GoldHoldingInput {
  form: GoldForm
  /** Fineness in parts-per-thousand (1..1000). */
  fineness: number
  /** Weight of ONE unit, in milligrams. */
  weightMg: number
  /** Number of identical units. */
  quantity: number
  /** Total amount paid for the whole line, in paise. */
  priceTotalPaise: number
  /** Optional rewards that REDUCE effective cost (all default to 0). */
  cashbackPaise: number
  /** Cash value of credit-card reward points earned, in paise. */
  rewardValuePaise: number
  /** Vouchers + wallet credits + SuperCoins used, in paise. */
  voucherSavingsPaise: number
}

/** Derived, display-ready metrics for one gold line. */
export interface GoldHoldingSummary {
  /** Gross weight across all units, in milligrams. */
  totalWeightMg: number
  /** Pure (100%) gold content across all units, in milligrams. */
  pureWeightMg: number
  /** What was paid (before benefits), in paise. */
  investedPaise: number
  /** Sum of all benefits that reduce the real cost, in paise. */
  benefitsPaise: number
  /** investedPaise − benefitsPaise, in paise. */
  effectiveCostPaise: number
  /** Live market value at the current 24K rate, in paise. */
  currentValuePaise: number
  /** currentValue − effectiveCost, in paise. */
  gainPaise: number
  /** Gain as a % of effective cost. Null when effective cost is 0 or less. */
  gainPct: number | null
  /** Paid price per gram (gross weight), in paise. Null with no weight. */
  pricePerGramPaise: number | null
  /** Effective cost per gram (gross weight), in paise. Null with no weight. */
  effectivePerGramPaise: number | null
}

/** Per-gram rate for a given fineness, derived from the 24K (999) rate. */
export function ratePerGram(
  spot999PaisePerGram: number,
  fineness: number,
): number {
  return Math.round((spot999PaisePerGram * fineness) / REFERENCE_FINENESS)
}

/** Gross weight across all units of a line, in milligrams. */
export function totalWeightMg(h: GoldHoldingInput): number {
  return h.weightMg * h.quantity
}

/** Pure gold content across all units, in milligrams (weight × fineness/1000). */
export function pureWeightMg(h: GoldHoldingInput): number {
  return Math.round((totalWeightMg(h) * h.fineness) / 1000)
}

/** Sum of every reward that lowers the effective cost, in paise. */
export function totalBenefitsPaise(h: GoldHoldingInput): number {
  return h.cashbackPaise + h.rewardValuePaise + h.voucherSavingsPaise
}

/** What the gold really cost after benefits, in paise (may be negative). */
export function effectiveCostPaise(h: GoldHoldingInput): number {
  return h.priceTotalPaise - totalBenefitsPaise(h)
}

/**
 * Live market value of a line, in paise, from the 24K (999) rate per gram.
 * value = grossGrams × (fineness / 999) × spot.
 */
export function currentValuePaise(
  h: GoldHoldingInput,
  spot999PaisePerGram: number,
): number {
  if (spot999PaisePerGram <= 0) return 0
  return Math.round(
    (totalWeightMg(h) * h.fineness * spot999PaisePerGram) /
      (1000 * REFERENCE_FINENESS),
  )
}

/** Summarise one gold line at the given 24K rate. */
export function summarizeGoldHolding(
  h: GoldHoldingInput,
  spot999PaisePerGram: number,
): GoldHoldingSummary {
  const weight = totalWeightMg(h)
  const investedPaise = h.priceTotalPaise
  const benefitsPaise = totalBenefitsPaise(h)
  const effective = investedPaise - benefitsPaise
  const current = currentValuePaise(h, spot999PaisePerGram)
  const gain = current - effective

  return {
    totalWeightMg: weight,
    pureWeightMg: pureWeightMg(h),
    investedPaise,
    benefitsPaise,
    effectiveCostPaise: effective,
    currentValuePaise: current,
    gainPaise: gain,
    gainPct: effective > 0 ? (gain / effective) * 100 : null,
    pricePerGramPaise:
      weight > 0 ? Math.round((investedPaise * 1000) / weight) : null,
    effectivePerGramPaise:
      weight > 0 ? Math.round((effective * 1000) / weight) : null,
  }
}

/** A slice of the portfolio grouped by some key (form, purity, owner…). */
export interface GoldAllocationSlice {
  key: string
  currentValuePaise: number
  weightMg: number
  /** Share of total current value, as a percentage (0 when total is 0). */
  pct: number
}

/** Portfolio-wide gold totals plus allocation breakdowns. */
export interface GoldPortfolioSummary {
  count: number
  totalWeightMg: number
  pureWeightMg: number
  investedPaise: number
  benefitsPaise: number
  effectiveCostPaise: number
  currentValuePaise: number
  gainPaise: number
  gainPct: number | null
  /** Current value split by form (coin / bar / jewellery). */
  byForm: GoldAllocationSlice[]
  /** Current value split by fineness (key is the fineness as a string). */
  byPurity: GoldAllocationSlice[]
}

function allocate(
  rows: { key: string; currentValuePaise: number; weightMg: number }[],
  totalCurrentValue: number,
): GoldAllocationSlice[] {
  const groups = new Map<string, { value: number; weight: number }>()
  for (const r of rows) {
    const g = groups.get(r.key) ?? { value: 0, weight: 0 }
    g.value += r.currentValuePaise
    g.weight += r.weightMg
    groups.set(r.key, g)
  }
  return Array.from(groups.entries())
    .map(([key, g]) => ({
      key,
      currentValuePaise: g.value,
      weightMg: g.weight,
      pct: totalCurrentValue > 0 ? (g.value / totalCurrentValue) * 100 : 0,
    }))
    .sort((a, b) => b.currentValuePaise - a.currentValuePaise)
}

/** Summarise a whole gold portfolio at the given 24K rate, with allocations. */
export function summarizeGoldPortfolio(
  holdings: GoldHoldingInput[],
  spot999PaisePerGram: number,
): GoldPortfolioSummary {
  let totalWeight = 0
  let pureWeight = 0
  let invested = 0
  let benefits = 0
  let effective = 0
  let current = 0

  const rows = holdings.map((h) => {
    const s = summarizeGoldHolding(h, spot999PaisePerGram)
    totalWeight += s.totalWeightMg
    pureWeight += s.pureWeightMg
    invested += s.investedPaise
    benefits += s.benefitsPaise
    effective += s.effectiveCostPaise
    current += s.currentValuePaise
    return { h, s }
  })

  const gain = current - effective

  return {
    count: holdings.length,
    totalWeightMg: totalWeight,
    pureWeightMg: pureWeight,
    investedPaise: invested,
    benefitsPaise: benefits,
    effectiveCostPaise: effective,
    currentValuePaise: current,
    gainPaise: gain,
    gainPct: effective > 0 ? (gain / effective) * 100 : null,
    byForm: allocate(
      rows.map(({ h, s }) => ({
        key: h.form,
        currentValuePaise: s.currentValuePaise,
        weightMg: s.totalWeightMg,
      })),
      current,
    ),
    byPurity: allocate(
      rows.map(({ h, s }) => ({
        key: String(h.fineness),
        currentValuePaise: s.currentValuePaise,
        weightMg: s.totalWeightMg,
      })),
      current,
    ),
  }
}
