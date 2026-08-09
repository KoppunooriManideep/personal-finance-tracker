import { useQuery } from '@tanstack/react-query'
import { fetchGoldSpot } from '@/features/investments/api/gold-queries'
import { useCurrentFamily } from '@/features/family/hooks/use-current-family'

/** React Query key factory for the family gold spot rate. */
export function goldSpotQueryKey(familyId: string | undefined) {
  return ['gold-spot', familyId] as const
}

/** The current family's 24K spot rate (null until one is set). */
export function useGoldSpot() {
  const { data: family } = useCurrentFamily()
  const familyId = family?.id

  return useQuery({
    queryKey: goldSpotQueryKey(familyId),
    queryFn: () => fetchGoldSpot(familyId!),
    enabled: Boolean(familyId),
  })
}
