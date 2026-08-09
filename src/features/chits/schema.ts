import { z } from 'zod'

/**
 * Validation for the add/edit chit form. `chitValue` is captured in rupees
 * (what the user types) and converted to integer paise before it hits the
 * database. `startDate` comes from a native date input as `YYYY-MM-DD`.
 */
export const chitSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Please enter a chit name')
    .max(100, 'Name is too long'),
  chitValue: z
    .number({ message: 'Enter the chit value' })
    .refine(Number.isFinite, 'Enter the chit value')
    .positive('Chit value must be greater than 0'),
  tenureMonths: z
    .number({ message: 'Enter the tenure' })
    .refine(Number.isFinite, 'Enter the tenure')
    .int('Tenure must be a whole number of months')
    .min(1, 'Tenure must be at least 1 month')
    .max(600, 'Tenure looks too long'),
  baseMonthly: z
    .number({ message: 'Enter the base EMI' })
    .refine(Number.isFinite, 'Enter the base EMI')
    .positive('Base EMI must be greater than 0'),
  startDate: z.string().min(1, 'Select a start date'),
  ownerId: z.string().uuid().nullable(),
  organizer: z.string().trim().max(100, 'Organizer name is too long').optional(),
  notes: z.string().trim().max(500, 'Notes are too long').optional(),
})

export type ChitFormValues = z.infer<typeof chitSchema>
