import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { fetchCurrentFamily } from '@/features/family/api/family-queries'

/** React Query hook for the current user's family (null when not onboarded). */
export function useCurrentFamily() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['current-family', user?.id],
    queryFn: () => fetchCurrentFamily(user!.id),
    enabled: Boolean(user?.id),
  })
}
