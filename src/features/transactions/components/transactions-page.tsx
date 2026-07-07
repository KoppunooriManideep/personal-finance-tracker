import { useMemo, useState } from 'react'
import { ArrowLeftRight, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState } from '@/components/common/empty-state'
import { ErrorState } from '@/components/common/error-state'
import { LoadingSpinner } from '@/components/common/loading-spinner'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/date'
import { formatPaise } from '@/lib/money'
import { useCurrentFamily } from '@/features/family/hooks/use-current-family'
import { useFamilyMembers } from '@/features/family/hooks/use-family-members'
import { useAccounts } from '@/features/accounts/hooks/use-accounts'
import { useCategories } from '@/features/categories/hooks/use-categories'
import { useTransactions } from '@/features/transactions/hooks/use-transactions'
import { useDeleteTransaction } from '@/features/transactions/hooks/use-transaction-mutations'
import { TransactionFormDialog } from '@/features/transactions/components/transaction-form-dialog'
import { TransactionCard } from '@/features/transactions/components/transaction-card'
import {
  transactionTypeMeta,
} from '@/features/transactions/config'
import {
  transactionTypes,
  type TransactionFilters,
} from '@/features/transactions/schema'
import type { Transaction } from '@/features/transactions/api/transaction-queries'
import type { FamilyMember } from '@/features/family/api/family-queries'
import type { TransactionType } from '@/types/database.types'
import type { AccountWithBalance } from '@/features/accounts/api/account-queries'

const emptyFilters: TransactionFilters = {
  from: '',
  to: '',
  accountId: '',
  categoryId: '',
  memberId: '',
  type: undefined,
  search: '',
}

/** Transactions list with create/edit/delete and type-aware filters. */
export function TransactionsPage() {
  const { data: family } = useCurrentFamily()
  const canManage = family?.role === 'owner' || family?.role === 'member'

  const {
    data: transactions,
    isLoading: transactionsLoading,
    isError: transactionsError,
    refetch,
  } = useTransactions()
  const { data: accounts, isLoading: accountsLoading } = useAccounts()
  const { data: categories, isLoading: categoriesLoading } = useCategories()
  const { data: members, isLoading: membersLoading } = useFamilyMembers()
  const deleteTransaction = useDeleteTransaction()

  const [filters, setFilters] = useState<TransactionFilters>(emptyFilters)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [toDelete, setToDelete] = useState<Transaction | null>(null)

  const accountsById = useMemo(
    () => new Map((accounts ?? []).map((account) => [account.id, account])),
    [accounts],
  )
  const categoriesById = useMemo(
    () =>
      new Map((categories ?? []).map((category) => [category.id, category])),
    [categories],
  )

  const filteredTransactions = useMemo(
    () =>
      (transactions ?? []).filter((transaction) =>
        matchesFilters(transaction, filters, accountsById, categoriesById),
      ),
    [transactions, filters, accountsById, categoriesById],
  )

  const groupedTransactions = useMemo(() => {
    const groups = new Map<string, Transaction[]>()
    filteredTransactions.forEach((transaction) => {
      const key = formatDate(transaction.occurredAt)
      groups.set(key, [...(groups.get(key) ?? []), transaction])
    })
    return Array.from(groups.entries())
  }, [filteredTransactions])

  const totals = useMemo(
    () =>
      filteredTransactions.reduce(
        (sum, transaction) => {
          if (transaction.type === 'income') sum.income += transaction.amount
          if (transaction.type === 'expense') sum.expense += transaction.amount
          if (transaction.type === 'transfer') sum.transfer += transaction.amount
          return sum
        },
        { income: 0, expense: 0, transfer: 0 },
      ),
    [filteredTransactions],
  )

  const isLoading =
    transactionsLoading || accountsLoading || categoriesLoading || membersLoading

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (transaction: Transaction) => {
    setEditing(transaction)
    setFormOpen(true)
  }

  const handleDelete = async () => {
    if (!toDelete) return
    try {
      await deleteTransaction.mutateAsync(toDelete)
      toast.success('Transaction deleted')
    } catch (error) {
      toast.error('Could not delete transaction')
      console.error(error)
    } finally {
      setToDelete(null)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Transactions"
        description="Income, expenses and transfers. Transfers never affect category reports."
        actions={
          canManage ? (
            <Button onClick={openCreate} disabled={(accounts ?? []).length < 1}>
              <Plus className="h-4 w-4" />
              Add transaction
            </Button>
          ) : undefined
        }
      />

      {isLoading ? (
        <LoadingSpinner />
      ) : transactionsError ? (
        <ErrorState
          description="We could not load your transactions."
          onRetry={() => refetch()}
        />
      ) : !transactions || transactions.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title="No transactions yet"
          description="Add your first income, expense or transfer to get started."
          action={
            canManage ? (
              <Button onClick={openCreate} disabled={(accounts ?? []).length < 1}>
                <Plus className="h-4 w-4" />
                Add transaction
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          <SummaryCards totals={totals} />
          <TransactionFiltersCard
            filters={filters}
            onFiltersChange={setFilters}
            accounts={accounts ?? []}
            categories={categories ?? []}
            members={members ?? []}
          />

          {filteredTransactions.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No matching transactions"
              description="Try changing the date range, type, account, category or search text."
              action={
                <Button
                  variant="outline"
                  onClick={() => setFilters(emptyFilters)}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <div className="space-y-6">
              {groupedTransactions.map(([date, items]) => (
                <section key={date} className="space-y-3">
                  <div className="flex items-center justify-between sticky top-14 z-10 bg-background/95 backdrop-blur-xs py-2">
                    <h2 className="text-muted-foreground text-sm font-medium">
                      {date}
                    </h2>
                    <span className="text-muted-foreground text-xs">
                      {items.length}{' '}
                      {items.length === 1 ? 'transaction' : 'transactions'}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {items.map((transaction) => (
                      <TransactionCard
                        key={transaction.id}
                        transaction={transaction}
                        accountsById={accountsById}
                        categoriesById={categoriesById}
                        canManage={canManage}
                        onEdit={openEdit}
                        onDelete={setToDelete}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      )}

      <TransactionFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        transaction={editing}
        accounts={accounts ?? []}
        categories={categories ?? []}
      />

      {canManage && (
        <button
          type="button"
          onClick={openCreate}
          disabled={(accounts ?? []).length < 1}
          className="fixed bottom-24 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95 disabled:pointer-events-none disabled:opacity-50 md:hidden"
          aria-label="Add transaction"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Delete transaction?"
        description="This transaction will be removed and account balances will update automatically."
        confirmLabel="Delete"
        destructive
        loading={deleteTransaction.isPending}
        onConfirm={handleDelete}
      />
    </div>
  )
}

interface SummaryCardsProps {
  totals: Record<TransactionType, number>
}

function SummaryCards({ totals }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {transactionTypes.map((type) => {
        const meta = transactionTypeMeta[type]
        const Icon = meta.icon
        return (
          <Card key={type}>
            <CardContent className="flex flex-col items-start gap-1 p-2 sm:flex-row sm:items-center sm:gap-3 sm:p-4">
              <div
                className={cn(
                  'flex h-7 w-7 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg',
                  meta.badgeClassName,
                )}
              >
                <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </div>
              <div className="min-w-0 w-full">
                <p className="text-muted-foreground text-[10px] sm:text-xs truncate">{meta.label}</p>
                <p
                  className={cn(
                    'text-[10px] min-[360px]:text-xs sm:text-sm md:text-base font-semibold tabular-nums',
                    meta.amountClassName,
                  )}
                >
                  {formatPaise(totals[type])}
                </p>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

interface TransactionFiltersCardProps {
  filters: TransactionFilters
  onFiltersChange: (filters: TransactionFilters) => void
  accounts: { id: string; name: string }[]
  categories: { id: string; name: string; kind: 'income' | 'expense' }[]
  members: FamilyMember[]
}

function TransactionFiltersCard({
  filters,
  onFiltersChange,
  accounts,
  categories,
  members,
}: TransactionFiltersCardProps) {
  const [isOpen, setIsOpen] = useState(false)

  const update = (patch: Partial<TransactionFilters>) =>
    onFiltersChange({ ...filters, ...patch })

  const categoryOptions = categories.filter((category) =>
    filters.type && filters.type !== 'transfer'
      ? category.kind === filters.type
      : true,
  )

  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (filters.from) count++
    if (filters.to) count++
    if (filters.type) count++
    if (filters.accountId) count++
    if (filters.categoryId) count++
    if (filters.memberId) count++
    return count
  }, [filters])

  return (
    <>
      {/* Desktop view (inline card) */}
      <Card className="hidden md:block">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-7">
          <FilterField label="From">
            <Input
              type="date"
              value={filters.from ?? ''}
              onChange={(event) => update({ from: event.target.value })}
            />
          </FilterField>
          <FilterField label="To">
            <Input
              type="date"
              value={filters.to ?? ''}
              onChange={(event) => update({ to: event.target.value })}
            />
          </FilterField>
          <FilterField label="Type">
            <select
              className={selectClassName}
              value={filters.type ?? ''}
              onChange={(event) =>
                update({
                  type: (event.target.value || undefined) as
                    | TransactionType
                    | undefined,
                  categoryId:
                    event.target.value === 'transfer' ? '' : filters.categoryId,
                })
              }
            >
              <option value="">All</option>
              {transactionTypes.map((type) => (
                <option key={type} value={type}>
                  {transactionTypeMeta[type].label}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Account">
            <select
              className={selectClassName}
              value={filters.accountId ?? ''}
              onChange={(event) => update({ accountId: event.target.value })}
            >
              <option value="">All accounts</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Category">
            <select
              className={selectClassName}
              value={filters.categoryId ?? ''}
              disabled={filters.type === 'transfer'}
              onChange={(event) => update({ categoryId: event.target.value })}
            >
              <option value="">All categories</option>
              {categoryOptions.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Account Owner">
            <select
              className={selectClassName}
              value={filters.memberId ?? ''}
              onChange={(event) => update({ memberId: event.target.value })}
            >
              <option value="">All members</option>
              <option value="shared">Shared / Family</option>
              {members.map((member) => (
                <option key={member.id} value={member.userId}>
                  {getMemberDisplayName(member)}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Search">
            <Input
              value={filters.search ?? ''}
              onChange={(event) => update({ search: event.target.value })}
              placeholder="Note, account..."
            />
          </FilterField>
        </CardContent>
      </Card>

      {/* Mobile view (search row + filter sheet trigger) */}
      <div className="flex gap-2 items-center md:hidden w-full">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={filters.search ?? ''}
            onChange={(event) => update({ search: event.target.value })}
            placeholder="Search note, account..."
            className="pl-9 h-10"
          />
        </div>
        
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="flex gap-1.5 shrink-0 relative h-10">
              <SlidersHorizontal className="h-4 w-4" />
              <span>Filters</span>
              {activeFiltersCount > 0 ? (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {activeFiltersCount}
                </span>
              ) : null}
            </Button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="rounded-t-xl max-h-[85vh] overflow-y-auto px-6 pb-6 pt-4"
            onOpenAutoFocus={(event) => event.preventDefault()}
          >
            <SheetHeader className="text-left mb-4">
              <SheetTitle>Filters</SheetTitle>
              <SheetDescription>
                Narrow down your transaction list.
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-4 my-2 pr-1">
              <FilterField label="From">
                <Input
                  type="date"
                  value={filters.from ?? ''}
                  onChange={(event) => update({ from: event.target.value })}
                  className="h-10"
                />
              </FilterField>
              <FilterField label="To">
                <Input
                  type="date"
                  value={filters.to ?? ''}
                  onChange={(event) => update({ to: event.target.value })}
                  className="h-10"
                />
              </FilterField>
              <FilterField label="Type">
                <select
                  className={cn(selectClassName, 'h-10')}
                  value={filters.type ?? ''}
                  onChange={(event) =>
                    update({
                      type: (event.target.value || undefined) as
                        | TransactionType
                        | undefined,
                      categoryId:
                        event.target.value === 'transfer' ? '' : filters.categoryId,
                    })
                  }
                >
                  <option value="">All Types</option>
                  {transactionTypes.map((type) => (
                    <option key={type} value={type}>
                      {transactionTypeMeta[type].label}
                    </option>
                  ))}
                </select>
              </FilterField>
              <FilterField label="Account">
                <select
                  className={cn(selectClassName, 'h-10')}
                  value={filters.accountId ?? ''}
                  onChange={(event) => update({ accountId: event.target.value })}
                >
                  <option value="">All accounts</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </FilterField>
              <FilterField label="Category">
                <select
                  className={cn(selectClassName, 'h-10')}
                  value={filters.categoryId ?? ''}
                  disabled={filters.type === 'transfer'}
                  onChange={(event) => update({ categoryId: event.target.value })}
                >
                  <option value="">All categories</option>
                  {categoryOptions.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </FilterField>
              <FilterField label="Account Owner">
                <select
                  className={cn(selectClassName, 'h-10')}
                  value={filters.memberId ?? ''}
                  onChange={(event) => update({ memberId: event.target.value })}
                >
                  <option value="">All members</option>
                  <option value="shared">Shared / Family</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.userId}>
                      {getMemberDisplayName(member)}
                    </option>
                  ))}
                </select>
              </FilterField>
            </div>
            <SheetFooter className="mt-6">
              <Button onClick={() => setIsOpen(false)} className="w-full h-11 text-base font-medium">
                Apply Filters
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}

function FilterField({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function matchesFilters(
  transaction: Transaction,
  filters: TransactionFilters,
  accountsById: Map<string, AccountWithBalance>,
  categoriesById: Map<string, { name: string }>,
) {
  const occurredOn = toDateInputValue(transaction.occurredAt)

  if (filters.from && occurredOn < filters.from) return false
  if (filters.to && occurredOn > filters.to) return false
  if (filters.type && transaction.type !== filters.type) return false
  if (filters.categoryId && transaction.categoryId !== filters.categoryId) {
    return false
  }
  if (filters.memberId) {
    const targetOwnerId = filters.memberId === 'shared' ? null : filters.memberId

    if (transaction.type === 'transfer') {
      const fromOwnerId = transaction.fromAccountId ? accountsById.get(transaction.fromAccountId)?.ownerId : null
      const toOwnerId = transaction.toAccountId ? accountsById.get(transaction.toAccountId)?.ownerId : null
      if (fromOwnerId !== targetOwnerId && toOwnerId !== targetOwnerId) {
        return false
      }
    } else {
      const ownerId = transaction.accountId ? accountsById.get(transaction.accountId)?.ownerId : null
      if (ownerId !== targetOwnerId) {
        return false
      }
    }
  }
  if (filters.accountId && !transactionTouchesAccount(transaction, filters.accountId)) {
    return false
  }

  const search = filters.search?.trim().toLowerCase()
  if (!search) return true

  const accountName = transaction.accountId
    ? accountsById.get(transaction.accountId)?.name
    : undefined
  const fromName = transaction.fromAccountId
    ? accountsById.get(transaction.fromAccountId)?.name
    : undefined
  const toName = transaction.toAccountId
    ? accountsById.get(transaction.toAccountId)?.name
    : undefined
  const categoryName = transaction.categoryId
    ? categoriesById.get(transaction.categoryId)?.name
    : undefined

  return [
    transaction.note,
    transaction.type,
    accountName,
    fromName,
    toName,
    categoryName,
  ]
    .filter(Boolean)
    .some((value) => value!.toLowerCase().includes(search))
}

function getMemberDisplayName(member: FamilyMember): string {
  return (
    member.profile?.fullName?.trim() ||
    member.displayName?.trim() ||
    `Member ${member.userId.slice(0, 8)}`
  )
}

function transactionTouchesAccount(transaction: Transaction, accountId: string) {
  return (
    transaction.accountId === accountId ||
    transaction.fromAccountId === accountId ||
    transaction.toAccountId === accountId
  )
}

function toDateInputValue(input: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(input))
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value
  return `${year}-${month}-${day}`
}

const selectClassName =
  'border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50'
