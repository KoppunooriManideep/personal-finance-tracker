import { useMutation, useQueryClient } from '@tanstack/react-query'
import { rupeesToPaise } from '@/lib/money'
import {
  clearChitReceived,
  createChit,
  deleteChit,
  setChitReceived,
  updateChit,
} from '@/features/chits/api/chit-mutations'
import type { Chit } from '@/features/chits/api/chit-queries'
import { chitsQueryKey } from '@/features/chits/hooks/use-chits'
import { useCurrentFamily } from '@/features/family/hooks/use-current-family'
import type { ChitFormValues } from '@/features/chits/schema'

const byStartDateThenName = (a: Chit, b: Chit) => {
  if (a.startDate !== b.startDate) return b.startDate.localeCompare(a.startDate)
  return a.name.localeCompare(b.name)
}

/** Trim optional text to a stored value (empty string becomes null). */
const nullable = (value: string | undefined) => value?.trim() || null

interface MutationContext {
  previous?: Chit[]
}

/** Create a chit with an optimistic insert into the cached list. */
export function useCreateChit() {
  const { data: family } = useCurrentFamily()
  const familyId = family?.id
  const queryClient = useQueryClient()
  const key = chitsQueryKey(familyId)

  return useMutation<Chit, Error, ChitFormValues, MutationContext>({
    mutationFn: (values) =>
      createChit({
        familyId: familyId!,
        name: values.name,
        ownerId: values.ownerId,
        chitValuePaise: rupeesToPaise(values.chitValue),
        tenureMonths: values.tenureMonths,
        startDate: values.startDate,
        organizer: nullable(values.organizer),
        notes: nullable(values.notes),
      }),
    onMutate: async (values) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Chit[]>(key)
      const optimistic: Chit = {
        id: `optimistic-${crypto.randomUUID()}`,
        ownerId: values.ownerId,
        name: values.name,
        chitValue: rupeesToPaise(values.chitValue),
        tenureMonths: values.tenureMonths,
        startDate: values.startDate,
        organizer: nullable(values.organizer),
        notes: nullable(values.notes),
        receivedMonth: null,
        receivedAmount: null,
        status: 'active',
      }
      queryClient.setQueryData<Chit[]>(key, (old) =>
        [...(old ?? []), optimistic].sort(byStartDateThenName),
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

/** Update a chit, optimistically patching the cached row. */
export function useUpdateChit() {
  const { data: family } = useCurrentFamily()
  const familyId = family?.id
  const queryClient = useQueryClient()
  const key = chitsQueryKey(familyId)

  return useMutation<
    void,
    Error,
    { id: string; values: ChitFormValues },
    MutationContext
  >({
    mutationFn: ({ id, values }) =>
      updateChit({
        id,
        name: values.name,
        ownerId: values.ownerId,
        chitValuePaise: rupeesToPaise(values.chitValue),
        tenureMonths: values.tenureMonths,
        startDate: values.startDate,
        organizer: nullable(values.organizer),
        notes: nullable(values.notes),
      }),
    onMutate: async ({ id, values }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Chit[]>(key)
      queryClient.setQueryData<Chit[]>(key, (old) =>
        (old ?? [])
          .map((chit) =>
            chit.id === id
              ? {
                  ...chit,
                  name: values.name,
                  ownerId: values.ownerId,
                  chitValue: rupeesToPaise(values.chitValue),
                  tenureMonths: values.tenureMonths,
                  startDate: values.startDate,
                  organizer: nullable(values.organizer),
                  notes: nullable(values.notes),
                }
              : chit,
          )
          .sort(byStartDateThenName),
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

/** Set (or update) a chit's "taken" record, patching the cached row. */
export function useSetChitReceived() {
  const { data: family } = useCurrentFamily()
  const familyId = family?.id
  const queryClient = useQueryClient()
  const key = chitsQueryKey(familyId)

  return useMutation<
    void,
    Error,
    { id: string; receivedMonth: number; receivedAmountPaise: number },
    MutationContext
  >({
    mutationFn: (input) =>
      setChitReceived({
        id: input.id,
        receivedMonth: input.receivedMonth,
        receivedAmountPaise: input.receivedAmountPaise,
      }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Chit[]>(key)
      queryClient.setQueryData<Chit[]>(key, (old) =>
        (old ?? []).map((chit) =>
          chit.id === input.id
            ? {
                ...chit,
                receivedMonth: input.receivedMonth,
                receivedAmount: input.receivedAmountPaise,
              }
            : chit,
        ),
      )
      return { previous }
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key })
    },
  })
}

/** Clear a chit's "taken" record, patching the cached row. */
export function useClearChitReceived() {
  const { data: family } = useCurrentFamily()
  const familyId = family?.id
  const queryClient = useQueryClient()
  const key = chitsQueryKey(familyId)

  return useMutation<void, Error, string, MutationContext>({
    mutationFn: (id) => clearChitReceived(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Chit[]>(key)
      queryClient.setQueryData<Chit[]>(key, (old) =>
        (old ?? []).map((chit) =>
          chit.id === id
            ? { ...chit, receivedMonth: null, receivedAmount: null }
            : chit,
        ),
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

/** Soft-delete a chit, optimistically removing it from the cached list. */
export function useDeleteChit() {
  const { data: family } = useCurrentFamily()
  const familyId = family?.id
  const queryClient = useQueryClient()
  const key = chitsQueryKey(familyId)

  return useMutation<void, Error, string, MutationContext>({
    mutationFn: (id) => deleteChit(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Chit[]>(key)
      queryClient.setQueryData<Chit[]>(key, (old) =>
        (old ?? []).filter((chit) => chit.id !== id),
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
