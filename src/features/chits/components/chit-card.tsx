import { Link } from 'react-router-dom'
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
import { formatMonthYear } from '@/lib/date'
import { chitDetailPath } from '@/config/paths'
import {
  chitBadgeClassName,
  chitIcon as ChitIcon,
  chitStatusMeta,
} from '@/features/chits/config'
import { chitBaseMonthly } from '@/features/chits/summary'
import type { Chit } from '@/features/chits/api/chit-queries'
import type { ChitSummary } from '@/features/chits/chit-math'

interface ChitCardProps {
  chit: Chit
  /** Live return summary; when omitted or with no payments, shows the basics. */
  summary?: ChitSummary
  /** When false, edit/delete actions are hidden (e.g. for viewers). */
  canManage: boolean
  onEdit: (chit: Chit) => void
  onDelete: (chit: Chit) => void
}

/** A single chit tile linking to its detail; shows value, base monthly, returns. */
export function ChitCard({
  chit,
  summary,
  canManage,
  onEdit,
  onDelete,
}: ChitCardProps) {
  const status = chitStatusMeta[chit.status]
  const baseMonthly = chitBaseMonthly(chit)
  const hasActivity = Boolean(summary && summary.monthsPaid > 0)

  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <Link
          to={chitDetailPath(chit.id)}
          className="flex min-w-0 flex-1 items-start gap-3"
        >
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
              chitBadgeClassName,
            )}
          >
            <ChitIcon className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-medium md:text-base">
                {chit.name}
              </p>
              <span
                className={cn(
                  'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                  status.badgeClassName,
                )}
              >
                {status.label}
              </span>
            </div>

            {chit.organizer ? (
              <p className="text-muted-foreground truncate text-xs">
                {chit.organizer}
              </p>
            ) : null}

            <p className="mt-2 text-lg font-semibold tabular-nums">
              {formatPaise(chit.chitValue, { decimals: false })}
            </p>

            <p className="text-muted-foreground mt-1 text-xs">
              {formatPaise(baseMonthly, { decimals: false })}/mo ·{' '}
              {chit.tenureMonths} months
            </p>

            {hasActivity && summary ? (
              <p className="text-muted-foreground mt-0.5 text-xs">
                Net{' '}
                <span
                  className={cn(
                    'font-medium tabular-nums',
                    summary.netPosition < 0
                      ? 'text-destructive'
                      : 'text-emerald-600 dark:text-emerald-400',
                  )}
                >
                  {formatPaise(summary.netPosition, { decimals: false })}
                </span>
                {summary.xirrPct != null
                  ? ` · XIRR ${summary.xirrPct.toFixed(1)}%`
                  : ''}
              </p>
            ) : (
              <p className="text-muted-foreground text-xs">
                Started {formatMonthYear(dateStamp(chit.startDate))}
              </p>
            )}
          </div>
        </Link>

        {canManage ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="-mr-1 shrink-0"
                aria-label={`Actions for ${chit.name}`}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(chit)}>
                <Pencil className="h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => onDelete(chit)}
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

/** A chit's start date is a plain YYYY-MM-DD; anchor it at noon for display. */
function dateStamp(startDate: string): string {
  return `${startDate}T12:00:00`
}
