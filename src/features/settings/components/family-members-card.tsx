import { useState } from 'react'
import { Loader2, MoreVertical, Shield, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { ErrorState } from '@/components/common/error-state'
import { LoadingSpinner } from '@/components/common/loading-spinner'
import { formatDate } from '@/lib/date'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { useCurrentFamily } from '@/features/family/hooks/use-current-family'
import { useFamilyMembers } from '@/features/family/hooks/use-family-members'
import {
  useRemoveFamilyMember,
  useUpdateFamilyMemberRole,
} from '@/features/family/hooks/use-family-member-mutations'
import type { FamilyMember } from '@/features/family/api/family-queries'
import type { FamilyRole } from '@/types/database.types'

const roles: FamilyRole[] = ['owner', 'member', 'viewer']

/** Family member list with owner-only role and removal controls. */
export function FamilyMembersCard() {
  const { user } = useAuth()
  const { data: family } = useCurrentFamily()
  const members = useFamilyMembers()
  const updateRole = useUpdateFamilyMemberRole()
  const removeMember = useRemoveFamilyMember()
  const [toRemove, setToRemove] = useState<FamilyMember | null>(null)

  const isOwner = family?.role === 'owner'

  const handleRoleChange = async (member: FamilyMember, role: FamilyRole) => {
    try {
      await updateRole.mutateAsync({ memberId: member.id, role })
      toast.success('Role updated')
    } catch (error) {
      toast.error('Could not update role')
      console.error(error)
    }
  }

  const handleRemove = async () => {
    if (!toRemove) return
    try {
      await removeMember.mutateAsync(toRemove.id)
      toast.success('Member removed')
    } catch (error) {
      toast.error('Could not remove member')
      console.error(error)
    } finally {
      setToRemove(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Family members</CardTitle>
        <CardDescription>
          Owners can update roles and remove members.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {members.isLoading ? (
          <LoadingSpinner />
        ) : members.isError ? (
          <ErrorState onRetry={() => members.refetch()} />
        ) : (
          <ul className="divide-y">
            {(members.data ?? []).map((member) => {
              const isSelf = member.userId === user?.id
              const displayName = getMemberName(member, isSelf, user?.email)
              return (
                <li
                  key={member.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar>
                      <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium">{displayName}</p>
                        {isSelf ? (
                          <span className="text-muted-foreground text-xs">
                            You
                          </span>
                        ) : null}
                      </div>
                      <p className="text-muted-foreground text-xs">
                        Joined {formatDate(member.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <RoleBadge role={member.role} />
                    {isOwner && !isSelf ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Actions for ${displayName}`}
                          >
                            {updateRole.isPending || removeMember.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MoreVertical className="h-4 w-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {roles.map((role) => (
                            <DropdownMenuItem
                              key={role}
                              disabled={member.role === role}
                              onClick={() => handleRoleChange(member, role)}
                            >
                              <Shield className="h-4 w-4" />
                              Make {role}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setToRemove(member)}
                          >
                            <Trash2 className="h-4 w-4" />
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>

      <ConfirmDialog
        open={Boolean(toRemove)}
        onOpenChange={(open) => !open && setToRemove(null)}
        title="Remove member?"
        description="They will lose access to this family's accounts, transactions and budgets."
        confirmLabel="Remove"
        destructive
        loading={removeMember.isPending}
        onConfirm={handleRemove}
      />
    </Card>
  )
}

function RoleBadge({ role }: { role: FamilyRole }) {
  return (
    <span
      className={cn(
        'rounded-md px-2 py-1 text-xs font-medium capitalize',
        role === 'owner' && 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
        role === 'member' &&
          'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
        role === 'viewer' &&
          'bg-slate-500/10 text-slate-700 dark:text-slate-300',
      )}
    >
      {role}
    </span>
  )
}

function getMemberName(
  member: FamilyMember,
  isSelf: boolean,
  email: string | undefined,
) {
  if (member.displayName) return member.displayName
  if (isSelf && email) return email
  return `Member ${member.userId.slice(0, 8)}`
}

function getInitials(value: string): string {
  const parts = value.trim().split(/\s+/)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return value.slice(0, 2).toUpperCase()
}
