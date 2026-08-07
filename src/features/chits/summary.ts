import { summarizeChit, type ChitInput, type ChitSummary } from './chit-math'
import type { Chit } from './api/chit-queries'
import type { ChitPayment } from './api/chit-payment-queries'

/** Adapt a stored chit + its payments into the pure engine's input shape. */
export function toChitInput(chit: Chit, payments: ChitPayment[]): ChitInput {
  return {
    chitValue: chit.chitValue,
    tenureMonths: chit.tenureMonths,
    startDate: chit.startDate,
    receivedMonth: chit.receivedMonth,
    receivedAmount: chit.receivedAmount,
    payments: payments.map((p) => ({
      monthNumber: p.monthNumber,
      amountPaid: p.amountPaid,
      paymentDate: p.paymentDate,
    })),
  }
}

/** Summarise a stored chit + its payments. */
export function chitSummary(
  chit: Chit,
  payments: ChitPayment[],
): ChitSummary {
  return summarizeChit(toChitInput(chit, payments))
}

/** Base monthly instalment before any dividend (chit value / tenure), paise. */
export function chitBaseMonthly(chit: Chit): number {
  return Math.round(chit.chitValue / chit.tenureMonths)
}
