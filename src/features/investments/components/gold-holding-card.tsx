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
import { finenessLabel, formLabel, formatGrams } from '@/features/investments/config'
import { summarizeGoldHolding } from '@/features/investments/gold-math'
import type { GoldHolding } from '@/features/investments/api/gold-queries'

interface GoldHoldingCardProps {
  holding: GoldHolding
  /** Current 24K (999) rate in paise per gram; 0 when unknown. */
  spotPaisePerGram: number
  canManage: boolean
  onEdit: (holding: GoldHolding) => void
  onDelete: (holding: GoldHolding) => void
}

/**
 * A dense holdings row (Kite/Zerodha style): weight·purity + gain% on top,
 * name + gain amount in the middle, invested + live value at the bottom.
 */
export function GoldHoldingCard({
  holding,
  spotPaisePerGram,
  canManage,
  onEdit,
  onDelete,
}: GoldHoldingCardProps) {
  const summary = summarizeGoldHolding(holding, spotPaisePerGram)
  const hasRate = spotPaisePerGram > 0
  const positive = summary.gainPaise >= 0
  const title =
    holding.name?.trim() ||
    `${finenessLabel(holding.fineness)} ${formLabel(holding.form)}`

  const gainColor = positive
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-destructive'

  const jewelleryBreakdown =
    holding.form === 'jewellery'
      ? [
          holding.makingChargesPaise > 0 &&
            `Making ${formatPaise(holding.makingChargesPaise, { decimals: false })}`,
          holding.vaPaise > 0 &&
            `VA ${formatPaise(holding.vaPaise, { decimals: false })}`,
          holding.stoneChargesPaise > 0 &&
            `Stones ${formatPaise(holding.stoneChargesPaise, { decimals: false })}`,
          holding.gstPercent > 0 && `GST ${holding.gstPercent}%`,
        ].filter(Boolean)
      : []

  const body = (
    <div className="min-w-0 flex-1 space-y-1">
      {/* line 1: weight · purity  ·······  gain % */}
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-muted-foreground truncate text-xs">
          {holding.quantity > 1 ? `Qty ${holding.quantity} · ` : ''}
          {formatGrams(summary.totalWeightMg)} · {finenessLabel(holding.fineness)}
        </span>
        {hasRate && summary.gainPct != null ? (
          <span className={cn('shrink-0 text-xs font-medium tabular-nums', gainColor)}>
            {positive ? '+' : ''}
            {summary.gainPct.toFixed(2)}%
          </span>
        ) : null}
      </div>

      {/* line 2: name  ·······  gain amount */}
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-sm font-medium">{title}</span>
        {hasRate ? (
          <span className={cn('shrink-0 text-sm font-semibold tabular-nums', gainColor)}>
            {positive ? '+' : ''}
            {formatPaise(summary.gainPaise, { decimals: false })}
          </span>
        ) : null}
      </div>

      {/* line 3: invested  ·······  live value */}
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-muted-foreground truncate text-xs tabular-nums">
          Invested {formatPaise(summary.effectiveCostPaise, { decimals: false })}
        </span>
        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
          {hasRate
            ? `Value ${formatPaise(summary.currentValuePaise, { decimals: false })}`
            : 'Set gold rate'}
        </span>
      </div>

      {/* jewellery charges breakdown */}
      {jewelleryBreakdown.length > 0 ? (
        <p className="text-muted-foreground truncate pt-0.5 text-xs">
          {jewelleryBreakdown.join(' · ')}
        </p>
      ) : null}
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
