import { useEffect } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
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
import { transactionTypeMeta } from '@/features/transactions/config'
import {
  transactionSchema,
  transactionTypes,
  type TransactionFormValues,
} from '@/features/transactions/schema'
import {
  useCreateTransaction,
  useUpdateTransaction,
} from '@/features/transactions/hooks/use-transaction-mutations'
import type { Transaction } from '@/features/transactions/api/transaction-queries'
import type { AccountWithBalance } from '@/features/accounts/api/account-queries'
import type { Category } from '@/features/categories/api/category-queries'

interface TransactionFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction?: Transaction | null
  accounts: AccountWithBalance[]
  categories: Category[]
}

const emptyDefaults: TransactionFormValues = {
  type: 'expense',
  amount: 0,
  occurredOn: toDateInputValue(new Date().toISOString()),
  note: '',
  accountId: '',
  categoryId: '',
  fromAccountId: '',
  toAccountId: '',
}

/** Add/Edit transaction modal with type-specific fields and validation. */
export function TransactionFormDialog({
  open,
  onOpenChange,
  transaction,
  accounts,
  categories,
}: TransactionFormDialogProps) {
  const isEdit = Boolean(transaction)
  const createTransaction = useCreateTransaction()
  const updateTransaction = useUpdateTransaction()

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors },
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: emptyDefaults,
  })

  const type = useWatch({ control, name: 'type' })
  const availableCategories = categories.filter(
    (category) => category.kind === type,
  )

  useEffect(() => {
    if (!open) return

    reset(
      transaction
        ? {
            type: transaction.type,
            amount: paiseToRupees(transaction.amount),
            occurredOn: toDateInputValue(transaction.occurredAt),
            note: transaction.note ?? '',
            accountId: transaction.accountId ?? '',
            categoryId: transaction.categoryId ?? '',
            fromAccountId: transaction.fromAccountId ?? '',
            toAccountId: transaction.toAccountId ?? '',
          }
        : emptyDefaults,
    )
  }, [open, transaction, reset])

  useEffect(() => {
    if (type === 'transfer') {
      setValue('accountId', '')
      setValue('categoryId', '')
      return
    }

    setValue('fromAccountId', '')
    setValue('toAccountId', '')
  }, [type, setValue])

  const isPending = createTransaction.isPending || updateTransaction.isPending

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (transaction) {
        await updateTransaction.mutateAsync({
          id: transaction.id,
          previous: transaction,
          values,
        })
        toast.success('Transaction updated')
      } else {
        await createTransaction.mutateAsync(values)
        toast.success('Transaction added')
      }
      onOpenChange(false)
    } catch (error) {
      toast.error(
        isEdit ? 'Could not update transaction' : 'Could not add transaction',
      )
      console.error(error)
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Edit transaction' : 'Add transaction'}
          </DialogTitle>
          <DialogDescription>
            Transfers move money between accounts and do not use categories.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <div className="grid grid-cols-3 gap-2">
                  {transactionTypes.map((option) => {
                    const meta = transactionTypeMeta[option]
                    const Icon = meta.icon
                    const selected = field.value === option
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => field.onChange(option)}
                        aria-pressed={selected}
                        className={cn(
                          'flex items-center justify-center gap-2 rounded-md border p-2.5 text-sm transition-colors',
                          selected
                            ? 'border-primary bg-primary/5 ring-1 ring-primary'
                            : 'hover:bg-accent',
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {meta.label}
                      </button>
                    )
                  })}
                </div>
              )}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="transaction-amount">Amount (Rs)</Label>
              <Input
                id="transaction-amount"
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
              <Label htmlFor="transaction-date">Date</Label>
              <Input
                id="transaction-date"
                type="date"
                {...register('occurredOn')}
              />
              {errors.occurredOn ? (
                <p className="text-destructive text-sm">
                  {errors.occurredOn.message}
                </p>
              ) : null}
            </div>
          </div>

          {type === 'transfer' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                id="from-account"
                label="From account"
                error={errors.fromAccountId?.message}
                {...register('fromAccountId')}
              >
                <option value="">Select account</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </SelectField>

              <SelectField
                id="to-account"
                label="To account"
                error={errors.toAccountId?.message}
                {...register('toAccountId')}
              >
                <option value="">Select account</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </SelectField>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                id="transaction-account"
                label="Account"
                error={errors.accountId?.message}
                {...register('accountId')}
              >
                <option value="">Select account</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </SelectField>

              <SelectField
                id="transaction-category"
                label="Category"
                error={errors.categoryId?.message}
                {...register('categoryId')}
              >
                <option value="">Select category</option>
                {availableCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </SelectField>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="transaction-note">Note</Label>
            <Input
              id="transaction-note"
              placeholder="Optional"
              autoComplete="off"
              {...register('note')}
            />
            {errors.note ? (
              <p className="text-destructive text-sm">{errors.note.message}</p>
            ) : null}
          </div>

          <DialogFooter>
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
              {isEdit ? 'Save changes' : 'Add transaction'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface SelectFieldProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  id: string
  label: string
  error?: string
}

function SelectField({
  id,
  label,
  error,
  children,
  className,
  ...props
}: SelectFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        className={cn(
          'border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
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
