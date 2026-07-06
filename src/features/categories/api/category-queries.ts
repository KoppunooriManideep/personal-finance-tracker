import { supabase } from '@/lib/supabase'
import type { CategoryKind } from '@/types/database.types'

/** A single category as used throughout the UI. */
export interface Category {
  id: string
  name: string
  kind: CategoryKind
  /** Stored lucide icon name (kebab-case); may be null for legacy rows. */
  icon: string | null
  /** Hex colour string, e.g. `#22c55e`; may be null for legacy rows. */
  color: string | null
  /** True for the seeded Indian defaults. */
  isDefault: boolean
}

/**
 * Fetch all (non-deleted) categories for a family, ordered by kind then name.
 * Both income and expense categories are returned; callers split by `kind`.
 */
export async function fetchCategories(
  familyId: string,
): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, kind, icon, color, is_default')
    .eq('family_id', familyId)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind,
    icon: row.icon,
    color: row.color,
    isDefault: row.is_default,
  }))
}
