import { z } from 'zod'

export const transactionTypes = ['income', 'expense', 'transfer'] as const

/** Form validation for all three transaction shapes. */
export const transactionSchema = z
  .object({
    type: z.enum(transactionTypes),
    amount: z
      .number({ message: 'Enter an amount' })
      .positive('Amount must be greater than zero'),
    occurredOn: z.string().min(1, 'Pick a date'),
    note: z.string().trim().max(200, 'Note is too long').optional(),
    accountId: z.string().optional(),
    categoryId: z.string().optional(),
    fromAccountId: z.string().optional(),
    toAccountId: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.type === 'transfer') {
      if (!values.fromAccountId) {
        ctx.addIssue({
          code: 'custom',
          path: ['fromAccountId'],
          message: 'Pick the source account',
        })
      }
      if (!values.toAccountId) {
        ctx.addIssue({
          code: 'custom',
          path: ['toAccountId'],
          message: 'Pick the destination account',
        })
      }
      if (
        values.fromAccountId &&
        values.toAccountId &&
        values.fromAccountId === values.toAccountId
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['toAccountId'],
          message: 'Choose a different account',
        })
      }
      if (values.categoryId) {
        ctx.addIssue({
          code: 'custom',
          path: ['categoryId'],
          message: 'Transfers do not use categories',
        })
      }
      return
    }

    if (!values.accountId) {
      ctx.addIssue({
        code: 'custom',
        path: ['accountId'],
        message: 'Pick an account',
      })
    }
    if (!values.categoryId) {
      ctx.addIssue({
        code: 'custom',
        path: ['categoryId'],
        message: 'Pick a category',
      })
    }
    if (values.fromAccountId || values.toAccountId) {
      ctx.addIssue({
        code: 'custom',
        path: ['fromAccountId'],
        message: 'Income and expenses do not use transfer accounts',
      })
    }
  })

export type TransactionFormValues = z.infer<typeof transactionSchema>

export const transactionFilterSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  accountId: z.string().optional(),
  categoryId: z.string().optional(),
  memberId: z.string().optional(),
  type: z.enum(transactionTypes).optional(),
  search: z.string().optional(),
})

export type TransactionFilters = z.infer<typeof transactionFilterSchema>
