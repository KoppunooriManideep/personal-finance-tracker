import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  createCategory,
  deleteCategory,
  updateCategory,
} from '@/features/categories/api/category-mutations'
import type { Category } from '@/features/categories/api/category-queries'
import { categoriesQueryKey } from '@/features/categories/hooks/use-categories'
import { useCurrentFamily } from '@/features/family/hooks/use-current-family'
import type { CategoryFormValues } from '@/features/categories/schema'

const byName = (a: Category, b: Category) => a.name.localeCompare(b.name)

interface MutationContext {
  previous?: Category[]
}

/** Create a category with an optimistic insert into the cached list. */
export function useCreateCategory() {
  const { data: family } = useCurrentFamily()
  const familyId = family?.id
  const queryClient = useQueryClient()
  const key = categoriesQueryKey(familyId)

  return useMutation<Category, Error, CategoryFormValues, MutationContext>({
    mutationFn: (values) =>
      createCategory({
        familyId: familyId!,
        name: values.name,
        kind: values.kind,
        icon: values.icon,
        color: values.color,
      }),
    onMutate: async (values) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Category[]>(key)
      const optimistic: Category = {
        id: `optimistic-${crypto.randomUUID()}`,
        name: values.name,
        kind: values.kind,
        icon: values.icon,
        color: values.color,
        isDefault: false,
      }
      queryClient.setQueryData<Category[]>(key, (old) =>
        [...(old ?? []), optimistic].sort(byName),
      )
      return { previous }
    },
    onError: (_error, _values, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key })
    },
  })
}

/** Update a category, optimistically patching the cached row. */
export function useUpdateCategory() {
  const { data: family } = useCurrentFamily()
  const familyId = family?.id
  const queryClient = useQueryClient()
  const key = categoriesQueryKey(familyId)

  return useMutation<
    void,
    Error,
    { id: string; values: CategoryFormValues },
    MutationContext
  >({
    mutationFn: ({ id, values }) =>
      updateCategory({
        id,
        name: values.name,
        icon: values.icon,
        color: values.color,
      }),
    onMutate: async ({ id, values }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Category[]>(key)
      queryClient.setQueryData<Category[]>(key, (old) =>
        (old ?? [])
          .map((category) =>
            category.id === id
              ? {
                  ...category,
                  name: values.name,
                  icon: values.icon,
                  color: values.color,
                }
              : category,
          )
          .sort(byName),
      )
      return { previous }
    },
    onError: (_error, _values, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key })
    },
  })
}

/** Soft-delete a category, optimistically removing it from the cached list. */
export function useDeleteCategory() {
  const { data: family } = useCurrentFamily()
  const familyId = family?.id
  const queryClient = useQueryClient()
  const key = categoriesQueryKey(familyId)

  return useMutation<void, Error, string, MutationContext>({
    mutationFn: (id) => deleteCategory(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Category[]>(key)
      queryClient.setQueryData<Category[]>(key, (old) =>
        (old ?? []).filter((category) => category.id !== id),
      )
      return { previous }
    },
    onError: (_error, _id, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key })
    },
  })
}
