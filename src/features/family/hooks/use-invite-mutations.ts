import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  createFamilyInvite,
  revokeActiveFamilyInvites,
  revokeFamilyInvite,
} from '@/features/family/api/family-mutations'

/** Generate a new invite code for a family. */
export function useCreateInvite(familyId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => createFamilyInvite(familyId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family-invites', familyId] })
    },
  })
}

/** Revoke an existing invite code. */
export function useRevokeInvite(familyId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (inviteId: string) => revokeFamilyInvite(inviteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family-invites', familyId] })
    },
  })
}

/** Revoke active codes, then create a fresh invite code. */
export function useRegenerateInvite(familyId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      await revokeActiveFamilyInvites(familyId!)
      return createFamilyInvite(familyId!)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family-invites', familyId] })
    },
  })
}
