import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Landmark, MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react'
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatPaise } from '@/lib/money'
import { formatDate, getCurrentIstDate } from '@/lib/date'
import { paths } from '@/config/paths'
import { useCurrentFamily } from '@/features/family/hooks/use-current-family'
import {
  usePfAccounts,
  useDeletePfAccount,
} from '@/features/investments/hooks/use-pf-accounts'
import { projectPf, summarizePf } from '@/features/investments/pf-math'
import { pfKindLabel } from '@/features/investments/pf-config'
import { PfFormDialog } from '@/features/investments/components/pf-form-dialog'
import type { PfAccount } from '@/features/investments/api/pf-queries'

/** Investments · Provident Fund: projected balances for EPF/PPF/VPF/NPS. */
export function PfPage() {
  const { data: family } = useCurrentFamily()
  const canManage = family?.role === 'owner' || family?.role === 'member'
  const today = getCurrentIstDate()

  const { data: accounts, isLoading, isError, refetch } = usePfAccounts()
  const deletePf = useDeletePfAccount()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<PfAccount | null>(null)
  const [toDelete, setToDelete] = useState<PfAccount | null>(null)

  const list = useMemo(() => accounts ?? [], [accounts])
  const summary = useMemo(() => summarizePf(list, today), [list, today])
  const hasAny = list.length > 0

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (a: PfAccount) => {
    setEditing(a)
    setFormOpen(true)
  }
  const handleDelete = async () => {
    if (!toDelete) return
    try {
      await deletePf.mutateAsync(toDelete.id)
      toast.success('PF deleted')
    } catch (error) {
      toast.error('Could not delete PF')
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
        title="Provident Fund"
        description="EPF / PPF / VPF / NPS — a balance that grows with your monthly contribution."
        actions={
          canManage && hasAny ? (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add PF
            </Button>
          ) : undefined
        }
      />

      {isLoading ? (
        <LoadingSpinner />
      ) : isError ? (
        <ErrorState
          description="We could not load your PF accounts."
          onRetry={() => refetch()}
        />
      ) : !hasAny ? (
        <EmptyState
          icon={Landmark}
          title="No PF yet"
          description="Add your EPF/PPF and its monthly contribution — we'll project the balance forward for you."
          action={
            canManage ? (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Add PF
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-6">
          <Card>
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="text-muted-foreground text-xs">
                  Total balance · estimated today
                </p>
                <p className="text-2xl font-semibold tabular-nums break-words">
                  {formatPaise(summary.projectedBalancePaise, { decimals: false })}
                </p>
              </div>
              <p className="text-muted-foreground shrink-0 text-sm">
                {summary.count} {summary.count === 1 ? 'account' : 'accounts'}
              </p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {list.map((account) => (
              <PfCard
                key={account.id}
                account={account}
                today={today}
                canManage={canManage}
                onEdit={openEdit}
                onDelete={setToDelete}
              />
            ))}
          </div>

          <p className="text-muted-foreground text-xs">
            Balances are estimated from your last entry + monthly contribution.
            Reconcile occasionally by editing the balance to the real figure.
          </p>
        </div>
      )}

      <PfFormDialog open={formOpen} onOpenChange={setFormOpen} account={editing} />

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Delete PF account?"
        description="This PF entry will be removed. This can’t be undone from the app."
        confirmLabel="Delete"
        destructive
        loading={deletePf.isPending}
        onConfirm={handleDelete}
      />
    </div>
  )
}

function PfCard({
  account,
  today,
  canManage,
  onEdit,
  onDelete,
}: {
  account: PfAccount
  today: string
  canManage: boolean
  onEdit: (a: PfAccount) => void
  onDelete: (a: PfAccount) => void
}) {
  const projection = projectPf(account, today)
  const grown = projection.projectedBalancePaise - account.balancePaise
  const title = account.name?.trim() || pfKindLabel(account.kind)

  return (
    <Card>
      <CardContent className="flex items-start gap-2 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium md:text-base">{title}</p>
            <span className="text-muted-foreground bg-muted shrink-0 rounded-full px-2 py-0.5 text-xs">
              {pfKindLabel(account.kind)}
            </span>
          </div>

          <p className="mt-2 text-lg font-semibold tabular-nums break-words">
            {formatPaise(projection.projectedBalancePaise, { decimals: false })}
          </p>

          <p className="text-muted-foreground mt-0.5 text-xs">
            {grown > 0
              ? `+${formatPaise(grown, { decimals: false })} since ${formatDate(`${account.asOf}T12:00:00`)}`
              : `as of ${formatDate(`${account.asOf}T12:00:00`)}`}
          </p>

          <p className="text-muted-foreground mt-1 text-xs tabular-nums">
            Balance {formatPaise(account.balancePaise, { decimals: false })}
            {account.monthlyContributionPaise > 0
              ? ` · +${formatPaise(account.monthlyContributionPaise, { decimals: false })}/mo`
              : ''}
            {account.annualRatePercent > 0 ? ` · ${account.annualRatePercent}%` : ''}
          </p>
        </div>

        {canManage ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="-mr-1 shrink-0"
                aria-label={`Actions for ${title}`}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(account)}>
                <Pencil className="h-4 w-4" />
                Edit / update balance
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => onDelete(account)}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </CardContent>
    </Card>
  )
}
