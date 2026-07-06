/**
 * Money utilities.
 *
 * All money is stored as INTEGER paise (rupees * 100) to avoid floating-point
 * errors. Convert at the UI boundary only. Formatting uses the Indian numbering
 * system (e.g. ₹1,23,456.78) via the en-IN locale.
 */

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const inrFormatterNoDecimals = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

/** Convert a rupee amount (possibly fractional) to integer paise. */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100)
}

/** Convert integer paise to a rupee number. */
export function paiseToRupees(paise: number): number {
  return paise / 100
}

/**
 * Format integer paise as an INR string with the Indian numbering system.
 * @example formatPaise(12345678) // "₹1,23,456.78"
 */
export function formatPaise(
  paise: number,
  options?: { decimals?: boolean },
): string {
  const rupees = paiseToRupees(paise)
  const formatter =
    options?.decimals === false ? inrFormatterNoDecimals : inrFormatter
  return formatter.format(rupees)
}

/** Format a rupee number as INR (Indian numbering). */
export function formatRupees(
  rupees: number,
  options?: { decimals?: boolean },
): string {
  return formatPaise(rupeesToPaise(rupees), options)
}
