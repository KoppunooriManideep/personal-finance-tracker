import { useQuery } from '@tanstack/react-query'
import { fetchTransactions } from '@/features/transactions/api/transaction-queries'
import { useCurrentFamily } from '@/features/family/hooks/use-current-family'

/** React Query key factory for transaction lists (scoped per family). */
export function transactionsQueryKey(familyId: string | undefined) {
  return ['transactions', familyId] as const
}

/** List the current family's active transactions. */
export function useTransactions() {
  const { data: family } = useCurrentFamily()
  const familyId = family?.id

  return useQuery({
    queryKey: transactionsQueryKey(familyId),
    queryFn: () => fetchTransactions(familyId!),
    enabled: Boolean(familyId),
  })
}
