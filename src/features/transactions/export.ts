import { paiseToRupees } from '@/lib/money'
import { formatDate } from '@/lib/date'
import { toCsv } from '@/lib/csv'
import { transactionTypeMeta } from '@/features/transactions/config'
import type { Transaction } from '@/features/transactions/api/transaction-queries'
import type { AccountWithBalance } from '@/features/accounts/api/account-queries'
import type { Category } from '@/features/categories/api/category-queries'

interface BuildCsvContext {
  accountsById: Map<string, AccountWithBalance>
  categoriesById: Map<string, Category>
}

const CSV_HEADERS = [
  'Date',
  'Type',
  'Amount (INR)',
  'Account',
  'Category',
  'From',
  'To',
  'Added by',
  'Notes',
]

/** Format paise as a plain rupee number (no symbol) for spreadsheet cells. */
function amountCell(paise: number): string {
  return paiseToRupees(paise).toFixed(2)
}

/**
 * Build a CSV of the given transactions. Names are resolved from the same
 * cached account/category maps the list uses, so the export matches the UI.
 * Income/expense rows fill Account + Category; transfers fill From + To.
 */
export function buildTransactionsCsv(
  transactions: Transaction[],
  { accountsById, categoriesById }: BuildCsvContext,
): string {
  const rows = transactions.map((t) => {
    const accountName =
      t.type === 'transfer'
        ? ''
        : (accountsById.get(t.accountId ?? '')?.name ?? '')
    const categoryName =
      t.type === 'transfer'
        ? ''
        : (categoriesById.get(t.categoryId ?? '')?.name ?? '')
    const fromName =
      t.type === 'transfer'
        ? (accountsById.get(t.fromAccountId ?? '')?.name ?? '')
        : ''
    const toName =
      t.type === 'transfer'
        ? (accountsById.get(t.toAccountId ?? '')?.name ?? '')
        : ''

    return [
      formatDate(t.occurredAt),
      transactionTypeMeta[t.type].label,
      amountCell(t.amount),
      accountName,
      categoryName,
      fromName,
      toName,
      t.creator?.fullName?.trim() ?? '',
      t.note ?? '',
    ]
  })

  return toCsv(CSV_HEADERS, rows)
}

/** A dated filename like `transactions-2026-08-07.csv`. */
export function transactionsCsvFilename(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `transactions-${yyyy}-${mm}-${dd}.csv`
}
