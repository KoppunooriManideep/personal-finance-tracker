import { useMemo, useState } from 'react'
import { Plus, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState } from '@/components/common/empty-state'
import { ErrorState } from '@/components/common/error-state'
import { LoadingSpinner } from '@/components/common/loading-spinner'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { formatPaise } from '@/lib/money'
import { useCurrentFamily } from '@/features/family/hooks/use-current-family'
import { useAccounts } from '@/features/accounts/hooks/use-accounts'
import { useDeleteAccount } from '@/features/accounts/hooks/use-account-mutations'
import { AccountCard } from '@/features/accounts/components/account-card'
import { AccountFormDialog } from '@/features/accounts/components/account-form-dialog'
import type { AccountWithBalance } from '@/features/accounts/api/account-queries'

/** Accounts list with create, edit and soft-delete. */
export function AccountsPage() {
  const { data: family } = useCurrentFamily()
  const canManage = family?.role === 'owner' || family?.role === 'member'

  const { data: accounts, isLoading, isError, refetch } = useAccounts()
  const deleteAccount = useDeleteAccount()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<AccountWithBalance | null>(null)
  const [toDelete, setToDelete] = useState<AccountWithBalance | null>(null)

  const totalBalance = useMemo(
    () => (accounts ?? []).reduce((sum, a) => sum + a.currentBalance, 0),
    [accounts],
  )

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (account: AccountWithBalance) => {
    setEditing(account)
    setFormOpen(true)
  }

  const handleDelete = async () => {
    if (!toDelete) return
    try {
      await deleteAccount.mutateAsync(toDelete.id)
      toast.success('Account deleted')
    } catch (error) {
      toast.error('Could not delete account')
      console.error(error)
    } finally {
      setToDelete(null)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Accounts"
        description="Cash, bank, credit card and wallet balances."
        actions={
          canManage ? (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add account
            </Button>
          ) : undefined
        }
      />

      {isLoading ? (
        <LoadingSpinner />
      ) : isError ? (
        <ErrorState
          description="We could not load your accounts."
          onRetry={() => refetch()}
        />
      ) : !accounts || accounts.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No accounts yet"
          description="Add a cash, bank, credit card or wallet account to start tracking."
          action={
            canManage ? (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Add account
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-muted-foreground text-sm">Total balance</p>
                <p
                  className={cn(
                    'text-2xl font-semibold tabular-nums',
                    totalBalance < 0 && 'text-destructive',
                  )}
                >
                  {formatPaise(totalBalance)}
                </p>
              </div>
              <p className="text-muted-foreground text-sm">
                {accounts.length}{' '}
                {accounts.length === 1 ? 'account' : 'accounts'}
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {accounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                canManage={canManage}
                onEdit={openEdit}
                onDelete={setToDelete}
              />
            ))}
          </div>
        </div>
      )}

      <AccountFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        account={editing}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Delete account?"
        description={
          toDelete
            ? `“${toDelete.name}” will be removed. This can’t be undone from the app.`
            : undefined
        }
        confirmLabel="Delete"
        destructive
        loading={deleteAccount.isPending}
        onConfirm={handleDelete}
      />
    </div>
  )
}
