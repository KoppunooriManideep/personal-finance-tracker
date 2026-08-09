import { useMemo, useState } from 'react'
import { Gem, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState } from '@/components/common/empty-state'
import { ErrorState } from '@/components/common/error-state'
import { LoadingSpinner } from '@/components/common/loading-spinner'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { formatPaise } from '@/lib/money'
import { useCurrentFamily } from '@/features/family/hooks/use-current-family'
import { useGoldHoldings } from '@/features/investments/hooks/use-gold-holdings'
import { useGoldSpot } from '@/features/investments/hooks/use-gold-spot'
import { useDeleteGoldHolding } from '@/features/investments/hooks/use-gold-mutations'
import {
  currentValuePaise,
  effectiveCostPaise,
  summarizeGoldPortfolio,
} from '@/features/investments/gold-math'
import {
  finenessLabel,
  formLabel,
  formatGrams,
} from '@/features/investments/config'
import { GoldHoldingCard } from '@/features/investments/components/gold-holding-card'
import { GoldFormDialog } from '@/features/investments/components/gold-form-dialog'
import {
  GoldAllocationChart,
  type AllocationSlice,
} from '@/features/investments/components/gold-allocation-chart'
import { GoldSpotEditor } from '@/features/investments/components/gold-spot-editor'
import type { GoldHolding } from '@/features/investments/api/gold-queries'
import type { GoldForm } from '@/types/database.types'

type AllocBasis = 'form' | 'purity'

/** Investments · Gold: holdings, live P&L, allocation and the spot rate. */
export function InvestmentsPage() {
  const { data: family } = useCurrentFamily()
  const canManage = family?.role === 'owner' || family?.role === 'member'

  const { data: holdings, isLoading, isError, refetch } = useGoldHoldings()
  const { data: spot } = useGoldSpot()
  const deleteHolding = useDeleteGoldHolding()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<GoldHolding | null>(null)
  const [toDelete, setToDelete] = useState<GoldHolding | null>(null)
  const [allocBasis, setAllocBasis] = useState<AllocBasis>('form')

  const spotPaise = spot?.pricePaisePerGram ?? 0
  const hasRate = spotPaise > 0

  const portfolio = useMemo(
    () => summarizeGoldPortfolio(holdings ?? [], spotPaise),
    [holdings, spotPaise],
  )

  const slices = useMemo(
    () => buildSlices(holdings ?? [], allocBasis, hasRate, spotPaise),
    [holdings, allocBasis, hasRate, spotPaise],
  )

  const hasHoldings = Boolean(holdings && holdings.length > 0)

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (holding: GoldHolding) => {
    setEditing(holding)
    setFormOpen(true)
  }

  const handleDelete = async () => {
    if (!toDelete) return
    try {
      await deleteHolding.mutateAsync(toDelete.id)
      toast.success('Holding deleted')
    } catch (error) {
      toast.error('Could not delete holding')
      console.error(error)
    } finally {
      setToDelete(null)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Investments"
        description="Your gold portfolio — coins, bars and jewellery."
        actions={
          canManage && hasHoldings ? (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add gold
            </Button>
          ) : undefined
        }
      />

      {isLoading ? (
        <LoadingSpinner />
      ) : isError ? (
        <ErrorState
          description="We could not load your investments."
          onRetry={() => refetch()}
        />
      ) : !hasHoldings ? (
        <div className="space-y-6">
          <GoldSpotEditor spot={spot ?? null} canManage={canManage} />
          <EmptyState
            icon={Gem}
            title="No gold yet"
            description="Add your first coin, bar or piece of jewellery to start tracking value and returns."
            action={
              canManage ? (
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  Add gold
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="space-y-6">
          <GoldSpotEditor spot={spot ?? null} canManage={canManage} />

          {/* Portfolio summary */}
          <Card>
            <CardContent className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="Current value"
                value={
                  hasRate
                    ? formatPaise(portfolio.currentValuePaise, { decimals: false })
                    : '—'
                }
                hint={hasRate ? undefined : 'Set the gold rate above'}
              />
              <Stat
                label="Total gain"
                value={
                  hasRate
                    ? `${portfolio.gainPaise >= 0 ? '+' : ''}${formatPaise(
                        portfolio.gainPaise,
                        { decimals: false },
                      )}`
                    : '—'
                }
                hint={
                  hasRate && portfolio.gainPct != null
                    ? `${portfolio.gainPct >= 0 ? '+' : ''}${portfolio.gainPct.toFixed(1)}%`
                    : undefined
                }
                tone={hasRate ? (portfolio.gainPaise < 0 ? 'negative' : 'positive') : undefined}
              />
              <Stat
                label="Effective cost"
                value={formatPaise(portfolio.effectiveCostPaise, { decimals: false })}
                hint={`Paid ${formatPaise(portfolio.investedPaise, { decimals: false })}`}
              />
              <Stat
                label="Total weight"
                value={formatGrams(portfolio.totalWeightMg)}
                hint={`${formatGrams(portfolio.pureWeightMg)} pure · ${portfolio.count} ${
                  portfolio.count === 1 ? 'item' : 'items'
                }`}
              />
            </CardContent>
          </Card>

          {/* Allocation */}
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
              <CardTitle>Allocation</CardTitle>
              <div className="flex gap-1">
                {(['form', 'purity'] as const).map((basis) => (
                  <button
                    key={basis}
                    type="button"
                    onClick={() => setAllocBasis(basis)}
                    aria-pressed={allocBasis === basis}
                    className={cn(
                      'rounded-md border px-2.5 py-1 text-xs font-medium capitalize transition-colors',
                      allocBasis === basis
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'hover:bg-accent',
                    )}
                  >
                    {basis}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <GoldAllocationChart slices={slices} />
              {!hasRate ? (
                <p className="text-muted-foreground mt-3 text-xs">
                  Allocation shown by effective cost until you set the gold rate.
                </p>
              ) : null}
            </CardContent>
          </Card>

          {/* Holdings */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(holdings ?? []).map((holding) => (
              <GoldHoldingCard
                key={holding.id}
                holding={holding}
                spotPaisePerGram={spotPaise}
                canManage={canManage}
                onEdit={openEdit}
                onDelete={setToDelete}
              />
            ))}
          </div>
        </div>
      )}

      <GoldFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        holding={editing}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Delete holding?"
        description={
          toDelete
            ? `This gold entry will be removed. This can’t be undone from the app.`
            : undefined
        }
        confirmLabel="Delete"
        destructive
        loading={deleteHolding.isPending}
        onConfirm={handleDelete}
      />
    </div>
  )
}

/** Group holdings into allocation slices by form or purity. */
function buildSlices(
  holdings: GoldHolding[],
  basis: AllocBasis,
  hasRate: boolean,
  spotPaise: number,
): AllocationSlice[] {
  const valueOf = (h: GoldHolding) =>
    hasRate
      ? currentValuePaise(h, spotPaise)
      : Math.max(0, effectiveCostPaise(h))

  const groups = new Map<string, number>()
  let total = 0
  for (const h of holdings) {
    const key = basis === 'form' ? h.form : String(h.fineness)
    const value = valueOf(h)
    groups.set(key, (groups.get(key) ?? 0) + value)
    total += value
  }

  return Array.from(groups.entries())
    .map(([key, value]) => ({
      key,
      label:
        basis === 'form'
          ? formLabel(key as GoldForm)
          : finenessLabel(Number(key)),
      value,
      pct: total > 0 ? (value / total) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value)
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint?: string
  tone?: 'positive' | 'negative'
}) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p
        className={cn(
          'mt-1 text-base font-semibold tabular-nums break-words sm:text-lg',
          tone === 'negative' && 'text-destructive',
          tone === 'positive' && 'text-emerald-600 dark:text-emerald-400',
        )}
      >
        {value}
      </p>
      {hint ? <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p> : null}
    </div>
  )
}
