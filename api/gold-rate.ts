/**
 * GET /api/gold-rate — today's Indian gold rate, scraped from GoodReturns.
 *
 * GoodReturns publishes a webpage (no API) that is CORS-blocked from the browser,
 * so we fetch and parse it here (same-origin serverless function). Parsing lives
 * in the shared, unit-tested `parseGoldRatesFromHtml`.
 *
 * Runs on Vercel's Edge runtime (Web fetch/Response, no Node APIs).
 */
import {
  buildGoldRatePayload,
  parseGoldRatesFromHtml,
} from '../src/features/investments/gold-rate-parse'

export const config = { runtime: 'edge' }

const SOURCE_URL = 'https://www.goodreturns.in/gold-rates/'
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36'

function json(body: unknown, status = 200, cacheSeconds = 0): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(cacheSeconds > 0
        ? {
            'cache-control': `s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 2}`,
          }
        : {}),
    },
  })
}

export default async function handler(): Promise<Response> {
  let html: string
  try {
    const upstream = await fetch(SOURCE_URL, {
      headers: {
        'user-agent': BROWSER_UA,
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'en-IN,en;q=0.9',
      },
    })
    if (!upstream.ok) {
      return json({ error: `GoodReturns responded ${upstream.status}` }, 502)
    }
    html = await upstream.text()
  } catch {
    return json({ error: 'Could not reach GoodReturns' }, 502)
  }

  const rates = parseGoldRatesFromHtml(html)
  if (!rates) {
    return json({ error: 'Could not parse the 24K rate from GoodReturns' }, 502)
  }

  return json(buildGoldRatePayload(rates, new Date().toISOString()), 200, 1800)
}
