import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import type { FamilyRole } from '@/types/database.types'
import {
  removeFamilyMember,
  updateFamilyMemberRole,
  updateOwnFamilyDisplayName,
} from '@/features/family/api/family-mutations'
import type { FamilyMember } from '@/features/family/api/family-queries'
import { familyMembersQueryKey } from '@/features/family/hooks/use-family-members'
import { useCurrentFamily } from '@/features/family/hooks/use-current-family'

interface MutationContext {
  previous?: FamilyMember[]
}

/** Owner mutation for changing a member role. */
export function useUpdateFamilyMemberRole() {
  const { data: family } = useCurrentFamily()
  const familyId = family?.id
  const queryClient = useQueryClient()
  const key = familyMembersQueryKey(familyId)

  return useMutation<
    void,
    Error,
    { memberId: string; role: FamilyRole },
    MutationContext
  >({
    mutationFn: ({ memberId, role }) => updateFamilyMemberRole(memberId, role),
    onMutate: async ({ memberId, role }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<FamilyMember[]>(key)
      queryClient.setQueryData<FamilyMember[]>(key, (old) =>
        (old ?? []).map((member) =>
          member.id === memberId ? { ...member, role } : member,
        ),
      )
      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key })
      queryClient.invalidateQueries({ queryKey: ['current-family'] })
    },
  })
}

/** Owner mutation for removing a member from the family. */
export function useRemoveFamilyMember() {
  const { data: family } = useCurrentFamily()
  const familyId = family?.id
  const queryClient = useQueryClient()
  const key = familyMembersQueryKey(familyId)

  return useMutation<void, Error, string, MutationContext>({
    mutationFn: (memberId) => removeFamilyMember(memberId),
    onMutate: async (memberId) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<FamilyMember[]>(key)
      queryClient.setQueryData<FamilyMember[]>(key, (old) =>
        (old ?? []).filter((member) => member.id !== memberId),
      )
      return { previous }
    },
    onError: (_error, _memberId, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key })
    },
  })
}

/** Current-user mutation for changing their family display name. */
export function useUpdateOwnFamilyDisplayName() {
  const { user } = useAuth()
  const { data: family } = useCurrentFamily()
  const familyId = family?.id
  const queryClient = useQueryClient()
  const key = familyMembersQueryKey(familyId)

  return useMutation<void, Error, string, MutationContext>({
    mutationFn: (displayName) =>
      updateOwnFamilyDisplayName(familyId!, user!.id, displayName),
    onMutate: async (displayName) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<FamilyMember[]>(key)
      queryClient.setQueryData<FamilyMember[]>(key, (old) =>
        (old ?? []).map((member) =>
          member.userId === user?.id ? { ...member, displayName } : member,
        ),
      )
      return { previous }
    },
    onError: (_error, _displayName, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key })
    },
  })
}
