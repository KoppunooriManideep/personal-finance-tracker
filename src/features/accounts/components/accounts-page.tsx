import { useMemo, useState } from 'react'
import { Plus, Users, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState } from '@/components/common/empty-state'
import { ErrorState } from '@/components/common/error-state'
import { LoadingSpinner } from '@/components/common/loading-spinner'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { formatPaise } from '@/lib/money'
import { useCurrentFamily } from '@/features/family/hooks/use-current-family'
import { useFamilyMembers } from '@/features/family/hooks/use-family-members'
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
  const {
    data: familyMembers,
    isLoading: membersLoading,
    isError: membersError,
    refetch: refetchMembers,
  } = useFamilyMembers()
  const deleteAccount = useDeleteAccount()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<AccountWithBalance | null>(null)
  const [toDelete, setToDelete] = useState<AccountWithBalance | null>(null)

  const totalBalance = useMemo(
    () => (accounts ?? []).reduce((sum, a) => sum + a.currentBalance, 0),
    [accounts],
  )
  const groupedAccounts = useMemo(
    () => groupAccountsByOwner(accounts ?? [], familyMembers ?? []),
    [accounts, familyMembers],
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

      {isLoading || membersLoading ? (
        <LoadingSpinner />
      ) : isError || membersError ? (
        <ErrorState
          description="We could not load your accounts."
          onRetry={() => {
            refetch()
            refetchMembers()
          }}
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

          <div className="space-y-6">
            {groupedAccounts.map((group) => (
              <section key={group.id} className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    {group.avatarUrl || group.id !== 'shared' ? (
                      <Avatar>
                        <AvatarImage
                          src={group.avatarUrl ?? undefined}
                          alt={group.name}
                        />
                        <AvatarFallback>{getInitials(group.name)}</AvatarFallback>
                      </Avatar>
                    ) : (
                      <span className="bg-muted text-muted-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
                        <Users className="h-5 w-5" />
                      </span>
                    )}
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold">
                        {group.name}
                      </h2>
                      <p className="text-muted-foreground text-sm">
                        {group.accounts.length}{' '}
                        {group.accounts.length === 1 ? 'account' : 'accounts'}
                      </p>
                    </div>
                  </div>
                  <p
                    className={cn(
                      'shrink-0 font-semibold tabular-nums',
                      group.subtotal < 0 && 'text-destructive',
                    )}
                  >
                    {formatPaise(group.subtotal)}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {group.accounts.map((account) => (
                    <AccountCard
                      key={account.id}
                      account={account}
                      canManage={canManage}
                      onEdit={openEdit}
                      onDelete={setToDelete}
                    />
                  ))}
                </div>
              </section>
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

interface AccountOwnerGroup {
  id: string
  name: string
  avatarUrl: string | null
  accounts: AccountWithBalance[]
  subtotal: number
}

function groupAccountsByOwner(
  accounts: AccountWithBalance[],
  familyMembers: ReturnType<typeof useFamilyMembers>['data'],
): AccountOwnerGroup[] {
  const membersByUserId = new Map(
    (familyMembers ?? []).map((member) => [member.userId, member]),
  )
  const groups = new Map<string, AccountOwnerGroup>()

  const ensureGroup = (account: AccountWithBalance) => {
    if (!account.ownerId) {
      const existing = groups.get('shared')
      if (existing) return existing

      const shared: AccountOwnerGroup = {
        id: 'shared',
        name: 'Shared / Family',
        avatarUrl: null,
        accounts: [],
        subtotal: 0,
      }
      groups.set(shared.id, shared)
      return shared
    }

    const member = membersByUserId.get(account.ownerId)
    const name =
      member?.profile?.fullName?.trim() ||
      member?.displayName?.trim() ||
      'Unknown'
    const existing = groups.get(account.ownerId)
    if (existing) return existing

    const group: AccountOwnerGroup = {
      id: account.ownerId,
      name,
      avatarUrl: member?.profile?.avatarUrl ?? null,
      accounts: [],
      subtotal: 0,
    }
    groups.set(group.id, group)
    return group
  }

  accounts.forEach((account) => {
    const group = ensureGroup(account)
    group.accounts.push(account)
    group.subtotal += account.currentBalance
  })

  return Array.from(groups.values()).sort((a, b) => {
    if (a.id === 'shared') return -1
    if (b.id === 'shared') return 1
    return a.name.localeCompare(b.name)
  })
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return name.slice(0, 2).toUpperCase()
}
