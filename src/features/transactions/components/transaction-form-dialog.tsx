import { useEffect, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Sparkles } from 'lucide-react'
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
import { parseTransaction } from '@/features/transactions/api/parse-transaction-api'
import { matchParsedTransaction } from '@/features/transactions/nl-match'
import { useFamilyMembers } from '@/features/family/hooks/use-family-members'
import { GroupedAccountOptions } from '@/features/accounts/components/grouped-account-options'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  const { data: familyMembers } = useFamilyMembers()

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

  // Natural-language "quick add": type a sentence, Gemini fills the fields.
  const [nlText, setNlText] = useState('')
  const [parsing, setParsing] = useState(false)

  const handleOpenChange = (next: boolean) => {
    if (!next) setNlText('')
    onOpenChange(next)
  }

  const handleQuickAdd = async () => {
    const text = nlText.trim()
    if (!text) return
    try {
      setParsing(true)
      const parsed = await parseTransaction({ text, categories, accounts })
      const patch = matchParsedTransaction(parsed, { categories, accounts })
      // Set type first; the type-change effect only clears the OTHER mode's
      // fields, so the ones we set below survive.
      if (patch.type) setValue('type', patch.type)
      if (patch.amount != null) setValue('amount', patch.amount)
      if (patch.occurredOn) setValue('occurredOn', patch.occurredOn)
      if (patch.note != null) setValue('note', patch.note)
      if (patch.accountId) setValue('accountId', patch.accountId)
      if (patch.categoryId) setValue('categoryId', patch.categoryId)
      if (patch.fromAccountId) setValue('fromAccountId', patch.fromAccountId)
      if (patch.toAccountId) setValue('toAccountId', patch.toAccountId)
      toast.success('Filled below — check and save')
    } catch (error) {
      toast.error('Could not understand that — fill it in manually')
      console.error(error)
    } finally {
      setParsing(false)
    }
  }

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
      handleOpenChange(false)
    } catch (error) {
      toast.error(
        isEdit ? 'Could not update transaction' : 'Could not add transaction',
      )
      console.error(error)
    }
  })

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent onOpenAutoFocus={(event) => isEdit && event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Edit transaction' : 'Add transaction'}
          </DialogTitle>
          <DialogDescription>
            Transfers move money between accounts and do not use categories.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col min-h-0 flex-1 gap-4 overflow-hidden">
          <div className="flex-1 overflow-y-auto min-h-0 space-y-4 px-6">
            {!isEdit ? (
              <div className="bg-muted/40 space-y-1.5 rounded-lg border p-3">
                <Label
                  htmlFor="nl-quick-add"
                  className="flex items-center gap-1.5 text-sm"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Quick add
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="nl-quick-add"
                    value={nlText}
                    onChange={(event) => setNlText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        void handleQuickAdd()
                      }
                    }}
                    placeholder="e.g. paid 500 groceries at DMart yesterday"
                    autoComplete="off"
                    disabled={parsing}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleQuickAdd}
                    disabled={parsing || !nlText.trim()}
                  >
                    {parsing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Fill
                  </Button>
                </div>
                <p className="text-muted-foreground text-xs">
                  Type it naturally; AI fills the fields below to review. Your
                  category &amp; account names are sent to Google to match.
                </p>
              </div>
            ) : null}

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
                <Controller
                  control={control}
                  name="fromAccountId"
                  render={({ field }) => (
                    <CustomSelectField
                      id="from-account"
                      label="From account"
                      error={errors.fromAccountId?.message}
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder="Select account"
                    >
                      <SelectItem value="none">Select account</SelectItem>
                      <GroupedAccountOptions accounts={accounts} familyMembers={familyMembers} />
                    </CustomSelectField>
                  )}
                />

                <Controller
                  control={control}
                  name="toAccountId"
                  render={({ field }) => (
                    <CustomSelectField
                      id="to-account"
                      label="To account"
                      error={errors.toAccountId?.message}
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder="Select account"
                    >
                      <SelectItem value="none">Select account</SelectItem>
                      <GroupedAccountOptions accounts={accounts} familyMembers={familyMembers} />
                    </CustomSelectField>
                  )}
                />
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Controller
                  control={control}
                  name="accountId"
                  render={({ field }) => (
                    <CustomSelectField
                      id="transaction-account"
                      label="Account"
                      error={errors.accountId?.message}
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder="Select account"
                    >
                      <SelectItem value="none">Select account</SelectItem>
                      <GroupedAccountOptions accounts={accounts} familyMembers={familyMembers} />
                    </CustomSelectField>
                  )}
                />

                <Controller
                  control={control}
                  name="categoryId"
                  render={({ field }) => (
                    <CustomSelectField
                      id="transaction-category"
                      label="Category"
                      error={errors.categoryId?.message}
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder="Select category"
                    >
                      <SelectItem value="none">Select category</SelectItem>
                      {availableCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </CustomSelectField>
                  )}
                />
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
          </div>

          <DialogFooter className="shrink-0 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
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
interface CustomSelectFieldProps {
  id: string
  label: string
  error?: string
  value: string | undefined
  onValueChange: (value: string) => void
  placeholder?: string
  children: React.ReactNode
}

function CustomSelectField({
  id,
  label,
  error,
  value,
  onValueChange,
  placeholder,
  children,
}: CustomSelectFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={value || 'none'}
        onValueChange={(val) => onValueChange(val === 'none' ? '' : val)}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
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
