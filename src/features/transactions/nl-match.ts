import type { ParsedTransaction } from '@/features/transactions/nl-parse'
import type { TransactionFormValues } from '@/features/transactions/schema'
import type { Category } from '@/features/categories/api/category-queries'
import type { AccountWithBalance } from '@/features/accounts/api/account-queries'

/** Find an item by name — exact (case-insensitive) first, then a loose contains. */
function findByName<T extends { name: string }>(
  items: T[],
  name: string | null,
): T | undefined {
  if (!name) return undefined
  const needle = name.trim().toLowerCase()
  if (!needle) return undefined
  return (
    items.find((i) => i.name.toLowerCase() === needle) ??
    items.find((i) => {
      const hay = i.name.toLowerCase()
      return hay.includes(needle) || needle.includes(hay)
    })
  )
}

/**
 * Turn a parsed (name-based) transaction into a partial form patch with real
 * ids. Only fields we could confidently resolve are included; the rest stay for
 * the user to fill. Category is matched within the kind that fits the type.
 */
export function matchParsedTransaction(
  parsed: ParsedTransaction,
  { categories, accounts }: { categories: Category[]; accounts: AccountWithBalance[] },
): Partial<TransactionFormValues> {
  const patch: Partial<TransactionFormValues> = {}

  const type = parsed.type ?? undefined
  if (type) patch.type = type
  if (parsed.amount != null && parsed.amount > 0) patch.amount = parsed.amount
  if (parsed.date) patch.occurredOn = parsed.date
  if (parsed.note) patch.note = parsed.note

  if (type === 'transfer') {
    const from = findByName(accounts, parsed.fromAccount)
    const to = findByName(accounts, parsed.toAccount)
    if (from) patch.fromAccountId = from.id
    if (to && to.id !== from?.id) patch.toAccountId = to.id
  } else {
    const account = findByName(accounts, parsed.account)
    if (account) patch.accountId = account.id

    // Match the category only within the kind implied by the type.
    const kind = type === 'income' ? 'income' : 'expense'
    const category = findByName(
      categories.filter((c) => c.kind === kind),
      parsed.category,
    )
    if (category) patch.categoryId = category.id
  }

  return patch
}
