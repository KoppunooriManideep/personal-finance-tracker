import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  categoryColors,
  categoryKindMeta,
  defaultCategoryColor,
} from '@/features/categories/config'
import {
  categoryIconNames,
  getCategoryIcon,
  isCategoryIconName,
  type CategoryIconName,
} from '@/features/categories/icons'
import {
  categorySchema,
  type CategoryFormValues,
} from '@/features/categories/schema'
import {
  useCreateCategory,
  useUpdateCategory,
} from '@/features/categories/hooks/use-category-mutations'
import type { Category } from '@/features/categories/api/category-queries'
import type { CategoryKind } from '@/types/database.types'

interface CategoryFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  kind: CategoryKind
  category?: Category | null
}

const defaultIconByKind: Record<CategoryKind, CategoryIconName> = {
  income: 'circle-plus',
  expense: 'shopping-bag',
}

/** Add/Edit category modal backed by React Hook Form + Zod. */
export function CategoryFormDialog({
  open,
  onOpenChange,
  kind,
  category,
}: CategoryFormDialogProps) {
  const isEdit = Boolean(category)
  const createCategory = useCreateCategory()
  const updateCategory = useUpdateCategory()
  const meta = categoryKindMeta[kind]

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
      kind,
      icon: defaultIconByKind[kind],
      color: defaultCategoryColor,
    },
  })

  useEffect(() => {
    if (!open) return
    reset(
      category
        ? {
            name: category.name,
            kind: category.kind,
            icon: isCategoryIconName(category.icon)
              ? category.icon
              : defaultIconByKind[category.kind],
            color: category.color ?? defaultCategoryColor,
          }
        : {
            name: '',
            kind,
            icon: defaultIconByKind[kind],
            color: defaultCategoryColor,
          },
    )
  }, [open, category, kind, reset])

  const isPending = createCategory.isPending || updateCategory.isPending

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (category) {
        await updateCategory.mutateAsync({ id: category.id, values })
        toast.success('Category updated')
      } else {
        await createCategory.mutateAsync(values)
        toast.success('Category added')
      }
      onOpenChange(false)
    } catch (error) {
      toast.error(
        isEdit ? 'Could not update category' : 'Could not add category',
      )
      console.error(error)
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onOpenAutoFocus={(event) => isEdit && event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Edit category' : `Add ${meta.label.toLowerCase()} category`}
          </DialogTitle>
          <DialogDescription>
            Categories are used only for income and expense transactions.
            Transfers are kept separate.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col min-h-0 flex-1 gap-4 overflow-hidden">
          <input type="hidden" {...register('kind')} />
          <div className="flex-1 overflow-y-auto min-h-0 space-y-4 px-6">
            <div className="space-y-1.5">
              <Label htmlFor="category-name">Name</Label>
              <Input
                id="category-name"
                placeholder={kind === 'income' ? 'e.g. Salary' : 'e.g. Groceries'}
                autoComplete="off"
                {...register('name')}
              />
              {errors.name ? (
                <p className="text-destructive text-sm">{errors.name.message}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label>Icon</Label>
              <Controller
                control={control}
                name="icon"
                render={({ field }) => (
                  <div className="grid max-h-44 grid-cols-6 gap-2 overflow-y-auto rounded-md border p-2 sm:grid-cols-8">
                    {categoryIconNames.map((iconName) => {
                      const Icon = getCategoryIcon(iconName)
                      const selected = field.value === iconName
                      return (
                        <button
                          key={iconName}
                          type="button"
                          title={iconName}
                          onClick={() => field.onChange(iconName)}
                          aria-pressed={selected}
                          className={cn(
                            'flex h-9 w-9 items-center justify-center rounded-md border transition-colors',
                            selected
                              ? 'border-primary bg-primary/5 ring-1 ring-primary'
                              : 'hover:bg-accent',
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </button>
                      )
                    })}
                  </div>
                )}
              />
              {errors.icon ? (
                <p className="text-destructive text-sm">{errors.icon.message}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label>Color</Label>
              <Controller
                control={control}
                name="color"
                render={({ field }) => (
                  <div className="space-y-3">
                    <div className="grid grid-cols-10 gap-2">
                      {categoryColors.map((color) => {
                        const selected = field.value === color
                        return (
                          <button
                            key={color}
                            type="button"
                            title={color}
                            onClick={() => field.onChange(color)}
                            aria-pressed={selected}
                            className={cn(
                              'h-8 w-8 rounded-md border transition-transform',
                              selected && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                            )}
                            style={{ backgroundColor: color }}
                          />
                        )
                      })}
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="color"
                        className="h-9 w-12 shrink-0 p-1"
                        value={field.value}
                        onChange={(event) => field.onChange(event.target.value)}
                        aria-label="Custom category color"
                      />
                      <Input
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="#6366f1"
                      />
                    </div>
                  </div>
                )}
              />
              {errors.color ? (
                <p className="text-destructive text-sm">{errors.color.message}</p>
              ) : null}
            </div>
          </div>

          <DialogFooter className="shrink-0 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEdit ? 'Save changes' : 'Add category'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
