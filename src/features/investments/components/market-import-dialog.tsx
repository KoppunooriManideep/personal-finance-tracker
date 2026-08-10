import { useMemo, useState } from 'react'
import { Loader2, Upload } from 'lucide-react'
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
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useFamilyMembers } from '@/features/family/hooks/use-family-members'
import { useMarketHoldings } from '@/features/investments/hooks/use-market-holdings'
import { useSyncMarketImport } from '@/features/investments/hooks/use-market-mutations'
import { planMarketImport } from '@/features/investments/import-plan'
import {
  investedPaiseOf,
  parseZerodhaHoldings,
} from '@/features/investments/zerodha-import'

interface MarketImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Bulk-import stocks + mutual funds from a Zerodha Console holdings export. */
export function MarketImportDialog({ open, onOpenChange }: MarketImportDialogProps) {
  const syncImport = useSyncMarketImport()
  const { data: members } = useFamilyMembers()
  const { data: existing } = useMarketHoldings()

  const [text, setText] = useState('')
  const [ownerId, setOwnerId] = useState('shared')

  const parsed = useMemo(
    () => (text.trim() ? parseZerodhaHoldings(text) : null),
    [text],
  )
  const stockCount = parsed?.holdings.filter((h) => h.kind === 'stock').length ?? 0
  const fundCount =
    parsed?.holdings.filter((h) => h.kind === 'mutual_fund').length ?? 0

  // Diff against existing holdings so re-importing updates instead of duplicating.
  const plan = useMemo(() => {
    if (!parsed || parsed.error) return null
    const resolvedOwner = ownerId === 'shared' ? null : ownerId
    const rows = parsed.holdings.map((h) => ({
      ownerId: resolvedOwner,
      kind: h.kind,
      isin: h.isin,
      symbol: h.symbol,
      exchange: h.kind === 'stock' ? 'NSE' : null,
      name: null,
      quantity: h.quantity,
      investedPaise: investedPaiseOf(h),
      notes: null,
      tags: [],
    }))
    return planMarketImport(rows, existing ?? [])
  }, [parsed, ownerId, existing])

  const reset = () => {
    setText('')
    setOwnerId('shared')
  }

  const handleFile = async (file: File | undefined) => {
    if (file) setText(await file.text())
  }

  const handleImport = async () => {
    if (!plan || plan.inserts.length + plan.updates.length === 0) return
    try {
      const { inserted, updated } = await syncImport.mutateAsync(plan)
      const parts = [
        inserted > 0 ? `${inserted} added` : '',
        updated > 0 ? `${updated} updated` : '',
      ].filter(Boolean)
      toast.success(parts.length ? `Import done — ${parts.join(', ')}` : 'Import done')
      reset()
      onOpenChange(false)
    } catch (error) {
      toast.error('Could not import holdings')
      console.error(error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import from Zerodha</DialogTitle>
          <DialogDescription>
            Upload or paste your Zerodha Console holdings export (Console →
            Portfolio → Holdings → Download). Stocks and mutual funds are detected
            automatically from the ISIN.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6">
          <div className="space-y-1.5">
            <Label htmlFor="import-file">Holdings file (CSV)</Label>
            <input
              id="import-file"
              type="file"
              accept=".csv,text/csv,text/plain"
              onChange={(event) => handleFile(event.target.files?.[0])}
              className="text-sm file:mr-3 file:rounded-md file:border file:bg-transparent file:px-3 file:py-1.5 file:text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="import-text">…or paste the CSV contents</Label>
            <textarea
              id="import-text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Symbol,ISIN,…,Quantity Available,…,Average Price,…"
              rows={5}
              className={cn(
                'border-input w-full rounded-md border bg-transparent p-2.5 font-mono text-xs shadow-xs outline-none',
                'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
              )}
            />
          </div>

          {parsed ? (
            parsed.error ? (
              <p className="text-destructive text-sm">{parsed.error}</p>
            ) : (
              <div className="bg-muted/50 rounded-lg border p-3 text-sm">
                <p className="font-medium">
                  {parsed.holdings.length} holdings ready
                  {plan ? (
                    <span className="text-muted-foreground font-normal">
                      {' '}
                      — {plan.inserts.length} new, {plan.updates.length} to update
                    </span>
                  ) : null}
                </p>
                <p className="text-muted-foreground text-xs">
                  {stockCount} stock{stockCount === 1 ? '' : 's'} · {fundCount}{' '}
                  mutual fund{fundCount === 1 ? '' : 's'}
                  {parsed.skipped > 0 ? ` · ${parsed.skipped} skipped` : ''}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Re-importing updates existing holdings by ISIN — safe to run after
                  each SIP.
                </p>
              </div>
            )
          ) : null}

          <div className="space-y-1.5">
            <Label>Assign to owner</Label>
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

        <DialogFooter className="shrink-0 border-t pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={syncImport.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={
              syncImport.isPending ||
              !plan ||
              plan.inserts.length + plan.updates.length === 0
            }
          >
            {syncImport.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Import{' '}
            {plan ? plan.inserts.length + plan.updates.length : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
