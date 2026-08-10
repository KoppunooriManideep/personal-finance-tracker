import { useQuery } from '@tanstack/react-query'
import { fetchMarketHoldings } from '@/features/investments/api/market-queries'
import { useCurrentFamily } from '@/features/family/hooks/use-current-family'

/** React Query key factory for market holdings (scoped per family). */
export function marketHoldingsQueryKey(familyId: string | undefined) {
  return ['market-holdings', familyId] as const
}

/** List the current family's stock + mutual-fund holdings. */
export function useMarketHoldings() {
  const { data: family } = useCurrentFamily()
  const familyId = family?.id

  return useQuery({
    queryKey: marketHoldingsQueryKey(familyId),
    queryFn: () => fetchMarketHoldings(familyId!),
    enabled: Boolean(familyId),
  })
}
