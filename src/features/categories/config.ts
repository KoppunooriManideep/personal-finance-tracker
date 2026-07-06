import { ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { CategoryKind } from '@/types/database.types'

/** The two category kinds. Transfers never use categories. */
export const categoryKinds = ['income', 'expense'] as const satisfies readonly CategoryKind[]

interface CategoryKindMeta {
  label: string
  /** Plural label for tabs/headers. */
  pluralLabel: string
  icon: LucideIcon
  /** Tailwind classes for the tab accent. */
  accentClassName: string
}

/** Presentation metadata for each category kind. */
export const categoryKindMeta: Record<CategoryKind, CategoryKindMeta> = {
  income: {
    label: 'Income',
    pluralLabel: 'Income categories',
    icon: ArrowUpCircle,
    accentClassName: 'text-emerald-600 dark:text-emerald-400',
  },
  expense: {
    label: 'Expense',
    pluralLabel: 'Expense categories',
    icon: ArrowDownCircle,
    accentClassName: 'text-rose-600 dark:text-rose-400',
  },
}

/**
 * Curated colour palette offered in the picker. Values are hex strings stored
 * verbatim in `categories.color`. Grouped roughly green→blue→purple→pink→grey.
 */
export const categoryColors = [
  '#22c55e',
  '#16a34a',
  '#10b981',
  '#14b8a6',
  '#06b6d4',
  '#0ea5e9',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#a855f7',
  '#d946ef',
  '#ec4899',
  '#f43f5e',
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#eab308',
  '#84cc16',
  '#64748b',
  '#6b7280',
] as const

/** Default colour applied to a new category before the user picks one. */
export const defaultCategoryColor = '#6366f1'
