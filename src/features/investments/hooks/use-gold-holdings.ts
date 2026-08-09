import { useQuery } from '@tanstack/react-query'
import { fetchGoldHoldings } from '@/features/investments/api/gold-queries'
import { useCurrentFamily } from '@/features/family/hooks/use-current-family'

/** React Query key factory for gold holdings (scoped per family). */
export function goldHoldingsQueryKey(familyId: string | undefined) {
  return ['gold-holdings', familyId] as const
}

/** List the current family's gold holdings. */
export function useGoldHoldings() {
  const { data: family } = useCurrentFamily()
  const familyId = family?.id

  return useQuery({
    queryKey: goldHoldingsQueryKey(familyId),
    queryFn: () => fetchGoldHoldings(familyId!),
    enabled: Boolean(familyId),
  })
}
