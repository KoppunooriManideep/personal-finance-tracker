import { supabase } from '@/lib/supabase'
import type { Budget } from '@/features/budgets/api/budget-queries'

export interface CreateBudgetInput {
  familyId: string
  userId: string
  categoryId: string
  amountPaise: number
  periodMonth: string
}

export interface UpdateBudgetInput {
  id: string
  categoryId: string
  amountPaise: number
  periodMonth: string
}

/** Create a monthly budget for an expense category. */
export async function createBudget(input: CreateBudgetInput): Promise<Budget> {
  const id = crypto.randomUUID()

  const { error } = await supabase.from('budgets').insert({
    id,
    family_id: input.familyId,
    category_id: input.categoryId,
    amount: input.amountPaise,
    period_month: input.periodMonth,
    created_by: input.userId,
  })

  if (error) throw error

  return {
    id,
    familyId: input.familyId,
    categoryId: input.categoryId,
    amount: input.amountPaise,
    periodMonth: input.periodMonth,
  }
}

/** Update a budget's category, amount and month. */
export async function updateBudget(input: UpdateBudgetInput): Promise<void> {
  const { error } = await supabase
    .from('budgets')
    .update({
      category_id: input.categoryId,
      amount: input.amountPaise,
      period_month: input.periodMonth,
    })
    .eq('id', input.id)

  if (error) throw error
}

/** Soft-delete a budget. */
export async function deleteBudget(id: string): Promise<void> {
  const { error } = await supabase
    .from('budgets')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}
