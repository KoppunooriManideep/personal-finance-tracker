import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Plus, RefreshCw, SlidersHorizontal, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState } from '@/components/common/empty-state'
import { ErrorState } from '@/components/common/error-state'
import { LoadingSpinner } from '@/components/common/loading-spinner'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { formatPaise } from '@/lib/money'
import { paths } from '@/config/paths'
import { useCurrentFamily } from '@/features/family/hooks/use-current-family'
import { useFamilyMembers } from '@/features/family/hooks/use-family-members'
import { useMarketHoldings } from '@/features/investments/hooks/use-market-holdings'
import { useMarketQuotes } from '@/features/investments/hooks/use-market-quotes'
import { useDeleteMarketHolding } from '@/features/investments/hooks/use-market-mutations'
import {
  summarizeMarketHolding,
  summarizeMarketPortfolio,
} from '@/features/investments/market-math'
import { MARKET_KIND_META } from '@/features/investments/market-config'
import { quoteKey } from '@/features/investments/quotes-shared'
import { MarketHoldingCard } from '@/features/investments/components/market-holding-card'
import { MarketImportDialog } from '@/features/investments/components/market-import-dialog'
import { MarketHoldingDialog } from '@/features/investments/components/market-holding-dialog'
import type { MarketHolding } from '@/features/investments/api/market-queries'
import type { MarketHoldingKind } from '@/types/database.types'

interface MarketFilters {
  owner: string
  performance: string
  search: string
}
const EMPTY_MARKET_FILTERS: MarketFilters = {
  owner: 'all',
  performance: 'all',
  search: '',
}
interface OwnerOption {
  value: string
  label: string
}

/** Investments detail page for one market asset class (stocks or mutual funds). */
export function MarketPage({ kind }: { kind: MarketHoldingKind }) {
  const meta = MARKET_KIND_META[kind]
  const { data: family } = useCurrentFamily()
  const canManage = family?.role === 'owner' || family?.role === 'member'

  const { data: allHoldings, isLoading, isError, refetch } = useMarketHoldings()
  const holdings = useMemo(
    () => (allHoldings ?? []).filter((h) => h.kind === kind),
    [allHoldings, kind],
  )
  const quotes = useMarketQuotes(holdings)
  const priceOf = (h: MarketHolding) =>
    quotes.data?.quotes[quoteKey(h.kind, h.isin, h.symbol)] ?? null
  const prevCloseOf = (h: MarketHolding) =>
    quotes.data?.prevCloses[quoteKey(h.kind, h.isin, h.symbol)] ?? null

  const { data: members } = useFamilyMembers()

  const [importOpen, setImportOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<MarketHolding | null>(null)
  const [toDelete, setToDelete] = useState<MarketHolding | null>(null)
  const [filters, setFilters] = useState<MarketFilters>(EMPTY_MARKET_FILTERS)
  const deleteHolding = useDeleteMarketHolding()

  const ownerOptions = useMemo<OwnerOption[]>(() => {
    const ids = new Set(holdings.map((h) => h.ownerId))
    return [...ids].map((id) => ({
      value: id ?? 'shared',
      label: id
        ? (members?.find((m) => m.userId === id)?.profile?.fullName?.trim() ||
          members?.find((m) => m.userId === id)?.displayName?.trim() ||
          'Member')
        : 'Shared / Family',
    }))
  }, [holdings, members])

  const filtered = useMemo(() => {
    const query = filters.search.trim().toLowerCase()
    return holdings.filter((h) => {
      if (filters.owner !== 'all') {
        const matchOwner =
          filters.owner === 'shared'
            ? h.ownerId === null
            : h.ownerId === filters.owner
        if (!matchOwner) return false
      }
      if (query) {
        const name = (h.name ?? '').toLowerCase()
        if (!h.symbol.toLowerCase().includes(query) && !name.includes(query)) {
          return false
        }
      }
      if (filters.performance !== 'all') {
        const gain = summarizeMarketHolding(h, priceOf(h)).gainPaise
        if (gain == null) return false
        if (filters.performance === 'gainers' && gain <= 0) return false
        if (filters.performance === 'losers' && gain >= 0) return false
      }
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdings, filters, quotes.data])

  const activeFilterCount =
    (filters.owner !== 'all' ? 1 : 0) +
    (filters.performance !== 'all' ? 1 : 0) +
    (filters.search.trim() ? 1 : 0)
  const updateFilters = (patch: Partial<MarketFilters>) =>
    setFilters((current) => ({ ...current, ...patch }))
  const resetFilters = () => setFilters(EMPTY_MARKET_FILTERS)

  const portfolio = useMemo(
    () =>
      summarizeMarketPortfolio(
        filtered.map((h) => ({
          quantity: h.quantity,
          investedPaise: h.investedPaise,
          pricePaisePerUnit: priceOf(h),
          prevClosePaisePerUnit: prevCloseOf(h),
        })),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered, quotes.data],
  )

  const hasHoldings = holdings.length > 0
  const hasPrices = portfolio.pricedCount > 0
  const positive = portfolio.gainPaise >= 0

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (h: MarketHolding) => {
    setEditing(h)
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
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        to={paths.investments}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="h-4 w-4" />
        Investments
      </Link>

      <PageHeader
        title={meta.label}
        description={
          kind === 'stock'
            ? 'Your equity holdings and live P&L.'
            : 'Your mutual-fund units and live NAV.'
        }
        actions={
          canManage ? (
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <Upload className="h-4 w-4" />
                Import
              </Button>
              {hasHoldings ? (
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              ) : null}
            </div>
          ) : undefined
        }
      />

      {isLoading ? (
        <LoadingSpinner />
      ) : isError ? (
        <ErrorState
          description="We could not load your holdings."
          onRetry={() => refetch()}
        />
      ) : !hasHoldings ? (
        <EmptyState
          icon={meta.icon}
          title={`No ${meta.label.toLowerCase()} yet`}
          description="Import your Zerodha holdings, or add one manually."
          action={
            canManage ? (
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => setImportOpen(true)}>
                  <Upload className="h-4 w-4" />
                  Import from Zerodha
                </Button>
                <Button variant="outline" onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  Add manually
                </Button>
              </div>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-6">
          {/* Portfolio summary */}
          <Card>
            <CardContent className="space-y-4 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-muted-foreground text-xs">Invested</p>
                  <p className="text-xl font-semibold tabular-nums break-words">
                    {formatPaise(portfolio.investedPaise, { decimals: false })}
                  </p>
                </div>
                <div className="min-w-0 text-right">
                  <p className="text-muted-foreground text-xs">Current</p>
                  <p className="text-xl font-semibold tabular-nums break-words">
                    {hasPrices
                      ? formatPaise(portfolio.currentValuePaise, { decimals: false })
                      : '—'}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 border-t pt-3">
                <span className="text-muted-foreground text-sm">
                  P&amp;L
                  {portfolio.pricedCount < portfolio.count
                    ? ` · ${portfolio.pricedCount}/${portfolio.count} priced`
                    : ''}
                </span>
                {hasPrices ? (
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        'text-base font-semibold tabular-nums',
                        positive
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-destructive',
                      )}
                    >
                      {positive ? '+' : ''}
                      {formatPaise(portfolio.gainPaise, { decimals: false })}
                    </span>
                    {portfolio.gainPct != null ? (
                      <span
                        className={cn(
                          'rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums',
                          positive
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-destructive/10 text-destructive',
                        )}
                      >
                        {positive ? '+' : ''}
                        {portfolio.gainPct.toFixed(2)}%
                      </span>
                    ) : null}
                  </span>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => quotes.refetch()}
                    disabled={quotes.isFetching}
                  >
                    <RefreshCw
                      className={cn('h-4 w-4', quotes.isFetching && 'animate-spin')}
                    />
                    Prices
                  </Button>
                )}
              </div>

              {hasPrices && portfolio.dayChangePct != null ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground text-sm">
                    Day&apos;s P&amp;L
                  </span>
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        'text-sm font-semibold tabular-nums',
                        portfolio.dayChangePaise >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-destructive',
                      )}
                    >
                      {portfolio.dayChangePaise >= 0 ? '+' : ''}
                      {formatPaise(portfolio.dayChangePaise, { decimals: false })}
                    </span>
                    <span
                      className={cn(
                        'rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums',
                        portfolio.dayChangePaise >= 0
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-destructive/10 text-destructive',
                      )}
                    >
                      {portfolio.dayChangePaise >= 0 ? '+' : ''}
                      {portfolio.dayChangePct.toFixed(2)}%
                    </span>
                  </span>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <div className="flex items-center justify-between gap-2">
            {hasPrices ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => quotes.refetch()}
                disabled={quotes.isFetching}
              >
                <RefreshCw
                  className={cn('h-4 w-4', quotes.isFetching && 'animate-spin')}
                />
                {quotes.isFetching ? 'Updating…' : 'Refresh prices'}
              </Button>
            ) : (
              <span />
            )}
            <MarketFilters
              filters={filters}
              onChange={updateFilters}
              onReset={resetFilters}
              activeCount={activeFilterCount}
              shown={filtered.length}
              total={holdings.length}
              ownerOptions={ownerOptions}
            />
          </div>

          {filtered.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              No holdings match these filters.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {filtered.map((holding) => (
                <MarketHoldingCard
                  key={holding.id}
                  holding={holding}
                  pricePaise={priceOf(holding)}
                  prevClosePaise={prevCloseOf(holding)}
                  liveName={
                    quotes.data?.names[
                      quoteKey(holding.kind, holding.isin, holding.symbol)
                    ]
                  }
                  canManage={canManage}
                  onEdit={openEdit}
                  onDelete={setToDelete}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <MarketImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <MarketHoldingDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        kind={kind}
        holding={editing}
      />
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Delete holding?"
        description="This holding will be removed. This can’t be undone from the app."
        confirmLabel="Delete"
        destructive
        loading={deleteHolding.isPending}
        onConfirm={handleDelete}
      />
    </div>
  )
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-muted-foreground text-xs">{label}</Label>
      {children}
    </div>
  )
}

/** Holdings filters — a "Filters" button that opens a bottom sheet (search / owner / performance). */
function MarketFilters({
  filters,
  onChange,
  onReset,
  activeCount,
  shown,
  total,
  ownerOptions,
}: {
  filters: MarketFilters
  onChange: (patch: Partial<MarketFilters>) => void
  onReset: () => void
  activeCount: number
  shown: number
  total: number
  ownerOptions: OwnerOption[]
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground text-xs">
        {shown} of {total}
      </span>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="relative h-9 gap-1.5">
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {activeCount > 0 ? (
              <span className="bg-primary text-primary-foreground flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold">
                {activeCount}
              </span>
            ) : null}
          </Button>
        </SheetTrigger>
        <SheetContent
          side="bottom"
          className="max-h-[85vh] overflow-y-auto rounded-t-xl px-6 pt-4 pb-6"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <SheetHeader className="mb-4 text-left">
            <SheetTitle>Filters</SheetTitle>
            <SheetDescription>Narrow down your holdings.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4">
            <FilterField label="Search">
              <Input
                value={filters.search}
                onChange={(event) => onChange({ search: event.target.value })}
                placeholder="Symbol or name"
                className="h-10"
              />
            </FilterField>
            <FilterField label="Owner">
              <Select
                value={filters.owner}
                onValueChange={(value) => onChange({ owner: value })}
              >
                <SelectTrigger className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All owners</SelectItem>
                  {ownerOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Performance">
              <Select
                value={filters.performance}
                onValueChange={(value) => onChange({ performance: value })}
              >
                <SelectTrigger className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="gainers">Gainers</SelectItem>
                  <SelectItem value="losers">Losers</SelectItem>
                </SelectContent>
              </Select>
            </FilterField>
          </div>
          <SheetFooter className="mt-6">
            {activeCount > 0 ? (
              <Button variant="outline" onClick={onReset} className="h-11 w-full">
                Clear filters
              </Button>
            ) : null}
            <Button onClick={() => setOpen(false)} className="h-11 w-full">
              Apply filters
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
