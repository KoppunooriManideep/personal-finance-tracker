import { useQuery } from '@tanstack/react-query'
import { fetchAccounts } from '@/features/accounts/api/account-queries'
import { useCurrentFamily } from '@/features/family/hooks/use-current-family'

/** React Query key factory for account lists (scoped per family). */
export function accountsQueryKey(familyId: string | undefined) {
  return ['accounts', familyId] as const
}

/** List the current family's accounts with live balances. */
export function useAccounts() {
  const { data: family } = useCurrentFamily()
  const familyId = family?.id

  return useQuery({
    queryKey: accountsQueryKey(familyId),
    queryFn: () => fetchAccounts(familyId!),
    enabled: Boolean(familyId),
  })
}
