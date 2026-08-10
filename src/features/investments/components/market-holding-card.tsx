import { MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { formatPaise } from '@/lib/money'
import { formatQty } from '@/features/investments/market-config'
import { summarizeMarketHolding } from '@/features/investments/market-math'
import type { MarketHolding } from '@/features/investments/api/market-queries'

interface MarketHoldingCardProps {
  holding: MarketHolding
  /** Live price/NAV per unit in paise; null when unknown. */
  pricePaise: number | null
  /** Previous close per unit in paise (for the day's change); null if unknown. */
  prevClosePaise?: number | null
  /** Live-resolved name (from the quote), falls back to stored name/symbol. */
  liveName?: string
  canManage: boolean
  onEdit: (holding: MarketHolding) => void
  onDelete: (holding: MarketHolding) => void
}

/** A dense Kite-style holding row: qty·avg + gain% / name + gain₹ / invested + LTP. */
export function MarketHoldingCard({
  holding,
  pricePaise,
  prevClosePaise,
  liveName,
  canManage,
  onEdit,
  onDelete,
}: MarketHoldingCardProps) {
  const summary = summarizeMarketHolding(holding, pricePaise, prevClosePaise ?? null)
  const priced = summary.currentValuePaise != null
  const positive = (summary.gainPaise ?? 0) >= 0
  const title = holding.name?.trim() || liveName?.trim() || holding.symbol
  const gainColor = positive
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-destructive'
  const dayUp = (summary.dayChangePct ?? 0) >= 0

  const body = (
    <div className="min-w-0 flex-1 space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-muted-foreground truncate text-xs tabular-nums">
          Qty {formatQty(holding.quantity)} · Avg{' '}
          {formatPaise(summary.avgCostPaise)}
        </span>
        {priced && summary.gainPct != null ? (
          <span className={cn('shrink-0 text-xs font-medium tabular-nums', gainColor)}>
            {positive ? '+' : ''}
            {summary.gainPct.toFixed(2)}%
          </span>
        ) : null}
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-sm font-medium">{title}</span>
        {priced ? (
          <span className={cn('shrink-0 text-sm font-semibold tabular-nums', gainColor)}>
            {positive ? '+' : ''}
            {formatPaise(summary.gainPaise ?? 0, { decimals: false })}
          </span>
        ) : null}
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <span className="text-muted-foreground truncate text-xs tabular-nums">
          Invested {formatPaise(holding.investedPaise, { decimals: false })}
        </span>
        {priced ? (
          <span className="shrink-0 text-xs tabular-nums">
            <span className="text-muted-foreground">
              LTP {formatPaise(pricePaise ?? 0)}
            </span>
            {summary.dayChangePct != null ? (
              <span
                className={cn(
                  'ml-1',
                  dayUp
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-destructive',
                )}
              >
                ({dayUp ? '+' : ''}
                {summary.dayChangePct.toFixed(2)}%)
              </span>
            ) : null}
          </span>
        ) : (
          <span className="text-muted-foreground shrink-0 text-xs">
            Price unavailable
          </span>
        )}
      </div>
    </div>
  )

  return (
    <Card>
      <CardContent className="flex items-start gap-2 p-4">
        {canManage ? (
          <button
            type="button"
            className="min-w-0 flex-1 text-left"
            onClick={() => onEdit(holding)}
            aria-label={`Edit ${title}`}
          >
            {body}
          </button>
        ) : (
          body
        )}

        {canManage ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="-mr-1 shrink-0 print:hidden"
                aria-label={`Actions for ${title}`}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(holding)}>
                <Pencil className="h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => onDelete(holding)}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </CardContent>
    </Card>
  )
}
