import { z } from 'zod'

/** Monthly budget form. Amount is entered in rupees and stored as paise. */
export const budgetSchema = z.object({
  categoryId: z.string().min(1, 'Pick an expense category'),
  amount: z
    .number({ message: 'Enter a budget amount' })
    .nonnegative('Budget cannot be negative'),
  periodMonth: z.string().regex(/^\d{4}-\d{2}$/, 'Pick a month'),
})

export type BudgetFormValues = z.infer<typeof budgetSchema>
