import { useState } from 'react'
import { Copy, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/common/loading-spinner'
import { ErrorState } from '@/components/common/error-state'
import { EmptyState } from '@/components/common/empty-state'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { formatDate } from '@/lib/date'
import { useCurrentFamily } from '@/features/family/hooks/use-current-family'
import { useFamilyInvites } from '@/features/family/hooks/use-family-invites'
import {
  useCreateInvite,
  useRegenerateInvite,
  useRevokeInvite,
} from '@/features/family/hooks/use-invite-mutations'

/**
 * Generate and manage family invite codes. Viewers see codes read-only; owners
 * and members can create and revoke them.
 */
export function InviteManager() {
  const { data: family } = useCurrentFamily()
  const familyId = family?.id
  const canManage = family?.role === 'owner' || family?.role === 'member'

  const invites = useFamilyInvites(familyId)
  const createInvite = useCreateInvite(familyId)
  const regenerateInvite = useRegenerateInvite(familyId)
  const revokeInvite = useRevokeInvite(familyId)

  const [toRevoke, setToRevoke] = useState<string | null>(null)

  const handleGenerate = async () => {
    try {
      const invite = await createInvite.mutateAsync()
      await copyCode(invite.code)
      toast.success('Invite code created and copied')
    } catch (error) {
      toast.error('Could not create invite code')
      console.error(error)
    }
  }

  const handleRegenerate = async () => {
    try {
      const invite = await regenerateInvite.mutateAsync()
      await copyCode(invite.code)
      toast.success('Invite code regenerated and copied')
    } catch (error) {
      toast.error('Could not regenerate invite code')
      console.error(error)
    }
  }

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      toast.success('Code copied')
    } catch {
      toast.error('Could not copy code')
    }
  }

  const handleRevoke = async () => {
    if (!toRevoke) return
    try {
      await revokeInvite.mutateAsync(toRevoke)
      toast.success('Invite revoked')
    } catch (error) {
      toast.error('Could not revoke invite')
      console.error(error)
    } finally {
      setToRevoke(null)
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">Invite codes</CardTitle>
          <CardDescription>
            Share a code so others can join this family.
          </CardDescription>
        </div>
        {canManage ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleRegenerate}
              disabled={regenerateInvite.isPending}
            >
              <RefreshCw className="h-4 w-4" />
              Regenerate
            </Button>
            <Button
              size="sm"
              onClick={handleGenerate}
              disabled={createInvite.isPending}
            >
              <Plus className="h-4 w-4" />
              Generate
            </Button>
          </div>
        ) : null}
      </CardHeader>
      <CardContent>
        {invites.isLoading ? (
          <LoadingSpinner />
        ) : invites.isError ? (
          <ErrorState onRetry={() => invites.refetch()} />
        ) : !invites.data || invites.data.length === 0 ? (
          <EmptyState
            title="No invite codes"
            description="Generate a code to invite family members."
          />
        ) : (
          <ul className="divide-y">
            {invites.data.map((invite) => (
              <li
                key={invite.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <code className="bg-muted rounded px-2 py-1 font-mono text-sm tracking-wider">
                    {invite.code}
                  </code>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Created {formatDate(invite.created_at)} · Used{' '}
                    {invite.used_count}
                    {invite.max_uses ? ` / ${invite.max_uses}` : ''} times
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Copy code"
                    onClick={() => copyCode(invite.code)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  {canManage ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Revoke code"
                      onClick={() => setToRevoke(invite.id)}
                    >
                      <Trash2 className="text-destructive h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <ConfirmDialog
        open={toRevoke !== null}
        onOpenChange={(open) => !open && setToRevoke(null)}
        title="Revoke this invite code?"
        description="Anyone who hasn't joined yet will no longer be able to use it."
        confirmLabel="Revoke"
        destructive
        loading={revokeInvite.isPending}
        onConfirm={handleRevoke}
      />
    </Card>
  )
}
