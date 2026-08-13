import { getCurrentIstDate } from '@/lib/date'
import type { ParsedTransaction } from '@/features/transactions/nl-parse'
import type { Category } from '@/features/categories/api/category-queries'
import type { AccountWithBalance } from '@/features/accounts/api/account-queries'

/**
 * Client for the /api/parse-transaction serverless function (Gemini). Only works
 * where the function is deployed (Vercel) or under the vite dev middleware with
 * GEMINI_API_KEY set — callers must handle failure gracefully.
 *
 * We send the family's category + account NAMES (not amounts or balances) so the
 * model can map the note to real ones; nothing else about the ledger is shared.
 */
export async function parseTransaction(input: {
  text: string
  categories: Category[]
  accounts: AccountWithBalance[]
}): Promise<ParsedTransaction> {
  const payload = {
    text: input.text,
    today: getCurrentIstDate(),
    expenseCategories: input.categories
      .filter((c) => c.kind === 'expense')
      .map((c) => c.name),
    incomeCategories: input.categories
      .filter((c) => c.kind === 'income')
      .map((c) => c.name),
    accounts: input.accounts.map((a) => a.name),
  }

  const response = await fetch('/api/parse-transaction', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    let message = `Parse failed (${response.status})`
    try {
      const body = (await response.json()) as { error?: string }
      if (body?.error) message = body.error
    } catch {
      // Non-JSON error (e.g. 404 under bare `vite dev`) — keep the generic msg.
    }
    throw new Error(message)
  }

  return (await response.json()) as ParsedTransaction
}
