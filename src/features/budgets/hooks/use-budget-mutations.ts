import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { rupeesToPaise } from '@/lib/money'
import {
  createBudget,
  deleteBudget,
  updateBudget,
} from '@/features/budgets/api/budget-mutations'
import type { BudgetWithSpending } from '@/features/budgets/api/budget-queries'
import { budgetsQueryKey } from '@/features/budgets/hooks/use-budgets'
import { useCurrentFamily } from '@/features/family/hooks/use-current-family'
import type { BudgetFormValues } from '@/features/budgets/schema'

interface MutationContext {
  previous?: BudgetWithSpending[]
}

const byCategory = (a: BudgetWithSpending, b: BudgetWithSpending) =>
  a.categoryId.localeCompare(b.categoryId)

/** Create a budget with an optimistic row in the selected month. */
export function useCreateBudget(selectedMonth: string) {
  const { user } = useAuth()
  const { data: family } = useCurrentFamily()
  const familyId = family?.id
  const queryClient = useQueryClient()
  const key = budgetsQueryKey(familyId, selectedMonth)

  return useMutation<BudgetWithSpending, Error, BudgetFormValues, MutationContext>({
    mutationFn: async (values) => {
      const budget = await createBudget({
        familyId: familyId!,
        userId: user!.id,
        categoryId: values.categoryId,
        amountPaise: rupeesToPaise(values.amount),
        periodMonth: toPeriodMonth(values.periodMonth),
      })
      return { ...budget, spent: 0 }
    },
    onMutate: async (values) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<BudgetWithSpending[]>(key)
      const optimistic: BudgetWithSpending = {
        id: `optimistic-${crypto.randomUUID()}`,
        familyId: familyId!,
        categoryId: values.categoryId,
        amount: rupeesToPaise(values.amount),
        periodMonth: toPeriodMonth(values.periodMonth),
        spent: 0,
      }
      queryClient.setQueryData<BudgetWithSpending[]>(key, (old) =>
        [...(old ?? []), optimistic].sort(byCategory),
      )
      return { previous }
    },
    onError: (_error, _values, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets', familyId] })
    },
  })
}

/** Update a budget, preserving the cached spending amount optimistically. */
export function useUpdateBudget(selectedMonth: string) {
  const { data: family } = useCurrentFamily()
  const familyId = family?.id
  const queryClient = useQueryClient()
  const key = budgetsQueryKey(familyId, selectedMonth)

  return useMutation<
    void,
    Error,
    { id: string; values: BudgetFormValues },
    MutationContext
  >({
    mutationFn: ({ id, values }) =>
      updateBudget({
        id,
        categoryId: values.categoryId,
        amountPaise: rupeesToPaise(values.amount),
        periodMonth: toPeriodMonth(values.periodMonth),
      }),
    onMutate: async ({ id, values }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<BudgetWithSpending[]>(key)
      queryClient.setQueryData<BudgetWithSpending[]>(key, (old) =>
        (old ?? [])
          .map((budget) =>
            budget.id === id
              ? {
                  ...budget,
                  categoryId: values.categoryId,
                  amount: rupeesToPaise(values.amount),
                  periodMonth: toPeriodMonth(values.periodMonth),
                }
              : budget,
          )
          .sort(byCategory),
      )
      return { previous }
    },
    onError: (_error, _values, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets', familyId] })
    },
  })
}

/** Soft-delete a budget with optimistic removal. */
export function useDeleteBudget(selectedMonth: string) {
  const { data: family } = useCurrentFamily()
  const familyId = family?.id
  const queryClient = useQueryClient()
  const key = budgetsQueryKey(familyId, selectedMonth)

  return useMutation<void, Error, string, MutationContext>({
    mutationFn: (id) => deleteBudget(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<BudgetWithSpending[]>(key)
      queryClient.setQueryData<BudgetWithSpending[]>(key, (old) =>
        (old ?? []).filter((budget) => budget.id !== id),
      )
      return { previous }
    },
    onError: (_error, _id, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets', familyId] })
    },
  })
}

function toPeriodMonth(selectedMonth: string): string {
  return `${selectedMonth}-01`
}
