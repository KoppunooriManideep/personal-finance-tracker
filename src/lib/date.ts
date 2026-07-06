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
