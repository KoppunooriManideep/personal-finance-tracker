import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { rupeesToPaise } from '@/lib/money'
import {
  createAccount,
  deleteAccount,
  updateAccount,
} from '@/features/accounts/api/account-mutations'
import type { AccountWithBalance } from '@/features/accounts/api/account-queries'
import { accountsQueryKey } from '@/features/accounts/hooks/use-accounts'
import { useCurrentFamily } from '@/features/family/hooks/use-current-family'
import type { AccountFormValues } from '@/features/accounts/schema'

const byName = (a: AccountWithBalance, b: AccountWithBalance) =>
  a.name.localeCompare(b.name)

interface MutationContext {
  previous?: AccountWithBalance[]
}

/** Create an account with an optimistic insert into the cached list. */
export function useCreateAccount() {
  const { user } = useAuth()
  const { data: family } = useCurrentFamily()
  const familyId = family?.id
  const queryClient = useQueryClient()
  const key = accountsQueryKey(familyId)

  return useMutation<
    AccountWithBalance,
    Error,
    AccountFormValues,
    MutationContext
  >({
    mutationFn: (values) =>
      createAccount({
        familyId: familyId!,
        userId: user!.id,
        name: values.name,
        type: values.type,
        openingBalancePaise: rupeesToPaise(values.openingBalance),
      }),
    onMutate: async (values) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<AccountWithBalance[]>(key)
      const paise = rupeesToPaise(values.openingBalance)
      const optimistic: AccountWithBalance = {
        id: `optimistic-${crypto.randomUUID()}`,
        name: values.name,
        type: values.type,
        openingBalance: paise,
        currentBalance: paise,
      }
      queryClient.setQueryData<AccountWithBalance[]>(key, (old) =>
        [...(old ?? []), optimistic].sort(byName),
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

/** Update an account, optimistically patching the cached row. */
export function useUpdateAccount() {
  const { data: family } = useCurrentFamily()
  const familyId = family?.id
  const queryClient = useQueryClient()
  const key = accountsQueryKey(familyId)

  return useMutation<
    void,
    Error,
    { id: string; values: AccountFormValues },
    MutationContext
  >({
    mutationFn: ({ id, values }) =>
      updateAccount({
        id,
        name: values.name,
        type: values.type,
        openingBalancePaise: rupeesToPaise(values.openingBalance),
      }),
    onMutate: async ({ id, values }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<AccountWithBalance[]>(key)
      const nextOpening = rupeesToPaise(values.openingBalance)
      queryClient.setQueryData<AccountWithBalance[]>(key, (old) =>
        (old ?? [])
          .map((account) => {
            if (account.id !== id) return account
            // Shift the current balance by the change in opening balance so the
            // optimistic figure stays consistent with existing activity.
            const delta = nextOpening - account.openingBalance
            return {
              ...account,
              name: values.name,
              type: values.type,
              openingBalance: nextOpening,
              currentBalance: account.currentBalance + delta,
            }
          })
          .sort(byName),
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

/** Soft-delete an account, optimistically removing it from the cached list. */
export function useDeleteAccount() {
  const { data: family } = useCurrentFamily()
  const familyId = family?.id
  const queryClient = useQueryClient()
  const key = accountsQueryKey(familyId)

  return useMutation<void, Error, string, MutationContext>({
    mutationFn: (id) => deleteAccount(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<AccountWithBalance[]>(key)
      queryClient.setQueryData<AccountWithBalance[]>(key, (old) =>
        (old ?? []).filter((account) => account.id !== id),
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
