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
import { accountTypeMeta } from '@/features/accounts/config'
import type { AccountWithBalance } from '@/features/accounts/api/account-queries'

interface AccountCardProps {
  account: AccountWithBalance
  /** When false, edit/delete actions are hidden (e.g. for viewers). */
  canManage: boolean
  onEdit: (account: AccountWithBalance) => void
  onDelete: (account: AccountWithBalance) => void
}

/** A single account tile showing its type, name and current balance. */
export function AccountCard({
  account,
  canManage,
  onEdit,
  onDelete,
}: AccountCardProps) {
  const meta = accountTypeMeta[account.type]
  const Icon = meta.icon
  const isNegative = account.currentBalance < 0

  return (
    <Card>
      <CardContent className="flex items-start gap-4 p-4">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
            meta.badgeClassName,
          )}
        >
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{account.name}</p>
          <p className="text-muted-foreground text-xs">{meta.label}</p>
          <p
            className={cn(
              'mt-2 text-lg font-semibold tabular-nums',
              isNegative && 'text-destructive',
            )}
          >
            {formatPaise(account.currentBalance)}
          </p>
        </div>

        {canManage ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="-mr-1 shrink-0"
                aria-label={`Actions for ${account.name}`}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(account)}>
                <Pencil className="h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => onDelete(account)}
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
