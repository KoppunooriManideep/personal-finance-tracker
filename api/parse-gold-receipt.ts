/**
 * POST /api/parse-gold-receipt — read a gold bill and return structured fields.
 *
 * Body: { imageBase64: string, mimeType: string }. We forward the image to
 * Google Gemini (vision + JSON response schema) and return a normalised
 * ParsedGoldReceipt the client drops into the gold form for the user to verify.
 *
 * Requires GEMINI_API_KEY (server-side env). Optional GEMINI_MODEL override.
 * Runs on Vercel's Edge runtime (Web fetch/Response, no Node APIs).
 */
import {
  RECEIPT_PROMPT,
  RECEIPT_SCHEMA,
  normalizeParsedReceipt,
} from '../src/features/investments/gold-receipt-parse'

export const config = { runtime: 'edge' }

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
])

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

interface ParseBody {
  imageBase64?: string
  mimeType?: string
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return json({ error: 'Bill reading is not configured (no GEMINI_API_KEY).' }, 501)
  }

  let body: ParseBody
  try {
    body = (await request.json()) as ParseBody
  } catch {
    return json({ error: 'Invalid request body' }, 400)
  }

  const { imageBase64, mimeType } = body
  if (!imageBase64 || !mimeType || !ALLOWED_MIME.has(mimeType)) {
    return json({ error: 'Send a JPG, PNG, WebP or PDF bill.' }, 400)
  }

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` +
    `?key=${apiKey}`

  let upstream: Response
  try {
    upstream = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { inline_data: { mime_type: mimeType, data: imageBase64 } },
              { text: RECEIPT_PROMPT },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
          responseSchema: RECEIPT_SCHEMA,
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
    return json({ error: 'The bill could not be read. Enter details manually.' }, 422)
  }

  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return json({ error: 'The bill could not be read. Enter details manually.' }, 422)
  }

  return json(normalizeParsedReceipt(raw))
}
