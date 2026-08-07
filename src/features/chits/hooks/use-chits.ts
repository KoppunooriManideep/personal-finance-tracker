import { useQuery } from '@tanstack/react-query'
import { fetchChits } from '@/features/chits/api/chit-queries'
import { useCurrentFamily } from '@/features/family/hooks/use-current-family'

/** React Query key factory for chit lists (scoped per family). */
export function chitsQueryKey(familyId: string | undefined) {
  return ['chits', familyId] as const
}

/** List the current family's chits. */
export function useChits() {
  const { data: family } = useCurrentFamily()
  const familyId = family?.id

  return useQuery({
    queryKey: chitsQueryKey(familyId),
    queryFn: () => fetchChits(familyId!),
    enabled: Boolean(familyId),
  })
}
