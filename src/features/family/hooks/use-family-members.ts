import { useQuery } from '@tanstack/react-query'
import { fetchFamilyMembers } from '@/features/family/api/family-queries'
import { useCurrentFamily } from '@/features/family/hooks/use-current-family'

/** React Query key factory for family members. */
export function familyMembersQueryKey(familyId: string | undefined) {
  return ['family-members', familyId] as const
}

/** List the current family's active members. */
export function useFamilyMembers() {
  const { data: family } = useCurrentFamily()
  const familyId = family?.id

  return useQuery({
    queryKey: familyMembersQueryKey(familyId),
    queryFn: () => fetchFamilyMembers(familyId!),
    enabled: Boolean(familyId),
  })
}
