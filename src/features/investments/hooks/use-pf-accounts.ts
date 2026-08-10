import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createPfAccount,
  deletePfAccount,
  updatePfAccount,
  type PfAccountWrite,
} from '@/features/investments/api/pf-mutations'
import { fetchPfAccounts } from '@/features/investments/api/pf-queries'
import { useCurrentFamily } from '@/features/family/hooks/use-current-family'

/** React Query key factory for PF accounts (scoped per family). */
export function pfAccountsQueryKey(familyId: string | undefined) {
  return ['pf-accounts', familyId] as const
}

/** List the current family's Provident Fund accounts. */
export function usePfAccounts() {
  const { data: family } = useCurrentFamily()
  const familyId = family?.id
  return useQuery({
    queryKey: pfAccountsQueryKey(familyId),
    queryFn: () => fetchPfAccounts(familyId!),
    enabled: Boolean(familyId),
  })
}

export function useCreatePfAccount() {
  const { data: family } = useCurrentFamily()
  const familyId = family?.id
  const queryClient = useQueryClient()
  const key = pfAccountsQueryKey(familyId)
  return useMutation({
    mutationFn: (input: PfAccountWrite) => createPfAccount(familyId!, input),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}

export function useUpdatePfAccount() {
  const { data: family } = useCurrentFamily()
  const queryClient = useQueryClient()
  const key = pfAccountsQueryKey(family?.id)
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: PfAccountWrite }) =>
      updatePfAccount(id, input),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}

export function useDeletePfAccount() {
  const { data: family } = useCurrentFamily()
  const queryClient = useQueryClient()
  const key = pfAccountsQueryKey(family?.id)
  return useMutation({
    mutationFn: (id: string) => deletePfAccount(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}
