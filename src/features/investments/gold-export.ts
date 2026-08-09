import { paiseToRupees } from '@/lib/money'
import { formatDate } from '@/lib/date'
import { toCsv } from '@/lib/csv'
import { finenessLabel, formLabel } from '@/features/investments/config'
import { summarizeGoldHolding } from '@/features/investments/gold-math'
import type { GoldHolding } from '@/features/investments/api/gold-queries'

const CSV_HEADERS = [
  'Purchase date',
  'Type',
  'Name',
  'Purity',
  'Weight (g)',
  'Qty',
  'Price paid (INR)',
  'Rewards (INR)',
  'Effective cost (INR)',
  'Current value (INR)',
  'Gain (INR)',
  'Gain %',
  'Making (INR)',
  'VA (INR)',
  'Stones (INR)',
  'GST %',
  'Tags',
  'Notes',
]

/** Format paise as a plain rupee number (no symbol) for spreadsheet cells. */
const money = (paise: number) => paiseToRupees(paise).toFixed(2)
const grams = (mg: number) => (mg / 1000).toFixed(3)

/**
 * Build a CSV of gold holdings, valued at the given 24K rate. Live-value columns
 * are left blank when no rate is set. Matches what the gold page shows.
 */
export function buildGoldCsv(
  holdings: GoldHolding[],
  spotPaisePerGram: number,
): string {
  const hasRate = spotPaisePerGram > 0

  const rows = holdings.map((h) => {
    const s = summarizeGoldHolding(h, spotPaisePerGram)
    const isJewellery = h.form === 'jewellery'

    return [
      formatDate(`${h.purchaseDate}T12:00:00`),
      formLabel(h.form),
      h.name ?? '',
      finenessLabel(h.fineness),
      grams(s.totalWeightMg),
      String(h.quantity),
      money(h.priceTotalPaise),
      money(s.benefitsPaise),
      money(s.effectiveCostPaise),
      hasRate ? money(s.currentValuePaise) : '',
      hasRate ? money(s.gainPaise) : '',
      hasRate && s.gainPct != null ? s.gainPct.toFixed(2) : '',
      isJewellery ? money(h.makingChargesPaise) : '',
      isJewellery ? money(h.vaPaise) : '',
      isJewellery ? money(h.stoneChargesPaise) : '',
      isJewellery && h.gstPercent > 0 ? String(h.gstPercent) : '',
      h.tags.join('; '),
      h.notes ?? '',
    ]
  })

  return toCsv(CSV_HEADERS, rows)
}

/** A dated filename like `gold-holdings-2026-08-10.csv`. */
export function goldCsvFilename(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `gold-holdings-${yyyy}-${mm}-${dd}.csv`
}
