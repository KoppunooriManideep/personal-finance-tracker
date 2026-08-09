import { useEffect } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
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
import { chitSchema, type ChitFormValues } from '@/features/chits/schema'
import {
  useCreateChit,
  useUpdateChit,
} from '@/features/chits/hooks/use-chit-mutations'
import { useFamilyMembers } from '@/features/family/hooks/use-family-members'
import type { Chit } from '@/features/chits/api/chit-queries'

interface ChitFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When provided, the dialog edits this chit; otherwise it creates one. */
  chit?: Chit | null
}

const emptyDefaults: ChitFormValues = {
  name: '',
  // Start numeric fields empty (not 0) so users type straight in on mobile.
  chitValue: undefined as unknown as number,
  tenureMonths: undefined as unknown as number,
  baseMonthly: undefined as unknown as number,
  startDate: '',
  ownerId: null,
  organizer: '',
  notes: '',
}

/** Add/Edit chit modal backed by React Hook Form + Zod. */
export function ChitFormDialog({ open, onOpenChange, chit }: ChitFormDialogProps) {
  const isEdit = Boolean(chit)
  const createChit = useCreateChit()
  const updateChit = useUpdateChit()
  const { data: familyMembers } = useFamilyMembers()

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<ChitFormValues>({
    resolver: zodResolver(chitSchema),
    defaultValues: emptyDefaults,
  })

  // Suggest the flat instalment (value ÷ tenure) to guide the Base EMI field.
  // useWatch (not watch()) keeps this compiler-safe — it returns a value, not a
  // function that would opt the component out of React Compiler memoization.
  const watchedValue = useWatch({ control, name: 'chitValue' })
  const watchedTenure = useWatch({ control, name: 'tenureMonths' })
  const suggestedBaseEmi =
    Number.isFinite(watchedValue) &&
    Number.isFinite(watchedTenure) &&
    watchedTenure > 0
      ? Math.round(watchedValue / watchedTenure)
      : null

  // Sync form values whenever the dialog opens (for create or a specific edit).
  useEffect(() => {
    if (!open) return
    reset(
      chit
        ? {
            name: chit.name,
            chitValue: paiseToRupees(chit.chitValue),
            tenureMonths: chit.tenureMonths,
            baseMonthly: paiseToRupees(chit.baseMonthly),
            startDate: chit.startDate,
            ownerId: chit.ownerId,
            organizer: chit.organizer ?? '',
            notes: chit.notes ?? '',
          }
        : emptyDefaults,
    )
  }, [open, chit, reset])

  const isPending = createChit.isPending || updateChit.isPending

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (chit) {
        await updateChit.mutateAsync({ id: chit.id, values })
        toast.success('Chit updated')
      } else {
        await createChit.mutateAsync(values)
        toast.success('Chit added')
      }
      onOpenChange(false)
    } catch (error) {
      toast.error(isEdit ? 'Could not update chit' : 'Could not add chit')
      console.error(error)
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onOpenAutoFocus={(event) => isEdit && event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit chit' : 'Add chit'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update this chit fund’s details.'
              : 'Track a chit fund and its returns.'}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={onSubmit}
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden"
        >
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6">
            <div className="space-y-1.5">
              <Label htmlFor="chit-name">Name</Label>
              <Input
                id="chit-name"
                placeholder="e.g. Sriram Chits 10L"
                autoComplete="off"
                {...register('name')}
              />
              {errors.name ? (
                <p className="text-destructive text-sm">{errors.name.message}</p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="chit-value">Chit value (₹)</Label>
                <Input
                  id="chit-value"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="0.00"
                  {...register('chitValue', { valueAsNumber: true })}
                />
                {errors.chitValue ? (
                  <p className="text-destructive text-sm">
                    {errors.chitValue.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="chit-tenure">Tenure (months)</Label>
                <Input
                  id="chit-tenure"
                  type="number"
                  step="1"
                  inputMode="numeric"
                  placeholder="e.g. 25"
                  {...register('tenureMonths', { valueAsNumber: true })}
                />
                {errors.tenureMonths ? (
                  <p className="text-destructive text-sm">
                    {errors.tenureMonths.message}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="chit-base-emi">Base EMI (₹)</Label>
              <Input
                id="chit-base-emi"
                type="number"
                step="0.01"
                inputMode="decimal"
                placeholder="0.00"
                {...register('baseMonthly', { valueAsNumber: true })}
              />
              {errors.baseMonthly ? (
                <p className="text-destructive text-sm">
                  {errors.baseMonthly.message}
                </p>
              ) : (
                <p className="text-muted-foreground text-xs">
                  The flat monthly instalment. Commission each month is Base EMI −
                  what you actually pay.
                  {suggestedBaseEmi
                    ? ` Often ₹${suggestedBaseEmi.toLocaleString('en-IN')} (value ÷ tenure).`
                    : ''}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="chit-start">Start date</Label>
              <Input id="chit-start" type="date" {...register('startDate')} />
              {errors.startDate ? (
                <p className="text-destructive text-sm">
                  {errors.startDate.message}
                </p>
              ) : (
                <p className="text-muted-foreground text-xs">
                  The month of your first instalment.
                </p>
              )}
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
              <Label htmlFor="chit-organizer">Organizer (optional)</Label>
              <Input
                id="chit-organizer"
                placeholder="e.g. Sriram Chits Pvt Ltd"
                autoComplete="off"
                {...register('organizer')}
              />
              {errors.organizer ? (
                <p className="text-destructive text-sm">
                  {errors.organizer.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="chit-notes">Notes (optional)</Label>
              <Input
                id="chit-notes"
                placeholder="Anything worth remembering"
                autoComplete="off"
                {...register('notes')}
              />
              {errors.notes ? (
                <p className="text-destructive text-sm">{errors.notes.message}</p>
              ) : null}
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t pt-2">
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
              {isEdit ? 'Save changes' : 'Add chit'}
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
