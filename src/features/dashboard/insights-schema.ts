/**
 * Shared, DEPENDENCY-FREE helpers for AI dashboard insights / Q&A. Imported by
 * the `/api/finance-insights` edge function AND vite.config's dev middleware, so
 * (like the other *-parse/*-schema modules) it must have NO imports.
 *
 * The CLIENT computes a compact `FinanceContext` (aggregates in ₹, not raw
 * transactions — see build-finance-context.ts) and sends it here; Gemini only
 * writes the language. This keeps the payload small and the maths correct.
 */

/** A category's spend for the month, in whole rupees. */
export interface CategorySpend {
  name: string
  amount: number
}

/** A month's income/expense in whole rupees (short month label, e.g. "Aug"). */
export interface MonthlyPoint {
  month: string
  income: number
  expense: number
}

/** Compact, pre-aggregated financial context. All amounts are whole RUPEES. */
export interface FinanceContext {
  /** Human month label, e.g. "August 2026". */
  month: string
  /** "the whole family" or a member's first name. */
  scope: string
  income: number
  expense: number
  net: number
  savingsRatePct: number | null
  topExpenseCategories: CategorySpend[]
  previousMonth: { month: string; expense: number } | null
  averageMonthlyExpense: number | null
  monthlySeries: MonthlyPoint[]
}

export type InsightsMode = 'summary' | 'question'

/** Body the client POSTs to /api/finance-insights. */
export interface InsightsRequest {
  mode: InsightsMode
  question?: string
  context: FinanceContext
}

/** What the endpoint returns. */
export interface InsightsResult {
  answer: string
  points: string[]
}

/** Gemini `responseSchema` (OpenAPI subset; UPPERCASE types). */
export const INSIGHTS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    answer: { type: 'STRING', nullable: true },
    points: { type: 'ARRAY', nullable: true, items: { type: 'STRING' } },
  },
}

const GUARDRAILS =
  'You are a concise, friendly assistant for an Indian family finance app. ' +
  'All amounts are in Indian Rupees (₹). Base everything ONLY on the data given — ' +
  'never invent numbers. Be short, specific and encouraging. This is ' +
  'informational only, not financial advice.'

/** Build the Gemini prompt for a summary or a question over the context. */
export function buildInsightsPrompt(request: InsightsRequest): string {
  const data = JSON.stringify(request.context)
  if (request.mode === 'question') {
    const question = (request.question ?? '').replace(/"/g, "'").slice(0, 400)
    return `${GUARDRAILS}
Answer the user's question using ONLY the JSON data below. Put the direct answer in "answer" (one or two sentences) and up to 3 short supporting "points" if useful. If the data does not contain the answer, say so briefly in "answer".
Question: "${question}"
Data: ${data}`
  }
  return `${GUARDRAILS}
Write a brief spending summary for ${request.context.month} (${request.context.scope}). Put a single one-line highlight in "answer", then 2-4 short "points" bullets covering the notable things: biggest categories, change vs last month, savings rate, and anything worth attention. Keep each point under ~15 words.
Data: ${data}`
}

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** Coerce Gemini's raw JSON into a safe InsightsResult. */
export function normalizeInsights(raw: unknown): InsightsResult {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const answer = cleanString(r.answer)
  const points = Array.isArray(r.points)
    ? r.points
        .map((p) => cleanString(p))
        .filter((p) => p.length > 0)
        .slice(0, 6)
    : []
  return { answer, points }
}
