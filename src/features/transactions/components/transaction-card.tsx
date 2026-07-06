import { MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { formatPaise } from '@/lib/money'
import { transactionTypeMeta } from '@/features/transactions/config'
import { CategoryBadge } from '@/features/categories/components/category-badge'
import type { Transaction } from '@/features/transactions/api/transaction-queries'
import type { AccountWithBalance } from '@/features/accounts/api/account-queries'
import type { Category } from '@/features/categories/api/category-queries'

interface TransactionCardProps {
  transaction: Transaction
  accountsById: Map<string, AccountWithBalance>
  categoriesById: Map<string, Category>
  canManage: boolean
  onEdit: (transaction: Transaction) => void
  onDelete: (transaction: Transaction) => void
}

/** Single transaction row, with transfers rendered as account movement. */
export function TransactionCard({
  transaction,
  accountsById,
  categoriesById,
  canManage,
  onEdit,
  onDelete,
}: TransactionCardProps) {
  const meta = transactionTypeMeta[transaction.type]
  const Icon = meta.icon
  const account = transaction.accountId
    ? accountsById.get(transaction.accountId)
    : undefined
  const category = transaction.categoryId
    ? categoriesById.get(transaction.categoryId)
    : undefined
  const fromAccount = transaction.fromAccountId
    ? accountsById.get(transaction.fromAccountId)
    : undefined
  const toAccount = transaction.toAccountId
    ? accountsById.get(transaction.toAccountId)
    : undefined

  const signedAmount =
    transaction.type === 'expense'
      ? `-${formatPaise(transaction.amount)}`
      : transaction.type === 'income'
        ? `+${formatPaise(transaction.amount)}`
        : formatPaise(transaction.amount)

  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
            meta.badgeClassName,
          )}
        >
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          {transaction.type === 'transfer' ? (
            <>
              <p className="truncate font-medium">
                {fromAccount?.name ?? 'Account'} -&gt;{' '}
                {toAccount?.name ?? 'Account'}
              </p>
              <TransactionMetaLine
                parts={['Transfer']}
                transaction={transaction}
              />
            </>
          ) : (
            <>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                {category ? (
                  <CategoryBadge
                    name={category.name}
                    icon={category.icon}
                    color={category.color}
                    className="max-w-full"
                  />
                ) : (
                  <p className="font-medium">Uncategorized</p>
                )}
              </div>
              <TransactionMetaLine
                parts={[account?.name ?? 'Account']}
                transaction={transaction}
              />
            </>
          )}

          {transaction.note ? (
            <p className="text-muted-foreground truncate text-sm">
              {transaction.note}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-start gap-1">
          <p
            className={cn(
              'pt-1 text-right font-semibold tabular-nums',
              meta.amountClassName,
            )}
          >
            {signedAmount}
          </p>

          {canManage ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="-mr-1"
                  aria-label="Transaction actions"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(transaction)}>
                  <Pencil className="h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => onDelete(transaction)}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

function TransactionMetaLine({
  parts,
  transaction,
}: {
  parts: string[]
  transaction: Transaction
}) {
  const creatorName = transaction.creator?.fullName?.trim() || 'Unknown'

  return (
    <div className="text-muted-foreground flex min-w-0 flex-wrap items-center gap-1.5 text-xs">
      {parts.map((part, index) => (
        <span key={`${part}-${index}`} className="inline-flex items-center gap-1">
          {index > 0 ? <span>·</span> : null}
          <span>{part}</span>
        </span>
      ))}
      <span>·</span>
      <span className="inline-flex min-w-0 items-center gap-1">
        <Avatar size="sm" className="h-4 w-4">
          <AvatarImage
            src={transaction.creator?.avatarUrl ?? undefined}
            alt={creatorName}
          />
          <AvatarFallback className="text-[8px]">
            {getInitials(creatorName)}
          </AvatarFallback>
        </Avatar>
        <span className="truncate">{getFirstName(creatorName)}</span>
      </span>
    </div>
  )
}

function getFirstName(name: string): string {
  return name.trim().split(/\s+/)[0] || 'Unknown'
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return name.slice(0, 2).toUpperCase()
}
