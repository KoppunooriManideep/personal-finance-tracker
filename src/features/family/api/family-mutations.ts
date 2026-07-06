import { supabase } from '@/lib/supabase'
import type { FamilyRole, Tables } from '@/types/database.types'

export type FamilyInvite = Tables<'family_invites'>

/** Create a family; the DB trigger makes the creator owner and seeds categories. */
export async function createFamily(
  name: string,
  userId: string,
): Promise<{ id: string; name: string }> {
  // Generate the id client-side so we don't need `.select()` on the insert.
  // A `RETURNING`/select would be checked against the `families` SELECT RLS
  // policy (is_family_member), but the owner membership is only created by the
  // AFTER INSERT trigger — so reading the row back would fail with 42501.
  const id = crypto.randomUUID()

  const { error } = await supabase
    .from('families')
    .insert({ id, name, created_by: userId })

  if (error) throw error
  return { id, name }
}

/** Join a family via invite code. Returns the joined family id. */
export async function joinFamilyWithCode(code: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_family_with_code', {
    _code: code,
  })

  if (error) throw error
  return data
}

/** Generate a new invite code for a family. */
export async function createFamilyInvite(
  familyId: string,
): Promise<FamilyInvite> {
  const { data, error } = await supabase.rpc('create_family_invite', {
    _family_id: familyId,
  })

  if (error) throw error
  return data
}

/** List active (non-deleted) invites for a family, newest first. */
export async function listFamilyInvites(
  familyId: string,
): Promise<FamilyInvite[]> {
  const { data, error } = await supabase
    .from('family_invites')
    .select('*')
    .eq('family_id', familyId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

/** Revoke (soft-delete + deactivate) an invite. */
export async function revokeFamilyInvite(inviteId: string): Promise<void> {
  const { error } = await supabase
    .from('family_invites')
    .update({ is_active: false, deleted_at: new Date().toISOString() })
    .eq('id', inviteId)

  if (error) throw error
}

/** Revoke all active invites for a family. Used before regenerating a code. */
export async function revokeActiveFamilyInvites(
  familyId: string,
): Promise<void> {
  const { error } = await supabase
    .from('family_invites')
    .update({ is_active: false, deleted_at: new Date().toISOString() })
    .eq('family_id', familyId)
    .eq('is_active', true)
    .is('deleted_at', null)

  if (error) throw error
}

/** Change a family member's role. Owner-only by RLS. */
export async function updateFamilyMemberRole(
  memberId: string,
  role: FamilyRole,
): Promise<void> {
  const { error } = await supabase
    .from('family_members')
    .update({ role })
    .eq('id', memberId)

  if (error) throw error
}

/** Soft-remove a family member. Owner-only by RLS, except self-leave flow. */
export async function removeFamilyMember(memberId: string): Promise<void> {
  const { error } = await supabase
    .from('family_members')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', memberId)

  if (error) throw error
}

/** Update the current user's display name inside the family membership row. */
export async function updateOwnFamilyDisplayName(
  familyId: string,
  userId: string,
  displayName: string,
): Promise<void> {
  const { error } = await supabase
    .from('family_members')
    .update({ display_name: displayName })
    .eq('family_id', familyId)
    .eq('user_id', userId)
    .is('deleted_at', null)

  if (error) throw error
}

/**
 * Leave the current family by soft-deleting the user's membership row.
 * (Handy for re-testing onboarding — the user is bounced back to it.)
 */
export async function leaveFamily(
  familyId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from('family_members')
    .update({ deleted_at: new Date().toISOString() })
    .eq('family_id', familyId)
    .eq('user_id', userId)
    .is('deleted_at', null)

  if (error) throw error
}
