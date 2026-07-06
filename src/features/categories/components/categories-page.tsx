import { useMemo, useState } from 'react'
import { Plus, Tags } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState } from '@/components/common/empty-state'
import { ErrorState } from '@/components/common/error-state'
import { LoadingSpinner } from '@/components/common/loading-spinner'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useCurrentFamily } from '@/features/family/hooks/use-current-family'
import { useCategories } from '@/features/categories/hooks/use-categories'
import { useDeleteCategory } from '@/features/categories/hooks/use-category-mutations'
import {
  categoryKindMeta,
  categoryKinds,
} from '@/features/categories/config'
import { CategoryCard } from '@/features/categories/components/category-card'
import { CategoryFormDialog } from '@/features/categories/components/category-form-dialog'
import type { Category } from '@/features/categories/api/category-queries'
import type { CategoryKind } from '@/types/database.types'

/** Categories list split into income and expense. Transfers do not use them. */
export function CategoriesPage() {
  const { data: family } = useCurrentFamily()
  const canManage = family?.role === 'owner' || family?.role === 'member'

  const { data: categories, isLoading, isError, refetch } = useCategories()
  const deleteCategory = useDeleteCategory()

  const [activeKind, setActiveKind] = useState<CategoryKind>('expense')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [toDelete, setToDelete] = useState<Category | null>(null)

  const categoriesByKind = useMemo(
    () => ({
      income: (categories ?? []).filter((category) => category.kind === 'income'),
      expense: (categories ?? []).filter((category) => category.kind === 'expense'),
    }),
    [categories],
  )

  const activeCategories = categoriesByKind[activeKind]

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (category: Category) => {
    setActiveKind(category.kind)
    setEditing(category)
    setFormOpen(true)
  }

  const handleDelete = async () => {
    if (!toDelete) return
    try {
      await deleteCategory.mutateAsync(toDelete.id)
      toast.success('Category deleted')
    } catch (error) {
      toast.error('Could not delete category')
      console.error(error)
    } finally {
      setToDelete(null)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Categories"
        description="Manage income and expense categories. Transfers are not categorized."
        actions={
          canManage ? (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add category
            </Button>
          ) : undefined
        }
      />

      {isLoading ? (
        <LoadingSpinner />
      ) : isError ? (
        <ErrorState
          description="We could not load your categories."
          onRetry={() => refetch()}
        />
      ) : !categories || categories.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="No categories yet"
          description="Add income and expense categories to organize your transactions."
          action={
            canManage ? (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Add category
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          <Card>
            <CardContent className="grid gap-2 p-2 sm:grid-cols-2">
              {categoryKinds.map((kind) => {
                const meta = categoryKindMeta[kind]
                const Icon = meta.icon
                const selected = activeKind === kind
                return (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => setActiveKind(kind)}
                    aria-pressed={selected}
                    className={cn(
                      'flex items-center justify-between rounded-md px-3 py-2.5 text-left transition-colors',
                      selected ? 'bg-accent' : 'hover:bg-accent/60',
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Icon className={cn('h-4 w-4', meta.accentClassName)} />
                      <span className="truncate font-medium">
                        {meta.pluralLabel}
                      </span>
                    </span>
                    <span className="text-muted-foreground text-sm tabular-nums">
                      {categoriesByKind[kind].length}
                    </span>
                  </button>
                )
              })}
            </CardContent>
          </Card>

          {activeCategories.length === 0 ? (
            <EmptyState
              icon={categoryKindMeta[activeKind].icon}
              title={`No ${activeKind} categories`}
              description={`Add ${activeKind} categories for transaction reporting.`}
              action={
                canManage ? (
                  <Button onClick={openCreate}>
                    <Plus className="h-4 w-4" />
                    Add category
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {activeCategories.map((category) => (
                <CategoryCard
                  key={category.id}
                  category={category}
                  canManage={canManage}
                  onEdit={openEdit}
                  onDelete={setToDelete}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <CategoryFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        kind={editing?.kind ?? activeKind}
        category={editing}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Delete category?"
        description={
          toDelete
            ? `"${toDelete.name}" will be removed. Existing transactions will keep their history, but this category will no longer be available for new entries.`
            : undefined
        }
        confirmLabel="Delete"
        destructive
        loading={deleteCategory.isPending}
        onConfirm={handleDelete}
      />
    </div>
  )
}
