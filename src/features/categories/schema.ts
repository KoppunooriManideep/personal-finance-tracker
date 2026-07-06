import { z } from 'zod'
import { categoryKinds } from '@/features/categories/config'
import { categoryIconNames } from '@/features/categories/icons'

/**
 * Validation for the add/edit category form. `kind` is fixed by the active tab
 * (income vs expense) and is not user-editable after creation.
 */
export const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Please enter a category name')
    .max(60, 'Name is too long'),
  kind: z.enum(categoryKinds),
  icon: z.enum(categoryIconNames as [string, ...string[]], {
    message: 'Pick an icon',
  }),
  color: z
    .string()
    .regex(/^#([0-9a-fA-F]{6})$/, 'Pick a colour'),
})

export type CategoryFormValues = z.infer<typeof categorySchema>
