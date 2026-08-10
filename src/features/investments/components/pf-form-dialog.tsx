import { useState } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { paiseToRupees, rupeesToPaise } from '@/lib/money'
import { getCurrentIstDate } from '@/lib/date'
import { useFamilyMembers } from '@/features/family/hooks/use-family-members'
import {
  useCreatePfAccount,
  useUpdatePfAccount,
} from '@/features/investments/hooks/use-pf-accounts'
import { PF_KINDS } from '@/features/investments/pf-config'
import type { PfAccount } from '@/features/investments/api/pf-queries'
import type { PfKind } from '@/types/database.types'

interface PfFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account?: PfAccount | null
}

export function PfFormDialog({ open, onOpenChange, account }: PfFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open ? (
          <PfForm
            key={account?.id ?? 'new'}
            account={account ?? null}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

/** Inner form; remounted per open so initial state comes straight from props. */
function PfForm({
  account,
  onDone,
}: {
  account: PfAccount | null
  onDone: () => void
}) {
  const isEdit = Boolean(account)
  const createPf = useCreatePfAccount()
  const updatePf = useUpdatePfAccount()
  const { data: members } = useFamilyMembers()

  const [kind, setKind] = useState<PfKind>(account?.kind ?? 'epf')
  const [name, setName] = useState(account?.name ?? '')
  const [ownerId, setOwnerId] = useState(account?.ownerId ?? 'shared')
  const [balance, setBalance] = useState(
    account ? String(paiseToRupees(account.balancePaise)) : '',
  )
  const [asOf, setAsOf] = useState(account?.asOf ?? getCurrentIstDate())
  const [monthly, setMonthly] = useState(
    account ? String(paiseToRupees(account.monthlyContributionPaise)) : '',
  )
  const [rate, setRate] = useState(
    account && account.annualRatePercent > 0
      ? String(account.annualRatePercent)
      : '',
  )

  const isPending = createPf.isPending || updatePf.isPending

  const submit = async () => {
    const bal = Number(balance)
    if (!Number.isFinite(bal) || bal < 0) return toast.error('Enter a valid balance')
    if (!asOf) return toast.error('Pick the "as of" date')
    const monthlyNum = Number(monthly) || 0
    const rateNum = Number(rate) || 0

    const input = {
      ownerId: ownerId === 'shared' ? null : ownerId,
      kind,
      name: name.trim() || null,
      balancePaise: rupeesToPaise(bal),
      asOf,
      monthlyContributionPaise: rupeesToPaise(monthlyNum),
      annualRatePercent: rateNum,
      notes: null,
    }

    try {
      if (account) {
        await updatePf.mutateAsync({ id: account.id, input })
        toast.success('PF updated')
      } else {
        await createPf.mutateAsync(input)
        toast.success('PF added')
      }
      onDone()
    } catch (error) {
      toast.error('Could not save PF')
      console.error(error)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEdit ? 'Edit PF' : 'Add PF'}</DialogTitle>
        <DialogDescription>
          Track EPF / PPF / VPF / NPS. The balance projects forward from the “as
          of” date using your monthly contribution.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 px-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as PfKind)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PF_KINDS.map((k) => (
                  <SelectItem key={k.value} value={k.value}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-name">Label (optional)</Label>
            <Input
              id="pf-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. EPF — Company X"
              autoComplete="off"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pf-balance">Current balance (₹)</Label>
            <Input
              id="pf-balance"
              type="number"
              step="0.01"
              inputMode="decimal"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-asof">As of</Label>
            <Input
              id="pf-asof"
              type="date"
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              The date this balance is accurate. Contributions apply from here.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pf-monthly">Monthly contribution (₹)</Label>
            <Input
              id="pf-monthly"
              type="number"
              step="0.01"
              inputMode="decimal"
              value={monthly}
              onChange={(e) => setMonthly(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-rate">Interest rate (% p.a., optional)</Label>
            <Input
              id="pf-rate"
              type="number"
              step="0.01"
              inputMode="decimal"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="e.g. 8.25"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Owner</Label>
          <Select value={ownerId} onValueChange={setOwnerId}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="shared">Shared / Family</SelectItem>
              {(members ?? []).map((member) => (
                <SelectItem key={member.id} value={member.userId}>
                  {member.profile?.fullName?.trim() ||
                    member.displayName?.trim() ||
                    'Member'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <DialogFooter className="border-t pt-2">
        <Button variant="outline" onClick={onDone} disabled={isPending}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {isEdit ? 'Save changes' : 'Add PF'}
        </Button>
      </DialogFooter>
    </>
  )
}
