/**
 * Provident Fund projection. Pure + unit-testable (mirrors gold-math / market-math).
 *
 * PF can't be fetched live, so we project a manually-anchored balance forward:
 *   projected = balance + monthlyContribution × monthsElapsed + interest
 * where monthsElapsed counts whole months from the `asOf` anchor to today. The
 * anchor is what makes contribution changes safe — when the user reconciles they
 * set a fresh balance + asOf, so the contribution only ever applies *forward*.
 *
 * Interest is a simple estimate on the opening balance for the elapsed period
 * (a bridge between reconciles); when the real annual interest posts, the user
 * corrects the balance. Money is INTEGER paise; dates are `YYYY-MM-DD` (IST).
 */

export interface PfAccountInput {
  balancePaise: number
  /** `YYYY-MM-DD` the balance was accurate. */
  asOf: string
  monthlyContributionPaise: number
  /** Annual interest rate as a percentage (0 = don't accrue interest). */
  annualRatePercent: number
}

export interface PfProjection {
  /** Whole months from asOf to today (0 if asOf is in the future). */
  monthsElapsed: number
  /** Contributions added since the anchor, in paise. */
  contributionsPaise: number
  /** Estimated interest accrued since the anchor, in paise. */
  interestPaise: number
  /** Projected balance today = balance + contributions + interest, in paise. */
  projectedBalancePaise: number
}

function ymd(dateIso: string): [number, number, number] {
  const [y, m, d] = dateIso.split('-').map(Number)
  return [y, m, d]
}

/** Whole months between two `YYYY-MM-DD` dates (0 if `to` is before `from`). */
export function monthsBetween(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = ymd(fromIso)
  const [ty, tm, td] = ymd(toIso)
  const months = (ty - fy) * 12 + (tm - fm) - (td < fd ? 1 : 0)
  return Math.max(0, months)
}

/** Project a PF account's balance to `todayIso` (`YYYY-MM-DD`, IST). */
export function projectPf(
  account: PfAccountInput,
  todayIso: string,
): PfProjection {
  const monthsElapsed = monthsBetween(account.asOf, todayIso)
  const contributionsPaise = account.monthlyContributionPaise * monthsElapsed
  const interestPaise =
    account.annualRatePercent > 0
      ? Math.round(
          (account.balancePaise * account.annualRatePercent * monthsElapsed) /
            (100 * 12),
        )
      : 0

  return {
    monthsElapsed,
    contributionsPaise,
    interestPaise,
    projectedBalancePaise:
      account.balancePaise + contributionsPaise + interestPaise,
  }
}

export interface PfPortfolioSummary {
  count: number
  /** Sum of last-entered balances, in paise. */
  balancePaise: number
  /** Sum of projected balances today, in paise. */
  projectedBalancePaise: number
}

/** Sum projected balances across PF accounts. */
export function summarizePf(
  accounts: PfAccountInput[],
  todayIso: string,
): PfPortfolioSummary {
  let balance = 0
  let projected = 0
  for (const account of accounts) {
    balance += account.balancePaise
    projected += projectPf(account, todayIso).projectedBalancePaise
  }
  return {
    count: accounts.length,
    balancePaise: balance,
    projectedBalancePaise: projected,
  }
}
