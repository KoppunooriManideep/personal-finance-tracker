/**
 * Chit fund return calculations.
 *
 * Pure functions only — no React, no Supabase, no I/O. This is the single
 * source of truth for chit returns and is intentionally dependency-free so it
 * can be unit tested in isolation.
 *
 * Approach: we compute returns from ACTUAL recorded data (what was paid each
 * month, and the amount received if the chit was taken) rather than simulating
 * chit auction mechanics. This makes the numbers exact for any chit variant.
 *
 * All money values are INTEGER paise (see src/lib/money.ts). XIRR is
 * scale-invariant, so paise can be passed to it directly.
 */

/** A single recorded monthly payment (net amount actually paid). */
export interface ChitPaymentInput {
  /** 1-based installment number within the chit's tenure. */
  monthNumber: number
  /** Net amount paid that month, in paise (>= 0). */
  amountPaid: number
  /**
   * ISO date (YYYY-MM-DD) the payment was made. When omitted, the date is
   * derived from the chit's start date and month number.
   */
  paymentDate?: string | null
}

/** Everything the engine needs to summarise one chit. */
export interface ChitInput {
  /** Total chit value in paise. */
  chitValue: number
  /** Number of monthly installments. */
  tenureMonths: number
  /** Base EMI: the flat monthly instalment agreed for the chit, in paise. */
  baseMonthly: number
  /** ISO date (YYYY-MM-DD) of the first installment (month 1). */
  startDate: string
  /** 1-based month the chit was taken/prized, or null if not yet taken. */
  receivedMonth?: number | null
  /** Amount received when the chit was taken, in paise, or null. */
  receivedAmount?: number | null
  /** Recorded monthly payments (any order; duplicates by month are summed). */
  payments: ChitPaymentInput[]
}

/** Derived, display-ready metrics for a chit. */
export interface ChitSummary {
  /** Sum of all recorded payments (paise). */
  totalPaid: number
  /** Base EMI: the flat monthly instalment recorded for the chit, in paise. */
  baseMonthly: number
  /**
   * Total commission (dividend) earned across recorded months (paise): the
   * flat base instalment × months paid − what you actually paid. Positive when
   * dividends let you pay below the flat EMI (the normal chit case).
   */
  totalCommission: number
  /** Amount received so far (paise); 0 if the chit has not been taken. */
  totalReceived: number
  /**
   * received − paid (paise). Negative while you are still investing and have
   * not yet been paid out. This is the current cash position, not final profit.
   */
  netPosition: number
  /** Number of distinct months with a recorded payment. */
  monthsPaid: number
  /** tenureMonths − monthsPaid, clamped to >= 0. */
  monthsRemaining: number
  /** Whether the chit has been taken (received month + amount present). */
  isReceived: boolean
  /** Whether every installment has been recorded. */
  isComplete: boolean
  /**
   * Overall simple return on money paid, as a percentage
   * (netPosition / totalPaid * 100). Null when nothing has been paid.
   */
  simpleReturnPct: number | null
  /**
   * Annualised return (XIRR) as a percentage. Null when it cannot be computed
   * — e.g. no payout yet (all cash flows have the same sign) or too few flows.
   */
  xirrPct: number | null
}

/** A dated cash flow used for XIRR. Outflows are negative, inflows positive. */
export interface CashFlow {
  date: Date
  /** Amount in paise. */
  amount: number
}

const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000

/** Parse a YYYY-MM-DD string to a UTC-noon Date (avoids timezone drift). */
function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0))
}

/** Add `months` to a Date, clamping the day to the target month's length. */
function addMonths(date: Date, months: number): Date {
  const y = date.getUTCFullYear()
  const m = date.getUTCMonth() + months
  const targetYear = y + Math.floor(m / 12)
  const targetMonth = ((m % 12) + 12) % 12
  const daysInMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  const day = Math.min(date.getUTCDate(), daysInMonth)
  return new Date(Date.UTC(targetYear, targetMonth, day, 12, 0, 0))
}

/**
 * The date an installment falls on: start date shifted by (monthNumber − 1)
 * months. Month 1 == the start date.
 */
export function dateForMonth(startDate: string, monthNumber: number): Date {
  return addMonths(parseISODate(startDate), monthNumber - 1)
}

/**
 * Build the dated cash flows for a chit: one negative flow per payment and, if
 * the chit has been taken, one positive flow for the amount received. Flows are
 * returned sorted by date ascending.
 */
export function buildCashFlows(input: ChitInput): CashFlow[] {
  const flows: CashFlow[] = []

  for (const p of input.payments) {
    if (p.amountPaid <= 0) continue
    const date = p.paymentDate
      ? parseISODate(p.paymentDate)
      : dateForMonth(input.startDate, p.monthNumber)
    flows.push({ date, amount: -p.amountPaid })
  }

  if (
    input.receivedMonth != null &&
    input.receivedAmount != null &&
    input.receivedAmount > 0
  ) {
    flows.push({
      date: dateForMonth(input.startDate, input.receivedMonth),
      amount: input.receivedAmount,
    })
  }

  flows.sort((a, b) => a.date.getTime() - b.date.getTime())
  return flows
}

/**
 * Annualised internal rate of return for irregular, dated cash flows (XIRR),
 * returned as a fraction (0.16 == 16% p.a.). Returns null when the flows do not
 * bracket a solution — fewer than two flows, or all the same sign.
 *
 * Uses bisection over a wide bracket (robust, always converges when a root is
 * bracketed) then refines with a few Newton–Raphson steps.
 */
export function xirr(flows: CashFlow[]): number | null {
  if (flows.length < 2) return null
  const hasInflow = flows.some((f) => f.amount > 0)
  const hasOutflow = flows.some((f) => f.amount < 0)
  if (!hasInflow || !hasOutflow) return null

  const t0 = flows[0].date.getTime()
  const yearsOf = (d: Date) => (d.getTime() - t0) / MS_PER_YEAR

  const npv = (rate: number): number =>
    flows.reduce((sum, f) => sum + f.amount / Math.pow(1 + rate, yearsOf(f.date)), 0)

  // Bisection: NPV is monotonically decreasing in rate for a normal investment
  // (outflows early, inflow later). Bracket from just above -100% to +1000%.
  let lo = -0.9999
  let hi = 10
  let fLo = npv(lo)
  let fHi = npv(hi)

  // Expand the upper bound if the root is beyond it (very high returns).
  let expand = 0
  while (fLo * fHi > 0 && hi < 1e6 && expand < 40) {
    hi *= 2
    fHi = npv(hi)
    expand += 1
  }
  if (fLo * fHi > 0) return null // no sign change → cannot bracket a root

  let rate = lo
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    const fMid = npv(mid)
    rate = mid
    if (Math.abs(fMid) < 1e-6 || (hi - lo) / 2 < 1e-9) break
    if (fLo * fMid < 0) {
      hi = mid
    } else {
      lo = mid
      fLo = fMid
    }
  }

  if (!Number.isFinite(rate) || rate <= -0.9999) return null
  return rate
}

/** Summarise a chit's actuals into display-ready metrics. */
export function summarizeChit(input: ChitInput): ChitSummary {
  const totalPaid = input.payments.reduce(
    (sum, p) => sum + Math.max(0, p.amountPaid),
    0,
  )

  const isReceived =
    input.receivedMonth != null && input.receivedAmount != null
  const totalReceived = isReceived ? (input.receivedAmount as number) : 0

  const monthsPaid = new Set(
    input.payments.filter((p) => p.amountPaid > 0).map((p) => p.monthNumber),
  ).size
  const monthsRemaining = Math.max(0, input.tenureMonths - monthsPaid)

  const netPosition = totalReceived - totalPaid
  const simpleReturnPct =
    totalPaid > 0 ? (netPosition / totalPaid) * 100 : null

  const baseMonthly = Math.max(0, input.baseMonthly)
  const totalCommission = baseMonthly * monthsPaid - totalPaid

  const rate = xirr(buildCashFlows(input))
  const xirrPct = rate == null ? null : rate * 100

  return {
    totalPaid,
    baseMonthly,
    totalCommission,
    totalReceived,
    netPosition,
    monthsPaid,
    monthsRemaining,
    isReceived,
    isComplete: monthsPaid >= input.tenureMonths,
    simpleReturnPct,
    xirrPct,
  }
}

/** A chit plus assumptions for filling in the months that haven't happened. */
export interface ProjectChitInput extends ChitInput {
  /** Assumed net payment (paise) for every month with no recorded payment. */
  assumedMonthlyPaise: number
  /**
   * If the chit has not been taken, assume it is received in the final month
   * for this amount (paise). Null/undefined leaves it un-taken in the forecast.
   */
  assumedFinalReceivePaise?: number | null
}

/**
 * Forecast the final outcome of a chit: keep all recorded actuals, fill every
 * un-recorded month with `assumedMonthlyPaise`, and (if not already taken)
 * optionally assume a payout in the final month. Returns the same shape as
 * summarizeChit so the UI can reuse it.
 */
export function projectChit(input: ProjectChitInput): ChitSummary {
  const recordedMonths = new Set(
    input.payments.filter((p) => p.amountPaid > 0).map((p) => p.monthNumber),
  )

  const projectedPayments: ChitPaymentInput[] = [...input.payments]
  for (let month = 1; month <= input.tenureMonths; month++) {
    if (!recordedMonths.has(month)) {
      projectedPayments.push({
        monthNumber: month,
        amountPaid: input.assumedMonthlyPaise,
      })
    }
  }

  let receivedMonth = input.receivedMonth ?? null
  let receivedAmount = input.receivedAmount ?? null
  if (
    (receivedMonth == null || receivedAmount == null) &&
    input.assumedFinalReceivePaise != null &&
    input.assumedFinalReceivePaise > 0
  ) {
    receivedMonth = input.tenureMonths
    receivedAmount = input.assumedFinalReceivePaise
  }

  return summarizeChit({
    chitValue: input.chitValue,
    tenureMonths: input.tenureMonths,
    baseMonthly: input.baseMonthly,
    startDate: input.startDate,
    receivedMonth,
    receivedAmount,
    payments: projectedPayments,
  })
}
