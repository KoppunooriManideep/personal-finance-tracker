import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Loader2, RefreshCw, Send, Sparkles } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { fetchInsights } from '@/features/dashboard/api/insights-api'
import type {
  FinanceContext,
  InsightsResult,
} from '@/features/dashboard/insights-schema'

/** AI spending summary + Q&A. Rendered only when the user has opted in. */
export function AiInsightsCard({ context }: { context: FinanceContext }) {
  const contextKey = JSON.stringify(context)

  const summary = useQuery({
    queryKey: ['finance-insights', 'summary', contextKey],
    queryFn: () => fetchInsights({ mode: 'summary', context }),
    staleTime: 10 * 60_000,
    retry: false,
  })

  const [question, setQuestion] = useState('')
  const ask = useMutation({
    mutationFn: (q: string) =>
      fetchInsights({ mode: 'question', question: q, context }),
  })

  const submitQuestion = () => {
    const q = question.trim()
    if (q) ask.mutate(q)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="text-primary h-4 w-4" />
          AI insights
        </CardTitle>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => summary.refetch()}
          disabled={summary.isFetching}
          aria-label="Regenerate insights"
        >
          <RefreshCw
            className={summary.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'}
          />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        {summary.isLoading ? (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Reading your {context.month} spending…
          </p>
        ) : summary.isError ? (
          <p className="text-muted-foreground text-sm">
            Couldn&apos;t generate insights.{' '}
            <button
              type="button"
              className="underline"
              onClick={() => summary.refetch()}
            >
              Try again
            </button>
          </p>
        ) : summary.data ? (
          <InsightsBlock result={summary.data} />
        ) : null}

        {/* Q&A */}
        <div className="space-y-2 border-t pt-3">
          <div className="flex gap-2">
            <Input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  submitQuestion()
                }
              }}
              placeholder="Ask about your money, e.g. where did most go?"
              autoComplete="off"
              disabled={ask.isPending}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={submitQuestion}
              disabled={ask.isPending || !question.trim()}
              aria-label="Ask"
            >
              {ask.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>

          {ask.isError ? (
            <p className="text-muted-foreground text-sm">
              Couldn&apos;t answer that — try rephrasing.
            </p>
          ) : ask.data ? (
            <div className="bg-muted/40 rounded-lg p-3">
              <InsightsBlock result={ask.data} />
            </div>
          ) : null}
        </div>

        <p className="text-muted-foreground text-2xs sm:text-xs">
          Uses your spending totals via Google Gemini. Informational only — not
          financial advice.
        </p>
      </CardContent>
    </Card>
  )
}

function InsightsBlock({ result }: { result: InsightsResult }) {
  return (
    <div className="space-y-2">
      {result.answer ? (
        <p className="text-sm font-medium">{result.answer}</p>
      ) : null}
      {result.points.length > 0 ? (
        <ul className="space-y-1">
          {result.points.map((point, index) => (
            <li
              key={index}
              className="text-muted-foreground flex gap-2 text-sm"
            >
              <span className="text-primary mt-0.5 shrink-0">•</span>
              <span>{point}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {!result.answer && result.points.length === 0 ? (
        <p className="text-muted-foreground text-sm">No insights to show.</p>
      ) : null}
    </div>
  )
}
