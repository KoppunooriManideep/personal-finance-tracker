import { useQuery } from '@tanstack/react-query'
import { fetchChitPayments } from '@/features/chits/api/chit-payment-queries'
import { useCurrentFamily } from '@/features/family/hooks/use-current-family'

/** React Query key factory for chit payments (scoped per family). */
export function chitPaymentsQueryKey(familyId: string | undefined) {
  return ['chit-payments', familyId] as const
}

/** List every recorded chit payment for the current family. */
export function useChitPayments() {
  const { data: family } = useCurrentFamily()
  const familyId = family?.id

  return useQuery({
    queryKey: chitPaymentsQueryKey(familyId),
    queryFn: () => fetchChitPayments(familyId!),
    enabled: Boolean(familyId),
  })
}
