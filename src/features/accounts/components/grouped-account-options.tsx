import type { AccountWithBalance } from '@/features/accounts/api/account-queries'
import type { FamilyMember } from '@/features/family/api/family-queries'
import { SelectItem } from '@/components/ui/select'

interface GroupedAccountOptionsProps {
  accounts: AccountWithBalance[]
  familyMembers: FamilyMember[] | undefined
}

export function GroupedAccountOptions({
  accounts,
  familyMembers = [],
}: GroupedAccountOptionsProps) {
  // Map to find family member by userId
  const memberMap = new Map<string, FamilyMember>()
  familyMembers.forEach((member) => {
    memberMap.set(member.userId, member)
  })

  const getOwnerName = (ownerId: string | null): string => {
    if (!ownerId) return 'Shared'
    const member = memberMap.get(ownerId)
    const name = member?.profile?.fullName?.trim() || member?.displayName?.trim() || 'Unknown'
    return name.split(/\s+/)[0] || 'Unknown'
  }

  return (
    <>
      {accounts.map((account) => {
        const ownerName = getOwnerName(account.ownerId)
        return (
          <SelectItem key={account.id} value={account.id}>
            {account.name} ({ownerName})
          </SelectItem>
        )
      })}
    </>
  )
}
