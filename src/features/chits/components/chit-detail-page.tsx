import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ChevronRight,
  MoreVertical,
  Pencil,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/page-header'
import { LoadingSpinner } from '@/components/common/loading-spinner'
import { ErrorState } from '@/components/common/error-state'
import { EmptyState } from '@/components/common/empty-state'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { formatPaise, rupeesToPaise } from '@/lib/money'
import { formatMonthYear } from '@/lib/date'
import { paths } from '@/config/paths'
import { chitIcon as ChitIcon } from '@/features/chits/config'
import { dateForMonth, projectChit } from '@/features/chits/chit-math'
import { chitBaseMonthly, chitSummary, toChitInput } from '@/features/chits/summary'
import { useChits } from '@/features/chits/hooks/use-chits'
import { useChitPayments } from '@/features/chits/hooks/use-chit-payments'
import { useDeleteChit } from '@/features/chits/hooks/use-chit-mutations'
import { useFillChitMonths } from '@/features/chits/hooks/use-chit-payment-mutations'
import { useCurrentFamily } from '@/features/family/hooks/use-current-family'
import { ChitFormDialog } from '@/features/chits/components/chit-form-dialog'
import { ChitPaymentDialog } from '@/features/chits/components/chit-payment-dialog'
import { ChitProgressChart } from '@/features/chits/components/chit-progress-chart'
import { ChitReceivedDialog } from '@/features/chits/components/chit-received-dialog'
import type { ChitPayment } from '@/features/chits/api/chit-payment-queries'

/** Detail view for a single chit: results, payments and a projection. */
export function ChitDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: family } = useCurrentFamily()
  const canManage = family?.role === 'owner' || family?.role === 'member'

  const {
    data: chits,
    isLoading: chitsLoading,
    isError: chitsError,
    refetch: refetchChits,
  } = useChits()
  const {
    data: allPayments,
    isLoading: paymentsLoading,
    isError: paymentsError,
    refetch: refetchPayments,
  } = useChitPayments()
  const deleteChit = useDeleteChit()
  const fillMonths = useFillChitMonths()

  const chit = useMemo(
    () => (chits ?? []).find((c) => c.id === id) ?? null,
    [chits, id],
  )
  const payments = useMemo(
    () => (allPayments ?? []).filter((p) => p.chitId === id),
    [allPayments, id],
  )
  const paymentByMonth = useMemo(() => {
    const map = new Map<number, ChitPayment>()
    for (const p of payments) map.set(p.monthNumber, p)
    return map
  }, [payments])

  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [receivedOpen, setReceivedOpen] = useState(false)
  const [paymentMonth, setPaymentMonth] = useState<number | null>(null)
  const [fillAmount, setFillAmount] = useState('')
  const [projMonthly, setProjMonthly] = useState('')
  const [projReceive, setProjReceive] = useState('')

  if (chitsLoading || paymentsLoading) return <LoadingSpinner />
  if (chitsError || paymentsError) {
    return (
      <ErrorState
        description="We could not load this chit."
        onRetry={() => {
          refetchChits()
          refetchPayments()
        }}
      />
    )
  }
  if (!chit) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <BackLink />
        <EmptyState
          icon={ChitIcon}
          title="Chit not found"
          description="It may have been deleted. Go back to your chits list."
          action={
            <Button asChild>
              <Link to={paths.chits}>Back to chits</Link>
            </Button>
          }
        />
      </div>
    )
  }

  const summary = chitSummary(chit, payments)
  const baseMonthly = chitBaseMonthly(chit)
  const progressPct =
    chit.tenureMonths > 0
      ? Math.min(100, (summary.monthsPaid / chit.tenureMonths) * 100)
      : 0

  const gapMonths = Array.from(
    { length: chit.tenureMonths },
    (_, i) => i + 1,
  ).filter((m) => !paymentByMonth.has(m))

  // Projection: fill gaps with an assumed monthly and, if not taken, assume a
  // payout in the final month.
  const assumedMonthly =
    fillOrDefault(projMonthly, baseMonthly)
  const assumedReceive = summary.isReceived
    ? null
    : fillOrDefault(projReceive, chit.chitValue)
  const projection = projectChit({
    ...toChitInput(chit, payments),
    assumedMonthlyPaise: assumedMonthly,
    assumedFinalReceivePaise: assumedReceive,
  })

  const handleDelete = async () => {
    try {
      await deleteChit.mutateAsync(chit.id)
      toast.success('Chit deleted')
      navigate(paths.chits)
    } catch (error) {
      toast.error('Could not delete chit')
      console.error(error)
    }
  }

  const handleFill = async () => {
    const value = Number(fillAmount)
    if (fillAmount.trim() === '' || !Number.isFinite(value) || value < 0) {
      toast.error('Enter a valid amount')
      return
    }
    if (gapMonths.length === 0) return
    try {
      await fillMonths.mutateAsync({
        chitId: chit.id,
        months: gapMonths,
        amountPaidPaise: rupeesToPaise(value),
      })
      toast.success(`Filled ${gapMonths.length} months`)
      setFillAmount('')
    } catch (error) {
      toast.error('Could not fill months')
      console.error(error)
    }
  }

  const activePayment =
    paymentMonth != null ? (paymentByMonth.get(paymentMonth) ?? null) : null

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <BackLink />

      <PageHeader
        title={chit.name}
        description={`${formatPaise(chit.chitValue, { decimals: false })} · ${chit.tenureMonths} months${chit.organizer ? ` · ${chit.organizer}` : ''}`}
        actions={
          canManage ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Chit actions">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditOpen(true)}>
                  <Pencil className="h-4 w-4" />
                  Edit details
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : undefined
        }
      />

      {/* Results */}
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-4">
            <Metric label="Total paid" value={formatPaise(summary.totalPaid)} />
            <Metric
              label="Received"
              value={
                summary.isReceived ? formatPaise(summary.totalReceived) : '—'
              }
            />
            <Metric
              label="Net position"
              value={formatPaise(summary.netPosition)}
              tone={summary.netPosition < 0 ? 'negative' : 'positive'}
            />
            <Metric
              label="Simple return"
              value={
                summary.simpleReturnPct == null
                  ? '—'
                  : `${summary.simpleReturnPct.toFixed(1)}%`
              }
              tone={
                summary.simpleReturnPct != null && summary.simpleReturnPct < 0
                  ? 'negative'
                  : 'positive'
              }
            />
            <Metric
              label="Annualised (XIRR)"
              value={
                summary.xirrPct == null
                  ? '—'
                  : `${summary.xirrPct.toFixed(1)}% p.a.`
              }
              tone={
                summary.xirrPct != null && summary.xirrPct < 0
                  ? 'negative'
                  : 'positive'
              }
              hint={
                summary.xirrPct == null
                  ? 'Shown once a payout is recorded'
                  : undefined
              }
            />
            <Metric
              label="Progress"
              value={`${summary.monthsPaid} / ${chit.tenureMonths}`}
              hint={`${summary.monthsRemaining} months left`}
            />
          </div>

          <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
            <div
              className="bg-primary h-full rounded-full transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Cumulative payments chart */}
      {summary.monthsPaid > 0 || summary.isReceived ? (
        <ChitProgressChart chit={chit} payments={payments} />
      ) : null}

      {/* Received status */}
      <Card>
        <CardContent className="flex items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="text-sm font-medium">Chit taken?</p>
            {summary.isReceived ? (
              <p className="text-muted-foreground text-sm">
                {formatPaise(chit.receivedAmount ?? 0)} in month{' '}
                {chit.receivedMonth} (
                {formatMonthYear(
                  dateForMonth(chit.startDate, chit.receivedMonth ?? 1),
                )}
                )
              </p>
            ) : (
              <p className="text-muted-foreground text-sm">Not taken yet</p>
            )}
          </div>
          {canManage ? (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => setReceivedOpen(true)}
            >
              {summary.isReceived ? 'Edit' : 'Mark received'}
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {/* Monthly payments */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Monthly payments</h2>
          <span className="text-muted-foreground text-sm">
            {payments.length} recorded
          </span>
        </div>

        {canManage && gapMonths.length > 0 ? (
          <Card>
            <CardContent className="space-y-2 p-4">
              <Label htmlFor="fill-amount">
                Fill the {gapMonths.length} un-recorded month
                {gapMonths.length === 1 ? '' : 's'} (₹)
              </Label>
              <div className="flex gap-2">
                <Input
                  id="fill-amount"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="e.g. 34000"
                  value={fillAmount}
                  onChange={(event) => setFillAmount(event.target.value)}
                />
                <Button
                  className="shrink-0"
                  onClick={handleFill}
                  disabled={fillMonths.isPending}
                >
                  Apply
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">
                Sets the same amount for every month you haven’t recorded yet.
                Edit individual months below.
              </p>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardContent className="divide-border divide-y p-0">
            {Array.from({ length: chit.tenureMonths }, (_, i) => i + 1).map(
              (month) => {
                const payment = paymentByMonth.get(month)
                const isReceivedMonth = chit.receivedMonth === month
                const row = (
                  <div className="flex items-center gap-3 px-4 py-3 text-left">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        Month {month}
                        <span className="text-muted-foreground font-normal">
                          {' · '}
                          {formatMonthYear(dateForMonth(chit.startDate, month))}
                        </span>
                        {isReceivedMonth ? (
                          <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ml-2 rounded-full px-2 py-0.5 text-xs">
                            Taken
                          </span>
                        ) : null}
                      </p>
                    </div>
                    {payment ? (
                      <span className="text-sm font-semibold tabular-nums">
                        {formatPaise(payment.amountPaid)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">
                        Not recorded
                      </span>
                    )}
                    {canManage ? (
                      <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
                    ) : null}
                  </div>
                )

                return canManage ? (
                  <button
                    key={month}
                    type="button"
                    className="hover:bg-accent w-full transition-colors"
                    onClick={() => setPaymentMonth(month)}
                  >
                    {row}
                  </button>
                ) : (
                  <div key={month}>{row}</div>
                )
              },
            )}
          </CardContent>
        </Card>
      </section>

      {/* Projection */}
      {!summary.isComplete ? (
        <section className="space-y-3">
          <h2 className="text-base font-semibold">Projection</h2>
          <Card>
            <CardContent className="space-y-4 p-4">
              <p className="text-muted-foreground text-sm">
                Estimate your final return if the rest of the tenure continues at
                a steady monthly payment
                {summary.isReceived ? '.' : ', and you receive the chit at the end.'}
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="proj-monthly">Assumed monthly (₹)</Label>
                  <Input
                    id="proj-monthly"
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    placeholder={String(Math.round(baseMonthly / 100))}
                    value={projMonthly}
                    onChange={(event) => setProjMonthly(event.target.value)}
                  />
                </div>
                {!summary.isReceived ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="proj-receive">Assumed final payout (₹)</Label>
                    <Input
                      id="proj-receive"
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      placeholder={String(Math.round(chit.chitValue / 100))}
                      value={projReceive}
                      onChange={(event) => setProjReceive(event.target.value)}
                    />
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-4 border-t pt-3">
                <Metric
                  label="Projected total paid"
                  value={formatPaise(projection.totalPaid)}
                />
                <Metric
                  label="Projected net"
                  value={formatPaise(projection.netPosition)}
                  tone={projection.netPosition < 0 ? 'negative' : 'positive'}
                />
                <Metric
                  label="Projected XIRR"
                  value={
                    projection.xirrPct == null
                      ? '—'
                      : `${projection.xirrPct.toFixed(1)}% p.a.`
                  }
                  tone={
                    projection.xirrPct != null && projection.xirrPct < 0
                      ? 'negative'
                      : 'positive'
                  }
                />
              </div>
            </CardContent>
          </Card>
        </section>
      ) : null}

      {/* Dialogs */}
      <ChitFormDialog open={editOpen} onOpenChange={setEditOpen} chit={chit} />

      <ChitReceivedDialog
        open={receivedOpen}
        onOpenChange={setReceivedOpen}
        chit={chit}
      />

      {paymentMonth != null ? (
        <ChitPaymentDialog
          open={paymentMonth != null}
          onOpenChange={(open) => !open && setPaymentMonth(null)}
          chitId={chit.id}
          monthNumber={paymentMonth}
          monthLabel={`Month ${paymentMonth} · ${formatMonthYear(dateForMonth(chit.startDate, paymentMonth))}`}
          existing={activePayment}
        />
      ) : null}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete chit?"
        description={`“${chit.name}” and its recorded payments will be removed. This can’t be undone from the app.`}
        confirmLabel="Delete"
        destructive
        loading={deleteChit.isPending}
        onConfirm={handleDelete}
      />
    </div>
  )
}

function BackLink() {
  return (
    <Link
      to={paths.chits}
      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
    >
      <ArrowLeft className="h-4 w-4" />
      Chits
    </Link>
  )
}

interface MetricProps {
  label: string
  value: string
  hint?: string
  tone?: 'positive' | 'negative'
}

function Metric({ label, value, hint, tone }: MetricProps) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p
        className={cn(
          'text-base font-semibold tabular-nums break-words sm:text-lg',
          tone === 'negative' && 'text-destructive',
          tone === 'positive' && 'text-emerald-600 dark:text-emerald-400',
        )}
      >
        {value}
      </p>
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  )
}

/** Parse a rupee string to paise, falling back to a paise default when blank. */
function fillOrDefault(input: string, defaultPaise: number): number {
  const value = Number(input)
  if (input.trim() === '' || !Number.isFinite(value) || value < 0) {
    return defaultPaise
  }
  return rupeesToPaise(value)
}
