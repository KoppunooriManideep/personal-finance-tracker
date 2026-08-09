/**
 * Pure parser for the GoodReturns gold-rates page. No I/O, no imports — the
 * fetch happens in the caller (the Vercel Edge function in prod, the Vite dev
 * middleware locally), so this stays unit-testable.
 *
 * The page contains a sentence like:
 *   "…stands at ₹15,235 per gram for 24 karat gold (99.9% purity),
 *     ₹13,965 per gram for 22 karat gold (91.6% purity),
 *     and ₹11,426 per gram for 18 karat gold (75% purity)."
 * ₹ is encoded as the entity &#8377; and the numbers sit inside <strong> tags,
 * so we decode the entity, strip tags, then read each "N per gram for <k> karat".
 */

export interface ParsedGoldRates {
  /** 24K (999) rate in whole rupees per gram. */
  rate24kRupees: number
  rate22kRupees: number | null
  rate18kRupees: number | null
}

/** Read "<number> per gram for <karat> karat" as a sane rupee amount. */
function perGram(text: string, karat: number): number | null {
  const match = text.match(
    new RegExp(`([\\d,]+)\\s*per gram for ${karat}\\s*karat`, 'i'),
  )
  if (!match) return null
  const rupees = Number(match[1].replace(/,/g, ''))
  // Sanity bounds so a layout change can't yield a garbage rate.
  if (!Number.isFinite(rupees) || rupees < 500 || rupees > 1_000_000) return null
  return rupees
}

/** Parse the three purity rates from the raw GoodReturns HTML. */
export function parseGoldRatesFromHtml(html: string): ParsedGoldRates | null {
  const text = html
    .replace(/&#8377;|&#x20b9;/gi, '₹')
    .replace(/<[^>]*>/g, ' ')

  const rate24kRupees = perGram(text, 24)
  if (rate24kRupees == null) return null

  return {
    rate24kRupees,
    rate22kRupees: perGram(text, 22),
    rate18kRupees: perGram(text, 18),
  }
}

/** The JSON payload shape returned by /api/gold-rate (rupees + paise). */
export interface GoldRatePayload {
  source: string
  fetchedAt: string
  perGramRupees: { '24k': number; '22k': number | null; '18k': number | null }
  rate24kPaise: number
  rate22kPaise: number | null
  rate18kPaise: number | null
}

/** Build the endpoint payload from parsed rates + a fetch timestamp. */
export function buildGoldRatePayload(
  rates: ParsedGoldRates,
  fetchedAtIso: string,
): GoldRatePayload {
  const toPaise = (rupees: number | null) =>
    rupees == null ? null : rupees * 100

  return {
    source: 'GoodReturns',
    fetchedAt: fetchedAtIso,
    perGramRupees: {
      '24k': rates.rate24kRupees,
      '22k': rates.rate22kRupees,
      '18k': rates.rate18kRupees,
    },
    rate24kPaise: rates.rate24kRupees * 100,
    rate22kPaise: toPaise(rates.rate22kRupees),
    rate18kPaise: toPaise(rates.rate18kRupees),
  }
}
