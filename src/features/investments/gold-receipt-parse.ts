/**
 * Shared, DEPENDENCY-FREE helpers for gold-bill extraction. Imported by the
 * `/api/parse-gold-receipt` edge function AND the client, so it must have NO
 * imports (same rule as gold-rate-parse.ts) to avoid extension/alias issues.
 *
 * The heavy lifting (reading the bill image) is done by Gemini; this module
 * only holds the prompt + response schema and normalises Gemini's raw JSON into
 * a shape that maps 1:1 onto the gold form (rupees / grams / ppt fineness).
 */

export type GoldFormKind = 'coin' | 'bar' | 'jewellery'

/** Extracted bill fields, already shaped like the gold form values. */
export interface ParsedGoldReceipt {
  form: GoldFormKind | null
  /** Fineness in parts-per-thousand (999 = 24K, 916 = 22K…). */
  fineness: number | null
  name: string | null
  /** Net gold weight in grams. */
  weightGrams: number | null
  quantity: number | null
  /** ISO date YYYY-MM-DD. */
  purchaseDate: string | null
  /** Final all-in amount paid, in rupees. */
  priceTotal: number | null
  makingCharges: number | null
  va: number | null
  stoneCharges: number | null
  gstPercent: number | null
  discount: number | null
  brand: string | null
}

/** Purities we snap to (matches PURITY_PRESETS in config.ts). */
export const ALLOWED_FINENESS = [999, 995, 916, 875, 833, 750, 585]

/** Instruction sent to Gemini alongside the bill image. */
export const RECEIPT_PROMPT = `You are reading an Indian jeweller's or bullion TAX INVOICE for a gold purchase. Extract the fields into the given JSON schema. Rules:
- form: "jewellery" for ornaments/chains/kante/bangles, "coin" for coins, "bar" for bars/biscuits. If unsure but there are making/stone charges, use "jewellery".
- fineness: parts-per-thousand from the purity. 24K/24KT/999 -> 999; 995 -> 995; 22K/22KT/916 -> 916; 21K -> 875; 20K -> 833; 18K -> 750; 14K -> 585. Use the closest of [999,995,916,875,833,750,585].
- weightGrams: the NET gold weight (gross weight minus stone weight) in grams. If only a gross/net weight column exists, use the net one.
- quantity: number of pieces (Pcs). Default 1.
- purchaseDate: the invoice date as YYYY-MM-DD.
- priceTotal: the FINAL amount the customer actually paid (grand total / total receipt / net amount, inclusive of GST), in rupees.
- makingCharges: making / labour / VA charges in rupees (often a column like "VA Chg" or "MC").
- va: value-addition charges in rupees ONLY if shown SEPARATELY from making charges; otherwise null.
- stoneCharges: stone / diamond / "Col.St.& Ot.Chg" charges in rupees.
- gstPercent: the TOTAL GST rate as a number (CGST + SGST, e.g. 1.5 + 1.5 = 3).
- discount: any discount amount in rupees (applied before GST); otherwise null.
- brand: the shop / jeweller name.
All amounts are plain rupee numbers with no symbols or commas. Use null for anything not clearly present. Do not guess.`

/** Gemini `responseSchema` (OpenAPI subset; type names are UPPERCASE). */
export const RECEIPT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    form: { type: 'STRING', enum: ['coin', 'bar', 'jewellery'], nullable: true },
    fineness: { type: 'INTEGER', nullable: true },
    name: { type: 'STRING', nullable: true },
    weightGrams: { type: 'NUMBER', nullable: true },
    quantity: { type: 'INTEGER', nullable: true },
    purchaseDate: { type: 'STRING', nullable: true },
    priceTotal: { type: 'NUMBER', nullable: true },
    makingCharges: { type: 'NUMBER', nullable: true },
    va: { type: 'NUMBER', nullable: true },
    stoneCharges: { type: 'NUMBER', nullable: true },
    gstPercent: { type: 'NUMBER', nullable: true },
    discount: { type: 'NUMBER', nullable: true },
    brand: { type: 'STRING', nullable: true },
  },
}

function cleanString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/** A finite number ≥ 0, else null. */
function nonNegNumber(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value.replace(/,/g, '')) : value
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null
}

function snapFineness(value: unknown): number | null {
  const n = nonNegNumber(value)
  if (n == null || n <= 0) return null
  let best = ALLOWED_FINENESS[0]
  for (const f of ALLOWED_FINENESS) {
    if (Math.abs(f - n) < Math.abs(best - n)) best = f
  }
  return best
}

/**
 * Coerce Gemini's raw JSON into a safe ParsedGoldReceipt. Anything missing,
 * malformed or out-of-range becomes null so the form simply isn't prefilled
 * for that field (never a wrong/garbage value).
 */
export function normalizeParsedReceipt(raw: unknown): ParsedGoldReceipt {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>

  const form =
    r.form === 'coin' || r.form === 'bar' || r.form === 'jewellery'
      ? r.form
      : null

  const quantityRaw = nonNegNumber(r.quantity)
  const quantity =
    quantityRaw != null && quantityRaw >= 1 ? Math.round(quantityRaw) : null

  const gstRaw = nonNegNumber(r.gstPercent)
  const gstPercent = gstRaw != null && gstRaw <= 100 ? gstRaw : null

  const date = cleanString(r.purchaseDate)
  const purchaseDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null

  return {
    form,
    fineness: snapFineness(r.fineness),
    name: cleanString(r.name),
    weightGrams: nonNegNumber(r.weightGrams),
    quantity,
    purchaseDate,
    priceTotal: nonNegNumber(r.priceTotal),
    makingCharges: nonNegNumber(r.makingCharges),
    va: nonNegNumber(r.va),
    stoneCharges: nonNegNumber(r.stoneCharges),
    gstPercent,
    discount: nonNegNumber(r.discount),
    brand: cleanString(r.brand),
  }
}
