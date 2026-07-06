import { z } from 'zod'

export const createFamilySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Please enter a family name')
    .max(100, 'Name is too long'),
})

export const joinFamilySchema = z.object({
  code: z
    .string()
    .trim()
    .min(4, 'Enter a valid invite code')
    .max(20, 'Invite code is too long'),
})

export type CreateFamilyValues = z.infer<typeof createFamilySchema>
export type JoinFamilyValues = z.infer<typeof joinFamilySchema>
