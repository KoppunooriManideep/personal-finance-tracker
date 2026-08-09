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
  GOLD_FORMS,
  finenessLabel,
  formatGrams,
} from '@/features/investments/config'
import { GoldHoldingCard } from '@/features/investments/components/gold-holding-card'
import { GoldFormDialog } from '@/features/investments/components/gold-form-dialog'
import { GoldSpotEditor } from '@/features/investments/components/gold-spot-editor'
import { buildGoldCsv, goldCsvFilename } from '@/features/investments/gold-export'
import type { GoldHolding } from '@/features/investments/api/gold-queries'

interface GoldFilters {
  form: string
  purity: string
  owner: string
  year: string
}

const EMPTY_GOLD_FILTERS: GoldFilters = {
  form: 'all',
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
          (filters.form === 'all' || h.form === filters.form) &&
          (filters.purity === 'all' || h.fineness === Number(filters.purity)) &&
          (filters.owner === 'all' ||
            (filters.owner === 'shared'
              ? h.ownerId === null
              : h.ownerId === filters.owner)) &&
          (filters.year === 'all' || h.purchaseDate.slice(0, 4) === filters.year),
      ),
    [all, filters],
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
            <PortfolioSummary
              investedPaise={portfolio.effectiveCostPaise}
              currentValuePaise={portfolio.currentValuePaise}
              gainPaise={portfolio.gainPaise}
              gainPct={portfolio.gainPct}
              totalWeightMg={portfolio.totalWeightMg}
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
      <FilterField label="Type">
        <Select value={filters.form} onValueChange={(v) => onChange({ form: v })}>
          <SelectTrigger className={trigger}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {GOLD_FORMS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

/** Kite-style summary: Invested / Current on top, P&L with a % pill below. */
export function PortfolioSummary({
  investedPaise,
  currentValuePaise,
  gainPaise,
  gainPct,
  totalWeightMg,
  hasRate,
}: {
  investedPaise: number
  currentValuePaise: number
  gainPaise: number
  gainPct: number | null
  totalWeightMg: number
  hasRate: boolean
}) {
  const positive = gainPaise >= 0
  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs">Invested</p>
            <p className="text-xl font-semibold tabular-nums break-words">
              {formatPaise(investedPaise, { decimals: false })}
            </p>
          </div>
          <div className="min-w-0 text-right">
            <p className="text-muted-foreground text-xs">Current</p>
            <p className="text-xl font-semibold tabular-nums break-words">
              {hasRate ? formatPaise(currentValuePaise, { decimals: false }) : '—'}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t pt-3">
          <span className="text-muted-foreground text-sm">
            P&amp;L · {formatGrams(totalWeightMg)}
          </span>
          {hasRate ? (
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
                {formatPaise(gainPaise, { decimals: false })}
              </span>
              {gainPct != null ? (
                <span
                  className={cn(
                    'rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums',
                    positive
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'bg-destructive/10 text-destructive',
                  )}
                >
                  {positive ? '+' : ''}
                  {gainPct.toFixed(2)}%
                </span>
              ) : null}
            </span>
          ) : (
            <span className="text-muted-foreground text-sm">Set the gold rate</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
