import { useQuery } from '@tanstack/react-query'
import { fetchCategories } from '@/features/categories/api/category-queries'
import { useCurrentFamily } from '@/features/family/hooks/use-current-family'

/** React Query key factory for category lists (scoped per family). */
export function categoriesQueryKey(familyId: string | undefined) {
  return ['categories', familyId] as const
}

/** List the current family's categories (both income and expense). */
export function useCategories() {
  const { data: family } = useCurrentFamily()
  const familyId = family?.id

  return useQuery({
    queryKey: categoriesQueryKey(familyId),
    queryFn: () => fetchCategories(familyId!),
    enabled: Boolean(familyId),
  })
}
