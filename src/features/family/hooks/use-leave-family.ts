import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { leaveFamily } from '@/features/family/api/family-mutations'

/** Leave the current family, then refresh family state (→ onboarding). */
export function useLeaveFamily() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (familyId: string) => leaveFamily(familyId, user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-family'] })
    },
  })
}
