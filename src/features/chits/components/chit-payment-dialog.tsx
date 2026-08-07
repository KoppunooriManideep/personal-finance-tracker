import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Trash2 } from 'lucide-react'
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
import { paiseToRupees, rupeesToPaise } from '@/lib/money'
import {
  useDeleteChitPayment,
  useSaveChitPayment,
} from '@/features/chits/hooks/use-chit-payment-mutations'
import type { ChitPayment } from '@/features/chits/api/chit-payment-queries'

interface ChitPaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  chitId: string
  monthNumber: number
  /** Human label for the month, e.g. "Month 3 · Mar 2024". */
  monthLabel: string
  /** Existing payment for this month, if any (edit vs create). */
  existing?: ChitPayment | null
}

/** Record or edit the net amount paid for one month of a chit. */
export function ChitPaymentDialog({
  open,
  onOpenChange,
  chitId,
  monthNumber,
  monthLabel,
  existing,
}: ChitPaymentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onOpenAutoFocus={(event) => event.preventDefault()}>
        {open ? (
          // Remount per month so the fields initialise from `existing` without
          // a state-syncing effect.
          <PaymentDialogBody
            key={monthNumber}
            onOpenChange={onOpenChange}
            chitId={chitId}
            monthNumber={monthNumber}
            monthLabel={monthLabel}
            existing={existing}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

type PaymentDialogBodyProps = Omit<ChitPaymentDialogProps, 'open'>

function PaymentDialogBody({
  onOpenChange,
  chitId,
  monthNumber,
  monthLabel,
  existing,
}: PaymentDialogBodyProps) {
  const savePayment = useSaveChitPayment()
  const deletePayment = useDeleteChitPayment()

  const [amount, setAmount] = useState(
    existing ? String(paiseToRupees(existing.amountPaid)) : '',
  )
  const [date, setDate] = useState(existing?.paymentDate ?? '')
  const [error, setError] = useState<string | null>(null)

  const isPending = savePayment.isPending || deletePayment.isPending

  const handleSave = async () => {
    const value = Number(amount)
    if (amount.trim() === '' || !Number.isFinite(value) || value < 0) {
      setError('Enter a valid amount')
      return
    }
    try {
      await savePayment.mutateAsync({
        existingId: existing?.id,
        chitId,
        monthNumber,
        amountPaidPaise: rupeesToPaise(value),
        paymentDate: date.trim() === '' ? null : date,
      })
      toast.success('Payment saved')
      onOpenChange(false)
    } catch (err) {
      toast.error('Could not save payment')
      console.error(err)
    }
  }

  const handleClear = async () => {
    if (!existing) return
    try {
      await deletePayment.mutateAsync(existing.id)
      toast.success('Payment cleared')
      onOpenChange(false)
    } catch (err) {
      toast.error('Could not clear payment')
      console.error(err)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{monthLabel}</DialogTitle>
        <DialogDescription>
          Enter the net amount you paid this month (after any dividend).
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 px-6">
        <div className="space-y-1.5">
          <Label htmlFor="payment-amount">Amount paid (₹)</Label>
          <Input
            id="payment-amount"
            type="number"
            step="0.01"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="payment-date">Payment date (optional)</Label>
          <Input
            id="payment-date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>
      </div>

      <DialogFooter className="border-t pt-2">
        {existing ? (
          <Button
            type="button"
            variant="outline"
            className="text-destructive hover:text-destructive sm:mr-auto"
            onClick={handleClear}
            disabled={isPending}
          >
            <Trash2 className="h-4 w-4" />
            Clear
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="button" onClick={handleSave} disabled={isPending}>
          {savePayment.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : null}
          Save
        </Button>
      </DialogFooter>
    </>
  )
}
