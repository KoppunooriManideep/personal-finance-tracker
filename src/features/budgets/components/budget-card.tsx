import { AlertTriangle, MoreVertical, Pencil, Trash2 } from 'lucide-react'
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
import { CategoryBadge } from '@/features/categories/components/category-badge'
import type { BudgetWithSpending } from '@/features/budgets/api/budget-queries'
import type { Category } from '@/features/categories/api/category-queries'

interface BudgetCardProps {
  budget: BudgetWithSpending
  category?: Category
  canManage: boolean
  onEdit: (budget: BudgetWithSpending) => void
  onDelete: (budget: BudgetWithSpending) => void
}

/** Budget progress tile with green/orange/red warning states. */
export function BudgetCard({
  budget,
  category,
  canManage,
  onEdit,
  onDelete,
}: BudgetCardProps) {
  const percent = budget.amount === 0 ? 100 : (budget.spent / budget.amount) * 100
  const clampedPercent = Math.min(percent, 100)
  const isOver = budget.spent > budget.amount
  const state =
    isOver || percent >= 100 ? 'red' : percent >= 80 ? 'orange' : 'green'
  const remaining = budget.amount - budget.spent

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            {category ? (
              <CategoryBadge
                name={category.name}
                icon={category.icon}
                color={category.color}
                className="max-w-full"
              />
            ) : (
              <p className="font-medium">Expense category</p>
            )}
          </div>

          {canManage ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="-mr-1 shrink-0"
                  aria-label="Budget actions"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(budget)}>
                  <Pencil className="h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => onDelete(budget)}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">Spent</span>
            <span className="font-medium tabular-nums">
              {formatPaise(budget.spent)} / {formatPaise(budget.amount)}
            </span>
          </div>
          <div className="bg-muted h-2.5 overflow-hidden rounded-full">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                state === 'green' && 'bg-emerald-500',
                state === 'orange' && 'bg-amber-500',
                state === 'red' && 'bg-rose-500',
              )}
              style={{ width: `${clampedPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span
              className={cn(
                'font-medium tabular-nums',
                state === 'green' && 'text-emerald-600 dark:text-emerald-400',
                state === 'orange' && 'text-amber-600 dark:text-amber-400',
                state === 'red' && 'text-rose-600 dark:text-rose-400',
              )}
            >
              {Math.round(percent)}% used
            </span>
            <span className="text-muted-foreground tabular-nums">
              {isOver
                ? `${formatPaise(Math.abs(remaining))} over`
                : `${formatPaise(remaining)} left`}
            </span>
          </div>
        </div>

        {isOver ? (
          <div className="bg-destructive/10 text-destructive flex items-start gap-2 rounded-md p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>This category is over budget for the month.</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
