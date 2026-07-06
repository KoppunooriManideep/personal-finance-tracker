import { MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { BadgeCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CategoryBadge } from '@/features/categories/components/category-badge'
import type { Category } from '@/features/categories/api/category-queries'

interface CategoryCardProps {
  category: Category
  canManage: boolean
  onEdit: (category: Category) => void
  onDelete: (category: Category) => void
}

/** A single income/expense category tile. Transfers never use categories. */
export function CategoryCard({
  category,
  canManage,
  onEdit,
  onDelete,
}: CategoryCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-2 px-3 md:py-3 md:px-4">
        <CategoryBadge
          name={category.name}
          icon={category.icon}
          color={category.color}
          className="flex-1 border-0 bg-transparent px-0 py-0"
        />

        {category.isDefault ? (
          <span className="text-muted-foreground inline-flex shrink-0 items-center gap-1 text-xs">
            <BadgeCheck className="h-3.5 w-3.5" />
            <span>Default</span>
          </span>
        ) : null}

        {canManage ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="-mr-1 shrink-0 h-9 w-9 md:h-8 md:w-8 flex items-center justify-center"
                aria-label={`Actions for ${category.name}`}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(category)}>
                <Pencil className="h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => onDelete(category)}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </CardContent>
    </Card>
  )
}
