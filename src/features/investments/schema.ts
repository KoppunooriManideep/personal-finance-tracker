import { z } from 'zod'

/**
 * Validation for the add/edit gold form. Money is captured in rupees and weight
 * in grams (what the user types); both are converted to integer paise / integer
 * milligrams before hitting the database. `purchaseDate` is a `YYYY-MM-DD`.
 */
const optionalMoney = z
  .number()
  .nonnegative('Cannot be negative')
  .optional()

export const goldSchema = z.object({
  form: z.enum(['coin', 'bar', 'jewellery']),
  fineness: z
    .number({ message: 'Select a purity' })
    .int()
    .min(1)
    .max(1000),
  name: z.string().trim().max(100, 'Name is too long').optional(),
  weightGrams: z
    .number({ message: 'Enter the weight' })
    .refine(Number.isFinite, 'Enter the weight')
    .positive('Weight must be greater than 0'),
  quantity: z
    .number({ message: 'Enter the quantity' })
    .refine(Number.isFinite, 'Enter the quantity')
    .int('Quantity must be a whole number')
    .min(1, 'At least 1'),
  purchaseDate: z.string().min(1, 'Select a purchase date'),
  priceTotal: z
    .number({ message: 'Enter the price' })
    .refine(Number.isFinite, 'Enter the price')
    .nonnegative('Price cannot be negative'),
  // Optional rewards.
  cashback: optionalMoney,
  rewardValue: optionalMoney,
  voucherSavings: optionalMoney,
  // Jewellery cost breakdown (optional; part of the total price).
  makingCharges: optionalMoney,
  va: optionalMoney,
  stoneCharges: optionalMoney,
  gstPercent: z
    .number()
    .min(0, 'Cannot be negative')
    .max(100, 'Too high')
    .optional(),
  discount: optionalMoney,
  // Store / provenance (optional).
  website: z.string().trim().max(100, 'Too long').optional(),
  brand: z.string().trim().max(100, 'Too long').optional(),
  tags: z.string().trim().max(300, 'Too many tags').optional(),
  ownerId: z.string().uuid().nullable(),
  notes: z.string().trim().max(500, 'Notes are too long').optional(),
})

export type GoldFormValues = z.infer<typeof goldSchema>
