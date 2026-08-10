import {
  forwardRef,
  useEffect,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
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
import { formatRupees, paiseToRupees } from '@/lib/money'
import { getCurrentIstDate } from '@/lib/date'
import { goldSchema, type GoldFormValues } from '@/features/investments/schema'
import { GOLD_FORMS, PURITY_PRESETS } from '@/features/investments/config'
import {
  useCreateGoldHolding,
  useUpdateGoldHolding,
} from '@/features/investments/hooks/use-gold-mutations'
import { useFamilyMembers } from '@/features/family/hooks/use-family-members'
import type { GoldHolding } from '@/features/investments/api/gold-queries'

interface GoldFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When provided, the dialog edits this holding; otherwise it creates one. */
  holding?: GoldHolding | null
}

/**
 * react-hook-form's `valueAsNumber` turns an empty input into NaN, which fails
 * the optional zod number checks. Convert blanks to `undefined` so optional
 * money/percent fields can be left empty.
 */
const asOptionalNumber = (value: string) =>
  value === '' || value == null ? undefined : Number(value)

function emptyDefaults(): GoldFormValues {
  return {
    form: 'coin',
    fineness: 999,
    name: '',
    // Numeric fields start empty (not 0) so users type straight in on mobile.
    weightGrams: undefined as unknown as number,
    quantity: 1,
    purchaseDate: getCurrentIstDate(),
    priceTotal: undefined as unknown as number,
    cashback: undefined,
    rewardValue: undefined,
    voucherSavings: undefined,
    makingCharges: undefined,
    va: undefined,
    stoneCharges: undefined,
    gstPercent: undefined,
    discount: undefined,
    website: '',
    brand: '',
    tags: '',
    ownerId: null,
    notes: '',
  }
}

/** Add/Edit physical gold modal backed by React Hook Form + Zod. */
export function GoldFormDialog({
  open,
  onOpenChange,
  holding,
}: GoldFormDialogProps) {
  const isEdit = Boolean(holding)
  const createHolding = useCreateGoldHolding()
  const updateHolding = useUpdateGoldHolding()
  const { data: familyMembers } = useFamilyMembers()

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<GoldFormValues>({
    resolver: zodResolver(goldSchema),
    defaultValues: emptyDefaults(),
  })

  useEffect(() => {
    if (!open) return
    reset(
      holding
        ? {
            form: holding.form,
            fineness: holding.fineness,
            name: holding.name ?? '',
            weightGrams: holding.weightMg / 1000,
            quantity: holding.quantity,
            purchaseDate: holding.purchaseDate,
            priceTotal: paiseToRupees(holding.priceTotalPaise),
            cashback: paiseToRupees(holding.cashbackPaise) || undefined,
            rewardValue: paiseToRupees(holding.rewardValuePaise) || undefined,
            voucherSavings:
              paiseToRupees(holding.voucherSavingsPaise) || undefined,
            makingCharges: paiseToRupees(holding.makingChargesPaise) || undefined,
            va: paiseToRupees(holding.vaPaise) || undefined,
            stoneCharges: paiseToRupees(holding.stoneChargesPaise) || undefined,
            gstPercent: holding.gstPercent || undefined,
            discount: paiseToRupees(holding.discountPaise) || undefined,
            website: holding.website ?? '',
            brand: holding.brand ?? '',
            tags: holding.tags.join(', '),
            ownerId: holding.ownerId,
            notes: holding.notes ?? '',
          }
        : emptyDefaults(),
    )
  }, [open, holding, reset])

  const isJewellery = useWatch({ control, name: 'form' }) === 'jewellery'

  // Live "effective cost" preview (in rupees) as the user types.
  const price = useWatch({ control, name: 'priceTotal' }) || 0
  const cashback = useWatch({ control, name: 'cashback' }) || 0
  const rewardValue = useWatch({ control, name: 'rewardValue' }) || 0
  const voucherSavings = useWatch({ control, name: 'voucherSavings' }) || 0
  const weightGrams = useWatch({ control, name: 'weightGrams' }) || 0
  const quantity = useWatch({ control, name: 'quantity' }) || 0

  const benefits = cashback + rewardValue + voucherSavings
  const effectiveCost = price - benefits
  const totalGrams = weightGrams * quantity
  const effectivePerGram = totalGrams > 0 ? effectiveCost / totalGrams : null

  const isPending = createHolding.isPending || updateHolding.isPending

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (holding) {
        await updateHolding.mutateAsync({ id: holding.id, values })
        toast.success('Holding updated')
      } else {
        await createHolding.mutateAsync(values)
        toast.success('Gold added')
      }
      onOpenChange(false)
    } catch (error) {
      toast.error(isEdit ? 'Could not update holding' : 'Could not add gold')
      console.error(error)
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onOpenAutoFocus={(event) => isEdit && event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit gold' : 'Add gold'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update this gold purchase.'
              : 'Record a gold purchase — coin, bar or jewellery.'}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={onSubmit}
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden"
        >
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6">
            {/* Item */}
            <Section label="Item">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Type">
                  <NativeSelect id="gold-form" {...register('form')}>
                    {GOLD_FORMS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Purity">
                  <NativeSelect
                    id="gold-purity"
                    {...register('fineness', { valueAsNumber: true })}
                  >
                    {PURITY_PRESETS.map((p) => (
                      <option key={p.fineness} value={p.fineness}>
                        {p.label}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label={isJewellery ? 'Net gold weight (g)' : 'Weight (g) / unit'}
                  error={errors.weightGrams?.message}
                >
                  <Input
                    type="number"
                    step="0.001"
                    inputMode="decimal"
                    placeholder="e.g. 8"
                    {...register('weightGrams', { valueAsNumber: true })}
                  />
                </Field>
                <Field label="Quantity" error={errors.quantity?.message}>
                  <Input
                    type="number"
                    step="1"
                    inputMode="numeric"
                    placeholder="1"
                    {...register('quantity', { valueAsNumber: true })}
                  />
                </Field>
              </div>

              <Field label="Label (optional)">
                <Input
                  placeholder="e.g. Sovereign coin, wedding chain"
                  autoComplete="off"
                  {...register('name')}
                />
              </Field>
            </Section>

            {/* Transaction */}
            <Section label="Transaction">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Purchase date" error={errors.purchaseDate?.message}>
                  <Input type="date" {...register('purchaseDate')} />
                </Field>
                <Field
                  label="Total paid (₹)"
                  hint="All-in amount you actually paid (incl. making, stones & GST)."
                  error={errors.priceTotal?.message}
                >
                  <Input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="0.00"
                    {...register('priceTotal', { valueAsNumber: true })}
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Website (optional)">
                  <Input
                    placeholder="e.g. Flipkart"
                    autoComplete="off"
                    {...register('website')}
                  />
                </Field>
                <Field label="Brand (optional)">
                  <Input
                    placeholder="e.g. Tanishq"
                    autoComplete="off"
                    {...register('brand')}
                  />
                </Field>
              </div>
            </Section>

            {/* Jewellery cost breakdown */}
            {isJewellery ? (
              <Section
                label="Jewellery charges"
                hint="Optional breakdown of the total paid — making/VA, stones & GST aren't recoverable in gold value; a discount reduces them."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Making charges (₹)">
                    <Input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="0.00"
                      {...register('makingCharges', { setValueAs: asOptionalNumber })}
                    />
                  </Field>
                  <Field label="VA / value addition (₹)">
                    <Input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="0.00"
                      {...register('va', { setValueAs: asOptionalNumber })}
                    />
                  </Field>
                  <Field label="Stone charges (₹)">
                    <Input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="0.00"
                      {...register('stoneCharges', { setValueAs: asOptionalNumber })}
                    />
                  </Field>
                  <Field label="GST (%)" error={errors.gstPercent?.message}>
                    <Input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="e.g. 3"
                      {...register('gstPercent', { setValueAs: asOptionalNumber })}
                    />
                  </Field>
                  <Field label="Discount (₹)">
                    <Input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="0.00"
                      {...register('discount', { setValueAs: asOptionalNumber })}
                    />
                  </Field>
                </div>
              </Section>
            ) : null}

            {/* Savings & rewards */}
            <Section
              label="Rewards"
              hint="Optional — cashback, points or vouchers you earned. Leave blank if none."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Cashback (₹)">
                  <Input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="0.00"
                    {...register('cashback', { setValueAs: asOptionalNumber })}
                  />
                </Field>
                <Field label="Reward-points value (₹)">
                  <Input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="0.00"
                    {...register('rewardValue', { setValueAs: asOptionalNumber })}
                  />
                </Field>
                <Field label="Vouchers / SuperCoins (₹)">
                  <Input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="0.00"
                    {...register('voucherSavings', { setValueAs: asOptionalNumber })}
                  />
                </Field>
              </div>

              {/* Live effective cost */}
              <div className="bg-muted/50 space-y-1 rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Effective cost</span>
                  <span className="font-semibold tabular-nums">
                    {formatRupees(effectiveCost, { decimals: false })}
                  </span>
                </div>
                {effectivePerGram != null ? (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Effective / gram</span>
                    <span className="tabular-nums">
                      {formatRupees(effectivePerGram, { decimals: false })}
                    </span>
                  </div>
                ) : null}
              </div>
            </Section>

            {/* Owner + meta */}
            <Section label="More">
              <Field label="Owner">
                <NativeSelect
                  id="gold-owner"
                  {...register('ownerId', {
                    setValueAs: (value) => value || null,
                  })}
                >
                  <option value="">Shared / Family</option>
                  {(familyMembers ?? []).map((member) => {
                    const name =
                      member.profile?.fullName?.trim() ||
                      member.displayName?.trim() ||
                      'Unknown'
                    return (
                      <option key={member.id} value={member.userId}>
                        {name}
                      </option>
                    )
                  })}
                </NativeSelect>
              </Field>

              <Field label="Tags (optional)" error={errors.tags?.message}>
                <Input
                  placeholder="Akshaya Tritiya, Festival Offer"
                  autoComplete="off"
                  {...register('tags')}
                />
              </Field>

              <Field label="Notes (optional)" error={errors.notes?.message}>
                <Input
                  placeholder="Anything worth remembering"
                  autoComplete="off"
                  {...register('notes')}
                />
              </Field>
            </Section>
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
              {isEdit ? 'Save changes' : 'Add gold'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Section({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {label}
        </p>
        {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
      </div>
      {children}
    </div>
  )
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  )
}

/** Native <select> styled like the app's inputs (plain-text labels only). */
const NativeSelect = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      'border-input flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none',
      'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
      className,
    )}
    {...props}
  />
))
NativeSelect.displayName = 'NativeSelect'
