import { formatPaise } from '@/lib/money'
import { formatMonthYear } from '@/lib/date'
import { dateForMonth, type ChitSummary } from '@/features/chits/chit-math'
import type { Chit } from '@/features/chits/api/chit-queries'

/**
 * A plain-text summary of a chit suitable for sharing (WhatsApp, notes, etc.)
 * or copying to the clipboard. Zero-dependency; no PDF library.
 */
export function buildChitShareText(chit: Chit, summary: ChitSummary): string {
  const lines: string[] = []
  lines.push(chit.name)

  const head = [
    `${formatPaise(chit.chitValue, { decimals: false })} chit`,
    `${chit.tenureMonths} months`,
  ]
  if (chit.organizer) head.push(chit.organizer)
  lines.push(head.join(' · '))
  lines.push('')

  lines.push(`Base EMI: ${formatPaise(summary.baseMonthly)}/mo`)
  lines.push(
    `Total paid: ${formatPaise(summary.totalPaid)} (${summary.monthsPaid}/${chit.tenureMonths} months)`,
  )
  lines.push(`Commission earned: ${formatPaise(summary.totalCommission)}`)

  if (summary.isReceived) {
    lines.push(
      `Received: ${formatPaise(summary.totalReceived)} in ${formatMonthYear(
        dateForMonth(chit.startDate, chit.receivedMonth ?? 1),
      )}`,
    )
  } else {
    lines.push('Chit taken: not yet')
  }

  lines.push(`Net position: ${formatPaise(summary.netPosition)}`)

  const returns: string[] = []
  if (summary.simpleReturnPct != null) {
    returns.push(`simple ${summary.simpleReturnPct.toFixed(1)}%`)
  }
  if (summary.xirrPct != null) {
    returns.push(`XIRR ${summary.xirrPct.toFixed(1)}% p.a.`)
  }
  if (returns.length > 0) lines.push(`Return: ${returns.join(' · ')}`)

  return lines.join('\n')
}

/**
 * Share `text` via the Web Share API when available (mobile), otherwise copy it
 * to the clipboard. Resolves to how it was handled so the caller can toast.
 * A user-cancelled share resolves to 'cancelled'.
 */
export async function shareOrCopy(
  title: string,
  text: string,
): Promise<'shared' | 'copied' | 'cancelled'> {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title, text })
      return 'shared'
    } catch (error) {
      // The user dismissing the share sheet throws AbortError — not a failure.
      if (error instanceof DOMException && error.name === 'AbortError') {
        return 'cancelled'
      }
      // Fall through to clipboard on any other share failure.
    }
  }
  await navigator.clipboard.writeText(text)
  return 'copied'
}
