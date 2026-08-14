/**
 * POST /api/finance-insights — AI spending summary / Q&A over a PRE-AGGREGATED
 * finance context (amounts in ₹; no raw transactions). Body is an InsightsRequest
 * { mode, question?, context }. Forwards to Gemini and returns { answer, points }.
 *
 * Requires GEMINI_API_KEY (server-side env). Optional GEMINI_MODEL override.
 * Runs on Vercel's Edge runtime (Web fetch/Response, no Node APIs).
 */
import {
  INSIGHTS_SCHEMA,
  buildInsightsPrompt,
  normalizeInsights,
  type InsightsRequest,
} from '../src/features/dashboard/insights-schema'

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
    return json({ error: 'Insights are not configured (no GEMINI_API_KEY).' }, 501)
  }

  let body: InsightsRequest
  try {
    body = (await request.json()) as InsightsRequest
  } catch {
    return json({ error: 'Invalid request body' }, 400)
  }

  if (!body.context || (body.mode !== 'summary' && body.mode !== 'question')) {
    return json({ error: 'Nothing to analyse' }, 400)
  }

  const prompt = buildInsightsPrompt(body)

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
          temperature: 0.3,
          responseMimeType: 'application/json',
          responseSchema: INSIGHTS_SCHEMA,
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
    return json({ error: 'Could not generate insights right now.' }, 422)
  }

  try {
    return json(normalizeInsights(JSON.parse(text)))
  } catch {
    return json({ error: 'Could not generate insights right now.' }, 422)
  }
}
