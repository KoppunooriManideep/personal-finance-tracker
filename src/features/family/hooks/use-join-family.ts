import { useMutation, useQueryClient } from '@tanstack/react-query'
import { joinFamilyWithCode } from '@/features/family/api/family-mutations'

/** Join an existing family via invite code and refresh family state. */
export function useJoinFamily() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (code: string) => joinFamilyWithCode(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-family'] })
    },
  })
}
