import { useMutation, useQueryClient } from '@tanstack/react-query'
import { rupeesToPaise } from '@/lib/money'
import {
  createGoldHolding,
  deleteGoldHolding,
  setGoldSpot,
  updateGoldHolding,
  type GoldHoldingWrite,
} from '@/features/investments/api/gold-mutations'
import type { GoldHolding, GoldSpot } from '@/features/investments/api/gold-queries'
import { goldHoldingsQueryKey } from '@/features/investments/hooks/use-gold-holdings'
import { goldSpotQueryKey } from '@/features/investments/hooks/use-gold-spot'
import { useCurrentFamily } from '@/features/family/hooks/use-current-family'
import type { GoldFormValues } from '@/features/investments/schema'

/** Trim optional text to a stored value (empty string becomes null). */
const nullable = (value: string | undefined) => value?.trim() || null
const money = (rupees: number | undefined) => rupeesToPaise(rupees ?? 0)

/** Convert validated form values into the paise/milligram DB write shape. */
export function goldFormToWrite(values: GoldFormValues): GoldHoldingWrite {
  return {
    ownerId: values.ownerId,
    form: values.form,
    name: nullable(values.name),
    fineness: values.fineness,
    weightMg: Math.round(values.weightGrams * 1000),
    quantity: values.quantity,
    purchaseDate: values.purchaseDate,
    priceTotalPaise: rupeesToPaise(values.priceTotal),
    cashbackPaise: money(values.cashback),
    rewardValuePaise: money(values.rewardValue),
    voucherSavingsPaise: money(values.voucherSavings),
    // Jewellery breakdown only applies to jewellery; zero it out otherwise.
    makingChargesPaise: values.form === 'jewellery' ? money(values.makingCharges) : 0,
    vaPaise: values.form === 'jewellery' ? money(values.va) : 0,
    stoneChargesPaise: values.form === 'jewellery' ? money(values.stoneCharges) : 0,
    gstPercent: values.form === 'jewellery' ? (values.gstPercent ?? 0) : 0,
    discountPaise: values.form === 'jewellery' ? money(values.discount) : 0,
    website: nullable(values.website),
    brand: nullable(values.brand),
    notes: nullable(values.notes),
    tags: values.tags
      ? values.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean)
      : [],
  }
}

const byPurchaseDate = (a: GoldHolding, b: GoldHolding) =>
  b.purchaseDate.localeCompare(a.purchaseDate)

interface MutationContext {
  previous?: GoldHolding[]
}

/** Create a gold holding with an optimistic insert into the cached list. */
export function useCreateGoldHolding() {
  const { data: family } = useCurrentFamily()
  const familyId = family?.id
  const queryClient = useQueryClient()
  const key = goldHoldingsQueryKey(familyId)

  return useMutation<GoldHolding, Error, GoldFormValues, MutationContext>({
    mutationFn: (values) =>
      createGoldHolding({ familyId: familyId!, ...goldFormToWrite(values) }),
    onMutate: async (values) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<GoldHolding[]>(key)
      const optimistic: GoldHolding = {
        id: `optimistic-${crypto.randomUUID()}`,
        ...goldFormToWrite(values),
      }
      queryClient.setQueryData<GoldHolding[]>(key, (old) =>
        [...(old ?? []), optimistic].sort(byPurchaseDate),
      )
      return { previous }
    },
    onError: (_error, _values, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key })
    },
  })
}

/** Update a gold holding, optimistically patching the cached row. */
export function useUpdateGoldHolding() {
  const { data: family } = useCurrentFamily()
  const familyId = family?.id
  const queryClient = useQueryClient()
  const key = goldHoldingsQueryKey(familyId)

  return useMutation<
    void,
    Error,
    { id: string; values: GoldFormValues },
    MutationContext
  >({
    mutationFn: ({ id, values }) =>
      updateGoldHolding({ id, ...goldFormToWrite(values) }),
    onMutate: async ({ id, values }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<GoldHolding[]>(key)
      queryClient.setQueryData<GoldHolding[]>(key, (old) =>
        (old ?? [])
          .map((holding) =>
            holding.id === id
              ? { id, ...goldFormToWrite(values) }
              : holding,
          )
          .sort(byPurchaseDate),
      )
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key })
    },
  })
}

/** Soft-delete a gold holding, optimistically removing it from the list. */
export function useDeleteGoldHolding() {
  const { data: family } = useCurrentFamily()
  const familyId = family?.id
  const queryClient = useQueryClient()
  const key = goldHoldingsQueryKey(familyId)

  return useMutation<void, Error, string, MutationContext>({
    mutationFn: (id) => deleteGoldHolding(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<GoldHolding[]>(key)
      queryClient.setQueryData<GoldHolding[]>(key, (old) =>
        (old ?? []).filter((holding) => holding.id !== id),
      )
      return { previous }
    },
    onError: (_error, _id, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key })
    },
  })
}

/** Set (upsert) the family's 24K spot rate, optimistically patching the cache. */
export function useSetGoldSpot() {
  const { data: family } = useCurrentFamily()
  const familyId = family?.id
  const queryClient = useQueryClient()
  const key = goldSpotQueryKey(familyId)

  return useMutation<
    void,
    Error,
    { pricePaisePerGram: number; source: string | null },
    { previous?: GoldSpot | null }
  >({
    mutationFn: (input) => setGoldSpot({ familyId: familyId!, ...input }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<GoldSpot | null>(key)
      queryClient.setQueryData<GoldSpot | null>(key, () => ({
        pricePaisePerGram: input.pricePaisePerGram,
        source: input.source,
        asOf: new Date().toISOString(),
      }))
      return { previous }
    },
    onError: (_error, _input, context) => {
      if (context) queryClient.setQueryData(key, context.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key })
    },
  })
}
