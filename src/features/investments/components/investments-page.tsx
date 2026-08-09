import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronDown,
  ChevronRight,
  Gem,
  LineChart,
  PieChart,
  type LucideIcon,
} from 'lucide-react'
import { PageHeader } from '@/components/common/page-header'
import { ErrorState } from '@/components/common/error-state'
import { LoadingSpinner } from '@/components/common/loading-spinner'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { formatPaise } from '@/lib/money'
import { paths } from '@/config/paths'
import { useGoldHoldings } from '@/features/investments/hooks/use-gold-holdings'
import { useGoldSpot } from '@/features/investments/hooks/use-gold-spot'
import { summarizeGoldPortfolio } from '@/features/investments/gold-math'

interface AssetClass {
  key: string
  label: string
  icon: LucideIcon
  color: string
  to: string
  available: boolean
  investedPaise: number
  currentValuePaise: number
  gainPaise: number
  gainPct: number | null
}

/** Investments hub: total portfolio, allocation and per-asset-class cards. */
export function InvestmentsPage() {
  const { data: holdings, isLoading, isError, refetch } = useGoldHoldings()
  const { data: spot } = useGoldSpot()

  const [segmentsOpen, setSegmentsOpen] = useState(false)

  const spotPaise = spot?.pricePaisePerGram ?? 0
  const hasRate = spotPaise > 0

  const gold = useMemo(
    () => summarizeGoldPortfolio(holdings ?? [], spotPaise),
    [holdings, spotPaise],
  )

  const classes: AssetClass[] = [
    {
      key: 'gold',
      label: 'Gold',
      icon: Gem,
      color: '#d4a017',
      to: paths.investmentsGold,
      available: true,
      investedPaise: gold.effectiveCostPaise,
      currentValuePaise: hasRate ? gold.currentValuePaise : gold.effectiveCostPaise,
      gainPaise: hasRate ? gold.gainPaise : 0,
      gainPct: hasRate ? gold.gainPct : null,
    },
    {
      key: 'stocks',
      label: 'Stocks',
      icon: LineChart,
      color: '#3b82f6',
      to: paths.investmentsStocks,
      available: false,
      investedPaise: 0,
      currentValuePaise: 0,
      gainPaise: 0,
      gainPct: null,
    },
    {
      key: 'mutual-funds',
      label: 'Mutual Funds',
      icon: PieChart,
      color: '#8b5cf6',
      to: paths.investmentsMutualFunds,
      available: false,
      investedPaise: 0,
      currentValuePaise: 0,
      gainPaise: 0,
      gainPct: null,
    },
  ]

  const totalInvested = classes.reduce((s, c) => s + c.investedPaise, 0)
  const totalCurrent = classes.reduce((s, c) => s + c.currentValuePaise, 0)
  const totalGain = totalCurrent - totalInvested
  const totalGainPct =
    totalInvested > 0 ? (totalGain / totalInvested) * 100 : null
  const positive = totalGain >= 0

  const allocation = classes
    .map((c) => ({
      key: c.key,
      label: c.label,
      color: c.color,
      value: c.currentValuePaise,
      pct: totalCurrent > 0 ? (c.currentValuePaise / totalCurrent) * 100 : 0,
      available: c.available,
    }))
    .sort((a, b) => b.value - a.value)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Investments"
        description="Your portfolio across gold, stocks and mutual funds."
      />

      {isLoading ? (
        <LoadingSpinner />
      ) : isError ? (
        <ErrorState
          description="We could not load your investments."
          onRetry={() => refetch()}
        />
      ) : (
        <div className="space-y-6">
          {/* Total portfolio */}
          <Card>
            <CardContent className="space-y-4 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-muted-foreground text-xs">Invested</p>
                  <p className="text-xl font-semibold tabular-nums break-words">
                    {formatPaise(totalInvested, { decimals: false })}
                  </p>
                </div>
                <div className="min-w-0 text-right">
                  <p className="text-muted-foreground text-xs">Current</p>
                  <p className="text-xl font-semibold tabular-nums break-words">
                    {formatPaise(totalCurrent, { decimals: false })}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 border-t pt-3">
                <span className="text-muted-foreground text-sm">Total P&amp;L</span>
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      'text-base font-semibold tabular-nums',
                      positive
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-destructive',
                    )}
                  >
                    {positive ? '+' : ''}
                    {formatPaise(totalGain, { decimals: false })}
                  </span>
                  {totalGainPct != null ? (
                    <span
                      className={cn(
                        'rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums',
                        positive
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-destructive/10 text-destructive',
                      )}
                    >
                      {positive ? '+' : ''}
                      {totalGainPct.toFixed(2)}%
                    </span>
                  ) : null}
                </span>
              </div>

              {/* Allocation bar */}
              {totalCurrent > 0 ? (
                <AllocationBar slices={allocation} />
              ) : (
                <p className="text-muted-foreground text-xs">
                  Add holdings to see your asset allocation.
                </p>
              )}

              {/* Segment-wise P&L (expandable) */}
              <div className="border-t pt-3">
                <button
                  type="button"
                  onClick={() => setSegmentsOpen((open) => !open)}
                  aria-expanded={segmentsOpen}
                  className="flex w-full items-center justify-between text-sm"
                >
                  <span className="text-muted-foreground">Segment P&amp;L</span>
                  <ChevronDown
                    className={cn(
                      'text-muted-foreground h-4 w-4 transition-transform',
                      segmentsOpen && 'rotate-180',
                    )}
                  />
                </button>

                {segmentsOpen ? (
                  <ul className="mt-3 space-y-3">
                    {classes.map((asset) => (
                      <SegmentPnlRow
                        key={asset.key}
                        asset={asset}
                        hasRate={hasRate}
                      />
                    ))}
                  </ul>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {/* Asset-class cards */}
          <div className="space-y-3">
            {classes.map((asset) => (
              <AssetClassCard key={asset.key} asset={asset} hasRate={hasRate} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SegmentPnlRow({
  asset,
  hasRate,
}: {
  asset: AssetClass
  hasRate: boolean
}) {
  const positive = asset.gainPaise >= 0
  return (
    <li className="flex items-start justify-between gap-3">
      <span className="flex items-center gap-2 text-sm">
        <span
          aria-hidden
          className="h-2.5 w-2.5 shrink-0 rounded-sm"
          style={{ backgroundColor: asset.color }}
        />
        {asset.label}
      </span>

      {asset.available && hasRate ? (
        <span className="text-right">
          <span className="flex items-center justify-end gap-2">
            <span
              className={cn(
                'text-sm font-semibold tabular-nums',
                positive
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-destructive',
              )}
            >
              {positive ? '+' : ''}
              {formatPaise(asset.gainPaise, { decimals: false })}
            </span>
            {asset.gainPct != null ? (
              <span
                className={cn(
                  'rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums',
                  positive
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'bg-destructive/10 text-destructive',
                )}
              >
                {positive ? '+' : ''}
                {asset.gainPct.toFixed(2)}%
              </span>
            ) : null}
          </span>
          <span className="text-muted-foreground block text-xs tabular-nums">
            {formatPaise(asset.investedPaise, { decimals: false })} →{' '}
            {formatPaise(asset.currentValuePaise, { decimals: false })}
          </span>
        </span>
      ) : asset.available ? (
        <span className="text-muted-foreground text-sm">Set gold rate</span>
      ) : (
        <span className="text-muted-foreground text-sm">Coming soon</span>
      )}
    </li>
  )
}

function AllocationBar({
  slices,
}: {
  slices: {
    key: string
    label: string
    color: string
    value: number
    pct: number
    available: boolean
  }[]
}) {
  const withValue = slices.filter((s) => s.value > 0)
  return (
    <div className="space-y-2">
      <div className="bg-muted flex h-2.5 w-full overflow-hidden rounded-full">
        {withValue.map((s) => (
          <div
            key={s.key}
            style={{ width: `${s.pct}%`, backgroundColor: s.color }}
            className="h-full first:rounded-l-full last:rounded-r-full"
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {slices.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-xs">
            <span
              aria-hidden
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="font-medium tabular-nums">
              {s.available ? `${s.pct.toFixed(0)}%` : '—'}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

function AssetClassCard({
  asset,
  hasRate,
}: {
  asset: AssetClass
  hasRate: boolean
}) {
  const Icon = asset.icon
  const positive = asset.gainPaise >= 0
  return (
    <Link to={asset.to} className="block">
      <Card className="transition-colors hover:bg-accent/50">
        <CardContent className="flex items-center gap-3 p-4">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${asset.color}1a`, color: asset.color }}
          >
            <Icon className="h-5 w-5" />
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium md:text-base">{asset.label}</p>
            {asset.available ? (
              <p className="text-muted-foreground truncate text-xs tabular-nums">
                Invested {formatPaise(asset.investedPaise, { decimals: false })}
              </p>
            ) : (
              <span className="text-muted-foreground bg-muted mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs">
                Coming soon
              </span>
            )}
          </div>

          {asset.available ? (
            <div className="shrink-0 text-right">
              <p className="text-sm font-semibold tabular-nums">
                {hasRate
                  ? formatPaise(asset.currentValuePaise, { decimals: false })
                  : '—'}
              </p>
              {hasRate && asset.gainPct != null ? (
                <p
                  className={cn(
                    'text-xs font-medium tabular-nums',
                    positive
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-destructive',
                  )}
                >
                  {positive ? '+' : ''}
                  {asset.gainPct.toFixed(2)}%
                </p>
              ) : null}
            </div>
          ) : null}

          <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
        </CardContent>
      </Card>
    </Link>
  )
}
