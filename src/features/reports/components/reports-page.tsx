import { useState } from 'react'
import { Printer } from 'lucide-react'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState } from '@/components/common/empty-state'
import { ErrorState } from '@/components/common/error-state'
import { LoadingSpinner } from '@/components/common/loading-spinner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { formatPaise } from '@/lib/money'
import { formatDate, formatMonthYear, getCurrentIstMonth } from '@/lib/date'
import { useCurrentFamily } from '@/features/family/hooks/use-current-family'
import { useFamilyMembers } from '@/features/family/hooks/use-family-members'
import { useAccounts } from '@/features/accounts/hooks/use-accounts'
import { useCategories } from '@/features/categories/hooks/use-categories'
import { useDashboardData } from '@/features/dashboard/hooks/use-dashboard-data'
import { useDashboardStore } from '@/stores/dashboard-store'

/** A printable monthly financial summary that reuses the dashboard aggregates. */
export function ReportsPage() {
  const { data: family } = useCurrentFamily()
  const { selectedOwnerId, setSelectedOwnerId } = useDashboardStore()
  const [selectedMonth, setSelectedMonth] = useState(getCurrentIstMonth())

  const { data: members } = useFamilyMembers()
  const { data: accounts } = useAccounts()
  const { data: categories } = useCategories()

  const {
    data: report,
    isLoading,
    isError,
    refetch,
  } = useDashboardData(
    selectedMonth,
    categories,
    accounts,
    members,
    selectedOwnerId,
  )

  const selectedMember = members?.find((m) => m.userId === selectedOwnerId)
  const viewLabel = selectedOwnerId
    ? (selectedMember?.profile?.fullName?.trim() ||
      selectedMember?.displayName?.trim() ||
      'Member')
    : 'Whole family'
  const monthLabel = formatMonthYear(`${selectedMonth}-01T12:00:00`)

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-4 print:hidden">
        <PageHeader
          title="Reports"
          description="A monthly summary you can print or save as PDF."
          actions={
            report ? (
              <Button variant="outline" onClick={() => window.print()}>
                <Printer className="h-4 w-4" />
                Print / Save PDF
              </Button>
            ) : undefined
          }
        />

        <Card>
          <CardContent className="grid gap-4 p-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="report-month">Month</Label>
              <Input
                id="report-month"
                type="month"
                value={selectedMonth}
                onChange={(event) => setSelectedMonth(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="report-view">View</Label>
              <select
                id="report-view"
                value={selectedOwnerId ?? ''}
                onChange={(event) =>
                  setSelectedOwnerId(event.target.value || null)
                }
                className={cn(
                  'border-input flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none',
                  'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
                )}
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
              </select>
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : isError ? (
        <ErrorState
          description="We could not build this report."
          onRetry={() => refetch()}
        />
      ) : !report ? (
        <EmptyState
          icon={Printer}
          title="No report yet"
          description="Pick a month to see its summary."
        />
      ) : (
        <ReportBody
          familyName={family?.name ?? 'Family'}
          monthLabel={monthLabel}
          viewLabel={viewLabel}
          totalIncome={report.totalIncome}
          totalExpense={report.totalExpense}
          netBalance={report.netBalance}
          expenseByCategory={report.expenseByCategory}
          memberIncomeExpense={report.memberIncomeExpense}
        />
      )}
    </div>
  )
}

interface ReportBodyProps {
  familyName: string
  monthLabel: string
  viewLabel: string
  totalIncome: number
  totalExpense: number
  netBalance: number
  expenseByCategory: { categoryId: string; name: string; value: number }[]
  memberIncomeExpense: {
    userId: string
    name: string
    income: number
    expense: number
  }[]
}

function ReportBody({
  familyName,
  monthLabel,
  viewLabel,
  totalIncome,
  totalExpense,
  netBalance,
  expenseByCategory,
  memberIncomeExpense,
}: ReportBodyProps) {
  return (
    <Card className="print:border-0 print:shadow-none">
      <CardContent className="space-y-6 p-6">
        {/* Report header */}
        <div className="space-y-1 border-b pb-4">
          <p className="text-muted-foreground text-sm">{familyName}</p>
          <h2 className="text-xl font-semibold">Financial report · {monthLabel}</h2>
          <p className="text-muted-foreground text-sm">
            View: {viewLabel} · Generated {formatDate(new Date())}
          </p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <SummaryCell label="Income" value={formatPaise(totalIncome)} tone="positive" />
          <SummaryCell label="Spent" value={formatPaise(totalExpense)} tone="negative" />
          <SummaryCell
            label="Saved"
            value={formatPaise(netBalance)}
            tone={netBalance < 0 ? 'negative' : 'positive'}
          />
        </div>

        {/* Spending by category */}
        <section className="space-y-2">
          <h3 className="text-base font-semibold">Spending by category</h3>
          {expenseByCategory.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No expenses recorded this month.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-left">
                  <th className="py-2 font-medium">Category</th>
                  <th className="py-2 text-right font-medium">Amount</th>
                  <th className="py-2 text-right font-medium">% of spend</th>
                </tr>
              </thead>
              <tbody>
                {expenseByCategory.map((row) => (
                  <tr key={row.categoryId} className="border-b last:border-0">
                    <td className="py-2">{row.name}</td>
                    <td className="py-2 text-right tabular-nums">
                      {formatPaise(row.value)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {totalExpense > 0
                        ? `${((row.value / totalExpense) * 100).toFixed(1)}%`
                        : '—'}
                    </td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="py-2">Total</td>
                  <td className="py-2 text-right tabular-nums">
                    {formatPaise(totalExpense)}
                  </td>
                  <td className="py-2 text-right tabular-nums">100%</td>
                </tr>
              </tbody>
            </table>
          )}
        </section>

        {/* By member */}
        {memberIncomeExpense.length > 0 ? (
          <section className="space-y-2">
            <h3 className="text-base font-semibold">By member</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-left">
                  <th className="py-2 font-medium">Member</th>
                  <th className="py-2 text-right font-medium">Income</th>
                  <th className="py-2 text-right font-medium">Spent</th>
                </tr>
              </thead>
              <tbody>
                {memberIncomeExpense.map((row) => (
                  <tr key={row.userId} className="border-b last:border-0">
                    <td className="py-2">{row.name}</td>
                    <td className="py-2 text-right tabular-nums">
                      {formatPaise(row.income)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatPaise(row.expense)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}
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
    <div className="rounded-lg border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p
        className={cn(
          'mt-1 text-base font-semibold tabular-nums sm:text-lg',
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
