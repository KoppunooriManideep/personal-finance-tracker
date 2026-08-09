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
import { formatDate } from '@/lib/date'
import {
  FORM_ICONS,
  finenessLabel,
  formLabel,
  formatGrams,
  goldBadgeClassName,
} from '@/features/investments/config'
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

/** A single gold holding tile with live value and gain. */
export function GoldHoldingCard({
  holding,
  spotPaisePerGram,
  canManage,
  onEdit,
  onDelete,
}: GoldHoldingCardProps) {
  const Icon = FORM_ICONS[holding.form]
  const summary = summarizeGoldHolding(holding, spotPaisePerGram)
  const hasRate = spotPaisePerGram > 0
  const title =
    holding.name?.trim() ||
    `${finenessLabel(holding.fineness)} ${formLabel(holding.form)}`

  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
            goldBadgeClassName,
          )}
        >
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium md:text-base">{title}</p>
            <span className="text-muted-foreground bg-muted shrink-0 rounded-full px-2 py-0.5 text-xs">
              {formLabel(holding.form)}
            </span>
          </div>

          <p className="text-muted-foreground mt-0.5 text-xs">
            {formatGrams(summary.totalWeightMg)} · {finenessLabel(holding.fineness)}
            {holding.quantity > 1 ? ` · ×${holding.quantity}` : ''}
          </p>

          <p className="mt-2 text-base font-semibold tabular-nums break-words sm:text-lg">
            {hasRate ? formatPaise(summary.currentValuePaise, { decimals: false }) : '—'}
          </p>

          {hasRate ? (
            <p className="mt-0.5 text-xs">
              <span
                className={cn(
                  'font-medium tabular-nums',
                  summary.gainPaise < 0
                    ? 'text-destructive'
                    : 'text-emerald-600 dark:text-emerald-400',
                )}
              >
                {summary.gainPaise >= 0 ? '+' : ''}
                {formatPaise(summary.gainPaise, { decimals: false })}
                {summary.gainPct != null
                  ? ` · ${summary.gainPct >= 0 ? '+' : ''}${summary.gainPct.toFixed(1)}%`
                  : ''}
              </span>
              <span className="text-muted-foreground">
                {' '}
                vs {formatPaise(summary.effectiveCostPaise, { decimals: false })} cost
              </span>
            </p>
          ) : (
            <p className="text-muted-foreground mt-0.5 text-xs">
              Set the gold rate to see live value · paid{' '}
              {formatPaise(summary.effectiveCostPaise, { decimals: false })}
            </p>
          )}

          <p className="text-muted-foreground mt-1 text-xs">
            {formatDate(`${holding.purchaseDate}T12:00:00`)}
            {holding.brand ? ` · ${holding.brand}` : ''}
          </p>
        </div>

        {canManage ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="-mr-1 shrink-0"
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
