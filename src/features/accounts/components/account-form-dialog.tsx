import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2, Users } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { paiseToRupees } from '@/lib/money'
import { accountTypeMeta, accountTypes } from '@/features/accounts/config'
import { accountSchema, type AccountFormValues } from '@/features/accounts/schema'
import {
  useCreateAccount,
  useUpdateAccount,
} from '@/features/accounts/hooks/use-account-mutations'
import { useFamilyMembers } from '@/features/family/hooks/use-family-members'
import type { AccountWithBalance } from '@/features/accounts/api/account-queries'

interface AccountFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When provided, the dialog edits this account; otherwise it creates one. */
  account?: AccountWithBalance | null
}

const emptyDefaults: AccountFormValues = {
  name: '',
  type: 'bank',
  ownerId: null,
  openingBalance: 0,
}

/** Add/Edit account modal backed by React Hook Form + Zod. */
export function AccountFormDialog({
  open,
  onOpenChange,
  account,
}: AccountFormDialogProps) {
  const isEdit = Boolean(account)
  const createAccount = useCreateAccount()
  const updateAccount = useUpdateAccount()
  const { data: familyMembers } = useFamilyMembers()

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: emptyDefaults,
  })

  // Sync form values whenever the dialog opens (for create or a specific edit).
  useEffect(() => {
    if (!open) return
    reset(
      account
        ? {
            name: account.name,
            type: account.type,
            ownerId: account.ownerId,
            openingBalance: paiseToRupees(account.openingBalance),
          }
        : emptyDefaults,
    )
  }, [open, account, reset])

  const isPending = createAccount.isPending || updateAccount.isPending

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (account) {
        await updateAccount.mutateAsync({ id: account.id, values })
        toast.success('Account updated')
      } else {
        await createAccount.mutateAsync(values)
        toast.success('Account added')
      }
      onOpenChange(false)
    } catch (error) {
      toast.error(
        isEdit ? 'Could not update account' : 'Could not add account',
      )
      console.error(error)
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit account' : 'Add account'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update this account’s details.'
              : 'Track a cash, bank, credit card or wallet account.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="account-name">Name</Label>
            <Input
              id="account-name"
              placeholder="e.g. HDFC Savings"
              autoComplete="off"
              {...register('name')}
            />
            {errors.name ? (
              <p className="text-destructive text-sm">{errors.name.message}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label>Type</Label>
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <div className="grid grid-cols-2 gap-2">
                  {accountTypes.map((type) => {
                    const meta = accountTypeMeta[type]
                    const Icon = meta.icon
                    const selected = field.value === type
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => field.onChange(type)}
                        aria-pressed={selected}
                        className={cn(
                          'flex items-center gap-2 rounded-md border p-2.5 text-sm transition-colors',
                          selected
                            ? 'border-primary bg-primary/5 ring-1 ring-primary'
                            : 'hover:bg-accent',
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-7 w-7 items-center justify-center rounded-md',
                            meta.badgeClassName,
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        {meta.label}
                      </button>
                    )
                  })}
                </div>
              )}
            />
            {errors.type ? (
              <p className="text-destructive text-sm">{errors.type.message}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label>Owner</Label>
            <Controller
              control={control}
              name="ownerId"
              render={({ field }) => (
                <div className="grid gap-2">
                  <button
                    type="button"
                    onClick={() => field.onChange(null)}
                    aria-pressed={field.value === null}
                    className={cn(
                      'flex items-center gap-2 rounded-md border p-2.5 text-left text-sm transition-colors',
                      field.value === null
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'hover:bg-accent',
                    )}
                  >
                    <span className="bg-muted text-muted-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
                      <Users className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-medium">Shared / Family</span>
                      <span className="text-muted-foreground block text-xs">
                        Not assigned to one member
                      </span>
                    </span>
                  </button>

                  <div className="grid gap-2 sm:grid-cols-2">
                    {(familyMembers ?? []).map((member) => {
                      const name =
                        member.profile?.fullName?.trim() ||
                        member.displayName?.trim() ||
                        'Unknown'
                      const selected = field.value === member.userId

                      return (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => field.onChange(member.userId)}
                          aria-pressed={selected}
                          className={cn(
                            'flex min-w-0 items-center gap-2 rounded-md border p-2.5 text-left text-sm transition-colors',
                            selected
                              ? 'border-primary bg-primary/5 ring-1 ring-primary'
                              : 'hover:bg-accent',
                          )}
                        >
                          <Avatar size="sm">
                            <AvatarImage
                              src={member.profile?.avatarUrl ?? undefined}
                              alt={name}
                            />
                            <AvatarFallback>{getInitials(name)}</AvatarFallback>
                          </Avatar>
                          <span className="truncate font-medium">
                            {getFirstName(name)}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            />
            {errors.ownerId ? (
              <p className="text-destructive text-sm">
                {errors.ownerId.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="account-balance">Opening balance (₹)</Label>
            <Input
              id="account-balance"
              type="number"
              step="0.01"
              inputMode="decimal"
              placeholder="0.00"
              {...register('openingBalance', { valueAsNumber: true })}
            />
            {errors.openingBalance ? (
              <p className="text-destructive text-sm">
                {errors.openingBalance.message}
              </p>
            ) : (
              <p className="text-muted-foreground text-xs">
                Current balance in this account today. Use a negative value for
                credit card dues.
              </p>
            )}
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
              {isEdit ? 'Save changes' : 'Add account'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
