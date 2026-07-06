import { useQuery } from '@tanstack/react-query'
import { fetchBudgets } from '@/features/budgets/api/budget-queries'
import { useCurrentFamily } from '@/features/family/hooks/use-current-family'

/** React Query key factory for budget lists (scoped per family/month). */
export function budgetsQueryKey(
  familyId: string | undefined,
  selectedMonth?: string,
) {
  return ['budgets', familyId, selectedMonth] as const
}

/** List budgets with expense-only spending for the selected month. */
export function useBudgets(selectedMonth: string) {
  const { data: family } = useCurrentFamily()
  const familyId = family?.id

  return useQuery({
    queryKey: budgetsQueryKey(familyId, selectedMonth),
    queryFn: () => fetchBudgets(familyId!, selectedMonth),
    enabled: Boolean(familyId),
  })
}
