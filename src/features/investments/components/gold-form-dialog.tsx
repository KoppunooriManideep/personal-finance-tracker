import {
  forwardRef,
  useState,
  type ChangeEvent,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Download, FileText, Loader2, Paperclip, Sparkles, X } from 'lucide-react'
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
import {
  RECEIPT_ACCEPT,
  deleteGoldReceipt,
  getGoldReceiptUrl,
  isAcceptedReceipt,
  uploadGoldReceipt,
} from '@/features/investments/api/gold-receipts'
import { parseGoldReceipt } from '@/features/investments/api/parse-receipt-api'
import type { ParsedGoldReceipt } from '@/features/investments/gold-receipt-parse'
import { useFamilyMembers } from '@/features/family/hooks/use-family-members'
import { useCurrentFamily } from '@/features/family/hooks/use-current-family'
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

/** Prefill the form from an existing holding (money paise → rupees). */
function toDefaults(holding: GoldHolding | null): GoldFormValues {
  if (!holding) return emptyDefaults()
  return {
    form: holding.form,
    fineness: holding.fineness,
    name: holding.name ?? '',
    weightGrams: holding.weightMg / 1000,
    quantity: holding.quantity,
    purchaseDate: holding.purchaseDate,
    priceTotal: paiseToRupees(holding.priceTotalPaise),
    cashback: paiseToRupees(holding.cashbackPaise) || undefined,
    rewardValue: paiseToRupees(holding.rewardValuePaise) || undefined,
    voucherSavings: paiseToRupees(holding.voucherSavingsPaise) || undefined,
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
}

/** Overlay parsed bill fields onto current form values (parsed wins where set). */
function applyParsed(
  current: GoldFormValues,
  parsed: ParsedGoldReceipt,
): GoldFormValues {
  const num = (v: number | null) =>
    typeof v === 'number' && Number.isFinite(v) ? v : undefined
  const str = (v: string | null) => (v && v.trim() ? v.trim() : undefined)
  return {
    ...current,
    form: parsed.form ?? current.form,
    fineness: num(parsed.fineness) ?? current.fineness,
    name: str(parsed.name) ?? current.name,
    weightGrams: num(parsed.weightGrams) ?? current.weightGrams,
    quantity: num(parsed.quantity) ?? current.quantity,
    purchaseDate: str(parsed.purchaseDate) ?? current.purchaseDate,
    priceTotal: num(parsed.priceTotal) ?? current.priceTotal,
    makingCharges: num(parsed.makingCharges) ?? current.makingCharges,
    va: num(parsed.va) ?? current.va,
    stoneCharges: num(parsed.stoneCharges) ?? current.stoneCharges,
    gstPercent: num(parsed.gstPercent) ?? current.gstPercent,
    discount: num(parsed.discount) ?? current.discount,
    brand: str(parsed.brand) ?? current.brand,
  }
}

/**
 * Add/Edit physical gold modal. The form body is only mounted while the dialog
 * is open (and keyed by holding id), so every open starts from fresh state —
 * no reset-in-effect, and the file-upload state resets cleanly too.
 */
export function GoldFormDialog({
  open,
  onOpenChange,
  holding,
}: GoldFormDialogProps) {
  const isEdit = Boolean(holding)
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

        {open ? (
          <GoldForm
            key={holding?.id ?? 'new'}
            holding={holding ?? null}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function GoldForm({
  holding,
  onClose,
}: {
  holding: GoldHolding | null
  onClose: () => void
}) {
  const isEdit = Boolean(holding)
  const createHolding = useCreateGoldHolding()
  const updateHolding = useUpdateGoldHolding()
  const { data: familyMembers } = useFamilyMembers()
  const { data: family } = useCurrentFamily()
  const familyId = family?.id

  const {
    register,
    handleSubmit,
    control,
    reset,
    getValues,
    formState: { errors },
  } = useForm<GoldFormValues>({
    resolver: zodResolver(goldSchema),
    defaultValues: toDefaults(holding),
  })

  // Bill/receipt: a newly picked file, or the existing one (optionally removed).
  const existingReceiptPath = holding?.receiptPath ?? null
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [removeExisting, setRemoveExisting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [scanning, setScanning] = useState(false)

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

  const isPending =
    createHolding.isPending || updateHolding.isPending || uploading || scanning

  // Read the bill with Gemini and prefill the form for the user to verify.
  const scanBill = async (file: File) => {
    try {
      setScanning(true)
      const parsed = await parseGoldReceipt(file)
      reset(applyParsed(getValues(), parsed))
      toast.success('Filled from the bill — please double-check the values')
    } catch (error) {
      toast.error('Could not read the bill — enter the details manually')
      console.error(error)
    } finally {
      setScanning(false)
    }
  }

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = '' // let the same file be re-picked later
    if (!file) return
    if (!isAcceptedReceipt(file)) {
      toast.error('Use a JPG, PNG, WebP or PDF up to 10 MB')
      return
    }
    setReceiptFile(file)
    setRemoveExisting(false)
    void scanBill(file) // auto-read on attach; user can re-scan or edit
  }

  const handleDownload = async () => {
    if (!existingReceiptPath) return
    try {
      setDownloading(true)
      const url = await getGoldReceiptUrl(existingReceiptPath)
      window.open(url, '_blank', 'noopener')
    } catch (error) {
      toast.error('Could not open the bill')
      console.error(error)
    } finally {
      setDownloading(false)
    }
  }

  const onSubmit = handleSubmit(async (values) => {
    try {
      let receiptPath: string | null = removeExisting ? null : existingReceiptPath
      if (receiptFile) {
        if (!familyId) throw new Error('No family selected')
        setUploading(true)
        receiptPath = await uploadGoldReceipt(familyId, receiptFile)
        setUploading(false)
      }

      if (holding) {
        await updateHolding.mutateAsync({ id: holding.id, values, receiptPath })
        toast.success('Holding updated')
      } else {
        await createHolding.mutateAsync({ values, receiptPath })
        toast.success('Gold added')
      }

      // Clean up a replaced/removed bill (best-effort — don't block the save).
      if (existingReceiptPath && existingReceiptPath !== receiptPath) {
        deleteGoldReceipt(existingReceiptPath).catch(() => {})
      }
      onClose()
    } catch (error) {
      toast.error(isEdit ? 'Could not update holding' : 'Could not add gold')
      console.error(error)
    } finally {
      setUploading(false)
    }
  })

  return (
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

        {/* Bill / receipt */}
        <Section
          label="Bill / receipt"
          hint="Optional — attach the shop bill (JPG, PNG or PDF) to keep and download later."
        >
          {existingReceiptPath && !removeExisting && !receiptFile ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <span className="flex min-w-0 items-center gap-2 text-sm">
                <FileText className="text-muted-foreground h-4 w-4 shrink-0" />
                <span className="truncate">Bill attached</span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  disabled={downloading}
                >
                  {downloading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  View
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setRemoveExisting(true)}
                >
                  Remove
                </Button>
              </span>
            </div>
          ) : receiptFile ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <span className="flex min-w-0 items-center gap-2 text-sm">
                  <FileText className="text-muted-foreground h-4 w-4 shrink-0" />
                  <span className="truncate">{receiptFile.name}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => scanBill(receiptFile)}
                    disabled={scanning}
                  >
                    {scanning ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {scanning ? 'Reading…' : 'Auto-fill'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setReceiptFile(null)}
                    disabled={scanning}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </span>
              </div>
              <p className="text-muted-foreground text-xs">
                Auto-fill reads the bill with Google Gemini (the image is sent to
                Google). Always check the values before saving.
              </p>
            </div>
          ) : (
            <label className="border-input text-muted-foreground hover:bg-accent/50 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed p-3 text-sm">
              <Paperclip className="h-4 w-4 shrink-0" />
              <span>Attach bill (JPG, PNG or PDF)</span>
              <input
                type="file"
                accept={RECEIPT_ACCEPT}
                className="sr-only"
                onChange={handleFile}
              />
            </label>
          )}

          {removeExisting && existingReceiptPath ? (
            <p className="text-muted-foreground text-xs">
              Bill will be removed when you save.{' '}
              <button
                type="button"
                className="underline"
                onClick={() => setRemoveExisting(false)}
              >
                Undo
              </button>
            </p>
          ) : null}
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
          onClick={onClose}
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
