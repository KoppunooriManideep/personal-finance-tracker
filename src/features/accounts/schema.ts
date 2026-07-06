import { z } from 'zod'
import { accountTypes } from '@/features/accounts/config'

/**
 * Validation for the add/edit account form. `openingBalance` is captured in
 * rupees (what the user types) and converted to integer paise before it hits
 * the database.
 */
export const accountSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Please enter an account name')
    .max(60, 'Name is too long'),
  type: z.enum(accountTypes, { message: 'Select an account type' }),
  ownerId: z.string().uuid().nullable(),
  openingBalance: z
    .number({ message: 'Enter a valid amount' })
    .refine(Number.isFinite, 'Enter a valid amount'),
})

export type AccountFormValues = z.infer<typeof accountSchema>
