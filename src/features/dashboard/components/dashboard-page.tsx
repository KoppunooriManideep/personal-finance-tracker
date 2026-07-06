import { useMemo, useState } from 'react'
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ChevronDown,
  Info,
  LayoutDashboard,
  Scale,
  Users,
  WalletCards,
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
  Tooltip as RechartsTooltip,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { formatMonthYear } from '@/lib/date'
import { formatPaise } from '@/lib/money'
import { useAccounts } from '@/features/accounts/hooks/use-accounts'
import { useCategories } from '@/features/categories/hooks/use-categories'
import { useDashboardData } from '@/features/dashboard/hooks/use-dashboard-data'
import { TransactionCard } from '@/features/transactions/components/transaction-card'
import { useFamilyMembers } from '@/features/family/hooks/use-family-members'
import { useDashboardStore } from '@/stores/dashboard-store'
import type { Transaction } from '@/features/transactions/api/transaction-queries'
import type { AccountWithBalance } from '@/features/accounts/api/account-queries'
import type { Category } from '@/features/categories/api/category-queries'
import type { FamilyMember } from '@/features/family/api/family-queries'
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
  const { data: familyMembers, isLoading: familyMembersLoading } = useFamilyMembers()
  const { selectedOwnerId, setSelectedOwnerId } = useDashboardStore()

  const {
    data: dashboard,
    isLoading: dashboardLoading,
    isError,
    refetch,
  } = useDashboardData(
    selectedMonth,
    categories,
    accounts,
    familyMembers,
    selectedOwnerId,
  )

  const accountsById = useMemo(
    () => new Map((accounts ?? []).map((account) => [account.id, account])),
    [accounts],
  )
  const categoriesById = useMemo(
    () =>
      new Map((categories ?? []).map((category) => [category.id, category])),
    [categories],
  )

  const selectedMember = useMemo(() => {
    return familyMembers?.find((m) => m.userId === selectedOwnerId)
  }, [familyMembers, selectedOwnerId])

  const filteredAccounts = useMemo(() => {
    if (!accounts) return []
    if (!selectedOwnerId) return accounts
    return accounts.filter((account) => account.ownerId === selectedOwnerId)
  }, [accounts, selectedOwnerId])

  const isLoading =
    dashboardLoading ||
    accountsLoading ||
    categoriesLoading ||
    familyMembersLoading
  const hasAnyDashboardData =
    dashboard &&
    ((accounts?.length ?? 0) > 0 ||
      dashboard.totalIncome > 0 ||
      dashboard.totalExpense > 0 ||
      dashboard.recentTransactions.length > 0)

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Dashboard"
        description="Income, expenses and recent activity at a glance."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-muted p-0.5">
              <button
                type="button"
                onClick={() => setSelectedOwnerId(null)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                  selectedOwnerId === null
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Users className="h-3.5 w-3.5" />
                <span>Family</span>
              </button>
              {familyMembers?.map((member) => {
                const isSelected = selectedOwnerId === member.userId
                const name = member.profile?.fullName || member.displayName || 'Unknown'
                const firstName = getFirstName(name)
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => setSelectedOwnerId(member.userId)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all',
                      isSelected
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <Avatar size="sm" className="h-4 w-4">
                      <AvatarImage src={member.profile?.avatarUrl ?? undefined} alt={name} />
                      <AvatarFallback className="text-[9px] font-bold">
                        {getInitials(name)}
                      </AvatarFallback>
                    </Avatar>
                    <span>{firstName}</span>
                  </button>
                )
              })}
            </div>

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
                className="w-[140px]"
              />
            </div>
          </div>
        }
      />

      {selectedOwnerId && selectedMember && (
        <div className="bg-sky-500/5 text-sky-700 dark:text-sky-300 border border-sky-500/10 rounded-lg p-3 text-xs flex items-center gap-2">
          <Info className="h-4 w-4 shrink-0 text-sky-500" />
          <span>
            Showing only accounts owned by <strong>{getFirstName(selectedMember.profile?.fullName || selectedMember.displayName || 'this member')}</strong>. Shared/Family accounts are excluded.
          </span>
        </div>
      )}

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
            accounts={filteredAccounts}
            selectedMonth={selectedMonth}
            memberIncomeExpense={dashboard.memberIncomeExpense}
            familyMembers={familyMembers ?? []}
            selectedOwnerId={selectedOwnerId}
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
  accounts: AccountWithBalance[]
  selectedMonth: string
  memberIncomeExpense: MemberIncomeExpenseDatum[]
  familyMembers: FamilyMember[]
  selectedOwnerId: string | null
}

function SummaryCards({
  income,
  expense,
  net,
  accounts,
  selectedMonth,
  memberIncomeExpense,
  familyMembers,
  selectedOwnerId,
}: SummaryCardsProps) {
  const [expanded, setExpanded] = useState<
    'balance' | 'income' | 'expense' | null
  >(null)
  const totalBalance = accounts.reduce(
    (sum, account) => sum + account.currentBalance,
    0,
  )

  const showBalanceByMember = selectedOwnerId === null

  const balanceByMember = useMemo(() => {
    if (!showBalanceByMember) return []

    const memberBalances: MemberBalanceDatum[] = []
    const groups = new Map<string | null, number>()
    accounts.forEach((account) => {
      const key = account.ownerId
      groups.set(key, (groups.get(key) ?? 0) + account.currentBalance)
    })

    familyMembers.forEach((member) => {
      const bal = groups.get(member.userId) ?? 0
      if (bal !== 0) {
        memberBalances.push({
          userId: member.userId,
          name: member.profile?.fullName?.trim() || member.displayName?.trim() || 'Unknown',
          avatarUrl: member.profile?.avatarUrl ?? null,
          balance: bal,
        })
      }
      groups.delete(member.userId)
    })

    groups.forEach((bal, key) => {
      if (bal !== 0) {
        if (key === null) {
          memberBalances.push({
            userId: null,
            name: 'Shared / Family',
            avatarUrl: null,
            balance: bal,
          })
        } else {
          memberBalances.push({
            userId: key,
            name: 'Unknown Member',
            avatarUrl: null,
            balance: bal,
          })
        }
      }
    })

    return memberBalances.sort((a, b) => b.balance - a.balance)
  }, [accounts, familyMembers, showBalanceByMember])

  const hasSharedAccounts = accounts.some((acc) => acc.ownerId === null)
  const hideBalanceToggle = showBalanceByMember && ((familyMembers?.length ?? 0) <= 1 && !hasSharedAccounts)

  const selectedMember = familyMembers?.find((m) => m.userId === selectedOwnerId)
  const memberName = selectedMember
    ? getFirstName(selectedMember.profile?.fullName || selectedMember.displayName || '')
    : ''
  const balanceSubtitle = selectedOwnerId
    ? `For ${memberName} (now)`
    : 'Across all accounts (now)'

  const incomeMembers = memberIncomeExpense.filter((member) => member.income > 0)
  const expenseMembers = memberIncomeExpense.filter(
    (member) => member.expense > 0,
  )
  const monthLabel = formatMonthYear(
    new Date(`${selectedMonth}-01T00:00:00+05:30`),
  )
  const cards: SummaryCardConfig[] = [
    {
      id: 'balance',
      label: 'Total Balance',
      subtitle: balanceSubtitle,
      value: totalBalance,
      icon: WalletCards,
      className:
        totalBalance < 0
          ? 'text-rose-600 dark:text-rose-400'
          : 'text-foreground',
      bgClassName: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
      members: [],
      accounts,
      tooltip: 'Money you have across all accounts right now.',
    },
    {
      id: 'income',
      label: 'Income this month',
      subtitle: monthLabel,
      value: income,
      icon: ArrowUpCircle,
      className: 'text-emerald-600 dark:text-emerald-400',
      bgClassName: 'bg-emerald-500/10 text-emerald-700 dark:text-sky-300',
      members: incomeMembers,
      breakdownType: 'income',
    },
    {
      id: 'expense',
      label: 'Spent this month',
      subtitle: monthLabel,
      value: expense,
      icon: ArrowDownCircle,
      className: 'text-rose-600 dark:text-rose-400',
      bgClassName: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
      members: expenseMembers,
      breakdownType: 'expense',
    },
    {
      id: 'net',
      label: 'Saved this month',
      subtitle: 'Income - Spent',
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
      tooltip: "What's left after this month's spending.",
    },
  ]

  return (
    <TooltipProvider>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon
          const isBalanceCard = card.id === 'balance'

          const canExpand = isBalanceCard
            ? (showBalanceByMember
                ? (!hideBalanceToggle && balanceByMember.length > 1)
                : (card.accounts && card.accounts.length > 1))
            : Boolean(card.breakdownType && card.members.length > 1)

          const expandKey = isBalanceCard ? 'balance' : card.breakdownType
          const isExpanded = Boolean(expandKey && expanded === expandKey)
          const toggleLabel = isBalanceCard
            ? (showBalanceByMember ? 'by member' : 'by account')
            : 'by member'

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
                    <div className="flex items-center gap-1.5">
                      <p className="text-muted-foreground text-sm">
                        {card.label}
                      </p>
                      {card.tooltip ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="text-muted-foreground hover:text-foreground inline-flex rounded-full transition-colors"
                              aria-label={`${card.label} info`}
                            >
                              <Info className="h-3.5 w-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>{card.tooltip}</TooltipContent>
                        </Tooltip>
                      ) : null}
                    </div>
                    <p
                      className={cn(
                        'text-xl font-semibold tabular-nums',
                        card.className,
                      )}
                    >
                      {formatPaise(card.value)}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {card.subtitle}
                    </p>
                  </div>
                </div>

                {canExpand ? (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setExpanded(isExpanded ? null : expandKey!)
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
                      {toggleLabel}
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
                        {isBalanceCard ? (
                          showBalanceByMember ? (
                            <MemberBalanceBreakdownList members={balanceByMember} />
                          ) : (
                            <AccountBreakdownList accounts={card.accounts!} />
                          )
                        ) : (
                          <MemberBreakdownList
                            members={card.members}
                            type={card.breakdownType!}
                          />
                        )}
                      </div>
                    </div>
                  </>
                ) : null}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </TooltipProvider>
  )
}

interface SummaryCardConfig {
  id: 'balance' | 'income' | 'expense' | 'net'
  label: string
  subtitle: string
  value: number
  icon: typeof ArrowUpCircle
  className: string
  bgClassName: string
  members: MemberIncomeExpenseDatum[]
  accounts?: AccountWithBalance[]
  breakdownType?: 'income' | 'expense'
  tooltip?: string
}

interface MemberBalanceDatum {
  userId: string | null
  name: string
  avatarUrl: string | null
  balance: number
}

function MemberBalanceBreakdownList({
  members,
}: {
  members: MemberBalanceDatum[]
}) {
  return (
    <ul className="border-border/70 space-y-2 border-t pt-3">
      {members.map((member) => (
        <li
          key={member.userId ?? 'shared'}
          className="flex items-center justify-between gap-2 text-sm"
        >
          <div className="flex min-w-0 items-center gap-2">
            <Avatar size="sm">
              <AvatarImage src={member.avatarUrl ?? undefined} alt={member.name} />
              <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
            </Avatar>
            <span className="truncate">{getFirstName(member.name)}</span>
          </div>
          <span
            className={cn(
              'shrink-0 font-medium tabular-nums',
              member.balance < 0
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-foreground',
            )}
          >
            {formatPaise(member.balance)}
          </span>
        </li>
      ))}
    </ul>
  )
}

function AccountBreakdownList({
  accounts,
}: {
  accounts: AccountWithBalance[]
}) {
  return (
    <ul className="border-border/70 space-y-2 border-t pt-3">
      {accounts.map((account) => (
        <li
          key={account.id}
          className="flex items-center justify-between gap-2 text-sm"
        >
          <span className="truncate">{account.name}</span>
          <span
            className={cn(
              'shrink-0 font-medium tabular-nums',
              account.currentBalance < 0
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-foreground',
            )}
          >
            {formatPaise(account.currentBalance)}
          </span>
        </li>
      ))}
    </ul>
  )
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
                <RechartsTooltip formatter={(value) => formatPaise(Number(value))} />
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
              <RechartsTooltip formatter={(value) => formatPaise(Number(value))} />
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
              <RechartsTooltip formatter={(value) => formatPaise(Number(value))} />
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
