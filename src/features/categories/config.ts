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
  // greens
  '#4ade80', '#22c55e', '#16a34a',
  // emerald / teal
  '#10b981', '#2dd4bf', '#14b8a6', '#0f766e',
  // cyan
  '#22d3ee', '#06b6d4',
  // sky
  '#38bdf8', '#0ea5e9', '#0284c7',
  // blue
  '#60a5fa', '#3b82f6', '#2563eb',
  // indigo
  '#818cf8', '#6366f1', '#4f46e5',
  // violet
  '#a78bfa', '#8b5cf6', '#7c3aed',
  // purple / fuchsia
  '#c084fc', '#a855f7', '#d946ef', '#e879f9',
  // pink
  '#f472b6', '#ec4899', '#be185d',
  // rose
  '#fb7185', '#f43f5e', '#e11d48',
  // red
  '#f87171', '#ef4444', '#dc2626',
  // orange
  '#fb923c', '#f97316', '#ea580c',
  // amber / yellow
  '#fbbf24', '#f59e0b', '#d97706', '#facc15', '#eab308',
  // lime
  '#a3e635', '#84cc16',
  // browns / neutrals
  '#a16207', '#78716c', '#94a3b8', '#64748b', '#475569', '#6b7280',
] as const

/** Default colour applied to a new category before the user picks one. */
export const defaultCategoryColor = '#6366f1'
