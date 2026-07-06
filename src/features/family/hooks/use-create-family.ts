import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { createFamily } from '@/features/family/api/family-mutations'

/** Create a new family (current user becomes owner) and refresh family state. */
export function useCreateFamily() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (name: string) => createFamily(name, user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-family'] })
    },
  })
}
