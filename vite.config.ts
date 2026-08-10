import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'
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

const GOODRETURNS_URL = 'https://www.goodreturns.in/gold-rates/'

/**
 * Serve /api/gold-rate in the dev server so the "Live rate" button works in
 * `vite dev` too (in production this path is the Vercel Edge function in api/).
 */
function goldRateDevApi(): Plugin {
  return {
    name: 'dev-gold-rate-api',
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
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    goldRateDevApi(),
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
})
