import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Download,
  FileSpreadsheet,
  Gem,
  Plus,
  Printer,
  SlidersHorizontal,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState } from '@/components/common/empty-state'
import { ErrorState } from '@/components/common/error-state'
import { LoadingSpinner } from '@/components/common/loading-spinner'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { formatPaise } from '@/lib/money'
import { formatDate } from '@/lib/date'
import { downloadCsv } from '@/lib/csv'
import { paths } from '@/config/paths'
import { useCurrentFamily } from '@/features/family/hooks/use-current-family'
import { useFamilyMembers } from '@/features/family/hooks/use-family-members'
import { useGoldHoldings } from '@/features/investments/hooks/use-gold-holdings'
import { useGoldSpot } from '@/features/investments/hooks/use-gold-spot'
import { useDeleteGoldHolding } from '@/features/investments/hooks/use-gold-mutations'
import { summarizeGoldPortfolio } from '@/features/investments/gold-math'
import {
  finenessLabel,
  formatGrams,
  karatLabel,
} from '@/features/investments/config'
import type { GoldAllocationSlice } from '@/features/investments/gold-math'

/** Quick view switch: all gold, only jewellery, or only bullion (coins + bars). */
type GoldCategory = 'all' | 'jewellery' | 'bullion'

const CATEGORY_TABS: { value: GoldCategory; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'jewellery', label: 'Jewellery' },
  { value: 'bullion', label: 'Coins & bars' },
]
import { GoldHoldingCard } from '@/features/investments/components/gold-holding-card'
import { GoldFormDialog } from '@/features/investments/components/gold-form-dialog'
import { GoldSpotEditor } from '@/features/investments/components/gold-spot-editor'
import { buildGoldCsv, goldCsvFilename } from '@/features/investments/gold-export'
import type { GoldHolding } from '@/features/investments/api/gold-queries'

interface GoldFilters {
  purity: string
  owner: string
  year: string
}

const EMPTY_GOLD_FILTERS: GoldFilters = {
  purity: 'all',
  owner: 'all',
  year: 'all',
}

interface OwnerOption {
  value: string
  label: string
}

/** Investments · Gold detail: rate, portfolio summary and holdings. */
export function GoldPage() {
  const { data: family } = useCurrentFamily()
  const canManage = family?.role === 'owner' || family?.role === 'member'

  const { data: holdings, isLoading, isError, refetch } = useGoldHoldings()
  const { data: spot } = useGoldSpot()
  const { data: members } = useFamilyMembers()
  const deleteHolding = useDeleteGoldHolding()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<GoldHolding | null>(null)
  const [toDelete, setToDelete] = useState<GoldHolding | null>(null)

  const [filters, setFilters] = useState<GoldFilters>(EMPTY_GOLD_FILTERS)
  const [category, setCategory] = useState<GoldCategory>('all')

  const spotPaise = spot?.pricePaisePerGram ?? 0
  const hasRate = spotPaise > 0

  const all = useMemo(() => holdings ?? [], [holdings])
  const hasHoldings = all.length > 0

  // Distinct filter options, derived from all holdings.
  const purityOptions = useMemo(
    () => [...new Set(all.map((h) => h.fineness))].sort((a, b) => b - a),
    [all],
  )
  const yearOptions = useMemo(
    () =>
      [...new Set(all.map((h) => h.purchaseDate.slice(0, 4)))].sort((a, b) =>
        b.localeCompare(a),
      ),
    [all],
  )
  const ownerOptions = useMemo(() => {
    const ids = new Set(all.map((h) => h.ownerId))
    return [...ids].map((id) => ({
      value: id ?? 'shared',
      label: id
        ? (members?.find((m) => m.userId === id)?.profile?.fullName?.trim() ||
          members?.find((m) => m.userId === id)?.displayName?.trim() ||
          'Member')
        : 'Shared / Family',
    }))
  }, [all, members])

  const filtered = useMemo(
    () =>
      all.filter(
        (h) =>
          (category === 'all' ||
            (category === 'jewellery'
              ? h.form === 'jewellery'
              : h.form === 'coin' || h.form === 'bar')) &&
          (filters.purity === 'all' || h.fineness === Number(filters.purity)) &&
          (filters.owner === 'all' ||
            (filters.owner === 'shared'
              ? h.ownerId === null
              : h.ownerId === filters.owner)) &&
          (filters.year === 'all' || h.purchaseDate.slice(0, 4) === filters.year),
      ),
    [all, filters, category],
  )

  const activeFilterCount = Object.values(filters).filter(
    (v) => v !== 'all',
  ).length

  const updateFilters = (patch: Partial<GoldFilters>) =>
    setFilters((current) => ({ ...current, ...patch }))
  const resetFilters = () => setFilters(EMPTY_GOLD_FILTERS)

  const portfolio = useMemo(
    () => summarizeGoldPortfolio(filtered, spotPaise),
    [filtered, spotPaise],
  )

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (holding: GoldHolding) => {
    setEditing(holding)
    setFormOpen(true)
  }
  const handleExportCsv = () => {
    if (filtered.length === 0) return
    downloadCsv(goldCsvFilename(), buildGoldCsv(filtered, spotPaise))
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
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm print:hidden"
      >
        <ArrowLeft className="h-4 w-4" />
        Investments
      </Link>

      <PageHeader
        title="Gold"
        description="Coins, bars and jewellery."
        actions={
          hasHoldings ? (
            <div className="flex items-center gap-2 print:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <Download className="h-4 w-4" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleExportCsv}>
                    <FileSpreadsheet className="h-4 w-4" />
                    Download CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => window.print()}>
                    <Printer className="h-4 w-4" />
                    Print / Save PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {canManage ? (
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  Add gold
                </Button>
              ) : null}
            </div>
          ) : undefined
        }
      />

      {/* Print-only report header (hidden on screen). */}
      <p className="text-muted-foreground hidden text-sm print:block">
        {family?.name ? `${family.name} · ` : ''}Gold portfolio · Generated{' '}
        {formatDate(new Date())}
      </p>

      {isLoading ? (
        <LoadingSpinner />
      ) : isError ? (
        <ErrorState
          description="We could not load your gold."
          onRetry={() => refetch()}
        />
      ) : (
        <div className="space-y-6">
          <GoldSpotEditor spot={spot ?? null} canManage={canManage} />

          {hasHoldings ? (
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1 print:hidden">
              {CATEGORY_TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setCategory(tab.value)}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm transition-colors',
                    category === tab.value
                      ? 'bg-background text-foreground font-medium shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          ) : null}

          {hasHoldings ? (
            <PortfolioSummary
              spentPaise={portfolio.investedPaise}
              chargesPaise={portfolio.chargesPaise}
              discountPaise={portfolio.discountPaise}
              currentValuePaise={portfolio.currentValuePaise}
              gainPaise={portfolio.gainPaise}
              gainPct={portfolio.gainPct}
              totalWeightMg={portfolio.totalWeightMg}
              pureWeightMg={portfolio.pureWeightMg}
              byPurity={portfolio.byPurity}
              hasRate={hasRate}
            />
          ) : null}

          {hasHoldings ? (
            <GoldFiltersCard
              filters={filters}
              onChange={updateFilters}
              onReset={resetFilters}
              activeCount={activeFilterCount}
              shown={filtered.length}
              total={all.length}
              purityOptions={purityOptions}
              ownerOptions={ownerOptions}
              yearOptions={yearOptions}
            />
          ) : null}

          {!hasHoldings ? (
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
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              No holdings match these filters.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {filtered.map((holding) => (
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
          )}
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
        description="This gold entry will be removed. This can’t be undone from the app."
        confirmLabel="Delete"
        destructive
        loading={deleteHolding.isPending}
        onConfirm={handleDelete}
      />
    </div>
  )
}

/** A labelled filter control (label above the select), like the txns filters. */
function FilterField({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-muted-foreground text-xs">{label}</Label>
      {children}
    </div>
  )
}

interface GoldFilterFieldsProps {
  filters: GoldFilters
  onChange: (patch: Partial<GoldFilters>) => void
  purityOptions: number[]
  ownerOptions: OwnerOption[]
  yearOptions: string[]
  /** Extra classes for the select triggers (e.g. taller inputs in the sheet). */
  triggerClassName?: string
}

/** The four gold filter selects, shared by the desktop card and mobile sheet. */
function GoldFilterFields({
  filters,
  onChange,
  purityOptions,
  ownerOptions,
  yearOptions,
  triggerClassName,
}: GoldFilterFieldsProps) {
  const trigger = cn('w-full', triggerClassName)
  return (
    <>
      <FilterField label="Purity">
        <Select value={filters.purity} onValueChange={(v) => onChange({ purity: v })}>
          <SelectTrigger className={trigger}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All purities</SelectItem>
            {purityOptions.map((f) => (
              <SelectItem key={f} value={String(f)}>
                {finenessLabel(f)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="Owner">
        <Select value={filters.owner} onValueChange={(v) => onChange({ owner: v })}>
          <SelectTrigger className={trigger}>
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

      <FilterField label="Year">
        <Select value={filters.year} onValueChange={(v) => onChange({ year: v })}>
          <SelectTrigger className={trigger}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All years</SelectItem>
            {yearOptions.map((y) => (
              <SelectItem key={y} value={y}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>
    </>
  )
}

interface GoldFiltersCardProps extends GoldFilterFieldsProps {
  onReset: () => void
  activeCount: number
  shown: number
  total: number
}

/**
 * Gold holdings filters — same pattern as the Transactions page: an inline card
 * on desktop, and a "Filters" button that opens a bottom sheet on mobile.
 */
function GoldFiltersCard({
  onReset,
  activeCount,
  shown,
  total,
  ...fields
}: GoldFiltersCardProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Desktop: inline card */}
      <Card className="hidden print:hidden md:block">
        <CardContent className="space-y-3 p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <GoldFilterFields {...fields} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground text-xs">
              Showing {shown} of {total}
            </span>
            {activeCount > 0 ? (
              <Button variant="ghost" size="sm" onClick={onReset}>
                Clear filters
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Mobile: Filters button + bottom sheet */}
      <div className="flex items-center justify-between gap-2 md:hidden print:hidden">
        <span className="text-muted-foreground text-xs">
          Showing {shown} of {total}
        </span>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              className="relative flex h-10 shrink-0 gap-1.5"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span>Filters</span>
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
              <SheetDescription>Narrow down your gold holdings.</SheetDescription>
            </SheetHeader>
            <div className="my-2 space-y-4 pr-1">
              <GoldFilterFields {...fields} triggerClassName="h-10" />
            </div>
            <SheetFooter className="mt-6">
              {activeCount > 0 ? (
                <Button
                  variant="outline"
                  onClick={onReset}
                  className="h-11 w-full"
                >
                  Clear filters
                </Button>
              ) : null}
              <Button
                onClick={() => setOpen(false)}
                className="h-11 w-full text-base font-medium"
              >
                Apply filters
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}

/**
 * Gold summary. The hero number is the WEIGHT accumulated (gross grams, with
 * pure 24K-equivalent grams beneath) — that's what the user cares about most,
 * followed by a clear per-karat breakdown. Spent (with the making/VA/GST
 * portion called out), Current and P&L sit below.
 */
export function PortfolioSummary({
  spentPaise,
  chargesPaise,
  discountPaise,
  currentValuePaise,
  gainPaise,
  gainPct,
  totalWeightMg,
  pureWeightMg,
  byPurity,
  hasRate,
}: {
  spentPaise: number
  chargesPaise: number
  discountPaise: number
  currentValuePaise: number
  gainPaise: number
  gainPct: number | null
  totalWeightMg: number
  pureWeightMg: number
  byPurity: GoldAllocationSlice[]
  hasRate: boolean
}) {
  const positive = gainPaise >= 0
  const gainColor = positive
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-destructive'
  // Grams per purity, heaviest karat first (24K before 22K…) for easy counting.
  const purityRows = [...byPurity].sort((a, b) => Number(b.key) - Number(a.key))

  // With jewellery charges present, split the spend into the recoverable metal
  // cost vs the all-in total, and show BOTH gains: gold-only (did the metal
  // appreciate?) and net (am I ahead after making/stones/GST?).
  const hasCharges = chargesPaise > 0
  const goldCostPaise = spentPaise - chargesPaise
  const goldGainPaise = currentValuePaise - goldCostPaise
  const goldGainPct =
    goldCostPaise > 0 ? (goldGainPaise / goldCostPaise) * 100 : null
  const netGainPaise = currentValuePaise - spentPaise
  const netGainPct = spentPaise > 0 ? (netGainPaise / spentPaise) * 100 : null
  return (
    <Card>
      <CardContent className="space-y-4 p-4 sm:p-5">
        {/* Hero: grams accumulated */}
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs">Gold accumulated</p>
            <p className="text-3xl font-bold tabular-nums break-words text-amber-600 dark:text-amber-400">
              {formatGrams(totalWeightMg)}
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              ≈ {formatGrams(pureWeightMg)} pure (24K)
            </p>
          </div>
          <div className="bg-amber-500/10 shrink-0 rounded-full p-3">
            <Gem className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
        </div>

        {/* Grams by purity — 22K jewellery vs 24K coins, counted separately. */}
        {purityRows.length > 1 ? (
          <div className="grid grid-cols-2 gap-2">
            {purityRows.map((row) => (
              <div
                key={row.key}
                className="border-amber-500/25 bg-amber-500/5 flex items-center justify-between rounded-lg border px-3 py-2"
              >
                <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                  {karatLabel(Number(row.key))}
                </span>
                <span className="text-sm font-medium tabular-nums">
                  {formatGrams(row.weightMg)}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {/* Money. Jewellery (has charges) → split gold cost vs total paid, with
            gold-only and net P&L. Coins/bars (no charges) → simple Spent/Current/P&L. */}
        {hasCharges ? (
          <div className="space-y-3 border-t pt-3">
            <div className="space-y-1.5">
              <SummaryRow
                label="Total paid"
                value={formatPaise(spentPaise, { decimals: false })}
              />
              <SummaryRow
                label="Gold cost"
                value={formatPaise(goldCostPaise, { decimals: false })}
              />
              <SummaryRow
                label="Current"
                value={
                  hasRate
                    ? formatPaise(currentValuePaise, { decimals: false })
                    : '—'
                }
              />
            </div>
            {hasRate ? (
              <div className="space-y-1.5 border-t pt-3">
                <SummaryRow
                  label="Gold P&L"
                  value={formatSignedPnl(goldGainPaise, goldGainPct)}
                  valueClassName={pnlColor(goldGainPaise)}
                />
                <SummaryRow
                  label="Net P&L"
                  value={formatSignedPnl(netGainPaise, netGainPct)}
                  valueClassName={pnlColor(netGainPaise)}
                />
              </div>
            ) : (
              <p className="text-muted-foreground border-t pt-3 text-sm">
                Set the gold rate to see value & P&L.
              </p>
            )}
            <p className="text-muted-foreground text-xs">
              Total paid includes{' '}
              {formatPaise(chargesPaise, { decimals: false })} in making, stones
              &amp; GST
              {discountPaise > 0
                ? ` (after ${formatPaise(discountPaise, { decimals: false })} discount)`
                : ''}
              .
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 border-t pt-3">
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs">Spent</p>
              <p className="truncate text-sm font-semibold tabular-nums">
                {formatPaise(spentPaise, { decimals: false })}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs">Current</p>
              <p className="truncate text-sm font-semibold tabular-nums">
                {hasRate
                  ? formatPaise(currentValuePaise, { decimals: false })
                  : '—'}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs">P&amp;L</p>
              {hasRate ? (
                <>
                  <p
                    className={cn(
                      'truncate text-sm font-semibold tabular-nums',
                      gainColor,
                    )}
                  >
                    {positive ? '+' : ''}
                    {formatPaise(gainPaise, { decimals: false })}
                  </p>
                  {gainPct != null ? (
                    <p className={cn('text-xs tabular-nums', gainColor)}>
                      {positive ? '+' : ''}
                      {gainPct.toFixed(1)}%
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-muted-foreground text-sm">Set rate</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/** Tailwind text colour for a gain/loss amount. */
function pnlColor(gainPaise: number): string {
  return gainPaise >= 0
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-destructive'
}

/** "+₹8,423 (+5.3%)" — signed amount with an optional percentage. */
function formatSignedPnl(gainPaise: number, pct: number | null): string {
  const sign = gainPaise >= 0 ? '+' : ''
  const amount = `${sign}${formatPaise(gainPaise, { decimals: false })}`
  return pct != null ? `${amount} (${sign}${pct.toFixed(1)}%)` : amount
}

/** A label-left / value-right row for the split jewellery money breakdown. */
function SummaryRow({
  label,
  value,
  valueClassName,
}: {
  label: string
  value: string
  valueClassName?: string
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span
        className={cn('text-sm font-semibold tabular-nums', valueClassName)}
      >
        {value}
      </span>
    </div>
  )
}
