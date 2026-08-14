import type {
  InsightsRequest,
  InsightsResult,
} from '@/features/dashboard/insights-schema'

/**
 * Client for the /api/finance-insights serverless function (Gemini). Only works
 * where the function is deployed (Vercel) or under the vite dev middleware with
 * GEMINI_API_KEY set — callers handle failure gracefully.
 *
 * Sends a PRE-AGGREGATED FinanceContext (amounts in ₹, no raw transactions).
 * This is gated behind an explicit opt-in (useAiStore.insightsEnabled).
 */
export async function fetchInsights(
  request: InsightsRequest,
): Promise<InsightsResult> {
  const response = await fetch('/api/finance-insights', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    let message = `Insights failed (${response.status})`
    try {
      const body = (await response.json()) as { error?: string }
      if (body?.error) message = body.error
    } catch {
      // Non-JSON error (e.g. 404 under bare `vite dev`) — keep the generic msg.
    }
    throw new Error(message)
  }

  return (await response.json()) as InsightsResult
}
