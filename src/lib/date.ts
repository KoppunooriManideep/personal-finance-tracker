/**
 * Date utilities.
 *
 * Timestamps are stored in UTC and always displayed in IST (Asia/Kolkata)
 * using the DD/MM/YYYY format expected by Indian users.
 */

const TIME_ZONE = 'Asia/Kolkata'

type DateInput = string | number | Date

function toDate(input: DateInput): Date {
  return input instanceof Date ? input : new Date(input)
}

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const dateTimeFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
})

const monthYearFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: TIME_ZONE,
  month: 'long',
  year: 'numeric',
})

/** Format as DD/MM/YYYY in IST. @example "05/07/2026" */
export function formatDate(input: DateInput): string {
  return dateFormatter.format(toDate(input))
}

/** Format as DD/MM/YYYY, hh:mm AM/PM in IST. */
export function formatDateTime(input: DateInput): string {
  return dateTimeFormatter.format(toDate(input))
}

/** Format as full month + year in IST. @example "July 2026" */
export function formatMonthYear(input: DateInput): string {
  return monthYearFormatter.format(toDate(input))
}

/** Return the current `YYYY-MM` (IST) — the value a `type="month"` input uses. */
export function getCurrentIstMonth(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date())
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  return `${year}-${month}`
}

/** Today's date as `YYYY-MM-DD` (IST) — the value a `type="date"` input uses. */
export function getCurrentIstDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/** The `YYYY-MM` period (IST) a timestamp falls in. */
export function istPeriodKey(input: DateInput): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(toDate(input))
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  return `${year}-${month}`
}

/**
 * Start year of the current Indian financial year (Apr–Mar). Jan–Mar belong to
 * the previous year's FY (e.g. Feb 2026 → FY starting 2025).
 */
export function getCurrentFinancialYearStart(): number {
  const key = getCurrentIstMonth()
  const year = Number(key.slice(0, 4))
  const month = Number(key.slice(5, 7))
  return month >= 4 ? year : year - 1
}

/** Human label for a financial year, e.g. 2025 → "FY 2025–26". */
export function financialYearLabel(startYear: number): string {
  const endShort = String((startYear + 1) % 100).padStart(2, '0')
  return `FY ${startYear}–${endShort}`
}

/**
 * Return `YYYY-MM-DD` for the first day of the given date's month (IST).
 * Handy for the budgets `period_month` column.
 */
export function toPeriodMonth(input: DateInput = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(toDate(input))
  const year = parts.find((p) => p.type === 'year')?.value
  const month = parts.find((p) => p.type === 'month')?.value
  return `${year}-${month}-01`
}
