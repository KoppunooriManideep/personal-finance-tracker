import { useMemo, useState } from 'react'
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ChevronDown,
  LayoutDashboard,
  Scale,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState } from '@/components/common/empty-state'
import { ErrorState } from '@/components/common/error-state'
import { LoadingSpinner } from '@/components/common/loading-spinner'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { formatMonthYear } from '@/lib/date'
import { formatPaise } from '@/lib/money'
import { useAccounts } from '@/features/accounts/hooks/use-accounts'
import { useCategories } from '@/features/categories/hooks/use-categories'
import { useDashboardData } from '@/features/dashboard/hooks/use-dashboard-data'
import { TransactionCard } from '@/features/transactions/components/transaction-card'
import type { Transaction } from '@/features/transactions/api/transaction-queries'
import type { AccountWithBalance } from '@/features/accounts/api/account-queries'
import type { Category } from '@/features/categories/api/category-queries'
import type {
  CategoryExpenseDatum,
  MemberIncomeExpenseDatum,
  MonthlyDatum,
  TrendDatum,
} from '@/features/dashboard/hooks/use-dashboard-data'

/** Dashboard with month-scoped reporting. Transfers are excluded from charts. */
export function DashboardPage() {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentIstMonth())

  const { data: accounts, isLoading: accountsLoading } = useAccounts()
  const { data: categories, isLoading: categoriesLoading } = useCategories()
  const {
    data: dashboard,
    isLoading: dashboardLoading,
    isError,
    refetch,
  } = useDashboardData(selectedMonth, categories)

  const accountsById = useMemo(
    () => new Map((accounts ?? []).map((account) => [account.id, account])),
    [accounts],
  )
  const categoriesById = useMemo(
    () =>
      new Map((categories ?? []).map((category) => [category.id, category])),
    [categories],
  )

  const isLoading = dashboardLoading || accountsLoading || categoriesLoading
  const hasAnyDashboardData =
    dashboard &&
    (dashboard.totalIncome > 0 ||
      dashboard.totalExpense > 0 ||
      dashboard.recentTransactions.length > 0)

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Dashboard"
        description="Income, expenses and recent activity at a glance."
        actions={
          <div className="space-y-1.5">
            <Label htmlFor="dashboard-month" className="sr-only">
              Month
            </Label>
            <Input
              id="dashboard-month"
              type="month"
              value={selectedMonth}
              onChange={(event) => {
                if (event.target.value) setSelectedMonth(event.target.value)
              }}
            />
          </div>
        }
      />

      {isLoading ? (
        <LoadingSpinner />
      ) : isError ? (
        <ErrorState
          description="We could not load your dashboard."
          onRetry={() => refetch()}
        />
      ) : !dashboard || !hasAnyDashboardData ? (
        <EmptyState
          icon={LayoutDashboard}
          title="Nothing to show yet"
          description="Once you add income, expenses or transfers, your dashboard will appear here."
        />
      ) : (
        <div className="space-y-6">
          <SummaryCards
            income={dashboard.totalIncome}
            expense={dashboard.totalExpense}
            net={dashboard.netBalance}
            selectedMonth={selectedMonth}
            memberIncomeExpense={dashboard.memberIncomeExpense}
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <ExpenseByCategoryChart data={dashboard.expenseByCategory} />
            <MonthlyIncomeExpenseChart data={dashboard.monthlyIncomeExpense} />
          </div>

          <SpendingTrendChart data={dashboard.spendingTrend} />

          <RecentTransactions
            transactions={dashboard.recentTransactions}
            accountsById={accountsById}
            categoriesById={categoriesById}
          />
        </div>
      )}
    </div>
  )
}

interface SummaryCardsProps {
  income: number
  expense: number
  net: number
  selectedMonth: string
  memberIncomeExpense: MemberIncomeExpenseDatum[]
}

function SummaryCards({
  income,
  expense,
  net,
  selectedMonth,
  memberIncomeExpense,
}: SummaryCardsProps) {
  const [expanded, setExpanded] = useState<'income' | 'expense' | null>(null)
  const incomeMembers = memberIncomeExpense.filter((member) => member.income > 0)
  const expenseMembers = memberIncomeExpense.filter(
    (member) => member.expense > 0,
  )
  const cards: SummaryCardConfig[] = [
    {
      id: 'income',
      label: 'Income',
      value: income,
      icon: ArrowUpCircle,
      className: 'text-emerald-600 dark:text-emerald-400',
      bgClassName: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
      members: incomeMembers,
      breakdownType: 'income',
    },
    {
      id: 'expense',
      label: 'Expense',
      value: expense,
      icon: ArrowDownCircle,
      className: 'text-rose-600 dark:text-rose-400',
      bgClassName: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
      members: expenseMembers,
      breakdownType: 'expense',
    },
    {
      id: 'net',
      label: 'Net balance',
      value: net,
      icon: Scale,
      className:
        net < 0
          ? 'text-rose-600 dark:text-rose-400'
          : 'text-sky-600 dark:text-sky-400',
      bgClassName:
        net < 0
          ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
          : 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
      members: [],
    },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {cards.map((card) => {
        const Icon = card.icon
        const canExpand = Boolean(card.breakdownType && card.members.length > 1)
        const isExpanded = expanded === card.breakdownType
        return (
          <Card key={card.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                    card.bgClassName,
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-muted-foreground text-sm">
                    {card.label}
                  </p>
                  <p
                    className={cn(
                      'text-xl font-semibold tabular-nums',
                      card.className,
                    )}
                  >
                    {formatPaise(card.value)}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {formatMonthYear(
                      new Date(`${selectedMonth}-01T00:00:00+05:30`),
                    )}
                  </p>
                </div>
              </div>

              {canExpand ? (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setExpanded(isExpanded ? null : card.breakdownType!)
                    }
                    className="text-muted-foreground hover:text-foreground mt-3 inline-flex items-center gap-1 text-xs transition-colors"
                    aria-expanded={isExpanded}
                  >
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5 transition-transform',
                        isExpanded && 'rotate-180',
                      )}
                    />
                    by member
                  </button>
                  <div
                    className={cn(
                      'grid overflow-hidden transition-all duration-200 ease-out',
                      isExpanded
                        ? 'mt-3 grid-rows-[1fr] opacity-100'
                        : 'mt-0 grid-rows-[0fr] opacity-0',
                    )}
                  >
                    <div className="min-h-0">
                      <MemberBreakdownList
                        members={card.members}
                        type={card.breakdownType!}
                      />
                    </div>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

interface SummaryCardConfig {
  id: 'income' | 'expense' | 'net'
  label: string
  value: number
  icon: typeof ArrowUpCircle
  className: string
  bgClassName: string
  members: MemberIncomeExpenseDatum[]
  breakdownType?: 'income' | 'expense'
}

function MemberBreakdownList({
  members,
  type,
}: {
  members: MemberIncomeExpenseDatum[]
  type: 'income' | 'expense'
}) {
  const amountClassName =
    type === 'income'
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-rose-600 dark:text-rose-400'

  return (
    <ul className="border-border/70 space-y-2 border-t pt-3">
      {members.map((member) => (
        <li
          key={member.userId}
          className="flex items-center justify-between gap-2 text-sm"
        >
          <div className="flex min-w-0 items-center gap-2">
            <Avatar size="sm">
              <AvatarImage src={member.avatarUrl ?? undefined} alt={member.name} />
              <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
            </Avatar>
            <span className="truncate">{getFirstName(member.name)}</span>
          </div>
          <span className={cn('shrink-0 font-medium tabular-nums', amountClassName)}>
            {formatPaise(type === 'income' ? member.income : member.expense)}
          </span>
        </li>
      ))}
    </ul>
  )
}

function ExpenseByCategoryChart({ data }: { data: CategoryExpenseDatum[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Expense by category</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <ChartEmptyState text="No expenses this month" />
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={58}
                  outerRadius={92}
                  paddingAngle={2}
                >
                  {data.map((entry) => (
                    <Cell key={entry.categoryId} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatPaise(Number(value))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function MonthlyIncomeExpenseChart({ data }: { data: MonthlyDatum[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly income vs expense</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) =>
                  formatPaise(Number(value), { decimals: false })
                }
              />
              <Tooltip formatter={(value) => formatPaise(Number(value))} />
              <Legend />
              <Bar dataKey="income" name="Income" fill="#16a34a" radius={4} />
              <Bar dataKey="expense" name="Expense" fill="#e11d48" radius={4} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

function SpendingTrendChart({ data }: { data: TrendDatum[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Spending trend</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) =>
                  formatPaise(Number(value), { decimals: false })
                }
              />
              <Tooltip formatter={(value) => formatPaise(Number(value))} />
              <Line
                type="monotone"
                dataKey="expense"
                name="Expense"
                stroke="#2563eb"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

interface RecentTransactionsProps {
  transactions: Transaction[]
  accountsById: Map<string, AccountWithBalance>
  categoriesById: Map<string, Category>
}

function RecentTransactions({
  transactions,
  accountsById,
  categoriesById,
}: RecentTransactionsProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">
          Recent transactions
        </h2>
        <p className="text-muted-foreground text-sm">Last 5</p>
      </div>

      {transactions.length === 0 ? (
        <EmptyState
          icon={LayoutDashboard}
          title="No recent transactions"
          description="Recent income, expenses and transfers will appear here."
        />
      ) : (
        <div className="space-y-2">
          {transactions.map((transaction) => (
            <TransactionCard
              key={transaction.id}
              transaction={transaction}
              accountsById={accountsById}
              categoriesById={categoriesById}
              canManage={false}
              onEdit={() => undefined}
              onDelete={() => undefined}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function ChartEmptyState({ text }: { text: string }) {
  return (
    <div className="border-border bg-muted/30 text-muted-foreground flex h-72 items-center justify-center rounded-md border border-dashed text-sm">
      {text}
    </div>
  )
}

function getCurrentIstMonth(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date())
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  return `${year}-${month}`
}

function getFirstName(name: string): string {
  return name.trim().split(/\s+/)[0] || 'Unknown'
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return name.slice(0, 2).toUpperCase()
}
