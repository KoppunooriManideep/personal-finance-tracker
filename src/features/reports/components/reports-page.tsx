import { useMemo, useState, type ReactNode } from 'react'
import { Printer } from 'lucide-react'
import { PageHeader } from '@/components/common/page-header'
import { ErrorState } from '@/components/common/error-state'
import { LoadingSpinner } from '@/components/common/loading-spinner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { formatPaise } from '@/lib/money'
import {
  financialYearLabel,
  formatDate,
  formatMonthYear,
  getCurrentFinancialYearStart,
  getCurrentIstDate,
  getCurrentIstMonth,
} from '@/lib/date'
import { useCurrentFamily } from '@/features/family/hooks/use-current-family'
import { useFamilyMembers } from '@/features/family/hooks/use-family-members'
import { useAccounts } from '@/features/accounts/hooks/use-accounts'
import { useCategories } from '@/features/categories/hooks/use-categories'
import { useTransactions } from '@/features/transactions/hooks/use-transactions'
import { useGoldHoldings } from '@/features/investments/hooks/use-gold-holdings'
import { useGoldSpot } from '@/features/investments/hooks/use-gold-spot'
import { useMarketHoldings } from '@/features/investments/hooks/use-market-holdings'
import { useMarketQuotes } from '@/features/investments/hooks/use-market-quotes'
import { summarizeMarketPortfolio } from '@/features/investments/market-math'
import { summarizePf } from '@/features/investments/pf-math'
import { usePfAccounts } from '@/features/investments/hooks/use-pf-accounts'
import { quoteKey } from '@/features/investments/quotes-shared'
import { useDashboardStore } from '@/stores/dashboard-store'
import {
  aggregateReportFrom,
  financialYearPeriodKeys,
  monthlyBreakdown,
  monthPeriodKeys,
  type MonthRow,
} from '@/features/reports/aggregate'
import { aggregateGoldForReport } from '@/features/reports/gold-report'
import {
  buildInvestmentsReport,
  type InvestmentsReport,
} from '@/features/reports/investments-report'

type PeriodType = 'month' | 'fy'

/** A printable month or financial-year (Apr–Mar) financial summary. */
export function ReportsPage() {
  const { data: family } = useCurrentFamily()
  const { selectedOwnerId, setSelectedOwnerId } = useDashboardStore()

  const [periodType, setPeriodType] = useState<PeriodType>('month')
  const [selectedMonth, setSelectedMonth] = useState(getCurrentIstMonth())
  const [fyStartYear, setFyStartYear] = useState(getCurrentFinancialYearStart())

  const {
    data: transactions,
    isLoading: txLoading,
    isError,
    refetch,
  } = useTransactions()
  const { data: members, isLoading: membersLoading } = useFamilyMembers()
  const { data: accounts, isLoading: accountsLoading } = useAccounts()
  const { data: categories, isLoading: categoriesLoading } = useCategories()
  const { data: goldHoldings } = useGoldHoldings()
  const { data: goldSpot } = useGoldSpot()

  const loading =
    txLoading || membersLoading || accountsLoading || categoriesLoading

  const periodKeys = useMemo(
    () =>
      periodType === 'month'
        ? monthPeriodKeys(selectedMonth)
        : financialYearPeriodKeys(fyStartYear),
    [periodType, selectedMonth, fyStartYear],
  )

  const report = useMemo(
    () =>
      aggregateReportFrom(transactions ?? [], {
        accounts: accounts ?? [],
        categories: categories ?? [],
        members: members ?? [],
        periodKeys,
        selectedOwnerId,
      }),
    [transactions, accounts, categories, members, periodKeys, selectedOwnerId],
  )

  const breakdown = useMemo<MonthRow[]>(
    () =>
      periodType === 'fy'
        ? monthlyBreakdown(transactions ?? [], {
            accounts: accounts ?? [],
            orderedKeys: periodKeys,
            selectedOwnerId,
          })
        : [],
    [periodType, transactions, accounts, periodKeys, selectedOwnerId],
  )

  const gold = useMemo(
    () =>
      aggregateGoldForReport(goldHoldings ?? [], {
        periodKeys,
        selectedOwnerId,
        spotPaisePerGram: goldSpot?.pricePaisePerGram ?? 0,
      }),
    [goldHoldings, goldSpot, periodKeys, selectedOwnerId],
  )

  const { data: market } = useMarketHoldings()
  const marketAll = useMemo(() => market ?? [], [market])
  const quotes = useMarketQuotes(marketAll)
  const { data: pfAccounts } = usePfAccounts()

  const investments = useMemo<InvestmentsReport>(() => {
    const portfolioFor = (kind: 'stock' | 'mutual_fund') =>
      summarizeMarketPortfolio(
        marketAll
          .filter(
            (h) =>
              h.kind === kind &&
              (!selectedOwnerId || h.ownerId === selectedOwnerId),
          )
          .map((h) => ({
            quantity: h.quantity,
            investedPaise: h.investedPaise,
            pricePaisePerUnit:
              quotes.data?.quotes[quoteKey(h.kind, h.isin, h.symbol)] ?? null,
          })),
      )
    const pfPaise = summarizePf(
      (pfAccounts ?? []).filter(
        (p) => !selectedOwnerId || p.ownerId === selectedOwnerId,
      ),
      getCurrentIstDate(),
    ).projectedBalancePaise

    return buildInvestmentsReport(
      gold,
      portfolioFor('stock'),
      portfolioFor('mutual_fund'),
      pfPaise,
    )
  }, [gold, marketAll, selectedOwnerId, quotes.data, pfAccounts])

  const selectedMember = members?.find((m) => m.userId === selectedOwnerId)
  const viewLabel = selectedOwnerId
    ? (selectedMember?.profile?.fullName?.trim() ||
      selectedMember?.displayName?.trim() ||
      'Member')
    : 'Whole family'
  const periodLabel =
    periodType === 'month'
      ? formatMonthYear(`${selectedMonth}-01T12:00:00`)
      : `${financialYearLabel(fyStartYear)} · Apr ${fyStartYear} – Mar ${fyStartYear + 1}`

  const fyOptions = Array.from(
    { length: 6 },
    (_item, index) => getCurrentFinancialYearStart() - index,
  )

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-4 print:hidden">
        <PageHeader
          title="Reports"
          description="A monthly or financial-year summary you can print or save as PDF."
          actions={
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Print / Save PDF
            </Button>
          }
        />

        <Card>
          <CardContent className="space-y-4 p-4">
            {/* Period type */}
            <div className="grid grid-cols-2 gap-2 sm:max-w-xs">
              {(['month', 'fy'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setPeriodType(type)}
                  aria-pressed={periodType === type}
                  className={cn(
                    'rounded-md border p-2 text-sm font-medium transition-colors',
                    periodType === type
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'hover:bg-accent',
                  )}
                >
                  {type === 'month' ? 'Month' : 'Financial year'}
                </button>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {periodType === 'month' ? (
                <div className="space-y-1.5">
                  <Label htmlFor="report-month">Month</Label>
                  <Input
                    id="report-month"
                    type="month"
                    value={selectedMonth}
                    onChange={(event) => setSelectedMonth(event.target.value)}
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="report-fy">Financial year</Label>
                  <NativeSelect
                    id="report-fy"
                    value={String(fyStartYear)}
                    onChange={(value) => setFyStartYear(Number(value))}
                  >
                    {fyOptions.map((year) => (
                      <option key={year} value={year}>
                        {financialYearLabel(year)} (Apr {year} – Mar {year + 1})
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="report-view">View</Label>
                <NativeSelect
                  id="report-view"
                  value={selectedOwnerId ?? ''}
                  onChange={(value) => setSelectedOwnerId(value || null)}
                >
                  <option value="">Whole family</option>
                  {(members ?? []).map((member) => {
                    const name =
                      member.profile?.fullName?.trim() ||
                      member.displayName?.trim() ||
                      'Unknown'
                    return (
                      <option key={member.id} value={member.userId}>
                        {name}
                      </option>
                    )
                  })}
                </NativeSelect>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : isError ? (
        <ErrorState
          description="We could not build this report."
          onRetry={() => refetch()}
        />
      ) : (
        <div className="space-y-6">
          <ReportBody
            familyName={family?.name ?? 'Family'}
            periodLabel={periodLabel}
            viewLabel={viewLabel}
            totalIncome={report.totalIncome}
            totalExpense={report.totalExpense}
            netSaved={report.netSaved}
            byCategory={report.byCategory}
            byMember={report.byMember}
            monthlyRows={breakdown}
          />
          <InvestmentsReportCard report={investments} />
        </div>
      )}
    </div>
  )
}

interface ReportBodyProps {
  familyName: string
  periodLabel: string
  viewLabel: string
  totalIncome: number
  totalExpense: number
  netSaved: number
  byCategory: { categoryId: string; name: string; value: number }[]
  byMember: { userId: string; name: string; income: number; expense: number }[]
  monthlyRows: MonthRow[]
}

function ReportBody({
  familyName,
  periodLabel,
  viewLabel,
  totalIncome,
  totalExpense,
  netSaved,
  byCategory,
  byMember,
  monthlyRows,
}: ReportBodyProps) {
  return (
    <Card className="print:border-0 print:shadow-none">
      <CardContent className="space-y-6 p-6">
        <div className="space-y-1 border-b pb-4">
          <p className="text-muted-foreground text-sm">{familyName}</p>
          <h2 className="text-xl font-semibold">
            Financial report · {periodLabel}
          </h2>
          <p className="text-muted-foreground text-sm">
            View: {viewLabel} · Generated {formatDate(new Date())}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SummaryCell label="Income" value={formatPaise(totalIncome)} tone="positive" />
          <SummaryCell label="Spent" value={formatPaise(totalExpense)} tone="negative" />
          <SummaryCell
            label="Saved"
            value={formatPaise(netSaved)}
            tone={netSaved < 0 ? 'negative' : 'positive'}
          />
        </div>

        {monthlyRows.length > 0 ? (
          <section className="space-y-2">
            <h3 className="text-base font-semibold">Month by month</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b text-left">
                    <th className="py-2 font-medium">Month</th>
                    <th className="py-2 pl-4 text-right font-medium">Income</th>
                    <th className="py-2 pl-4 text-right font-medium">Spent</th>
                    <th className="py-2 pl-4 text-right font-medium">Saved</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyRows.map((row) => (
                    <tr key={row.key} className="border-b last:border-0">
                      <td className="py-2 pr-3 whitespace-nowrap">{row.label}</td>
                      <td className="py-2 pl-4 text-right tabular-nums whitespace-nowrap">
                        {formatPaise(row.income, { decimals: false })}
                      </td>
                      <td className="py-2 pl-4 text-right tabular-nums whitespace-nowrap">
                        {formatPaise(row.expense, { decimals: false })}
                      </td>
                      <td
                        className={cn(
                          'py-2 pl-4 text-right tabular-nums whitespace-nowrap',
                          row.net < 0 && 'text-destructive',
                        )}
                      >
                        {formatPaise(row.net, { decimals: false })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <section className="space-y-2">
          <h3 className="text-base font-semibold">Spending by category</h3>
          {byCategory.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No expenses recorded in this period.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b text-left">
                    <th className="py-2 font-medium">Category</th>
                    <th className="py-2 pl-3 text-right font-medium">Amount</th>
                    <th className="py-2 pl-3 text-right font-medium whitespace-nowrap">
                      % of spend
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {byCategory.map((row) => (
                    <tr key={row.categoryId} className="border-b last:border-0">
                      <td className="py-2 pr-3">{row.name}</td>
                      <td className="py-2 pl-3 text-right tabular-nums whitespace-nowrap">
                        {formatPaise(row.value)}
                      </td>
                      <td className="py-2 pl-3 text-right tabular-nums whitespace-nowrap">
                        {totalExpense > 0
                          ? `${((row.value / totalExpense) * 100).toFixed(1)}%`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td className="py-2 pr-3">Total</td>
                    <td className="py-2 pl-3 text-right tabular-nums whitespace-nowrap">
                      {formatPaise(totalExpense)}
                    </td>
                    <td className="py-2 pl-3 text-right tabular-nums">100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </section>

        {byMember.length > 0 ? (
          <section className="space-y-2">
            <h3 className="text-base font-semibold">By member</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b text-left">
                    <th className="py-2 font-medium">Member</th>
                    <th className="py-2 pl-4 text-right font-medium">Income</th>
                    <th className="py-2 pl-4 text-right font-medium">Spent</th>
                  </tr>
                </thead>
                <tbody>
                  {byMember.map((row) => (
                    <tr key={row.userId} className="border-b last:border-0">
                      <td className="py-2 pr-3">{row.name}</td>
                      <td className="py-2 pl-4 text-right tabular-nums whitespace-nowrap">
                        {formatPaise(row.income)}
                      </td>
                      <td className="py-2 pl-4 text-right tabular-nums whitespace-nowrap">
                        {formatPaise(row.expense)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </CardContent>
    </Card>
  )
}

/**
 * Investments is a SEPARATE card from the period financial report because a
 * portfolio's value is point-in-time, not period-bound. It shows a per-asset-class
 * (Gold / Stocks / Mutual Funds) "as of today" snapshot table.
 */
function InvestmentsReportCard({ report }: { report: InvestmentsReport }) {
  if (!report.hasAny) return null
  const totalUp = report.totalGainPaise >= 0

  const gainCell = (gainPaise: number, gainPct: number | null) => {
    if (gainPct == null) return '—'
    const up = gainPaise >= 0
    return `${up ? '+' : ''}${formatPaise(gainPaise, { decimals: false })} · ${up ? '+' : ''}${gainPct.toFixed(1)}%`
  }

  return (
    <Card className="print:border-0 print:shadow-none">
      <CardContent className="space-y-4 p-6">
        <div className="space-y-1 border-b pb-4">
          <h2 className="text-xl font-semibold">Investments</h2>
          <p className="text-muted-foreground text-sm">
            Holdings as of {formatDate(new Date())}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-left">
                <th className="py-2 font-medium">Asset</th>
                <th className="py-2 pl-4 text-right font-medium">Invested</th>
                <th className="py-2 pl-4 text-right font-medium">Current</th>
                <th className="py-2 pl-4 text-right font-medium">Gain</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr key={row.key} className="border-b last:border-0">
                  <td className="py-2 pr-3">
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{ backgroundColor: row.color }}
                      />
                      {row.label}
                    </span>
                  </td>
                  <td className="py-2 pl-4 text-right tabular-nums whitespace-nowrap">
                    {formatPaise(row.investedPaise, { decimals: false })}
                  </td>
                  <td className="py-2 pl-4 text-right tabular-nums whitespace-nowrap">
                    {row.priced
                      ? formatPaise(row.currentValuePaise, { decimals: false })
                      : '—'}
                  </td>
                  <td
                    className={cn(
                      'py-2 pl-4 text-right tabular-nums whitespace-nowrap',
                      row.gainPct != null &&
                        (row.gainPaise >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-destructive'),
                    )}
                  >
                    {gainCell(row.gainPaise, row.gainPct)}
                  </td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="py-2 pr-3">Total</td>
                <td className="py-2 pl-4 text-right tabular-nums whitespace-nowrap">
                  {formatPaise(report.totalInvestedPaise, { decimals: false })}
                </td>
                <td className="py-2 pl-4 text-right tabular-nums whitespace-nowrap">
                  {formatPaise(report.totalCurrentPaise, { decimals: false })}
                </td>
                <td
                  className={cn(
                    'py-2 pl-4 text-right tabular-nums whitespace-nowrap',
                    report.totalGainPct != null &&
                      (totalUp
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-destructive'),
                  )}
                >
                  {gainCell(report.totalGainPaise, report.totalGainPct)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function SummaryCell({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'positive' | 'negative'
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border p-3 sm:block">
      <p className="text-muted-foreground text-xs sm:mb-1">{label}</p>
      <p
        className={cn(
          'text-right text-base font-semibold tabular-nums break-words sm:text-left sm:text-lg',
          tone === 'negative'
            ? 'text-destructive'
            : 'text-emerald-600 dark:text-emerald-400',
        )}
      >
        {value}
      </p>
    </div>
  )
}

/** A native <select> styled like the app's inputs (avatars aren't needed here). */
function NativeSelect({
  id,
  value,
  onChange,
  children,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  children: ReactNode
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        'border-input flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
      )}
    >
      {children}
    </select>
  )
}
