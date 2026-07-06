import { useQuery } from '@tanstack/react-query'
import { listFamilyInvites } from '@/features/family/api/family-mutations'

/** List a family's active invite codes. */
export function useFamilyInvites(familyId: string | undefined) {
  return useQuery({
    queryKey: ['family-invites', familyId],
    queryFn: () => listFamilyInvites(familyId!),
    enabled: Boolean(familyId),
  })
}
