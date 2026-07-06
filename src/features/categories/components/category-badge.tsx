import { createElement } from 'react'
import { cn } from '@/lib/utils'
import { getCategoryIcon } from '@/features/categories/icons'

interface CategoryBadgeProps {
  name: string
  icon?: string | null
  color?: string | null
  className?: string
}

/** Compact category identity chip used by lists, forms and future reports. */
export function CategoryBadge({
  name,
  icon,
  color,
  className,
}: CategoryBadgeProps) {
  const swatch = color ?? '#64748b'

  return (
    <span
      className={cn(
        'inline-flex min-w-0 items-center gap-2 rounded-md border bg-background px-2.5 py-1.5 text-sm',
        className,
      )}
    >
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-white"
        style={{ backgroundColor: swatch }}
      >
        {createElement(getCategoryIcon(icon), { className: 'h-3.5 w-3.5' })}
      </span>
      <span className="truncate font-medium">{name}</span>
    </span>
  )
}
