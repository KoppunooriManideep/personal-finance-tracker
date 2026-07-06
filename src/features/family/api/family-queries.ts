import { supabase } from '@/lib/supabase'
import type { FamilyRole } from '@/types/database.types'

export interface CurrentFamily {
  id: string
  name: string
  role: FamilyRole
}

export interface FamilyMember {
  id: string
  familyId: string
  userId: string
  role: FamilyRole
  displayName: string | null
  profile: {
    fullName: string | null
    avatarUrl: string | null
  } | null
  createdAt: string
}

type FamilyMemberRow = {
  id: string
  family_id: string
  user_id: string
  role: FamilyRole
  display_name: string | null
  created_at: string
}

type ProfileRow = {
  id: string
  full_name: string | null
  avatar_url: string | null
}

/**
 * Resolve the family the given user belongs to (Phase 1 assumes one family per
 * user — the earliest membership wins). Returns null when the user has not yet
 * created or joined a family (i.e. needs onboarding).
 */
export async function fetchCurrentFamily(
  userId: string,
): Promise<CurrentFamily | null> {
  const { data: membership, error } = await supabase
    .from('family_members')
    .select('family_id, role')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!membership) return null

  const { data: family, error: familyError } = await supabase
    .from('families')
    .select('id, name')
    .eq('id', membership.family_id)
    .is('deleted_at', null)
    .maybeSingle()

  if (familyError) throw familyError
  if (!family) return null

  return { id: family.id, name: family.name, role: membership.role }
}

/** List active members for a family, including shared profile metadata. */
export async function fetchFamilyMembers(
  familyId: string,
): Promise<FamilyMember[]> {
  const { data, error } = await supabase
    .from('family_members')
    .select('id, family_id, user_id, role, display_name, created_at')
    .eq('family_id', familyId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  if (error) throw error

  const rows = (data ?? []) as FamilyMemberRow[]
  const userIds = rows.map((row) => row.user_id)
  const profilesById = new Map<string, ProfileRow>()

  if (userIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', userIds)

    if (profilesError) throw profilesError

    ;((profiles ?? []) as ProfileRow[]).forEach((profile) => {
      profilesById.set(profile.id, profile)
    })
  }

  return rows.map((row) => {
    const profile = profilesById.get(row.user_id)
    return {
    id: row.id,
    familyId: row.family_id,
    userId: row.user_id,
    role: row.role,
    displayName: row.display_name,
      profile: profile
      ? {
            fullName: profile.full_name,
            avatarUrl: profile.avatar_url,
        }
      : null,
    createdAt: row.created_at,
    }
  })
}
