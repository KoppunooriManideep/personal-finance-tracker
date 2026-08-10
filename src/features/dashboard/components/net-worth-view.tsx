import { useMemo } from 'react'
import { RefreshCw } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/common/loading-spinner'
import { cn } from '@/lib/utils'
import { formatPaise } from '@/lib/money'
import { useDashboardStore } from '@/stores/dashboard-store'
import { useAccounts } from '@/features/accounts/hooks/use-accounts'
import { useGoldHoldings } from '@/features/investments/hooks/use-gold-holdings'
import { useGoldSpot } from '@/features/investments/hooks/use-gold-spot'
import { useMarketHoldings } from '@/features/investments/hooks/use-market-holdings'
import { useMarketQuotes } from '@/features/investments/hooks/use-market-quotes'
import { useChits } from '@/features/chits/hooks/use-chits'
import { useChitPayments } from '@/features/chits/hooks/use-chit-payments'
import { usePfAccounts } from '@/features/investments/hooks/use-pf-accounts'
import { summarizeGoldPortfolio } from '@/features/investments/gold-math'
import { summarizeMarketPortfolio } from '@/features/investments/market-math'
import { summarizePf } from '@/features/investments/pf-math'
import { PF_COLOR } from '@/features/investments/pf-config'
import { getCurrentIstDate } from '@/lib/date'
import { quoteKey } from '@/features/investments/quotes-shared'
import { groupPaymentsByChit } from '@/features/chits/api/chit-payment-queries'
import { chitSummary } from '@/features/chits/summary'
import { buildNetWorth } from '@/features/dashboard/net-worth'

/** Owner-scope helper: whole family (null) or a single member. */
function scopeByOwner<T extends { ownerId: string | null }>(
  items: T[],
  ownerId: string | null,
): T[] {
  return ownerId ? items.filter((i) => i.ownerId === ownerId) : items
}

/** Net-worth lens for the Dashboard — assets across every tracked source, today. */
export function NetWorthView() {
  const { selectedOwnerId } = useDashboardStore()

  const { data: accounts, isLoading: accountsLoading } = useAccounts()
  const { data: gold, isLoading: goldLoading } = useGoldHoldings()
  const { data: spot } = useGoldSpot()
  const { data: market, isLoading: marketLoading } = useMarketHoldings()
  const { data: chits, isLoading: chitsLoading } = useChits()
  const { data: chitPayments, isLoading: paymentsLoading } = useChitPayments()
  const { data: pf, isLoading: pfLoading } = usePfAccounts()

  const marketHoldings = useMemo(() => market ?? [], [market])
  const quotes = useMarketQuotes(marketHoldings)

  const summary = useMemo(() => {
    const spotPaise = spot?.pricePaisePerGram ?? 0

    // Cash & bank — the account_balances view already nets credit-card dues.
    const cashPaise = scopeByOwner(accounts ?? [], selectedOwnerId).reduce(
      (sum, a) => sum + a.currentBalance,
      0,
    )

    // Gold — live value, or effective cost when the rate isn't set yet.
    const goldPortfolio = summarizeGoldPortfolio(
      scopeByOwner(gold ?? [], selectedOwnerId),
      spotPaise,
    )
    const goldPaise = spotPaise > 0
      ? goldPortfolio.currentValuePaise
      : goldPortfolio.effectiveCostPaise

    // Stocks + mutual funds — live value (falls back to invested when unpriced).
    const marketFor = (kind: 'stock' | 'mutual_fund') =>
      summarizeMarketPortfolio(
        scopeByOwner(marketHoldings, selectedOwnerId)
          .filter((h) => h.kind === kind)
          .map((h) => ({
            quantity: h.quantity,
            investedPaise: h.investedPaise,
            pricePaisePerUnit:
              quotes.data?.quotes[quoteKey(h.kind, h.isin, h.symbol)] ?? null,
          })),
      )
    const stocksPaise = marketFor('stock').currentValuePaise
    const mfPaise = marketFor('mutual_fund').currentValuePaise

    // Chits — paid-in for ACTIVE chits (received ones are realized → 0).
    const paymentsByChit = groupPaymentsByChit(chitPayments ?? [])
    const chitsPaise = scopeByOwner(chits ?? [], selectedOwnerId).reduce(
      (sum, chit) => {
        const s = chitSummary(chit, paymentsByChit.get(chit.id) ?? [])
        return sum + (s.isReceived ? 0 : s.totalPaid)
      },
      0,
    )

    // Provident Fund — projected balance today (owner-scoped).
    const pfPaise = summarizePf(
      scopeByOwner(pf ?? [], selectedOwnerId),
      getCurrentIstDate(),
    ).projectedBalancePaise

    return buildNetWorth([
      { key: 'cash', label: 'Cash & bank', color: '#0ea5e9', valuePaise: cashPaise },
      { key: 'gold', label: 'Gold', color: '#d4a017', valuePaise: goldPaise },
      { key: 'stocks', label: 'Stocks', color: '#3b82f6', valuePaise: stocksPaise },
      { key: 'mf', label: 'Mutual Funds', color: '#8b5cf6', valuePaise: mfPaise },
      { key: 'pf', label: 'Provident Fund', color: PF_COLOR, valuePaise: pfPaise },
      { key: 'chits', label: 'Chits', color: '#f59e0b', valuePaise: chitsPaise },
      { key: 'loans', label: 'Loans', color: '#ef4444', valuePaise: 0 },
    ])
  }, [accounts, gold, spot, marketHoldings, quotes.data, chits, chitPayments, pf, selectedOwnerId])

  const loading =
    accountsLoading ||
    goldLoading ||
    marketLoading ||
    chitsLoading ||
    paymentsLoading ||
    pfLoading

  if (loading) return <LoadingSpinner />

  const hasMarket = marketHoldings.length > 0

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-muted-foreground text-sm">Net worth · today</p>
              <p
                className={cn(
                  'text-3xl font-semibold tabular-nums break-words',
                  summary.netWorthPaise < 0 && 'text-destructive',
                )}
              >
                {formatPaise(summary.netWorthPaise, { decimals: false })}
              </p>
            </div>
            {hasMarket ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => quotes.refetch()}
                disabled={quotes.isFetching}
                className="shrink-0"
              >
                <RefreshCw
                  className={cn('h-4 w-4', quotes.isFetching && 'animate-spin')}
                />
                Prices
              </Button>
            ) : null}
          </div>

          {/* Allocation bar (positive assets only) */}
          {summary.totalAssetsPaise > 0 ? (
            <div className="bg-muted flex h-2.5 w-full overflow-hidden rounded-full">
              {summary.components
                .filter((c) => c.valuePaise > 0)
                .map((c) => (
                  <div
                    key={c.key}
                    style={{
                      width: `${(c.valuePaise / summary.totalAssetsPaise) * 100}%`,
                      backgroundColor: c.color,
                    }}
                    className="h-full first:rounded-l-full last:rounded-r-full"
                  />
                ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Breakdown */}
      <Card>
        <CardContent className="divide-border divide-y p-0">
          {summary.components.map((c) => (
            <div
              key={c.key}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <span className="flex items-center gap-2 text-sm">
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: c.color }}
                />
                {c.label}
              </span>
              <span
                className={cn(
                  'shrink-0 text-sm font-medium tabular-nums',
                  c.valuePaise < 0 && 'text-destructive',
                )}
              >
                {formatPaise(c.valuePaise, { decimals: false })}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-xs">
        As of today. PF is estimated from your last entry + contribution. Active
        chits count the amount paid in so far; once received a chit becomes cash
        in your accounts. Loans are coming soon.
      </p>
    </div>
  )
}
