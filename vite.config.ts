import path from 'node:path'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import {
  buildGoldRatePayload,
  parseGoldRatesFromHtml,
} from './src/features/investments/gold-rate-parse.ts'
import {
  resolveQuotes,
  type QuoteItem,
} from './src/features/investments/quotes-shared.ts'
import {
  RECEIPT_PROMPT,
  RECEIPT_SCHEMA,
  normalizeParsedReceipt,
} from './src/features/investments/gold-receipt-parse.ts'
import {
  TRANSACTION_SCHEMA,
  buildTransactionPrompt,
  normalizeParsedTransaction,
  type TransactionPromptContext,
} from './src/features/transactions/nl-parse.ts'
import {
  INSIGHTS_SCHEMA,
  buildInsightsPrompt,
  normalizeInsights,
  type InsightsRequest,
} from './src/features/dashboard/insights-schema.ts'

const GOODRETURNS_URL = 'https://www.goodreturns.in/gold-rates/'

/**
 * Serve /api/gold-rate in the dev server so the "Live rate" button works in
 * `vite dev` too (in production this path is the Vercel Edge function in api/).
 */
function devApi(geminiKey: string, geminiModel: string): Plugin {
  return {
    name: 'dev-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/gold-rate', async (_req, res) => {
        res.setHeader('content-type', 'application/json; charset=utf-8')
        try {
          const upstream = await fetch(GOODRETURNS_URL, {
            headers: {
              'user-agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
              accept: 'text/html,application/xhtml+xml',
              'accept-language': 'en-IN,en;q=0.9',
            },
          })
          if (!upstream.ok) {
            res.statusCode = 502
            res.end(JSON.stringify({ error: `GoodReturns responded ${upstream.status}` }))
            return
          }
          const rates = parseGoldRatesFromHtml(await upstream.text())
          if (!rates) {
            res.statusCode = 502
            res.end(JSON.stringify({ error: 'Could not parse GoodReturns' }))
            return
          }
          res.end(
            JSON.stringify(buildGoldRatePayload(rates, new Date().toISOString())),
          )
        } catch {
          res.statusCode = 502
          res.end(JSON.stringify({ error: 'Could not reach GoodReturns' }))
        }
      })

      // /api/quotes — live stock/MF prices (mirrors api/quotes.ts).
      server.middlewares.use('/api/quotes', async (req, res) => {
        res.setHeader('content-type', 'application/json; charset=utf-8')
        try {
          let raw = ''
          await new Promise<void>((resolve) => {
            req.on('data', (chunk) => (raw += chunk))
            req.on('end', () => resolve())
          })
          const items = (JSON.parse(raw || '{}').items ?? []) as QuoteItem[]
          const { quotes, prevCloses, names } = await resolveQuotes(items)
          res.end(
            JSON.stringify({
              quotes,
              prevCloses,
              names,
              fetchedAt: new Date().toISOString(),
            }),
          )
        } catch {
          res.statusCode = 502
          res.end(JSON.stringify({ error: 'Could not fetch quotes' }))
        }
      })

      // /api/parse-gold-receipt — Gemini bill reader (mirrors api/parse-gold-receipt.ts).
      server.middlewares.use('/api/parse-gold-receipt', async (req, res) => {
        res.setHeader('content-type', 'application/json; charset=utf-8')
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }
        if (!geminiKey) {
          res.statusCode = 501
          res.end(
            JSON.stringify({
              error: 'Bill reading is not configured (no GEMINI_API_KEY).',
            }),
          )
          return
        }
        try {
          let raw = ''
          await new Promise<void>((resolve) => {
            req.on('data', (chunk) => (raw += chunk))
            req.on('end', () => resolve())
          })
          const body = JSON.parse(raw || '{}') as {
            imageBase64?: string
            mimeType?: string
          }
          if (!body.imageBase64 || !body.mimeType) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'Send a JPG, PNG, WebP or PDF bill.' }))
            return
          }

          const model = geminiModel || 'gemini-flash-latest'
          const upstream = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
            {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                contents: [
                  {
                    role: 'user',
                    parts: [
                      {
                        inline_data: {
                          mime_type: body.mimeType,
                          data: body.imageBase64,
                        },
                      },
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
            },
          )
          if (!upstream.ok) {
            res.statusCode = 502
            res.end(JSON.stringify({ error: `Gemini responded ${upstream.status}` }))
            return
          }
          const data = (await upstream.json()) as {
            candidates?: { content?: { parts?: { text?: string }[] } }[]
          }
          const text = data.candidates?.[0]?.content?.parts?.find(
            (p) => p.text,
          )?.text
          if (!text) {
            res.statusCode = 422
            res.end(
              JSON.stringify({
                error: 'The bill could not be read. Enter details manually.',
              }),
            )
            return
          }
          res.end(JSON.stringify(normalizeParsedReceipt(JSON.parse(text))))
        } catch {
          res.statusCode = 502
          res.end(JSON.stringify({ error: 'Could not read the bill' }))
        }
      })

      // /api/parse-transaction — Gemini NL quick-add (mirrors api/parse-transaction.ts).
      server.middlewares.use('/api/parse-transaction', async (req, res) => {
        res.setHeader('content-type', 'application/json; charset=utf-8')
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }
        if (!geminiKey) {
          res.statusCode = 501
          res.end(
            JSON.stringify({
              error: 'Quick add is not configured (no GEMINI_API_KEY).',
            }),
          )
          return
        }
        try {
          let raw = ''
          await new Promise<void>((resolve) => {
            req.on('data', (chunk) => (raw += chunk))
            req.on('end', () => resolve())
          })
          const body = JSON.parse(raw || '{}') as Partial<TransactionPromptContext>
          if (!body.text || !body.today) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'Nothing to parse' }))
            return
          }
          const prompt = buildTransactionPrompt({
            text: body.text,
            today: body.today,
            expenseCategories: body.expenseCategories ?? [],
            incomeCategories: body.incomeCategories ?? [],
            accounts: body.accounts ?? [],
          })
          const model = geminiModel || 'gemini-flash-latest'
          const upstream = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
            {
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
            },
          )
          if (!upstream.ok) {
            res.statusCode = 502
            res.end(JSON.stringify({ error: `Gemini responded ${upstream.status}` }))
            return
          }
          const data = (await upstream.json()) as {
            candidates?: { content?: { parts?: { text?: string }[] } }[]
          }
          const text = data.candidates?.[0]?.content?.parts?.find(
            (p) => p.text,
          )?.text
          if (!text) {
            res.statusCode = 422
            res.end(
              JSON.stringify({ error: 'Could not understand that. Enter it manually.' }),
            )
            return
          }
          res.end(JSON.stringify(normalizeParsedTransaction(JSON.parse(text))))
        } catch {
          res.statusCode = 502
          res.end(JSON.stringify({ error: 'Could not parse the note' }))
        }
      })

      // /api/finance-insights — Gemini spending summary / Q&A (mirrors api/finance-insights.ts).
      server.middlewares.use('/api/finance-insights', async (req, res) => {
        res.setHeader('content-type', 'application/json; charset=utf-8')
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }
        if (!geminiKey) {
          res.statusCode = 501
          res.end(
            JSON.stringify({
              error: 'Insights are not configured (no GEMINI_API_KEY).',
            }),
          )
          return
        }
        try {
          let raw = ''
          await new Promise<void>((resolve) => {
            req.on('data', (chunk) => (raw += chunk))
            req.on('end', () => resolve())
          })
          const body = JSON.parse(raw || '{}') as InsightsRequest
          if (
            !body.context ||
            (body.mode !== 'summary' && body.mode !== 'question')
          ) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'Nothing to analyse' }))
            return
          }
          const prompt = buildInsightsPrompt(body)
          const model = geminiModel || 'gemini-flash-latest'
          const upstream = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
            {
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
            },
          )
          if (!upstream.ok) {
            res.statusCode = 502
            res.end(JSON.stringify({ error: `Gemini responded ${upstream.status}` }))
            return
          }
          const data = (await upstream.json()) as {
            candidates?: { content?: { parts?: { text?: string }[] } }[]
          }
          const text = data.candidates?.[0]?.content?.parts?.find(
            (p) => p.text,
          )?.text
          if (!text) {
            res.statusCode = 422
            res.end(
              JSON.stringify({ error: 'Could not generate insights right now.' }),
            )
            return
          }
          res.end(JSON.stringify(normalizeInsights(JSON.parse(text))))
        } catch {
          res.statusCode = 502
          res.end(JSON.stringify({ error: 'Could not generate insights' }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load ALL env vars (empty prefix) so server-only keys like GEMINI_API_KEY are
  // available to the dev middleware. These stay server-side — only VITE_* vars
  // are ever exposed to the client bundle.
  const env = loadEnv(mode, process.cwd(), '')
  return {
  plugins: [
    react(),
    tailwindcss(),
    devApi(env.GEMINI_API_KEY ?? '', env.GEMINI_MODEL ?? ''),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Personal Finance Tracker',
        short_name: 'FinTrack',
        description:
          'Track income, expenses, transfers, accounts and budgets for your family.',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        lang: 'en-IN',
        categories: ['finance', 'productivity'],
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  }
})
