import { useMemo, useState } from 'react'
import { Plus, PiggyBank } from 'lucide-react'
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
import { formatMonthYear } from '@/lib/date'
import { formatPaise } from '@/lib/money'
import { useCurrentFamily } from '@/features/family/hooks/use-current-family'
import { useCategories } from '@/features/categories/hooks/use-categories'
import { useBudgets } from '@/features/budgets/hooks/use-budgets'
import { useDeleteBudget } from '@/features/budgets/hooks/use-budget-mutations'
import { BudgetCard } from '@/features/budgets/components/budget-card'
import { BudgetFormDialog } from '@/features/budgets/components/budget-form-dialog'
import type { BudgetWithSpending } from '@/features/budgets/api/budget-queries'

/** Monthly budgets for expense categories. Transfers never count as spending. */
export function BudgetsPage() {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentIstMonth())
  const { data: family } = useCurrentFamily()
  const canManage = family?.role === 'owner' || family?.role === 'member'

  const {
    data: budgets,
    isLoading: budgetsLoading,
    isError,
    refetch,
  } = useBudgets(selectedMonth)
  const { data: categories, isLoading: categoriesLoading } = useCategories()
  const deleteBudget = useDeleteBudget(selectedMonth)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<BudgetWithSpending | null>(null)
  const [toDelete, setToDelete] = useState<BudgetWithSpending | null>(null)

  const expenseCategories = useMemo(
    () => (categories ?? []).filter((category) => category.kind === 'expense'),
    [categories],
  )
  const categoriesById = useMemo(
    () =>
      new Map((categories ?? []).map((category) => [category.id, category])),
    [categories],
  )

  const totals = useMemo(
    () =>
      (budgets ?? []).reduce(
        (sum, budget) => {
          sum.budgeted += budget.amount
          sum.spent += budget.spent
          return sum
        },
        { budgeted: 0, spent: 0 },
      ),
    [budgets],
  )

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (budget: BudgetWithSpending) => {
    setEditing(budget)
    setFormOpen(true)
  }

  const handleDelete = async () => {
    if (!toDelete) return
    try {
      await deleteBudget.mutateAsync(toDelete.id)
      toast.success('Budget deleted')
    } catch (error) {
      toast.error('Could not delete budget')
      console.error(error)
    } finally {
      setToDelete(null)
    }
  }

  const isLoading = budgetsLoading || categoriesLoading

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Budgets"
        description="Set monthly limits per expense category."
        actions={
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="space-y-0 w-[150px] shrink-0">
              <Label htmlFor="budget-page-month" className="sr-only">
                Month
              </Label>
              <Input
                id="budget-page-month"
                type="month"
                value={selectedMonth}
                onChange={(event) => {
                  if (event.target.value) setSelectedMonth(event.target.value)
                }}
                className="w-full h-10"
              />
            </div>
            {canManage ? (
              <Button
                onClick={openCreate}
                disabled={expenseCategories.length === 0}
                className="h-10 flex-1 sm:flex-initial justify-center shrink-0"
              >
                <Plus className="h-4 w-4" />
                <span>Add budget</span>
              </Button>
            ) : null}
          </div>
        }
      />

      {isLoading ? (
        <LoadingSpinner />
      ) : isError ? (
        <ErrorState
          description="We could not load your budgets."
          onRetry={() => refetch()}
        />
      ) : expenseCategories.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title="No expense categories"
          description="Create an expense category before setting budgets."
        />
      ) : !budgets || budgets.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title="No budgets yet"
          description="Create a monthly budget for an expense category to track your spending."
          action={
            canManage ? (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Add budget
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          <Card>
            <CardContent className="grid gap-4 p-4 sm:grid-cols-3">
              <SummaryValue
                label="Budgeted"
                value={formatPaise(totals.budgeted)}
              />
              <SummaryValue label="Spent" value={formatPaise(totals.spent)} />
              <SummaryValue
                label="Remaining"
                value={formatPaise(totals.budgeted - totals.spent)}
                destructive={totals.spent > totals.budgeted}
              />
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <h2 className="text-muted-foreground text-sm font-medium">
              {formatMonthYear(new Date(`${selectedMonth}-01T00:00:00+05:30`))}
            </h2>
            <p className="text-muted-foreground text-sm">
              Expense transactions only
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {budgets.map((budget) => (
              <BudgetCard
                key={budget.id}
                budget={budget}
                category={categoriesById.get(budget.categoryId)}
                canManage={canManage}
                onEdit={openEdit}
                onDelete={setToDelete}
              />
            ))}
          </div>
        </div>
      )}

      <BudgetFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        selectedMonth={selectedMonth}
        budget={editing}
        expenseCategories={expenseCategories}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Delete budget?"
        description="This monthly budget will be removed. Transactions are not changed."
        confirmLabel="Delete"
        destructive
        loading={deleteBudget.isPending}
        onConfirm={handleDelete}
      />
    </div>
  )
}

function SummaryValue({
  label,
  value,
  destructive = false,
}: {
  label: string
  value: string
  destructive?: boolean
}) {
  return (
    <div>
      <p className="text-muted-foreground text-sm">{label}</p>
      <p
        className={
          destructive
            ? 'text-destructive text-xl font-semibold tabular-nums'
            : 'text-xl font-semibold tabular-nums'
        }
      >
        {value}
      </p>
    </div>
  )
}

function getCurrentIstMonth(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date())
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  return `${year}-${month}`
}
