/**
 * POST /api/parse-transaction — turn a natural-language note into a structured
 * transaction. Body: { text, today, expenseCategories[], incomeCategories[],
 * accounts[] }. We forward to Google Gemini (JSON response schema) and return a
 * normalised ParsedTransaction the client maps to real ids for review.
 *
 * Requires GEMINI_API_KEY (server-side env). Optional GEMINI_MODEL override.
 * Runs on Vercel's Edge runtime (Web fetch/Response, no Node APIs).
 */
import {
  TRANSACTION_SCHEMA,
  buildTransactionPrompt,
  normalizeParsedTransaction,
  type TransactionPromptContext,
} from '../src/features/transactions/nl-parse'

export const config = { runtime: 'edge' }

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return json({ error: 'Quick add is not configured (no GEMINI_API_KEY).' }, 501)
  }

  let body: Partial<TransactionPromptContext>
  try {
    body = (await request.json()) as Partial<TransactionPromptContext>
  } catch {
    return json({ error: 'Invalid request body' }, 400)
  }

  if (!body.text || !body.today) {
    return json({ error: 'Nothing to parse' }, 400)
  }

  const prompt = buildTransactionPrompt({
    text: body.text,
    today: body.today,
    expenseCategories: body.expenseCategories ?? [],
    incomeCategories: body.incomeCategories ?? [],
    accounts: body.accounts ?? [],
  })

  // 'gemini-flash-latest' (not a pinned id — those 404 for new API keys).
  const model = process.env.GEMINI_MODEL || 'gemini-flash-latest'
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` +
    `?key=${apiKey}`

  let upstream: Response
  try {
    upstream = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
          responseSchema: TRANSACTION_SCHEMA,
        },
      }),
    })
  } catch {
    return json({ error: 'Could not reach Gemini' }, 502)
  }

  if (!upstream.ok) {
    return json({ error: `Gemini responded ${upstream.status}` }, 502)
  }

  let text: string | undefined
  try {
    const data = (await upstream.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
    }
    text = data.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text
  } catch {
    return json({ error: 'Unexpected Gemini response' }, 502)
  }

  if (!text) {
    return json({ error: 'Could not understand that. Enter it manually.' }, 422)
  }

  try {
    return json(normalizeParsedTransaction(JSON.parse(text)))
  } catch {
    return json({ error: 'Could not understand that. Enter it manually.' }, 422)
  }
}
