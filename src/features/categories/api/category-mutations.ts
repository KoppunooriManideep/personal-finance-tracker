import { supabase } from '@/lib/supabase'
import type { CategoryKind } from '@/types/database.types'
import type { Category } from '@/features/categories/api/category-queries'

export interface CreateCategoryInput {
  familyId: string
  name: string
  kind: CategoryKind
  icon: string
  color: string
}

export interface UpdateCategoryInput {
  id: string
  name: string
  icon: string
  color: string
}

/**
 * Create a category. The id is generated client-side so we don't need a
 * `.select()` read-back (which would run under the categories SELECT RLS
 * policy before it can be observed).
 */
export async function createCategory(
  input: CreateCategoryInput,
): Promise<Category> {
  const id = crypto.randomUUID()

  const { error } = await supabase.from('categories').insert({
    id,
    family_id: input.familyId,
    name: input.name,
    kind: input.kind,
    icon: input.icon,
    color: input.color,
    is_default: false,
  })

  if (error) throw error

  return {
    id,
    name: input.name,
    kind: input.kind,
    icon: input.icon,
    color: input.color,
    isDefault: false,
  }
}

/** Update a category's name, icon and colour. Kind is immutable. */
export async function updateCategory(
  input: UpdateCategoryInput,
): Promise<void> {
  const { error } = await supabase
    .from('categories')
    .update({
      name: input.name,
      icon: input.icon,
      color: input.color,
    })
    .eq('id', input.id)

  if (error) throw error
}

/** Soft-delete a category (sets `deleted_at`; queries then hide it). */
export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase
    .from('categories')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}
