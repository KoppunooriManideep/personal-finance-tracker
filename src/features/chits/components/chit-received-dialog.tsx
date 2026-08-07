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
import { cn } from '@/lib/utils'
import { paiseToRupees, rupeesToPaise } from '@/lib/money'
import { formatMonthYear } from '@/lib/date'
import { dateForMonth } from '@/features/chits/chit-math'
import {
  useClearChitReceived,
  useSetChitReceived,
} from '@/features/chits/hooks/use-chit-mutations'
import type { Chit } from '@/features/chits/api/chit-queries'

interface ChitReceivedDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  chit: Chit
}

/** Record (or clear) the month and amount at which a chit was taken. */
export function ChitReceivedDialog({
  open,
  onOpenChange,
  chit,
}: ChitReceivedDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onOpenAutoFocus={(event) => event.preventDefault()}>
        {open ? (
          // Remount when opened so the fields initialise from the chit without
          // a state-syncing effect.
          <ReceivedDialogBody
            key={chit.id}
            onOpenChange={onOpenChange}
            chit={chit}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

type ReceivedDialogBodyProps = Omit<ChitReceivedDialogProps, 'open'>

function ReceivedDialogBody({ onOpenChange, chit }: ReceivedDialogBodyProps) {
  const setReceived = useSetChitReceived()
  const clearReceived = useClearChitReceived()

  const [month, setMonth] = useState(
    chit.receivedMonth ? String(chit.receivedMonth) : '',
  )
  const [amount, setAmount] = useState(
    chit.receivedAmount != null ? String(paiseToRupees(chit.receivedAmount)) : '',
  )
  const [error, setError] = useState<string | null>(null)

  const isPending = setReceived.isPending || clearReceived.isPending

  const handleSave = async () => {
    const monthNum = Number(month)
    const value = Number(amount)
    if (
      !Number.isInteger(monthNum) ||
      monthNum < 1 ||
      monthNum > chit.tenureMonths
    ) {
      setError('Select the month you took the chit')
      return
    }
    if (amount.trim() === '' || !Number.isFinite(value) || value <= 0) {
      setError('Enter the amount you received')
      return
    }
    try {
      await setReceived.mutateAsync({
        id: chit.id,
        receivedMonth: monthNum,
        receivedAmountPaise: rupeesToPaise(value),
      })
      toast.success('Marked as received')
      onOpenChange(false)
    } catch (err) {
      toast.error('Could not save')
      console.error(err)
    }
  }

  const handleClear = async () => {
    try {
      await clearReceived.mutateAsync(chit.id)
      toast.success('Cleared')
      onOpenChange(false)
    } catch (err) {
      toast.error('Could not clear')
      console.error(err)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Mark chit as received</DialogTitle>
        <DialogDescription>
          Record the month you took the chit and the amount you received.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 px-6">
        <div className="space-y-1.5">
          <Label htmlFor="received-month">Month taken</Label>
          <select
            id="received-month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className={cn(
              'border-input flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none',
              'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
            )}
          >
            <option value="">Select a month</option>
            {Array.from({ length: chit.tenureMonths }, (_, i) => i + 1).map(
              (m) => (
                <option key={m} value={m}>
                  Month {m} · {formatMonthYear(dateForMonth(chit.startDate, m))}
                </option>
              ),
            )}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="received-amount">Amount received (₹)</Label>
          <Input
            id="received-amount"
            type="number"
            step="0.01"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </div>

        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </div>

      <DialogFooter className="border-t pt-2">
        {chit.receivedMonth != null ? (
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
          {setReceived.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : null}
          Save
        </Button>
      </DialogFooter>
    </>
  )
}
