/**
 * Shared, DEPENDENCY-FREE helpers for natural-language transaction entry.
 * Imported by the `/api/parse-transaction` edge function AND vite.config's dev
 * middleware, so (like gold-receipt-parse.ts) it must have NO imports.
 *
 * The model turns a short note ("paid 500 for groceries at DMart yesterday")
 * into structured fields; the CLIENT then maps the category/account NAMES back
 * to real ids (see nl-match.ts) and prefills the transaction form to verify.
 */

export type NlTxType = 'income' | 'expense' | 'transfer'

/** A parsed transaction — names, not ids; amount in rupees; date YYYY-MM-DD. */
export interface ParsedTransaction {
  type: NlTxType | null
  amount: number | null
  date: string | null
  category: string | null
  account: string | null
  fromAccount: string | null
  toAccount: string | null
  note: string | null
}

/** Everything the prompt needs — dynamic per family, injected server-side. */
export interface TransactionPromptContext {
  text: string
  /** Today's date (YYYY-MM-DD, IST) so relative dates resolve correctly. */
  today: string
  expenseCategories: string[]
  incomeCategories: string[]
  accounts: string[]
}

/** Gemini `responseSchema` (OpenAPI subset; type names are UPPERCASE). */
export const TRANSACTION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    type: {
      type: 'STRING',
      enum: ['income', 'expense', 'transfer'],
      nullable: true,
    },
    amount: { type: 'NUMBER', nullable: true },
    date: { type: 'STRING', nullable: true },
    category: { type: 'STRING', nullable: true },
    account: { type: 'STRING', nullable: true },
    fromAccount: { type: 'STRING', nullable: true },
    toAccount: { type: 'STRING', nullable: true },
    note: { type: 'STRING', nullable: true },
  },
}

/** Build the instruction, embedding the family's real categories + accounts. */
export function buildTransactionPrompt(ctx: TransactionPromptContext): string {
  const list = (items: string[]) => (items.length ? items.join(', ') : '(none)')
  return `You convert a short natural-language money note from an Indian family finance app into ONE structured transaction. Today's date is ${ctx.today} (Asia/Kolkata).
Expense categories: ${list(ctx.expenseCategories)}.
Income categories: ${list(ctx.incomeCategories)}.
Accounts: ${list(ctx.accounts)}.
Rules:
- type: "expense" (money out), "income" (money in), or "transfer" (moving money between the user's own accounts).
- amount: a positive number in rupees (₹). Understand "1k"=1000, "1.5 lakh"=150000.
- date: resolve relative words (today, yesterday, "last friday", "2 days ago") to YYYY-MM-DD using today's date. Default to today when unspecified.
- category: for income/expense, pick the SINGLE best match from the matching list above (expense list for expenses, income list for income) and copy its name EXACTLY. null for transfers or if nothing fits.
- account: the account the money left from / arrived in (income/expense). Copy an account name EXACTLY as listed, or null if unclear.
- fromAccount / toAccount: for transfers ONLY — the source and destination account names, exactly as listed.
- note: a short human note or merchant name (e.g. "DMart groceries"). Keep it brief.
Never invent a category or account that is not in the lists above. Use null for anything you cannot determine.
Note to convert: "${ctx.text.replace(/"/g, "'")}"`
}

function cleanString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function positiveNumber(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value.replace(/,/g, '')) : value
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null
}

/** Coerce Gemini's raw JSON into a safe ParsedTransaction (bad → null). */
export function normalizeParsedTransaction(raw: unknown): ParsedTransaction {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>

  const type =
    r.type === 'income' || r.type === 'expense' || r.type === 'transfer'
      ? r.type
      : null

  const date = cleanString(r.date)

  return {
    type,
    amount: positiveNumber(r.amount),
    date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
    category: cleanString(r.category),
    account: cleanString(r.account),
    fromAccount: cleanString(r.fromAccount),
    toAccount: cleanString(r.toAccount),
    note: cleanString(r.note),
  }
}
