import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { toast } from 'sonner'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { useCurrentFamily } from '@/features/family/hooks/use-current-family'
import { useLeaveFamily } from '@/features/family/hooks/use-leave-family'

/**
 * Danger-zone card that lets the user leave their current family. Useful for
 * re-testing the onboarding flow, since leaving sends them back to onboarding.
 */
export function LeaveFamilyCard() {
  const { data: family } = useCurrentFamily()
  const leaveFamily = useLeaveFamily()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const handleLeave = async () => {
    if (!family) return
    try {
      await leaveFamily.mutateAsync(family.id)
      toast.success('You left the family')
      // No manual navigation needed: RequireFamily redirects to onboarding
      // once the family query returns null.
    } catch (error) {
      toast.error('Could not leave the family. Please try again.')
      console.error(error)
    } finally {
      setConfirmOpen(false)
    }
  }

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-base">Leave family</CardTitle>
        <CardDescription>
          Remove yourself from{' '}
          <span className="font-medium">{family?.name ?? 'this family'}</span>.
          You can rejoin later with an invite code.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          variant="outline"
          className="text-destructive hover:text-destructive"
          onClick={() => setConfirmOpen(true)}
          disabled={!family || leaveFamily.isPending}
        >
          <LogOut className="h-4 w-4" />
          Leave family
        </Button>
      </CardContent>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Leave this family?"
        description="You'll lose access to its accounts, transactions and budgets until you rejoin."
        confirmLabel="Leave"
        destructive
        loading={leaveFamily.isPending}
        onConfirm={handleLeave}
      />
    </Card>
  )
}
