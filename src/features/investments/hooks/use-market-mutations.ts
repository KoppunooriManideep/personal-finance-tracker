import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  bulkCreateMarketHoldings,
  createMarketHolding,
  deleteMarketHolding,
  updateMarketHolding,
  type MarketHoldingWrite,
} from '@/features/investments/api/market-mutations'
import type { MarketHolding } from '@/features/investments/api/market-queries'
import type { MarketImportPlan } from '@/features/investments/import-plan'
import { marketHoldingsQueryKey } from '@/features/investments/hooks/use-market-holdings'
import { useCurrentFamily } from '@/features/family/hooks/use-current-family'

interface MutationContext {
  previous?: MarketHolding[]
}

export function useCreateMarketHolding() {
  const { data: family } = useCurrentFamily()
  const familyId = family?.id
  const queryClient = useQueryClient()
  const key = marketHoldingsQueryKey(familyId)

  return useMutation<MarketHolding, Error, MarketHoldingWrite, MutationContext>({
    mutationFn: (input) => createMarketHolding(familyId!, input),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}

export function useUpdateMarketHolding() {
  const { data: family } = useCurrentFamily()
  const familyId = family?.id
  const queryClient = useQueryClient()
  const key = marketHoldingsQueryKey(familyId)

  return useMutation<
    void,
    Error,
    { id: string; input: MarketHoldingWrite },
    MutationContext
  >({
    mutationFn: ({ id, input }) => updateMarketHolding(id, input),
    onMutate: async ({ id, input }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<MarketHolding[]>(key)
      queryClient.setQueryData<MarketHolding[]>(key, (old) =>
        (old ?? []).map((h) => (h.id === id ? { ...h, ...input } : h)),
      )
      return { previous }
    },
    onError: (_e, _v, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}

export function useDeleteMarketHolding() {
  const { data: family } = useCurrentFamily()
  const familyId = family?.id
  const queryClient = useQueryClient()
  const key = marketHoldingsQueryKey(familyId)

  return useMutation<void, Error, string, MutationContext>({
    mutationFn: (id) => deleteMarketHolding(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<MarketHolding[]>(key)
      queryClient.setQueryData<MarketHolding[]>(key, (old) =>
        (old ?? []).filter((h) => h.id !== id),
      )
      return { previous }
    },
    onError: (_e, _id, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}

/**
 * Idempotent CSV import: update existing holdings (matched by ISIN) in place and
 * insert new ones. Re-importing a broker export (e.g. monthly after SIPs) keeps
 * units/invested current without creating duplicates.
 */
export function useSyncMarketImport() {
  const { data: family } = useCurrentFamily()
  const familyId = family?.id
  const queryClient = useQueryClient()
  const key = marketHoldingsQueryKey(familyId)

  return useMutation<
    { inserted: number; updated: number },
    Error,
    MarketImportPlan
  >({
    mutationFn: async ({ inserts, updates }) => {
      await Promise.all(
        updates.map((u) => updateMarketHolding(u.id, u.input)),
      )
      const inserted = await bulkCreateMarketHoldings(familyId!, inserts)
      return { inserted, updated: updates.length }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}
