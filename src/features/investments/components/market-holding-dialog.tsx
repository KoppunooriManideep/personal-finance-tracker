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
import { useFamilyMembers } from '@/features/family/hooks/use-family-members'
import {
  useCreateMarketHolding,
  useUpdateMarketHolding,
} from '@/features/investments/hooks/use-market-mutations'
import { MARKET_KIND_META } from '@/features/investments/market-config'
import type { MarketHolding } from '@/features/investments/api/market-queries'
import type { MarketHoldingKind } from '@/types/database.types'

interface MarketHoldingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  kind: MarketHoldingKind
  holding?: MarketHolding | null
}

export function MarketHoldingDialog({
  open,
  onOpenChange,
  kind,
  holding,
}: MarketHoldingDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open ? (
          <MarketHoldingForm
            key={holding?.id ?? 'new'}
            kind={kind}
            holding={holding ?? null}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

/** Inner form; remounted per open so initial state comes straight from props. */
function MarketHoldingForm({
  kind,
  holding,
  onDone,
}: {
  kind: MarketHoldingKind
  holding: MarketHolding | null
  onDone: () => void
}) {
  const meta = MARKET_KIND_META[kind]
  const isEdit = Boolean(holding)
  const createHolding = useCreateMarketHolding()
  const updateHolding = useUpdateMarketHolding()
  const { data: members } = useFamilyMembers()

  const [symbol, setSymbol] = useState(holding?.symbol ?? '')
  const [isin, setIsin] = useState(holding?.isin ?? '')
  const [name, setName] = useState(holding?.name ?? '')
  const [exchange, setExchange] = useState(holding?.exchange ?? 'NSE')
  const [quantity, setQuantity] = useState(
    holding ? String(holding.quantity) : '',
  )
  const [avgPrice, setAvgPrice] = useState(
    holding && holding.quantity > 0
      ? String(paiseToRupees(holding.investedPaise) / holding.quantity)
      : '',
  )
  const [ownerId, setOwnerId] = useState(holding?.ownerId ?? 'shared')

  const isPending = createHolding.isPending || updateHolding.isPending

  const submit = async () => {
    const qty = Number(quantity)
    const avg = Number(avgPrice)
    if (!symbol.trim()) return toast.error('Enter a symbol / name')
    if (!Number.isFinite(qty) || qty <= 0) return toast.error('Enter a valid quantity')
    if (!Number.isFinite(avg) || avg < 0) return toast.error('Enter a valid average price')

    const input = {
      ownerId: ownerId === 'shared' ? null : ownerId,
      kind,
      isin: isin.trim() ? isin.trim().toUpperCase() : null,
      symbol: symbol.trim(),
      exchange: kind === 'stock' ? exchange : null,
      name: name.trim() || null,
      quantity: qty,
      investedPaise: rupeesToPaise(avg * qty),
      notes: null,
      tags: holding?.tags ?? [],
    }

    try {
      if (holding) {
        await updateHolding.mutateAsync({ id: holding.id, input })
        toast.success('Holding updated')
      } else {
        await createHolding.mutateAsync(input)
        toast.success(`${meta.singular} added`)
      }
      onDone()
    } catch (error) {
      toast.error('Could not save holding')
      console.error(error)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {isEdit ? 'Edit' : 'Add'} {meta.singular.toLowerCase()}
        </DialogTitle>
        <DialogDescription>
          {kind === 'stock'
            ? 'Enter the trading symbol and your average buy price.'
            : 'Enter the fund and your average purchase NAV.'}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 px-6">
        <div className="space-y-1.5">
          <Label htmlFor="mkt-symbol">
            {kind === 'stock' ? 'Trading symbol' : 'Fund name'}
          </Label>
          <Input
            id="mkt-symbol"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder={kind === 'stock' ? 'e.g. RELIANCE' : 'e.g. Axis Liquid Fund'}
            autoComplete="off"
          />
        </div>

        {kind === 'stock' ? (
          <div className="space-y-1.5">
            <Label htmlFor="mkt-name">Company name (optional)</Label>
            <Input
              id="mkt-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Reliance Industries"
              autoComplete="off"
            />
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="mkt-isin">ISIN (for live price)</Label>
            <Input
              id="mkt-isin"
              value={isin}
              onChange={(e) => setIsin(e.target.value)}
              placeholder={kind === 'stock' ? 'INE…' : 'INF…'}
              autoComplete="off"
            />
          </div>
          {kind === 'stock' ? (
            <div className="space-y-1.5">
              <Label>Exchange</Label>
              <Select value={exchange} onValueChange={setExchange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NSE">NSE</SelectItem>
                  <SelectItem value="BSE">BSE</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="mkt-qty">
              Quantity ({meta.unit})
            </Label>
            <Input
              id="mkt-qty"
              type="number"
              step="0.0001"
              inputMode="decimal"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mkt-avg">
              {kind === 'stock' ? 'Avg buy price (₹)' : 'Avg buy NAV (₹)'}
            </Label>
            <Input
              id="mkt-avg"
              type="number"
              step="0.0001"
              inputMode="decimal"
              value={avgPrice}
              onChange={(e) => setAvgPrice(e.target.value)}
              placeholder="0.00"
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
          {isEdit ? 'Save changes' : `Add ${meta.singular.toLowerCase()}`}
        </Button>
      </DialogFooter>
    </>
  )
}
