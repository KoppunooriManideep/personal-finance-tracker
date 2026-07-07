import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { paiseToRupees } from '@/lib/money'
import { budgetSchema, type BudgetFormValues } from '@/features/budgets/schema'
import {
  useCreateBudget,
  useUpdateBudget,
} from '@/features/budgets/hooks/use-budget-mutations'
import type { BudgetWithSpending } from '@/features/budgets/api/budget-queries'
import type { Category } from '@/features/categories/api/category-queries'

interface BudgetFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedMonth: string
  budget?: BudgetWithSpending | null
  expenseCategories: Category[]
}

/** Add/Edit monthly budget modal for expense categories only. */
export function BudgetFormDialog({
  open,
  onOpenChange,
  selectedMonth,
  budget,
  expenseCategories,
}: BudgetFormDialogProps) {
  const isEdit = Boolean(budget)
  const createBudget = useCreateBudget(selectedMonth)
  const updateBudget = useUpdateBudget(selectedMonth)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetSchema),
    defaultValues: {
      categoryId: '',
      amount: 0,
      periodMonth: selectedMonth,
    },
  })

  useEffect(() => {
    if (!open) return
    reset(
      budget
        ? {
            categoryId: budget.categoryId,
            amount: paiseToRupees(budget.amount),
            periodMonth: budget.periodMonth.slice(0, 7),
          }
        : {
            categoryId: '',
            amount: 0,
            periodMonth: selectedMonth,
          },
    )
  }, [open, budget, selectedMonth, reset])

  const isPending = createBudget.isPending || updateBudget.isPending

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (budget) {
        await updateBudget.mutateAsync({ id: budget.id, values })
        toast.success('Budget updated')
      } else {
        await createBudget.mutateAsync(values)
        toast.success('Budget added')
      }
      onOpenChange(false)
    } catch (error) {
      toast.error(isEdit ? 'Could not update budget' : 'Could not add budget')
      console.error(error)
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit budget' : 'Add budget'}</DialogTitle>
          <DialogDescription>
            Budgets track expense categories only. Transfers are excluded.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col min-h-0 flex-1 gap-4 overflow-hidden">
          <div className="flex-1 overflow-y-auto min-h-0 space-y-4 px-6">
            <div className="space-y-1.5">
              <Label htmlFor="budget-category">Expense category</Label>
              <select
                id="budget-category"
                className={selectClassName}
                {...register('categoryId')}
              >
                <option value="">Select category</option>
                {expenseCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              {errors.categoryId ? (
                <p className="text-destructive text-sm">
                  {errors.categoryId.message}
                </p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="budget-amount">Budget amount (Rs)</Label>
                <Input
                  id="budget-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  placeholder="0.00"
                  {...register('amount', { valueAsNumber: true })}
                />
                {errors.amount ? (
                  <p className="text-destructive text-sm">
                    {errors.amount.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="budget-month">Month</Label>
                <Input
                  id="budget-month"
                  type="month"
                  {...register('periodMonth')}
                />
                {errors.periodMonth ? (
                  <p className="text-destructive text-sm">
                    {errors.periodMonth.message}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <DialogFooter className="shrink-0 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEdit ? 'Save changes' : 'Add budget'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const selectClassName = cn(
  'border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
)
