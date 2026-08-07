import { useMemo, useState } from 'react'
import { Coins, Plus, Users } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState } from '@/components/common/empty-state'
import { ErrorState } from '@/components/common/error-state'
import { LoadingSpinner } from '@/components/common/loading-spinner'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { formatPaise } from '@/lib/money'
import { useCurrentFamily } from '@/features/family/hooks/use-current-family'
import { useFamilyMembers } from '@/features/family/hooks/use-family-members'
import { useChits } from '@/features/chits/hooks/use-chits'
import { useChitPayments } from '@/features/chits/hooks/use-chit-payments'
import { groupPaymentsByChit } from '@/features/chits/api/chit-payment-queries'
import { chitSummary } from '@/features/chits/summary'
import { useDeleteChit } from '@/features/chits/hooks/use-chit-mutations'
import { ChitCard } from '@/features/chits/components/chit-card'
import { ChitFormDialog } from '@/features/chits/components/chit-form-dialog'
import type { Chit } from '@/features/chits/api/chit-queries'

/** Chits list with create, edit and soft-delete. */
export function ChitsPage() {
  const { data: family } = useCurrentFamily()
  const canManage = family?.role === 'owner' || family?.role === 'member'

  const { data: chits, isLoading, isError, refetch } = useChits()
  const {
    data: familyMembers,
    isLoading: membersLoading,
    isError: membersError,
    refetch: refetchMembers,
  } = useFamilyMembers()
  const {
    data: chitPayments,
    isLoading: paymentsLoading,
    isError: paymentsError,
    refetch: refetchPayments,
  } = useChitPayments()
  const deleteChit = useDeleteChit()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Chit | null>(null)
  const [toDelete, setToDelete] = useState<Chit | null>(null)

  const totalValue = useMemo(
    () => (chits ?? []).reduce((sum, c) => sum + c.chitValue, 0),
    [chits],
  )
  const groupedChits = useMemo(
    () => groupChitsByOwner(chits ?? [], familyMembers ?? []),
    [chits, familyMembers],
  )
  const paymentsByChit = useMemo(
    () => groupPaymentsByChit(chitPayments ?? []),
    [chitPayments],
  )
  const hasChits = Boolean(chits && chits.length > 0)

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (chit: Chit) => {
    setEditing(chit)
    setFormOpen(true)
  }

  const handleDelete = async () => {
    if (!toDelete) return
    try {
      await deleteChit.mutateAsync(toDelete.id)
      toast.success('Chit deleted')
    } catch (error) {
      toast.error('Could not delete chit')
      console.error(error)
    } finally {
      setToDelete(null)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Chits"
        description="Track your chit funds and returns."
        actions={
          canManage && hasChits ? (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add chit
            </Button>
          ) : undefined
        }
      />

      {isLoading || membersLoading || paymentsLoading ? (
        <LoadingSpinner />
      ) : isError || membersError || paymentsError ? (
        <ErrorState
          description="We could not load your chits."
          onRetry={() => {
            refetch()
            refetchMembers()
            refetchPayments()
          }}
        />
      ) : !chits || chits.length === 0 ? (
        <EmptyState
          icon={Coins}
          title="No chits yet"
          description="Add a chit fund to start tracking its payments and returns."
          action={
            canManage ? (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Add chit
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-muted-foreground text-sm">Total chit value</p>
                <p className="text-2xl font-semibold tabular-nums">
                  {formatPaise(totalValue, { decimals: false })}
                </p>
              </div>
              <p className="text-muted-foreground text-sm">
                {chits.length} {chits.length === 1 ? 'chit' : 'chits'}
              </p>
            </CardContent>
          </Card>

          <div className="space-y-6">
            {groupedChits.map((group) => (
              <section key={group.id} className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    {group.id !== 'shared' ? (
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
                        {group.chits.length}{' '}
                        {group.chits.length === 1 ? 'chit' : 'chits'}
                      </p>
                    </div>
                  </div>
                  <p className="text-muted-foreground shrink-0 text-sm tabular-nums">
                    {formatPaise(group.subtotal, { decimals: false })}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {group.chits.map((chit) => (
                    <ChitCard
                      key={chit.id}
                      chit={chit}
                      summary={chitSummary(
                        chit,
                        paymentsByChit.get(chit.id) ?? [],
                      )}
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

      <ChitFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        chit={editing}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Delete chit?"
        description={
          toDelete
            ? `“${toDelete.name}” and its recorded payments will be removed. This can’t be undone from the app.`
            : undefined
        }
        confirmLabel="Delete"
        destructive
        loading={deleteChit.isPending}
        onConfirm={handleDelete}
      />
    </div>
  )
}

interface ChitOwnerGroup {
  id: string
  name: string
  avatarUrl: string | null
  chits: Chit[]
  subtotal: number
}

function groupChitsByOwner(
  chits: Chit[],
  familyMembers: ReturnType<typeof useFamilyMembers>['data'],
): ChitOwnerGroup[] {
  const membersByUserId = new Map(
    (familyMembers ?? []).map((member) => [member.userId, member]),
  )
  const groups = new Map<string, ChitOwnerGroup>()

  const ensureGroup = (chit: Chit) => {
    if (!chit.ownerId) {
      const existing = groups.get('shared')
      if (existing) return existing

      const shared: ChitOwnerGroup = {
        id: 'shared',
        name: 'Shared / Family',
        avatarUrl: null,
        chits: [],
        subtotal: 0,
      }
      groups.set(shared.id, shared)
      return shared
    }

    const existing = groups.get(chit.ownerId)
    if (existing) return existing

    const member = membersByUserId.get(chit.ownerId)
    const name =
      member?.profile?.fullName?.trim() ||
      member?.displayName?.trim() ||
      'Unknown'
    const group: ChitOwnerGroup = {
      id: chit.ownerId,
      name,
      avatarUrl: member?.profile?.avatarUrl ?? null,
      chits: [],
      subtotal: 0,
    }
    groups.set(group.id, group)
    return group
  }

  chits.forEach((chit) => {
    const group = ensureGroup(chit)
    group.chits.push(chit)
    group.subtotal += chit.chitValue
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
